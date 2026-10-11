/* Montagem, validação e permissões de lançamentos (comandas). */
import { mesmoDia } from "./datas.ts";
import { precoServ } from "./usuarios.ts";

export function montarItens(config, atendente, servSel, prodSel) {
  const s = config.servicos
    .filter((x) => servSel[x.id] > 0)
    .map((x) => ({ tipo: "servico", id: x.id, nome: x.nome, qtd: servSel[x.id], preco: precoServ(atendente, x), custo: 0 }));
  const p = config.produtos
    .filter((x) => prodSel[x.id] > 0)
    .map((x) => ({ tipo: "produto", id: x.id, nome: x.nome, qtd: prodSel[x.id], preco: x.preco, custo: x.custo }));
  return [...s, ...p];
}

export const subtotalDe = (itens) => +itens.reduce((a, i) => a + i.preco * i.qtd, 0).toFixed(2);

/** Pagamentos a partir da forma escolhida. `valorA` só vale no DIVIDIDO. */
export function montarPagamentos(
  forma: string,
  total: number,
  { formaA = "PIX", formaB = "CARTAO", valorA = 0 }: { formaA?: string; formaB?: string; valorA?: number } = {},
) {
  if (forma === "DIVIDIDO") {
    const vA = Math.min(valorA || 0, total);
    return [
      { forma: formaA, valor: +vA.toFixed(2) },
      { forma: formaB, valor: Math.max(0, +(total - vA).toFixed(2)) },
    ];
  }
  return [{ forma, valor: +total.toFixed(2) }];
}

/** Retorna a mensagem de erro, ou null se o lançamento estiver ok. */
export function validarLancamento({ itens, forma, cliente, total, valorA }) {
  if (!itens.length) return "Escolha pelo menos um serviço ou produto";
  if (forma === "FIADO" && !cliente) return "Fiado: escolha ou crie o cliente no campo CLIENTE (no topo)";
  if (forma === "DIVIDIDO" && (valorA <= 0 || valorA >= total)) return "No dividido, informe o valor da 1ª forma (menor que o total)";
  return null;
}

export function montarLancamento({ id, ts, atendente, user, cliente, itens, gorjeta, forma, pagamentos, comprovante }) {
  const subtotal = subtotalDe(itens);
  const total = +(subtotal + (gorjeta || 0)).toFixed(2);
  const fiado = forma === "FIADO";
  return {
    id,
    ts,
    barbeiroId: atendente.id,
    barbeiroNome: atendente.nome,
    lancadoPorId: user.id,
    lancadoPorNome: user.nome,
    clienteId: cliente?.id || null,
    clienteNome: cliente?.nome || "Cliente avulso",
    itens,
    subtotal,
    gorjeta: gorjeta || 0,
    total,
    pagamentos: pagamentos || [{ forma, valor: total }],
    fiado,
    pago: !fiado,
    pagoEm: fiado ? null : ts,
    comprovante: comprovante || null,
  };
}

/** Diferença de estoque entre duas listas de itens: positivo = devolve ao estoque. */
export function ajusteEstoque(itensAntes, itensDepois) {
  const delta = {};
  for (const i of itensAntes || []) if (i.tipo === "produto") delta[i.id] = (delta[i.id] || 0) + i.qtd;
  for (const i of itensDepois || []) if (i.tipo === "produto") delta[i.id] = (delta[i.id] || 0) - i.qtd;
  for (const k of Object.keys(delta)) if (delta[k] === 0) delete delta[k];
  return delta;
}

/** Foi lançado por alguém diferente de quem atendeu? */
export const lancadoPorOutro = (l) => !!l.lancadoPorId && l.lancadoPorId !== l.barbeiroId;

/* ---------- permissões (espelham as regras do banco) ---------- */
export const podeEditar = (user) => user?.role === "admin";

/** Dono exclui qualquer um; barbeiro só os de hoje que atendeu ou lançou. */
export function podeExcluir(user, l, agora = Date.now()) {
  if (!user) return false;
  if (user.role === "admin") return true;
  return (l.barbeiroId === user.id || l.lancadoPorId === user.id) && mesmoDia(l.ts, agora);
}

/** Barbeiro só enxerga o que atendeu ou o que ele mesmo lançou. */
export const visivelPara = (user, l) => user?.role === "admin" || l.barbeiroId === user?.id || l.lancadoPorId === user?.id;
