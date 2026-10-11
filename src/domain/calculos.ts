/* Regras de negócio: comissão, metas, DRE, ponto, clientes sumidos.
 *
 * Regra do fiado: lançamento fiado ainda não pago NÃO entra em faturamento, comissão nem bônus
 * (calc / dre usam só `pago`). Ele conta nas METAS de atendimento e produtos (lancStats),
 * porque o barbeiro fez o serviço. Quando o fiado é pago, entra no faturamento na data do pagamento.
 */

import { DIA, ddmm, diaKey, diasNoMes, hhmm, hora, inicioDia, inicioSemana, mesmoDia, minutosDe, mkOf, rangeMes, somarDias } from "./datas.ts";
import { brl, capitalizar, primeiroNome } from "./formato.ts";
import { nivelDe } from "./usuarios.ts";

export const CORTES = ["corte", "combo"]; // serviços que contam como "corte"

/** Data efetiva do lançamento: fiado conta quando é pago. */
export const dt = (l) => l.pagoEm || l.ts;

export function fatServMes(u, todas, mk) {
  let n = 0;
  for (const l of todas) {
    if (l.barbeiroId !== u.id || !l.pago || mkOf(dt(l)) !== mk) continue;
    for (const i of l.itens) if (i.tipo === "servico") n += i.preco * i.qtd;
  }
  return n;
}

export function taxaMes(u, todas, mk) {
  if (u.role === "admin") return 0;
  const niv = nivelDe(u, fatServMes(u, todas, mk));
  return niv ? niv.atual.comissao / 100 : 0.5;
}

export function riscoVermelho(u, todas, ref = Date.now()) {
  const mkAtual = mkOf(ref);
  const ant = mkOf(rangeMes(mkAtual)[0] - DIA);
  const nivAnt = nivelDe(u, fatServMes(u, todas, ant));
  const temMovAnt = todas.some((l) => l.barbeiroId === u.id && mkOf(dt(l)) === ant);
  const vermAnt = !!nivAnt && temMovAnt && nivAnt.idx === 0;
  const dia = new Date(ref).getDate();
  const cedo = dia < 7;
  const proj = (fatServMes(u, todas, mkAtual) / Math.max(1, dia)) * diasNoMes(mkAtual);
  const nivAt = nivelDe(u, proj);
  const vermAt = !cedo && !!nivAt && nivAt.idx === 0;
  return { vermAnt, vermAt, cedo, doisSeguidos: vermAnt && vermAt, proj };
}

/* ---------- metas de atendimento e de produtos (contam fiado, pela data do atendimento) ---------- */
export function lancStats(u, todas, ini, fim) {
  let clientes = 0;
  let cortes = 0;
  let prod = 0;
  let prodQtd = 0;
  let fat = 0;
  for (const l of todas) {
    if (l.barbeiroId !== u.id || l.ts < ini || l.ts >= fim) continue;
    let temServ = false;
    for (const i of l.itens) {
      const v = i.preco * i.qtd;
      fat += v;
      if (i.tipo === "servico") {
        temServ = true;
        if (CORTES.includes(i.id)) cortes += i.qtd;
      } else {
        prod += v;
        prodQtd += i.qtd;
      }
    }
    if (temServ) clientes++;
  }
  return { clientes, cortes, prod, prodQtd, fat };
}

export function metasProgresso(u, todas, ref = Date.now()) {
  const si = inicioSemana(ref);
  const [mi, mf] = rangeMes(mkOf(ref));
  const s = lancStats(u, todas, si, somarDias(si, 7));
  const m = lancStats(u, todas, mi, mf);
  return {
    semana: { ...s, metaCli: u.metaAtendSemana || 0, metaProd: u.metaProdSemana || 0 },
    mes: { ...m, metaCli: u.metaAtendMes || 0, metaProd: u.metaProdMes || 0 },
  };
}

/** Missões do dia: só contam vendas pagas (é bônus). Fiado pendente aparece separado. */
export function progressoMissoes(u, todas, config, ref = Date.now()) {
  const hoje = diaKey(ref);
  return (config.missoes || []).map((m) => {
    let n = 0;
    let fiado = 0;
    for (const l of todas) {
      if (l.barbeiroId !== u.id) continue;
      const qtd = l.itens.filter((i) => i.id === m.itemId).reduce((a, i) => a + i.qtd, 0);
      if (!qtd) continue;
      if (l.pago && diaKey(dt(l)) === hoje) n += qtd;
      else if (!l.pago && diaKey(l.ts) === hoje) fiado += qtd;
    }
    return { ...m, n, fiado };
  });
}

/* ---------- contas fixas e avisos de vencimento ---------- */
export function contasAlertas(config, ref = Date.now()) {
  const mk = mkOf(ref);
  const d = new Date(ref).getDate();
  const dm = diasNoMes(mk);
  const pagas = config.contasPagas?.[mk] || [];
  return (config.contas || []).map((c) => {
    const dia = Math.round(Number(c.dia) || 0);
    const paga = pagas.includes(c.id);
    if (!dia) return { c, semData: true, paga, status: paga ? "paga" : "semdata" };
    const diaV = Math.min(dia, dm);
    const falta = diaV - d;
    let status = "ok";
    if (paga) status = "paga";
    else if (falta < 0) status = "atrasada";
    else if (falta === 0) status = "hoje";
    else if (falta <= 2) status = "breve";
    return { c, semData: false, paga, falta, diaV, status };
  });
}

/* ---------- comissão / métricas (só lançamentos pagos) ---------- */
export interface ResumoCalc {
  cortes: number;
  atend: number;
  clientes: number;
  fatServ: number;
  fatProd: number;
  custoProd: number;
  lucroProd: number;
  comServ: number;
  comProd: number;
  gorjeta: number;
  bonusBebida: number;
  bonusMissoes: number;
  bonusTier: number;
  lancs: any[];
  porDia: Record<string, { fat: number; atend: number }>;
  bebidas: number;
  fat: number;
  comissao: number;
  ticket: number;
  casa: number;
}

export function calc(u, todas, config, ini, fim): ResumoCalc {
  const cache = {};
  const taxa = (mk) => {
    if (cache[mk] === undefined) cache[mk] = taxaMes(u, todas, mk);
    return cache[mk];
  };
  const mb = config.metaBebida;
  const pProd = (config.comissaoProduto ?? 30) / 100;
  const r: ResumoCalc = {
    fat: 0,
    comissao: 0,
    ticket: 0,
    casa: 0,
    cortes: 0,
    atend: 0,
    clientes: 0,
    fatServ: 0,
    fatProd: 0,
    custoProd: 0,
    lucroProd: 0,
    comServ: 0,
    comProd: 0,
    gorjeta: 0,
    bonusBebida: 0,
    bonusMissoes: 0,
    bonusTier: 0,
    lancs: [],
    porDia: {},
    bebidas: 0,
  };
  const meus = todas.filter((l) => l.barbeiroId === u.id && l.pago).sort((a, b) => dt(a) - dt(b));
  const cnt = {};
  const run = {};
  const bPago = {};
  for (const l of meus) {
    const d = dt(l);
    const mk = mkOf(d);
    let bebidaAqui = 0;
    let servAqui = 0;
    let temServ = false;
    for (const i of l.itens) {
      if (i.tipo === "produto" && mb && i.id === mb.produtoId) bebidaAqui += i.qtd;
      if (i.tipo === "servico") {
        servAqui += i.preco * i.qtd;
        temServ = true;
      }
    }
    const antes = cnt[mk] || 0;
    cnt[mk] = antes + bebidaAqui;
    const bonusAqui = mb && u.role !== "admin" && antes < mb.qtd && cnt[mk] >= mb.qtd ? mb.bonus : 0;
    run[mk] = (run[mk] || 0) + servAqui;
    let bonusT = 0;
    if (u.role !== "admin") {
      const niv = nivelDe(u, run[mk]);
      const b = niv ? niv.atual.bonus || 0 : 0;
      if (b > (bPago[mk] || 0)) {
        bonusT = b - (bPago[mk] || 0);
        bPago[mk] = b;
      }
    }
    if (d < ini || d >= fim) continue;
    r.lancs.push(l);
    r.atend++;
    if (temServ) r.clientes++;
    r.gorjeta += l.gorjeta || 0;
    r.bonusBebida += bonusAqui;
    r.bonusTier += bonusT;
    r.bebidas += bebidaAqui;
    const k = diaKey(d);
    r.porDia[k] = r.porDia[k] || { fat: 0, atend: 0 };
    const dia = r.porDia[k];
    dia.atend++;
    for (const i of l.itens) {
      const v = i.preco * i.qtd;
      dia.fat += v;
      if (i.tipo === "servico") {
        r.fatServ += v;
        r.comServ += v * taxa(mk);
        if (CORTES.includes(i.id)) r.cortes += i.qtd;
      } else {
        const lp = (i.preco - i.custo) * i.qtd;
        r.fatProd += v;
        r.custoProd += i.custo * i.qtd;
        r.lucroProd += lp;
        r.comProd += u.role === "admin" ? 0 : pProd * lp;
      }
    }
  }
  if (u.role !== "admin") {
    const porDiaItens = {};
    for (const l of r.lancs) {
      const k = diaKey(dt(l));
      porDiaItens[k] = porDiaItens[k] || {};
      for (const i of l.itens) porDiaItens[k][i.id] = (porDiaItens[k][i.id] || 0) + i.qtd;
    }
    for (const k of Object.keys(porDiaItens)) for (const m of config.missoes || []) if ((porDiaItens[k][m.itemId] || 0) >= m.alvo) r.bonusMissoes += m.bonus;
  }
  r.fat = r.fatServ + r.fatProd;
  r.comissao = r.comServ + r.comProd + r.bonusBebida + r.bonusMissoes + r.bonusTier;
  r.ticket = r.atend ? r.fat / r.atend : 0;
  r.casa = r.fat - r.custoProd - r.comissao;
  return r;
}

/** Pontos do gráfico: por dia (até 62 dias) ou por mês. */
export function serieDe(c, ini, fim, agora = Date.now()) {
  const out = [];
  const ponto = (fat, atend) => ({ fat: +fat.toFixed(2), atend, ticket: atend ? +(fat / atend).toFixed(2) : null });
  const dias = [];
  for (let t = ini; t < fim && t <= agora; t = somarDias(t, 1)) dias.push(t);
  if (Math.round((fim - ini) / DIA) <= 62) {
    for (const t of dias) {
      const d = c.porDia[diaKey(t)];
      out.push({ rot: ddmm(t), ...ponto(d ? d.fat : 0, d ? d.atend : 0) });
    }
    return out;
  }
  const grupos = {};
  for (const t of dias) {
    const k = mkOf(t);
    grupos[k] = grupos[k] || { fat: 0, atend: 0 };
    const d = c.porDia[diaKey(t)];
    if (d) {
      grupos[k].fat += d.fat;
      grupos[k].atend += d.atend;
    }
  }
  for (const k of Object.keys(grupos).sort()) out.push({ rot: `${k.slice(5)}/${k.slice(2, 4)}`, ...ponto(grupos[k].fat, grupos[k].atend) });
  return out;
}

/** Custo fixo proporcional aos dias do período (mês cheio = custo fixo mensal). */
export function fixoNoPeriodo(config, ini, fim) {
  let total = 0;
  let t = ini;
  while (t < fim) {
    const mk = mkOf(t);
    const mf = rangeMes(mk)[1];
    const ate = Math.min(fim, mf);
    total += (config.custoFixo * Math.round((ate - t) / DIA)) / diasNoMes(mk);
    t = ate;
  }
  return total;
}

export function dreRange(users, todas, config, ini, fim) {
  const porUser = users.map((u) => ({ u, c: calc(u, todas, config, ini, fim) }));
  const soma = (f) => porUser.reduce((a, x) => a + f(x.c), 0);
  const fat = soma((c) => c.fat);
  const comissoes = soma((c) => c.comissao);
  const custoProd = soma((c) => c.custoProd);
  let cartao = 0;
  for (const l of todas) {
    if (!l.pago) continue;
    const d = dt(l);
    if (d < ini || d >= fim) continue;
    for (const p of l.pagamentos) if (p.forma === "CARTAO") cartao += p.valor;
  }
  const imposto = (fat * config.imposto) / 100;
  const maq = (cartao * config.maquininha) / 100;
  const fixo = fixoNoPeriodo(config, ini, fim);
  const lucro = fat - comissoes - custoProd - imposto - maq - fixo;
  const atend = soma((c) => c.atend);
  return {
    fat,
    comissoes,
    custoProd,
    imposto,
    maq,
    fixo,
    lucro,
    margem: fat > 0 ? (lucro / fat) * 100 : 0,
    atend,
    cortes: soma((c) => c.cortes),
    gorjetas: soma((c) => c.gorjeta),
    ticket: atend ? fat / atend : 0,
    porUser,
  };
}

export function dreMes(users, todas, config, mk) {
  const [a, b] = rangeMes(mk);
  return dreRange(users, todas, config, a, b);
}

export function statusPonto(u, ponto, diaTs, agora = Date.now()) {
  const entrada = hhmm(u.entrada);
  if (ponto) {
    const delta = minutosDe(ponto.ts) - entrada;
    if (delta > 5) return { t: `Atraso ${delta} min`, c: "#facc15" };
    return { t: `Pontual ${hora(ponto.ts)}`, c: "#22c55e" };
  }
  if (mesmoDia(diaTs, agora) && minutosDe(agora) <= entrada + 60) return { t: "Aguardando", c: "#737373" };
  return { t: "Falta", c: "#ef4444" };
}

export function sumidosDe(clientes, todas, agora = Date.now()) {
  const lim = agora - 30 * DIA;
  const ultima = {};
  for (const l of todas) if (l.clienteId) ultima[l.clienteId] = Math.max(ultima[l.clienteId] || 0, l.ts);
  const out = [];
  for (const c of clientes) {
    const ult = ultima[c.id];
    if (ult && ult < lim) out.push({ c, ult, dias: Math.floor((agora - ult) / DIA) });
  }
  return out.sort((a, b) => b.dias - a.dias);
}

export function resumoTexto(users, todas, config, clientes, agora = Date.now()) {
  const ini = inicioDia(agora);
  const fim = somarDias(ini, 1);
  const partes = users.map((u) => ({ u, c: calc(u, todas, config, ini, fim) }));
  const fat = partes.reduce((a, x) => a + x.c.fat, 0);
  const cortes = partes.reduce((a, x) => a + x.c.cortes, 0);
  const casa = partes.reduce((a, x) => a + x.c.casa, 0);
  let cartao = 0;
  for (const l of todas) if (l.pago && dt(l) >= ini && dt(l) < fim) for (const p of l.pagamentos) if (p.forma === "CARTAO") cartao += p.valor;
  const lucro = casa - (fat * config.imposto) / 100 - (cartao * config.maquininha) / 100 - config.custoFixo / diasNoMes(mkOf(agora));
  const equipe = partes
    .filter((x) => x.c.fat > 0)
    .map((x) => `${x.u.role === "admin" ? "Você" : primeiroNome(x.u.nome)} ${brl(x.c.fat)}`)
    .join(", ");
  const baixos = config.produtos.filter((p) => p.estoque < 5).map((p) => `${capitalizar(p.nome)} ${p.estoque <= 0 ? "acabou" : "acabando"}`);
  const sum = sumidosDe(clientes, todas, agora).length;
  return [`Hoje: ${brl(fat)}`, `${cortes} cortes`, equipe, ...baixos, sum ? `${sum} sumido${sum > 1 ? "s" : ""}` : "", `Lucro ${brl(lucro)}`]
    .filter(Boolean)
    .join(", ");
}

export function previsaoFerias(u, users, todas, config, ini, fim, agora = Date.now()) {
  let dias = 0;
  const fimT = new Date(`${fim}T12:00:00`).getTime();
  for (let t = new Date(`${ini}T12:00:00`).getTime(); t <= fimT; t = somarDias(t, 1)) if (new Date(t).getDay() !== 0) dias++;
  const i30 = somarDias(inicioDia(agora), -30);
  const c = calc(u, todas, config, i30, agora + 1);
  const diasAtivos = Object.keys(c.porDia).length || 1;
  const media = c.fat / diasAtivos;
  const queda = media * dias;
  let refs = users.filter((x) => x.id !== u.id && x.role === "barbeiro" && x.ativo !== false);
  if (!refs.length) refs = users.filter((x) => x.id !== u.id);
  let fat = 0;
  let atend = 0;
  for (const o of refs) {
    const cc = calc(o, todas, config, i30, agora + 1);
    fat += cc.fat;
    atend += cc.atend;
  }
  const tk = atend ? fat / atend : c.ticket || 65;
  const cortes = tk > 0 ? Math.ceil(queda / tk) : 0;
  const porPessoa = refs.length ? Math.ceil(cortes / refs.length) : cortes;
  return { dias, media, queda, cortes, porPessoa, refs, tk };
}

/** Totais de uma lista de lançamentos: pago separado do fiado pendente. */
export function totaisLista(lancs) {
  let pago = 0;
  let fiado = 0;
  for (const l of lancs) {
    if (l.pago) pago += l.total;
    else fiado += l.total;
  }
  return { pago, fiado };
}
