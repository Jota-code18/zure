/* Casos de borda das regras de negócio (encontrados pelo teste de mutação). */
import { describe, expect, it } from "vitest";
import {
  calc,
  contasAlertas,
  dreRange,
  fatServMes,
  lancStats,
  metasProgresso,
  previsaoFerias,
  progressoMissoes,
  resumoTexto,
  riscoVermelho,
  serieDe,
  statusPonto,
  sumidosDe,
} from "./calculos.ts";
import { somarDias } from "./datas.ts";

const T = (d: number, h = 10, mes = 9, min = 0) => new Date(2026, mes, d, h, min).getTime();
const tiers = [
  { id: "a", nome: "A", minFat: 0, comissao: 40, bonus: 0 },
  { id: "b", nome: "B", minFat: 100, comissao: 50, bonus: 20 },
  { id: "c", nome: "C", minFat: 200, comissao: 50, bonus: 50 },
];
const b1 = { id: "b1", nome: "Gabriel Souza", role: "barbeiro", ativo: true, plano: { tiers } };
const b2 = { id: "b2", nome: "Nathanael", role: "barbeiro", ativo: true, plano: { tiers } };
const dono = { id: "d", nome: "Gustavo", role: "admin", ativo: true, plano: { tiers: [] } };

const corte = (preco = 60, qtd = 1) => ({ tipo: "servico", id: "corte", nome: "CORTE", qtd, preco, custo: 0 });
const barba = { tipo: "servico", id: "barba", nome: "BARBA", qtd: 1, preco: 35, custo: 0 };
const combo = { tipo: "servico", id: "combo", nome: "COMBO", qtd: 1, preco: 90, custo: 0 };
const cerveja = (qtd = 1) => ({ tipo: "produto", id: "cerveja", nome: "CERVEJA", qtd, preco: 6, custo: 2 });

function L(ts: number, itens: any[], extra: Record<string, any> = {}) {
  const total = itens.reduce((a, i) => a + i.preco * i.qtd, 0) + (extra.gorjeta || 0);
  const pago = extra.pago ?? true;
  return {
    id: `${ts}-${Math.random()}`,
    barbeiroId: "b1",
    ts,
    itens,
    total,
    gorjeta: 0,
    pago,
    fiado: !pago,
    pagoEm: pago ? ts : null,
    pagamentos: [{ forma: "PIX", valor: total }],
    ...extra,
  };
}

describe("faturamento de serviços do mês", () => {
  it("só serviços pagos do próprio barbeiro no mês (preço × quantidade)", () => {
    const todas = [
      L(T(5), [corte(60, 2), cerveja(3)]),
      L(T(6), [corte()], { pago: false }),
      L(T(6), [corte()], { barbeiroId: "b2" }),
      L(T(20, 10, 8), [corte()]),
    ];
    expect(fatServMes(b1, todas, "2026-10")).toBe(120);
  });
});

describe("risco de vermelho", () => {
  it("projeção do mês e a carência dos 7 primeiros dias", () => {
    const todas = [L(T(20, 10, 8), [corte(20)]), L(T(5), [corte(20)])];
    const d10 = riscoVermelho(b1, todas, T(10));
    expect(d10.proj).toBeCloseTo((20 / 10) * 31);
    expect(d10.vermAnt).toBe(true);
    const d7 = riscoVermelho(b1, todas, T(7));
    expect(d7.cedo).toBe(false);
    expect(d7.vermAt).toBe(true);
    expect(d7.doisSeguidos).toBe(true);
    expect(riscoVermelho(b1, todas, T(6)).cedo).toBe(true);
    const semMesPassado = riscoVermelho(b1, [L(T(5), [corte(20)])], T(10));
    expect(semMesPassado.vermAnt).toBe(false);
    const bom = riscoVermelho(b1, [L(T(20, 10, 8), [corte(300)]), L(T(5), [corte(300)])], T(10));
    expect(bom.vermAnt).toBe(false);
    expect(bom.vermAt).toBe(false);
  });
});

describe("metas: limites do período", () => {
  it("início entra, fim não; produto sozinho não é cliente; barba não é corte", () => {
    const ini = T(5, 0);
    const fim = T(6, 0);
    const todas = [
      L(ini, [corte()]),
      L(fim, [corte()]),
      L(ini, [corte()], { barbeiroId: "b2" }),
      L(T(5, 12), [cerveja(2)]),
      L(T(5, 13), [barba]),
      L(T(5, 14), [combo]),
    ];
    expect(lancStats(b1, todas, ini, fim)).toEqual({ clientes: 3, cortes: 2, prod: 12, prodQtd: 2, fat: 60 + 12 + 35 + 90 });
  });

  it("metas do perfil (ou zero se não definidas)", () => {
    const u = { ...b1, metaAtendSemana: 5, metaAtendMes: 20, metaProdSemana: 30, metaProdMes: 120 };
    const p = metasProgresso(u, [], T(11));
    expect([p.semana.metaCli, p.semana.metaProd, p.mes.metaCli, p.mes.metaProd]).toEqual([5, 30, 20, 120]);
    const z = metasProgresso(b1, [], T(11));
    expect([z.semana.metaCli, z.semana.metaProd, z.mes.metaCli, z.mes.metaProd]).toEqual([0, 0, 0, 0]);
  });
});

describe("missões do dia", () => {
  it("conta só pagas de hoje do próprio barbeiro; fiado de hoje vai separado", () => {
    const config = { missoes: [{ id: "m", itemId: "combo", alvo: 3, bonus: 5 }] };
    const todas = [
      L(T(11, 9), [combo], { barbeiroId: "b2" }),
      L(T(11, 9), [corte()]),
      L(T(10, 9), [combo]),
      L(T(10, 9), [combo], { pago: false }),
      L(T(11, 10), [{ ...combo, qtd: 2 }]),
      L(T(11, 11), [combo], { pago: false }),
      { ...L(T(9, 9), [combo]), pagoEm: T(11, 12) },
    ];
    const [m] = progressoMissoes(b1, todas, config, T(11, 18));
    expect(m.n).toBe(3);
    expect(m.fiado).toBe(1);
    expect(progressoMissoes(b1, todas, {}, T(11))).toEqual([]);
  });
});

describe("contas: limites do aviso", () => {
  it("faltando 2 dias avisa; 3 dias não", () => {
    const cfg = {
      contas: [
        { id: "a", nome: "A", valor: 1, dia: 13 },
        { id: "b", nome: "B", valor: 1, dia: 14 },
        { id: "c", nome: "C", valor: 1, dia: 0 },
      ],
      contasPagas: { "2026-10": ["c"] },
    };
    const r = contasAlertas(cfg, T(11));
    expect(r.map((x) => x.status)).toEqual(["breve", "ok", "paga"]);
    expect(r[0]).toMatchObject({ falta: 2, diaV: 13, semData: false, paga: false });
    expect(r[2]).toMatchObject({ semData: true, paga: true });
    expect(contasAlertas({}, T(11))).toEqual([]);
  });
});

describe("comissão: bônus e limites", () => {
  const cfg = { comissaoProduto: 50, metaBebida: { produtoId: "cerveja", qtd: 2, bonus: 10 }, missoes: [] };
  const todas = [L(T(5), [corte(), cerveja()]), L(T(6), [corte(), cerveja()]), L(T(7), [corte(), barba, cerveja()]), L(T(8), [cerveja(2)])];

  it("bônus de duas faixas no mesmo mês somam só a diferença; bebida paga uma vez", () => {
    const r = calc(b1, todas, cfg, T(1, 0), T(1, 0, 10));
    expect(r).toMatchObject({ atend: 4, clientes: 3, cortes: 3, bebidas: 5, bonusBebida: 10, bonusTier: 50, lucroProd: 20, comProd: 10 });
    expect(r.comServ).toBeCloseTo(0.5 * 215);
    expect(r.comissao).toBeCloseTo(107.5 + 10 + 10 + 50);
  });

  it("período: lançamento no instante inicial entra, no final não", () => {
    const r = calc(b1, todas, cfg, T(6), T(7));
    expect(r).toMatchObject({ atend: 1, bonusTier: 20, bonusBebida: 10, bebidas: 1 });
  });

  it("produto sem configuração de comissão usa 30% do lucro", () => {
    expect(calc(b1, [L(T(5), [cerveja(5)])], { missoes: [] }, T(1, 0), T(1, 0, 10)).comProd).toBeCloseTo(6);
  });

  it("dono: lucro do produto aparece, comissão não", () => {
    const r = calc(dono, [L(T(5), [cerveja(5)], { barbeiroId: "d" })], cfg, T(1, 0), T(1, 0, 10));
    expect(r.lucroProd).toBe(20);
    expect(r.comProd).toBe(0);
    expect(r.bonusBebida).toBe(0);
  });
});

describe("série do gráfico", () => {
  const c = calc(b1, [L(T(5), [corte()])], { missoes: [] }, T(1, 0, 0), T(1, 0, 11));
  it("até 62 dias é por dia; acima disso, por mês", () => {
    const ini = new Date(2026, 6, 1).getTime();
    expect(serieDe(c, ini, somarDias(ini, 62), T(11))).toHaveLength(62);
    expect(serieDe(c, ini, somarDias(ini, 63), T(11)).map((p) => p.rot)).toEqual(["07/26", "08/26", "09/26"]);
  });
  it("inclui o dia de hoje e calcula o ticket", () => {
    expect(serieDe(c, T(5, 0), T(6, 0), T(5, 0))).toEqual([{ rot: "05/10", fat: 60, atend: 1, ticket: 60 }]);
  });
});

describe("DRE: cartão e totais", () => {
  it("maquininha só no cartão pago dentro do período; totais da equipe", () => {
    const cartao = (ts: number, extra = {}) => ({ ...L(ts, [corte()], { gorjeta: 5, ...extra }), pagamentos: [{ forma: "CARTAO", valor: 65 }] });
    const todas = [cartao(T(5)), cartao(T(6), { pago: false }), cartao(T(20, 10, 8))];
    const d = dreRange([b1], todas, { imposto: 0, maquininha: 10, custoFixo: 0, missoes: [] }, T(1, 0), T(1, 0, 10));
    expect(d.maq).toBeCloseTo(6.5);
    expect(d).toMatchObject({ atend: 1, cortes: 1, gorjetas: 5, ticket: 60, fat: 60 });
  });
});

describe("ponto: limites", () => {
  const u = { entrada: "09:00" };
  it("até 5 minutos é pontual; 6 já é atraso", () => {
    expect(statusPonto(u, { ts: T(5, 9, 9, 5) }, T(5))).toEqual({ t: "Pontual 09:05", c: "#22c55e" });
    expect(statusPonto(u, { ts: T(5, 9, 9, 6) }, T(5))).toEqual({ t: "Atraso 6 min", c: "#facc15" });
  });
  it("aguarda até 1h depois da entrada; depois é falta", () => {
    expect(statusPonto(u, null, T(5), T(5, 10))).toEqual({ t: "Aguardando", c: "#737373" });
    expect(statusPonto(u, null, T(5), T(5, 10, 9, 1))).toEqual({ t: "Falta", c: "#ef4444" });
  });
});

describe("clientes sumidos: limites", () => {
  it("usa a visita mais recente, ordena por mais tempo sumido e 30 dias exatos ainda não conta", () => {
    const cls = [
      { id: "c1", nome: "A" },
      { id: "c2", nome: "B" },
      { id: "c3", nome: "C" },
    ];
    const todas = [
      L(T(1, 10, 7), [corte()], { clienteId: "c1" }),
      L(T(20, 10, 7), [corte()], { clienteId: "c1" }),
      L(T(1, 10, 6), [corte()], { clienteId: "c2" }),
      L(T(11, 10, 8), [corte()], { clienteId: "c3" }),
      L(T(1, 10, 5), [corte()], { clienteId: null }),
    ];
    const s = sumidosDe(cls, todas, T(11, 10));
    expect(s.map((x) => [x.c.id, x.dias])).toEqual([
      ["c2", 102],
      ["c1", 52],
    ]);
    expect(s[1].ult).toBe(T(20, 10, 7));
  });
});

describe("resumo das 19h", () => {
  it("texto completo com equipe, estoque, sumidos e lucro", () => {
    const b3 = { ...b2, id: "b3", nome: "Sem Movimento" };
    const todas = [
      L(T(11, 10), [corte(65)], { barbeiroId: "d" }),
      L(T(11, 11), [corte(60)]),
      L(T(11, 12), [corte(60)], { pago: false }),
      L(T(1, 10, 7), [corte()], { clienteId: "c1" }),
      L(T(2, 10, 7), [corte()], { clienteId: "c2" }),
    ];
    const config = {
      imposto: 6,
      maquininha: 1.5,
      custoFixo: 3100,
      missoes: [],
      produtos: [
        { nome: "CERVEJA", estoque: 0 },
        { nome: "ÁGUA", estoque: 3 },
        { nome: "POMADA", estoque: 9 },
      ],
    };
    const clientes = [
      { id: "c1", nome: "A" },
      { id: "c2", nome: "B" },
    ];
    const t = resumoTexto([dono, b1, b3], todas, config, clientes, T(11, 19)).replace(/ /g, " ");
    expect(t).toBe("Hoje: R$ 125,00, 2 cortes, Você R$ 65,00, Gabriel R$ 60,00, Cerveja acabou, Água acabando, 2 sumidos, Lucro -R$ 6,50");
    const umSumido = resumoTexto([b1], todas.slice(0, 4), { ...config, produtos: [] }, [clientes[0]], T(11, 19));
    expect(umSumido).toContain("1 sumido,");
  });
});

describe("previsão de férias: números", () => {
  it("média dos últimos 30 dias, cortes para cobrir e divisão entre os colegas", () => {
    const inativo = { ...b2, id: "b9", ativo: false };
    const todas = [
      L(T(5), [corte()]),
      L(T(6), [corte()]),
      L(T(5), [corte(45)], { barbeiroId: "b2" }),
      L(T(6), [corte(45)], { barbeiroId: "b2" }),
      L(T(7), [corte(45)], { barbeiroId: "b2" }),
      L(T(1, 10, 7), [corte(999)]),
    ];
    const p = previsaoFerias(b1, [b1, b2, inativo, dono], todas, { missoes: [] }, "2026-10-12", "2026-10-17", T(11, 12));
    expect(p).toMatchObject({ dias: 6, media: 60, queda: 360, tk: 45, cortes: 8, porPessoa: 8 });
    expect(p.refs.map((r) => r.id)).toEqual(["b2"]);
    const sozinho = previsaoFerias(b1, [b1, dono], todas, { missoes: [] }, "2026-10-12", "2026-10-12", T(11, 12));
    expect(sozinho.refs.map((r) => r.id)).toEqual(["d"]);
    expect(sozinho.dias).toBe(1);
    expect(sozinho.tk).toBe(60);
  });
});
