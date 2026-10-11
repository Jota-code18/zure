import { describe, expect, it } from "vitest";
import {
  CORTES,
  calc,
  contasAlertas,
  dreMes,
  dreRange,
  dt,
  fatServMes,
  fixoNoPeriodo,
  lancStats,
  metasProgresso,
  previsaoFerias,
  progressoMissoes,
  resumoTexto,
  riscoVermelho,
  serieDe,
  statusPonto,
  sumidosDe,
  taxaMes,
  totaisLista,
} from "./calculos.ts";

const T = (d: number, h = 10, m = 0, mes = 9) => new Date(2026, mes, d, h, m).getTime(); // outubro/2026 (mês 9)

const barbeiro = {
  id: "b1",
  nome: "Gabriel",
  role: "barbeiro",
  ativo: true,
  metaAtendSemana: 3,
  metaAtendMes: 10,
  metaProdSemana: 20,
  metaProdMes: 50,
  plano: {
    tiers: [
      { id: "a", nome: "BASE", minFat: 0, comissao: 40, bonus: 0 },
      { id: "b", nome: "BOA", minFat: 100, comissao: 50, bonus: 20 },
    ],
  },
};
const dono = { id: "d1", nome: "Gustavo", role: "admin", ativo: true, plano: { tiers: [] } };

const config = {
  comissaoProduto: 30,
  metaBebida: { produtoId: "cerveja", qtd: 2, bonus: 10 },
  missoes: [{ id: "m1", titulo: "2 combos", itemId: "combo", alvo: 2, bonus: 5 }],
  imposto: 6,
  maquininha: 1.5,
  custoFixo: 3100,
  contas: [],
  contasPagas: {},
  produtos: [{ id: "cerveja", nome: "CERVEJA", estoque: 3 }],
  servicos: [],
};

const corte = { tipo: "servico", id: "corte", nome: "CORTE", qtd: 1, preco: 60, custo: 0 };
const combo = { tipo: "servico", id: "combo", nome: "COMBO", qtd: 1, preco: 90, custo: 0 };
const cerveja = (qtd = 1) => ({ tipo: "produto", id: "cerveja", nome: "CERVEJA", qtd, preco: 6, custo: 2 });

function lanc(p: Record<string, any>) {
  const itens = p.itens || [corte];
  const subtotal = itens.reduce((a, i) => a + i.preco * i.qtd, 0);
  const total = subtotal + (p.gorjeta || 0);
  const fiado = !!p.fiado;
  const pago = p.pago ?? !fiado;
  return {
    id: p.id || Math.random().toString(36),
    barbeiroId: "b1",
    clienteId: "c1",
    clienteNome: "João",
    gorjeta: 0,
    itens,
    subtotal,
    total,
    fiado,
    pago,
    pagoEm: pago ? (p.pagoEm ?? p.ts) : null,
    pagamentos: p.pagamentos || [{ forma: pago ? "PIX" : "FIADO", valor: total }],
    ...p,
  };
}

const L1 = lanc({ id: "l1", ts: T(5) });
const L2 = lanc({ id: "l2", ts: T(6), itens: [corte, cerveja(2)] });
const L3fiado = lanc({ id: "l3", ts: T(7), fiado: true });
const OUT = [T(1, 0), T(1, 0, 0, 10)];

describe("comissão e faturamento (calc)", () => {
  it("fiado não pago fica FORA do faturamento, da comissão e dos bônus", () => {
    const r = calc(barbeiro, [L1, L2, L3fiado], config, OUT[0], OUT[1]);
    expect(r.fatServ).toBe(120);
    expect(r.fatProd).toBe(12);
    expect(r.atend).toBe(2);
    expect(r.clientes).toBe(2);
    expect(r.cortes).toBe(2);
    // nível BOA (≥100) → 50% em todo serviço do mês
    expect(r.comServ).toBe(60);
    // produto: 30% do lucro (6-2)*2
    expect(r.comProd).toBeCloseTo(2.4);
    expect(r.bonusTier).toBe(20);
    expect(r.bonusBebida).toBe(10);
    expect(r.bonusMissoes).toBe(0);
    expect(r.comissao).toBeCloseTo(92.4);
    expect(r.fat).toBe(132);
    expect(r.ticket).toBe(66);
    expect(r.custoProd).toBe(4);
    expect(r.casa).toBeCloseTo(35.6);
  });

  it("fiado pago entra na data do pagamento", () => {
    const pago = { ...L3fiado, pago: true, pagoEm: T(8), pagamentos: [{ forma: "DINHEIRO", valor: 60 }] };
    const r = calc(barbeiro, [L1, L2, pago], config, OUT[0], OUT[1]);
    expect(r.fatServ).toBe(180);
    expect(r.comServ).toBe(90);
    expect(Object.keys(r.porDia)).toContain("2026-10-08");
    expect(Object.keys(r.porDia)).not.toContain("2026-10-07");
    expect(dt(pago)).toBe(T(8));
  });

  it("bônus de nível é pago uma vez só, no lançamento que cruza a faixa", () => {
    const r = calc(barbeiro, [L1, L2, lanc({ ts: T(9) })], config, OUT[0], OUT[1]);
    expect(r.bonusTier).toBe(20);
    const soPrimeiraSemana = calc(barbeiro, [L1, L2, lanc({ ts: T(9) })], config, T(5, 0), T(6, 0));
    expect(soPrimeiraSemana.bonusTier).toBe(0);
  });

  it("missão do dia gera bônus quando bate o alvo com vendas pagas", () => {
    const r = calc(barbeiro, [lanc({ ts: T(5, 9), itens: [combo] }), lanc({ ts: T(5, 11), itens: [combo] })], config, OUT[0], OUT[1]);
    expect(r.bonusMissoes).toBe(5);
    const comFiado = calc(barbeiro, [lanc({ ts: T(5, 9), itens: [combo] }), lanc({ ts: T(5, 11), itens: [combo], fiado: true })], config, OUT[0], OUT[1]);
    expect(comFiado.bonusMissoes).toBe(0);
  });

  it("dono não recebe comissão nem bônus", () => {
    const r = calc(dono, [lanc({ barbeiroId: "d1", ts: T(5), itens: [corte, cerveja(2)] })], config, OUT[0], OUT[1]);
    expect(r.comissao).toBe(0);
    expect(r.fat).toBe(72);
    expect(taxaMes(dono, [], "2026-10")).toBe(0);
  });

  it("sem plano de carreira usa 50%", () => {
    const semPlano = { ...barbeiro, plano: { tiers: [] } };
    expect(taxaMes(semPlano, [L1], "2026-10")).toBe(0.5);
    expect(taxaMes(barbeiro, [L1], "2026-10")).toBe(0.4);
    expect(fatServMes(barbeiro, [L1, L2, L3fiado], "2026-10")).toBe(120);
  });
});

describe("metas (contam fiado)", () => {
  it("lancStats conta o atendimento fiado pela data do serviço", () => {
    const s = lancStats(barbeiro, [L1, L2, L3fiado], OUT[0], OUT[1]);
    expect(s.clientes).toBe(3);
    expect(s.cortes).toBe(3);
    expect(s.prod).toBe(12);
    expect(s.prodQtd).toBe(2);
    expect(s.fat).toBe(192);
  });

  it("metasProgresso separa semana e mês com as metas do barbeiro", () => {
    const p = metasProgresso(barbeiro, [L1, L2, L3fiado, lanc({ ts: T(1) })], T(7, 18));
    expect(p.semana.clientes).toBe(3);
    expect(p.mes.clientes).toBe(4);
    expect(p.semana.metaCli).toBe(3);
    expect(p.mes.metaProd).toBe(50);
  });

  it("missões mostram fiado separado (não conta no bônus)", () => {
    const m = progressoMissoes(barbeiro, [lanc({ ts: T(7, 9), itens: [combo] }), lanc({ ts: T(7, 10), itens: [combo], fiado: true })], config, T(7, 18));
    expect(m[0].n).toBe(1);
    expect(m[0].fiado).toBe(1);
  });

  it("CORTES inclui corte e combo", () => {
    expect(CORTES).toEqual(["corte", "combo"]);
  });
});

describe("DRE e custo fixo", () => {
  it("custo fixo de um mês cheio é o custo fixo mensal", () => {
    expect(fixoNoPeriodo(config, OUT[0], OUT[1])).toBeCloseTo(3100);
    expect(fixoNoPeriodo(config, T(1, 0), T(2, 0))).toBeCloseTo(100);
  });

  it("dre: imposto sobre faturamento, maquininha só no cartão", () => {
    const cartao = lanc({ ts: T(5), pagamentos: [{ forma: "CARTAO", valor: 60 }] });
    const d = dreRange([barbeiro], [cartao, L2], config, OUT[0], OUT[1]);
    expect(d.fat).toBe(132);
    expect(d.imposto).toBeCloseTo(7.92);
    expect(d.maq).toBeCloseTo(0.9);
    expect(d.lucro).toBeCloseTo(d.fat - d.comissoes - d.custoProd - d.imposto - d.maq - d.fixo);
    expect(d.margem).toBeCloseTo((d.lucro / d.fat) * 100);
    expect(dreMes([barbeiro], [cartao, L2], config, "2026-10").fat).toBe(132);
  });

  it("dre vazio não divide por zero", () => {
    const d = dreRange([barbeiro], [], config, OUT[0], OUT[1]);
    expect(d.margem).toBe(0);
    expect(d.ticket).toBe(0);
  });
});

describe("contas a pagar", () => {
  const cfg = {
    contas: [
      { id: "a", nome: "Aluguel", valor: 1000, dia: 10 },
      { id: "b", nome: "Luz", valor: 100, dia: 12 },
      { id: "c", nome: "Água", valor: 50, dia: 20 },
      { id: "d", nome: "Net", valor: 90, dia: 0 },
      { id: "e", nome: "Paga", valor: 10, dia: 5 },
      { id: "f", nome: "Hoje", valor: 10, dia: 11 },
    ],
    contasPagas: { "2026-10": ["e"] },
  };
  it("classifica vencimentos", () => {
    const st = Object.fromEntries(contasAlertas(cfg, T(11)).map((a) => [a.c.id, a.status]));
    expect(st).toEqual({ a: "atrasada", b: "breve", c: "ok", d: "semdata", e: "paga", f: "hoje" });
  });
  it("dia 31 em mês curto vence no último dia", () => {
    const [a] = contasAlertas({ contas: [{ id: "x", nome: "X", valor: 1, dia: 31 }] }, new Date(2026, 1, 10).getTime());
    expect(a.diaV).toBe(28);
  });
});

describe("ponto, clientes sumidos, série", () => {
  it("statusPonto: pontual, atraso, aguardando e falta", () => {
    const u = { entrada: "09:00" };
    expect(statusPonto(u, { ts: T(5, 9, 3) }, T(5)).t).toMatch(/Pontual/);
    expect(statusPonto(u, { ts: T(5, 9, 20) }, T(5)).t).toBe("Atraso 20 min");
    expect(statusPonto(u, null, T(5), T(5, 9, 30)).t).toBe("Aguardando");
    expect(statusPonto(u, null, T(5), T(5, 11)).t).toBe("Falta");
    expect(statusPonto(u, null, T(4), T(5, 8)).t).toBe("Falta");
  });

  it("sumidosDe lista quem não volta há mais de 30 dias", () => {
    const cls = [
      { id: "c1", nome: "A" },
      { id: "c2", nome: "B" },
      { id: "c3", nome: "C" },
    ];
    const ls = [lanc({ clienteId: "c1", ts: T(1, 10, 0, 7) }), lanc({ clienteId: "c2", ts: T(5) })];
    const s = sumidosDe(cls, ls, T(11));
    expect(s.map((x) => x.c.id)).toEqual(["c1"]);
    expect(s[0].dias).toBeGreaterThan(60);
  });

  it("serieDe gera pontos por dia e por mês", () => {
    const c = calc(barbeiro, [L1, L2], config, OUT[0], OUT[1]);
    const dias = serieDe(c, T(5, 0), T(8, 0), T(11));
    expect(dias.map((d) => d.rot)).toEqual(["05/10", "06/10", "07/10"]);
    expect(dias[0].fat).toBe(60);
    expect(dias[2].ticket).toBeNull();
    const ano = serieDe(c, new Date(2026, 0, 1).getTime(), new Date(2027, 0, 1).getTime(), T(11));
    expect(ano).toHaveLength(10);
    expect(ano[9]).toMatchObject({ rot: "10/26", fat: 132, atend: 2 });
  });
});

describe("risco, resumo, férias, totais", () => {
  it("riscoVermelho: 2 meses seguidos no primeiro nível", () => {
    const set = lanc({ ts: T(10, 10, 0, 8) });
    const r = riscoVermelho(barbeiro, [set], T(20));
    expect(r.vermAnt).toBe(true);
    expect(r.vermAt).toBe(true);
    expect(r.doisSeguidos).toBe(true);
    const cedo = riscoVermelho(barbeiro, [set], T(3));
    expect(cedo.cedo).toBe(true);
    expect(cedo.doisSeguidos).toBe(false);
  });

  it("resumoTexto traz faturamento, cortes, equipe e estoque", () => {
    const t = resumoTexto([barbeiro], [lanc({ ts: T(11, 10) })], config, [], T(11, 19));
    expect(t).toContain("Hoje: R$");
    expect(t).toContain("1 cortes");
    expect(t).toContain("Gabriel");
    expect(t).toContain("Cerveja acabando");
  });

  it("previsaoFerias calcula dias úteis e cortes para cobrir", () => {
    const outro = { ...barbeiro, id: "b2", nome: "Nathanael" };
    const ls = [lanc({ ts: T(5) }), lanc({ ts: T(6) }), lanc({ barbeiroId: "b2", ts: T(6) })];
    const p = previsaoFerias(barbeiro, [barbeiro, outro], ls, config, "2026-10-12", "2026-10-18", T(11, 12));
    expect(p.dias).toBe(6); // domingo não conta
    expect(p.refs.map((r) => r.id)).toEqual(["b2"]);
    expect(p.cortes).toBeGreaterThan(0);
  });

  it("totaisLista separa pago de fiado", () => {
    expect(totaisLista([L1, L3fiado])).toEqual({ pago: 60, fiado: 60 });
  });
});
