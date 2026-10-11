import { describe, expect, it } from "vitest";
import {
  ajusteEstoque,
  lancadoPorOutro,
  montarItens,
  montarLancamento,
  montarPagamentos,
  podeEditar,
  podeExcluir,
  subtotalDe,
  validarLancamento,
  visivelPara,
} from "./lancamento.ts";

const config = {
  servicos: [
    { id: "corte", nome: "CORTE", preco: 65 },
    { id: "barba", nome: "BARBA", preco: 35 },
  ],
  produtos: [{ id: "cerveja", nome: "CERVEJA", preco: 6, custo: 2.5, estoque: 10 }],
};
const gabriel = { id: "g", nome: "Gabriel", role: "barbeiro", precos: { corte: 60 } };
const nath = { id: "n", nome: "Nathanael", role: "barbeiro" };
const dono = { id: "d", nome: "Gustavo", role: "admin" };
const HOJE = new Date(2026, 9, 11, 15).getTime();

describe("montagem do lançamento", () => {
  it("usa o preço de quem atendeu", () => {
    const itens = montarItens(config, gabriel, { corte: 1, barba: 0 }, { cerveja: 2 });
    expect(itens).toEqual([
      { tipo: "servico", id: "corte", nome: "CORTE", qtd: 1, preco: 60, custo: 0 },
      { tipo: "produto", id: "cerveja", nome: "CERVEJA", qtd: 2, preco: 6, custo: 2.5 },
    ]);
    expect(subtotalDe(itens)).toBe(72);
    expect(montarItens(config, nath, { corte: 1 }, {})[0].preco).toBe(65);
  });

  it("pagamento dividido fecha o total", () => {
    expect(montarPagamentos("DIVIDIDO", 100, { formaA: "PIX", formaB: "CARTAO", valorA: 30 })).toEqual([
      { forma: "PIX", valor: 30 },
      { forma: "CARTAO", valor: 70 },
    ]);
    expect(montarPagamentos("DIVIDIDO", 50, { valorA: 80 })).toEqual([
      { forma: "PIX", valor: 50 },
      { forma: "CARTAO", valor: 0 },
    ]);
    expect(montarPagamentos("PIX", 65)).toEqual([{ forma: "PIX", valor: 65 }]);
  });

  it("validações", () => {
    expect(validarLancamento({ itens: [], forma: "PIX", cliente: null, total: 0, valorA: 0 })).toMatch(/pelo menos um/);
    expect(validarLancamento({ itens: [1], forma: "FIADO", cliente: null, total: 10, valorA: 0 })).toMatch(/Fiado/);
    expect(validarLancamento({ itens: [1], forma: "DIVIDIDO", cliente: null, total: 10, valorA: 10 })).toMatch(/dividido/);
    expect(validarLancamento({ itens: [1], forma: "DIVIDIDO", cliente: null, total: 10, valorA: 0 })).toMatch(/dividido/);
    expect(validarLancamento({ itens: [1], forma: "DIVIDIDO", cliente: null, total: 10, valorA: 4 })).toBeNull();
    expect(validarLancamento({ itens: [1], forma: "FIADO", cliente: { id: "c" }, total: 10, valorA: 0 })).toBeNull();
  });

  it("registra quem lançou (mesmo quando é para outro barbeiro)", () => {
    const itens = montarItens(config, nath, { corte: 1 }, {});
    const l = montarLancamento({
      id: "x",
      ts: HOJE,
      atendente: nath,
      user: gabriel,
      cliente: null,
      itens,
      gorjeta: 5,
      forma: "PIX",
      pagamentos: undefined,
      comprovante: undefined,
    });
    expect(l).toMatchObject({
      barbeiroId: "n",
      lancadoPorId: "g",
      lancadoPorNome: "Gabriel",
      clienteNome: "Cliente avulso",
      subtotal: 65,
      total: 70,
      pago: true,
      pagoEm: HOJE,
      fiado: false,
      comprovante: null,
    });
    expect(l.pagamentos).toEqual([{ forma: "PIX", valor: 70 }]);
    expect(lancadoPorOutro(l)).toBe(true);
    expect(lancadoPorOutro({ ...l, lancadoPorId: "n" })).toBe(false);
  });

  it("fiado nasce pendente e sem data de pagamento", () => {
    const l = montarLancamento({
      id: "x",
      ts: HOJE,
      atendente: gabriel,
      user: gabriel,
      cliente: { id: "c", nome: "Ana" },
      itens: [],
      gorjeta: 0,
      forma: "FIADO",
      pagamentos: undefined,
      comprovante: undefined,
    });
    expect(l).toMatchObject({ fiado: true, pago: false, pagoEm: null, clienteId: "c", clienteNome: "Ana" });
  });

  it("ajusteEstoque calcula o que volta e o que sai", () => {
    const a = [
      { tipo: "produto", id: "cerveja", qtd: 3 },
      { tipo: "servico", id: "corte", qtd: 1 },
    ];
    const b = [
      { tipo: "produto", id: "cerveja", qtd: 1 },
      { tipo: "produto", id: "agua", qtd: 2 },
    ];
    expect(ajusteEstoque(a, b)).toEqual({ cerveja: 2, agua: -2 });
    expect(ajusteEstoque(a, a)).toEqual({});
    expect(ajusteEstoque([], a)).toEqual({ cerveja: -3 });
  });
});

describe("permissões", () => {
  const l = { barbeiroId: "n", lancadoPorId: "g", ts: HOJE };
  it("só o dono corrige", () => {
    expect(podeEditar(dono)).toBe(true);
    expect(podeEditar(gabriel)).toBe(false);
    expect(podeEditar(null)).toBe(false);
  });
  it("barbeiro exclui só os de hoje que atendeu ou lançou; dono exclui qualquer um", () => {
    expect(podeExcluir(dono, { ...l, ts: 0 }, HOJE)).toBe(true);
    expect(podeExcluir(gabriel, l, HOJE)).toBe(true);
    expect(podeExcluir(nath, l, HOJE)).toBe(true);
    expect(podeExcluir(gabriel, { ...l, ts: HOJE - 86400000 }, HOJE)).toBe(false);
    expect(podeExcluir({ id: "z", role: "barbeiro" }, l, HOJE)).toBe(false);
    expect(podeExcluir(null, l, HOJE)).toBe(false);
  });
  it("barbeiro não enxerga lançamentos de colegas", () => {
    expect(visivelPara(dono, l)).toBe(true);
    expect(visivelPara(gabriel, l)).toBe(true);
    expect(visivelPara(nath, l)).toBe(true);
    expect(visivelPara({ id: "z", role: "barbeiro" }, l)).toBe(false);
  });
});
