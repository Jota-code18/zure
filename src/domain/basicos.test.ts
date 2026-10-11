import { describe, expect, it } from "vitest";
import { CONFIG_PUBLICA_PADRAO, itemNome, montarConfig, separarConfig } from "./config.ts";
import {
  dataBR,
  ddmm,
  diaKey,
  diasNoMes,
  hhmm,
  hora,
  inicioDia,
  inicioSemana,
  isoParaBR,
  mesLabel,
  mesmoDia,
  minutosDe,
  mkOf,
  rangeMes,
  rangePeriodo,
  rotuloSemana,
  somarDias,
} from "./datas.ts";
import { aleatorio, gerarDemo, USUARIOS_DEMO } from "./demo.ts";
import { brl, capitalizar, descreverItens, norm, num, pct, pctBR, primeiroNome, shortR, slug, tempoAtras, uid, waLink } from "./formato.ts";
import { comPadroes, cortesFaixa, extraPadrao, ganhoNivel, lucroNivelDono, nivelDe, planoPadrao, precoCorteDe, precoServ } from "./usuarios.ts";

const T = (d: number, h = 10, mes = 9) => new Date(2026, mes, d, h).getTime();

describe("formato", () => {
  it("moeda e números", () => {
    expect(brl(1234.5).replace(/\s/g, " ")).toBe("R$ 1.234,50");
    expect(brl("x")).toContain("0,00");
    expect(shortR(1234.4)).toBe("R$1.234");
    expect(pctBR(9.855)).toBe("9,86%");
    expect(num("12,5")).toBe(12.5);
    expect(num("-3")).toBe(0);
    expect(num("abc")).toBe(0);
    expect(pct(150, 100)).toBe(50);
    expect(pct(10, 0)).toBe(100);
    expect(pct(0, 0)).toBe(0);
  });
  it("textos", () => {
    expect(norm("  Ação ÉÇ ")).toBe("acao ec");
    expect(slug("Pomada Modeladora!")).toBe("pomada-modeladora");
    expect(slug("!!!")).toBe("item");
    expect(primeiroNome("João Victor")).toBe("João");
    expect(primeiroNome(undefined)).toBe("");
    expect(capitalizar("CORTE")).toBe("Corte");
    expect(
      descreverItens([
        { qtd: 2, nome: "CERVEJA" },
        { qtd: 1, nome: "CORTE" },
      ]),
    ).toBe("2x cerveja + corte");
    expect(uid()).toMatch(/^[0-9a-z-]{10,}$/);
  });
  it("whatsapp com DDI do Brasil", () => {
    expect(waLink("(62) 99999-8888", "oi")).toBe("https://wa.me/5562999998888?text=oi");
    expect(waLink("5562999998888", "a b")).toBe("https://wa.me/5562999998888?text=a%20b");
  });
  it("tempo relativo", () => {
    const agora = T(11);
    expect(tempoAtras(agora - 10_000, agora)).toBe("agora");
    expect(tempoAtras(agora - 5 * 60000, agora)).toBe("5 min atrás");
    expect(tempoAtras(agora - 3 * 3600000, agora)).toBe("3 h atrás");
    expect(tempoAtras(agora - 2 * 86400000, agora)).toBe("2 d atrás");
  });
});

describe("datas e períodos", () => {
  it("básicos", () => {
    expect(mkOf(T(11))).toBe("2026-10");
    expect(rangeMes("2026-10")).toEqual([new Date(2026, 9, 1).getTime(), new Date(2026, 10, 1).getTime()]);
    expect(mesLabel("2026-10")).toBe("Outubro de 2026");
    expect(inicioDia(T(11, 15))).toBe(new Date(2026, 9, 11).getTime());
    expect(diaKey(inicioSemana(T(11)))).toBe("2026-10-05"); // domingo → segunda anterior
    expect(diaKey(inicioSemana(T(5)))).toBe("2026-10-05");
    expect(diaKey(somarDias(T(31), 1))).toBe("2026-11-01");
    expect(diasNoMes("2026-02")).toBe(28);
    expect(hhmm("09:30")).toBe(570);
    expect(hhmm(undefined)).toBe(540);
    expect(minutosDe(T(5, 9))).toBe(540);
    expect(isoParaBR("2026-10-05")).toBe("05/10/2026");
    expect(rotuloSemana(T(5, 0))).toBe("05/10 a 11/10");
    expect(dataBR(T(5))).toBe("05/10/2026");
    expect(ddmm(T(5))).toBe("05/10");
    expect(hora(T(5, 9))).toBe("09:00");
    expect(mesmoDia(T(5, 1), T(5, 23))).toBe(true);
    expect(mesmoDia(T(5), T(6))).toBe(false);
  });
  it("rangePeriodo: dia, semana, mês, ano, datas", () => {
    const ref = T(11, 12);
    expect(rangePeriodo({ tipo: "dia", off: 0 }, ref).label).toBe("Hoje");
    expect(rangePeriodo({ tipo: "dia", off: 1 }, ref).label).toBe("Ontem");
    expect(rangePeriodo({ tipo: "dia", off: 2 }, ref).label).toBe("09/10/2026");
    const s = rangePeriodo({ tipo: "semana", off: 0 }, ref);
    expect(s.label).toBe("Esta semana · 05/10 a 11/10");
    expect(rangePeriodo({ tipo: "semana", off: 1 }, ref).label).toBe("Semana passada · 28/09 a 04/10");
    expect(rangePeriodo({ tipo: "semana", off: 3 }, ref).label).toMatch(/^Semana · /);
    expect(rangePeriodo({ tipo: "mes", off: 1 }, ref).label).toBe("Setembro de 2026");
    expect(rangePeriodo({ tipo: "ano", off: 0 }, ref)).toMatchObject({ label: "2026", ini: new Date(2026, 0, 1).getTime() });
    const c = rangePeriodo({ tipo: "custom", de: "2026-10-01", ate: "2026-10-03" }, ref);
    expect(c.label).toBe("01/10/2026 a 03/10/2026");
    expect(c.fim - c.ini).toBe(3 * 86400000);
    expect(rangePeriodo({ tipo: "custom", de: "2026-10-03", ate: "2026-10-01" }, ref).label).toBe("Últimos 7 dias");
    expect(rangePeriodo({ tipo: "dia", off: -5 }, ref).label).toBe("Hoje");
  });
});

describe("usuários e plano de carreira", () => {
  it("plano escala pelo preço do corte", () => {
    expect(planoPadrao(60).tiers.map((t) => t.minFat)).toEqual([0, 4500, 6000, 7200, 9000]);
    expect(planoPadrao(45).tiers[2].minFat).toBe(4500);
    expect(planoPadrao(undefined).tiers[1].minFat).toBe(4500);
  });
  it("padrões do perfil", () => {
    expect(extraPadrao("admin").plano.tiers).toEqual([]);
    expect(extraPadrao("admin").metaAtendSemana).toBe(20);
    expect(extraPadrao("barbeiro", 50).precos.corte).toBe(50);
    const u = comPadroes({ id: "x", role: "barbeiro", precos: { corte: 45 } });
    expect(u.plano.tiers[2].minFat).toBe(4500);
    expect(u.metaAtendMes).toBe(100);
    expect(comPadroes({ id: "x", role: "barbeiro", plano: { tiers: "lixo" } }).plano.tiers).toHaveLength(5);
    expect(comPadroes({ id: "d", role: "admin" }).plano.tiers).toEqual([]);
  });
  it("preço por barbeiro", () => {
    const cfg = { servicos: [{ id: "corte", preco: 65 }] };
    expect(precoServ({ precos: { corte: 50 } }, { id: "corte", preco: 65 })).toBe(50);
    expect(precoServ({ precos: { corte: 0 } }, { id: "corte", preco: 65 })).toBe(65);
    expect(precoServ(null, { id: "corte", preco: 65 })).toBe(65);
    expect(precoCorteDe({ precos: {} }, cfg)).toBe(65);
    expect(precoCorteDe({}, { servicos: [] })).toBe(65);
  });
  it("níveis, ganhos e faixas", () => {
    const u = { plano: planoPadrao(60) };
    expect(nivelDe(u, 0).idx).toBe(0);
    expect(nivelDe(u, 6000).atual.nome).toBe("META MÍNIMA");
    expect(nivelDe(u, 9999).proximo).toBeNull();
    expect(nivelDe({ plano: { tiers: [] } }, 100)).toBeNull();
    const t = u.plano.tiers;
    expect(ganhoNivel(t, 0).baixo).toBe(0);
    expect(ganhoNivel(t, 0).alto).toBeCloseTo(1799.6);
    expect(ganhoNivel(t, 4).alto).toBeNull();
    expect(cortesFaixa(t, 0, 60)).toBe("até 74 cortes");
    expect(cortesFaixa(t, 1, 60)).toBe("75 a 99 cortes");
    expect(cortesFaixa(t, 4, 60)).toBe("150+ cortes");
    const cfg = { imposto: 6, maquininha: 1.5, custoFixo: 3000, rateioFixo: 2 };
    expect(lucroNivelDono(cfg, t, 2)).toBeCloseTo(6000 - 3000 - 360 - 90 - 1500);
    expect(lucroNivelDono(cfg, t, 0)).toBeCloseTo(4500 - 1800 - 270 - 67.5 - 1500);
  });
});

describe("configuração", () => {
  it("separa parte pública da privada", () => {
    const { publica, privada } = separarConfig({ servicos: [], imposto: 5, contas: [], produtos: [1], custoFixo: 9 });
    expect(publica).toEqual({ servicos: [] });
    expect(privada).toEqual({ imposto: 5, contas: [] });
  });
  it("custo fixo = soma das contas; produtos ativos e em ordem", () => {
    const c = montarConfig({}, { contas: [{ valor: 100 }, { valor: "50.5" }] }, [
      { id: "b", ordem: 2 },
      { id: "a", ordem: 1 },
      { id: "z", ordem: 0, ativo: false },
    ]);
    expect(c.custoFixo).toBe(150.5);
    expect(c.produtos.map((p) => p.id)).toEqual(["a", "b"]);
    expect(c.servicos).toEqual(CONFIG_PUBLICA_PADRAO.servicos);
    expect(montarConfig(null, null, null).produtos).toEqual([]);
    expect(itemNome({ servicos: [{ id: "corte", nome: "CORTE" }], produtos: [] }, "corte")).toBe("corte");
    expect(itemNome({ servicos: [], produtos: [] }, "x")).toBe("x");
  });
});

describe("demonstração", () => {
  it("é determinística com a mesma semente", () => {
    const a = gerarDemo(USUARIOS_DEMO, { agora: T(11, 20), dias: 10, semente: 7 });
    const b = gerarDemo(USUARIOS_DEMO, { agora: T(11, 20), dias: 10, semente: 7 });
    expect(a.lancamentos.length).toBeGreaterThan(20);
    expect(a.lancamentos.map((l) => l.total)).toEqual(b.lancamentos.map((l) => l.total));
    expect(a.clientes).toHaveLength(18);
    expect(a.avaliacoes).toHaveLength(7);
    for (const l of a.lancamentos) {
      expect(l.ts).toBeLessThanOrEqual(T(11, 20));
      expect(l.total).toBeCloseTo(l.subtotal + l.gorjeta);
      if (!l.pago) expect(l.fiado).toBe(true);
    }
    const r = aleatorio(1);
    const v = r();
    expect(v).toBeGreaterThanOrEqual(0);
    expect(v).toBeLessThan(1);
  });
});
