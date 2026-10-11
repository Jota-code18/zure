import { describe, expect, it } from "vitest";
import { carteiraSemanas, montarSaque } from "./carteira.ts";

const T = (d: number, mes = 9) => new Date(2026, mes, d, 10).getTime();
const u = {
  id: "b1",
  nome: "Gabriel",
  role: "barbeiro",
  plano: { tiers: [{ id: "a", nome: "BASE", minFat: 0, comissao: 40, bonus: 0 }] },
};
const config = { comissaoProduto: 30, metaBebida: null, missoes: [] };
const corte = { tipo: "servico", id: "corte", nome: "CORTE", qtd: 1, preco: 60, custo: 0 };
const l = (ts: number, extra: Record<string, any> = {}) => ({
  id: String(ts),
  barbeiroId: "b1",
  itens: [corte],
  total: 60,
  gorjeta: 0,
  pago: true,
  pagoEm: ts,
  ts,
  pagamentos: [{ forma: "PIX", valor: 60 }],
  ...extra,
});

// 30/09 (semana de 28/09) e 06/10 (semana de 05/10). Referência: 07/10.
const lancs = [l(T(30, 8)), l(T(6), { gorjeta: 5, total: 65 })];
const REF = T(7);

describe("carteira por semana", () => {
  it("saldo de semana anterior continua disponível e marcado com o período", () => {
    const c = carteiraSemanas(u, lancs, config, [], REF);
    expect(c.semanas.map((s) => s.chave)).toEqual(["2026-10-05", "2026-09-28"]);
    expect(c.semanas[0].atual).toBe(true);
    expect(c.semanas[1].rotulo).toBe("28/09 a 04/10");
    expect(c.semanas[1].disponivel).toBe(24); // 40% de 60
    expect(c.semanas[0].disponivel).toBe(29); // 24 + 5 de gorjeta
    expect(c.disponivel).toBe(53);
  });

  it("saque pendente abate da semana certa e fica visível como 'em análise'", () => {
    const saques = [{ barbeiroId: "b1", status: "pendente", valor: 24, ts: REF, periodos: [{ semana: "2026-09-28", valor: 24 }] }];
    const c = carteiraSemanas(u, lancs, config, saques, REF);
    const antiga = c.semanas.find((s) => s.chave === "2026-09-28");
    expect(antiga?.disponivel).toBe(0);
    expect(antiga?.pendente).toBe(24);
    expect(c.disponivel).toBe(29);
  });

  it("semana já sacada e paga some da lista", () => {
    const saques = [{ barbeiroId: "b1", status: "pago", valor: 24, ts: REF, periodos: [{ semana: "2026-09-28", valor: 24 }] }];
    const c = carteiraSemanas(u, lancs, config, saques, REF);
    expect(c.semanas.map((s) => s.chave)).toEqual(["2026-10-05"]);
  });

  it("saque recusado devolve o valor para a carteira", () => {
    const saques = [{ barbeiroId: "b1", status: "recusado", valor: 24, ts: REF, periodos: [{ semana: "2026-09-28", valor: 24 }] }];
    expect(carteiraSemanas(u, lancs, config, saques, REF).disponivel).toBe(53);
  });

  it("saque antigo sem períodos é atribuído à semana em que foi pedido", () => {
    const saques = [{ barbeiroId: "b1", status: "pago", valor: 10, ts: T(6) }];
    const c = carteiraSemanas(u, lancs, config, saques, REF);
    expect(c.semanas[0].disponivel).toBe(19);
  });

  it("saques de outro barbeiro não interferem", () => {
    const saques = [{ barbeiroId: "outro", status: "pago", valor: 99, ts: REF, periodos: [{ semana: "2026-10-05", valor: 99 }] }];
    expect(carteiraSemanas(u, lancs, config, saques, REF).disponivel).toBe(53);
  });

  it("fiado não pago não entra na carteira", () => {
    const comFiado = [...lancs, l(T(7), { pago: false, pagoEm: null })];
    expect(carteiraSemanas(u, comFiado, config, [], REF).disponivel).toBe(53);
  });

  it("sem lançamentos mostra só a semana atual zerada", () => {
    const c = carteiraSemanas(u, [], config, [], REF);
    expect(c.semanas).toHaveLength(1);
    expect(c.disponivel).toBe(0);
    expect(c.semanaAtual.chave).toBe("2026-10-05");
  });

  it("montarSaque pede todo o saldo, separado por semana", () => {
    const c = carteiraSemanas(u, lancs, config, [], REF);
    const s = montarSaque(u, c, REF);
    expect(s).toMatchObject({ barbeiroId: "b1", nome: "Gabriel", valor: 53, status: "pendente" });
    expect(s.periodos).toEqual([
      { semana: "2026-10-05", rotulo: "05/10 a 11/10", valor: 29 },
      { semana: "2026-09-28", rotulo: "28/09 a 04/10", valor: 24 },
    ]);
  });
});
