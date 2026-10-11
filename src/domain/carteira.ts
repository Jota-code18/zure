/* Carteira do barbeiro, semana a semana.
 *
 * Cada semana (segunda a domingo) gera um ganho = comissão + bônus + gorjetas dos lançamentos PAGOS
 * naquela semana. Saldo que não foi sacado continua disponível nas semanas seguintes, sempre marcado
 * com o período de origem. Um saque guarda em `periodos` quanto saiu de cada semana.
 */
import { calc, dt } from "./calculos.ts";
import { diaKey, inicioSemana, rotuloSemana, somarDias } from "./datas.ts";

/** Quanto de cada semana já foi pedido/sacado (saques recusados não contam). */
function sacadoPorSemana(saques, barbeiroId) {
  const mapa = {};
  for (const s of saques) {
    if (s.barbeiroId !== barbeiroId || s.status === "recusado") continue;
    const partes = s.periodos?.length ? s.periodos : [{ semana: diaKey(inicioSemana(s.ts)), valor: s.valor }];
    for (const p of partes) {
      mapa[p.semana] = mapa[p.semana] || { total: 0, pendente: 0 };
      mapa[p.semana].total += p.valor;
      if (s.status === "pendente") mapa[p.semana].pendente += p.valor;
    }
  }
  return mapa;
}

export function carteiraSemanas(u, todas, config, saques, ref = Date.now()) {
  const meus = todas.filter((l) => l.barbeiroId === u.id && l.pago);
  const atual = inicioSemana(ref);
  const primeira = meus.length ? inicioSemana(Math.min(...meus.map(dt))) : atual;
  const sacado = sacadoPorSemana(saques, u.id);
  const semanas = [];
  for (let ini = primeira; ini <= atual; ini = somarDias(ini, 7)) {
    const fim = somarDias(ini, 7);
    const c = calc(u, todas, config, ini, fim);
    const ganho = +(c.comissao + c.gorjeta).toFixed(2);
    const chave = diaKey(ini);
    const s = sacado[chave] || { total: 0, pendente: 0 };
    const disponivel = Math.max(0, +(ganho - s.total).toFixed(2));
    semanas.push({
      chave,
      ini,
      fim,
      rotulo: rotuloSemana(ini),
      atual: ini === atual,
      comissao: c.comissao,
      gorjeta: c.gorjeta,
      ganho,
      sacado: s.total,
      pendente: s.pendente,
      disponivel,
    });
  }
  const disponivel = +semanas.reduce((a, s) => a + s.disponivel, 0).toFixed(2);
  const semanaAtual = semanas[semanas.length - 1];
  // Mais recentes primeiro; semanas antigas só aparecem se ainda têm saldo ou saque em análise.
  const visiveis = semanas.filter((s) => s.atual || s.disponivel > 0 || s.pendente > 0).reverse();
  return { semanas: visiveis, disponivel, semanaAtual };
}

/** Monta o saque de todo o saldo disponível, registrando quanto sai de cada semana. */
export function montarSaque(u, carteira, ts = Date.now()) {
  const periodos = carteira.semanas.filter((s) => s.disponivel > 0).map((s) => ({ semana: s.chave, rotulo: s.rotulo, valor: s.disponivel }));
  const valor = +periodos.reduce((a, p) => a + p.valor, 0).toFixed(2);
  return { barbeiroId: u.id, nome: u.nome, valor, ts, status: "pendente", periodos };
}
