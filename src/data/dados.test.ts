import { describe, expect, it, vi } from "vitest";
import { criarBackendMemoria } from "./backend-memoria.ts";
import { reducer } from "./DadosProvider.tsx";
import { ErroApp, traduzirErro } from "./erros.ts";
import * as M from "./mapeamento.ts";

const HOJE = new Date(2026, 9, 11, 15).getTime();
const usuarios = [
  { id: "d", nome: "Gustavo", email: "d@x", role: "admin", ativo: true },
  { id: "g", nome: "Gabriel", email: "g@x", role: "barbeiro", ativo: true },
  { id: "n", nome: "Nathanael", email: "n@x", role: "barbeiro", ativo: true },
  { id: "i", nome: "Inativo", email: "i@x", role: "barbeiro", ativo: false },
];
const corte = { tipo: "servico", id: "corte", nome: "CORTE", qtd: 1, preco: 60, custo: 0 };
const cerveja = { tipo: "produto", id: "cerveja", nome: "CERVEJA", qtd: 2, preco: 6, custo: 2.5 };

function backend(userId: string, dados = {}) {
  return criarBackendMemoria({ usuarios, userId, dados, agora: () => HOJE });
}
const novo = (extra = {}) => ({
  id: `l-${Math.random()}`,
  barbeiroId: "g",
  clienteId: null,
  clienteNome: "",
  itens: [corte, cerveja],
  gorjeta: 5,
  pagamentos: [{ forma: "PIX", valor: 77 }],
  fiado: false,
  ...extra,
});

describe("backend de memória (mesmas regras do banco)", () => {
  it("calcula totais no servidor, registra quem lançou e baixa o estoque", async () => {
    const b = backend("n");
    const ouvinte = vi.fn();
    b.assinar(ouvinte);
    const l = await b.registrarLancamento(novo({ subtotal: 1, total: 1 }));
    expect(l).toMatchObject({
      subtotal: 72,
      total: 77,
      ts: HOJE,
      lancadoPorId: "n",
      barbeiroNome: "Gabriel",
      clienteNome: "Cliente avulso",
      pago: true,
      pagoEm: HOJE,
    });
    const dono = backend("d", {});
    expect((await dono.carregar()).produtos.find((p) => p.id === "cerveja").estoque).toBe(24);
    expect((await b.carregar()).produtos.find((p) => p.id === "cerveja").estoque).toBe(22);
    expect(ouvinte).toHaveBeenCalledWith(expect.objectContaining({ chave: "lancamentos", tipo: "upsert" }));
  });

  it("recusa pagamento que não fecha, fiado sem cliente e barbeiro inativo", async () => {
    const b = backend("g");
    await expect(b.registrarLancamento(novo({ pagamentos: [{ forma: "PIX", valor: 10 }] }))).rejects.toThrow(/não bate/);
    await expect(b.registrarLancamento(novo({ fiado: true }))).rejects.toThrow(/Fiado precisa de cliente/);
    await expect(b.registrarLancamento(novo({ barbeiroId: "i" }))).rejects.toThrow(/inválido/);
    await expect(b.registrarLancamento(novo({ itens: [] }))).rejects.toThrow(/pelo menos um/);
    const f = await b.registrarLancamento(novo({ fiado: true, clienteId: "c1", clienteNome: "Ana" }));
    expect(f).toMatchObject({ pago: false, pagoEm: null, pagamentos: [{ forma: "FIADO", valor: 77 }] });
  });

  it("barbeiro só enxerga o que atendeu ou lançou; config privada só o dono", async () => {
    const dados = {
      lancamentos: [
        { id: "1", barbeiroId: "g", lancadoPorId: "g", itens: [], ts: HOJE },
        { id: "2", barbeiroId: "n", lancadoPorId: "g", itens: [], ts: HOJE },
        { id: "3", barbeiroId: "n", lancadoPorId: "n", itens: [], ts: HOJE },
      ],
      saques: [
        { id: "s1", barbeiroId: "g" },
        { id: "s2", barbeiroId: "n" },
      ],
      avaliacoes: [{ id: "a1", clienteId: "c", nota: 5 }],
      configPrivada: { imposto: 6 },
    };
    const g = await backend("g", dados).carregar();
    expect(g.lancamentos.map((l) => l.id)).toEqual(["1", "2"]);
    expect(g.saques.map((s) => s.id)).toEqual(["s1"]);
    expect(g.avaliacoes).toEqual([]);
    expect(g.configPrivada).toEqual({});
    const d = await backend("d", dados).carregar();
    expect(d.lancamentos).toHaveLength(3);
    expect(d.configPrivada).toEqual({ imposto: 6 });
    const inativo = await backend("i", dados).carregar();
    expect(inativo.lancamentos).toEqual([]);
  });

  it("só o dono corrige; o estoque acompanha a correção e a auditoria guarda antes/depois", async () => {
    const dono = backend("d");
    const l = await dono.registrarLancamento(novo());
    await expect(backend("g", {}).editarLancamento(l)).rejects.toThrow(/permissão/);
    const ed = await dono.editarLancamento({ ...l, itens: [corte], gorjeta: 0, pagamentos: [{ forma: "DINHEIRO", valor: 60 }] });
    expect(ed).toMatchObject({ total: 60, editadoPor: "d" });
    const estado = await dono.carregar();
    expect(estado.produtos.find((p) => p.id === "cerveja").estoque).toBe(24);
    const aud = await dono.carregarAuditoria();
    expect(aud.map((a) => a.acao)).toEqual(["edicao", "lancamento_por_outro"]);
    expect(aud[0].antes.total).toBe(77);
  });

  it("exclusão lógica: devolve estoque, pode ser desfeita e respeita a regra do dia", async () => {
    const g = backend("g");
    const l = await g.registrarLancamento(novo());
    const ex = await g.excluirLancamento(l.id, "duplicado");
    expect(ex).toMatchObject({ excluidoPor: "g", motivoExclusao: "duplicado" });
    expect((await g.carregar()).produtos.find((p) => p.id === "cerveja").estoque).toBe(24);
    expect(await g.excluirLancamento(l.id)).toMatchObject({ id: l.id });
    const r = await g.restaurarLancamento(l.id);
    expect(r.excluidoEm).toBeNull();
    expect(await g.restaurarLancamento(l.id)).toMatchObject({ excluidoEm: null });
    const antigo = backend("g", { lancamentos: [{ id: "velho", barbeiroId: "g", lancadoPorId: "g", itens: [], ts: HOJE - 3 * 86400000 }] });
    await expect(antigo.excluirLancamento("velho")).rejects.toThrow(/permissão/);
    await expect(antigo.excluirLancamento("nao-existe")).rejects.toThrow(/não encontrado/);
  });

  it("pagar fiado (só dono), ponto pelo relógio do servidor e caixa cego com esperado calculado", async () => {
    const d = backend("d");
    const f = await d.registrarLancamento(novo({ barbeiroId: "d", fiado: true, clienteId: "c", clienteNome: "Ana" }));
    await expect(backend("g", {}).pagarFiado(f.id, "PIX")).rejects.toThrow(/permissão/);
    const pago = await d.pagarFiado(f.id, "DINHEIRO");
    expect(pago).toMatchObject({ pago: true, pagoEm: HOJE, pagamentos: [{ forma: "DINHEIRO", valor: 77 }] });
    await expect(d.pagarFiado(f.id, "PIX")).rejects.toThrow(/já foi pago/);
    const p1 = await d.registrarPonto();
    const p2 = await d.registrarPonto();
    expect(p1.id).toBe(p2.id);
    expect(p1.dia).toBe("2026-10-11");
    await d.registrarLancamento(novo({ barbeiroId: "d", pagamentos: [{ forma: "CARTAO", valor: 77 }] }));
    const fc = await d.fecharCaixa({ PIX: 0, DINHEIRO: 77, CARTAO: 70 });
    expect(fc.esperado).toEqual({ PIX: 0, DINHEIRO: 77, CARTAO: 77 });
  });

  it("dono gerencia equipe, config, estoque, convites e férias; barbeiro não", async () => {
    const d = backend("d");
    const g = backend("g");
    await expect(g.salvarConfig("config_privada", {})).rejects.toThrow(/permissão/);
    await expect(g.salvarConvite({ email: "x@x", nome: "X" })).rejects.toThrow(/permissão/);
    await expect(g.entradaEstoque("cerveja", 5)).rejects.toThrow(/permissão/);
    expect((await d.entradaEstoque("cerveja", 6)).estoque).toBe(30);
    const conv = await d.salvarConvite({ email: " Novo@Zure.com ", nome: "Novo", role: "barbeiro" });
    expect(conv.email).toBe("novo@zure.com");
    await d.excluirConvite("novo@zure.com");
    expect((await d.carregar()).convites).toEqual([]);
    const perf = await d.atualizarPerfil("g", { ativo: false, extra: { entrada: "10:00" } });
    expect(perf).toMatchObject({ ativo: false, entrada: "10:00" });
    await d.salvarConfig("config", { servicos: [] });
    expect((await d.carregar()).configPublica).toEqual({ servicos: [] });
    const fer = await d.criarFerias({ id: "f1", userId: "n", ini: "2026-11-01", fim: "2026-11-05" });
    expect(fer.id).toBe("f1");
    await d.excluirFerias("f1");
    expect((await d.carregar()).ferias).toEqual([]);
    expect((await d.salvarMesFechado({ mk: "2026-09", fat: 1, lucro: 1, atend: 1 })).mk).toBe("2026-09");
    expect((await d.salvarProduto({ id: "nova", nome: "NOVA", preco: 5, custo: 1 })).estoque).toBe(0);
  });

  it("saque só do próprio barbeiro; dono resolve", async () => {
    const g = backend("g");
    await expect(g.solicitarSaque({ id: "s", barbeiroId: "n", valor: 10 })).rejects.toThrow(/permissão/);
    const s = await g.solicitarSaque({ id: "s", barbeiroId: "g", valor: 10, periodos: [] });
    expect(s.status).toBe("pendente");
    await expect(g.resolverSaque("s", "pago")).rejects.toThrow(/permissão/);
  });

  it("clientes: qualquer barbeiro cria, só o dono edita", async () => {
    const g = backend("g");
    const c = await g.criarCliente({ id: "c9", nome: "Zé" });
    expect(c).toMatchObject({ criadoPor: "g", telefone: "" });
    await expect(g.atualizarCliente("c9", { telefone: "1" })).rejects.toThrow(/permissão/);
    await expect(g.criarAvaliacao({ id: "a", clienteId: "c9", nota: 5 })).rejects.toThrow(/permissão/);
  });
});

describe("mapeamento banco ↔ app", () => {
  it("lançamento: datas em ms e números", () => {
    const l = M.lancamento.deLinha({
      id: "1",
      ts: "2026-10-11T18:00:00.000Z",
      pago_em: null,
      barbeiro_id: "g",
      lancado_por: "n",
      itens: [{ tipo: "servico", qtd: "1", preco: "60.00", custo: null }],
      subtotal: "60.00",
      gorjeta: null,
      total: "60",
      pagamentos: [{ forma: "PIX", valor: "60" }],
      fiado: false,
      pago: true,
    });
    expect(l).toMatchObject({ ts: Date.parse("2026-10-11T18:00:00.000Z"), pagoEm: null, lancadoPorId: "n", total: 60, gorjeta: 0 });
    expect(l.itens[0]).toMatchObject({ qtd: 1, preco: 60, custo: 0 });
    const p = M.lancamento.paraPayload({ ...l, ts: 0, clienteId: null });
    expect(p).toMatchObject({ barbeiro_id: "g", cliente_id: "", fiado: false, pago: true, comprovante: "" });
  });
  it("perfil: colunas fixas + extra", () => {
    const u = M.perfil.deLinha({ id: "g", nome: "G", email: "g@x", role: "barbeiro", ativo: true, extra: { entrada: "09:00" } });
    expect(u).toEqual({ id: "g", nome: "G", email: "g@x", role: "barbeiro", ativo: true, entrada: "09:00" });
    expect(M.perfil.paraLinha({ nome: "Novo", metaAtendMes: 90 }, u)).toEqual({ nome: "Novo", extra: { entrada: "09:00", metaAtendMes: 90 } });
    expect(M.perfil.paraLinha({ ativo: false }, u)).toEqual({ ativo: false });
  });
  it("demais tabelas", () => {
    expect(M.cliente.paraLinha({ fotoAntes: "a", telefone: "1" })).toEqual({ foto_antes: "a", telefone: "1" });
    expect(M.saque.deLinha({ id: "s", barbeiro_id: "g", valor: "10", ts: null, periodos: [{ semana: "x", valor: "10" }] }).periodos[0].valor).toBe(10);
    expect(M.fechamento.deLinha({ informado: { PIX: "1" }, esperado: null }).informado).toEqual({ PIX: 1 });
    expect(M.convite.paraLinha({ email: " A@B.c ", nome: " A " })).toEqual({ email: "a@b.c", nome: "A", role: "barbeiro", extra: {} });
    expect(M.mesFechado.paraLinha({ mk: "x", fat: 1.234, lucro: 2.345, atend: 3 })).toEqual({ mk: "x", fat: 1.23, lucro: 2.35, atend: 3 });
    expect(M.TABELAS.meses_fechados.chave).toBe("mesesFechados");
  });
});

describe("erros", () => {
  it("traduz códigos do banco e mensagens do Supabase Auth", () => {
    expect(traduzirErro({ message: "SEM_PERMISSAO" }).message).toMatch(/permissão/);
    expect(traduzirErro({ message: "Database error saving new user" }).codigo).toBe("CADASTRO_NAO_AUTORIZADO");
    expect(traduzirErro({ message: "Invalid login credentials" }).message).toBe("E-mail ou senha incorretos.");
    expect(traduzirErro({ message: "Failed to fetch" }).codigo).toBe("REDE");
    expect(traduzirErro({ message: "???" }).codigo).toBe("DESCONHECIDO");
    const e = new ErroApp("x", { codigo: "Y" });
    expect(traduzirErro(e)).toBe(e);
  });
});

describe("reducer do estado", () => {
  const base = { lancamentos: [{ id: "1", v: 1 }], convites: [{ email: "a" }], mesesFechados: [{ mk: "m" }], pendentes: 0 } as any;
  it("upsert, remover, pendentes e config", () => {
    expect(reducer(base, { tipo: "upsert", chave: "lancamentos", obj: { id: "1", v: 2 } }).lancamentos).toEqual([{ id: "1", v: 2 }]);
    expect(reducer(base, { tipo: "upsert", chave: "lancamentos", obj: { id: "2" } }).lancamentos.map((l) => l.id)).toEqual(["2", "1"]);
    expect(reducer(base, { tipo: "remover", chave: "convites", id: "a" }).convites).toEqual([]);
    expect(reducer(base, { tipo: "remover", chave: "mesesFechados", id: "m" }).mesesFechados).toEqual([]);
    expect(reducer(base, { tipo: "pendentes", delta: -1 }).pendentes).toBe(0);
    expect(reducer(base, { tipo: "config", chave: "configPublica", dados: { a: 1 } }).configPublica).toEqual({ a: 1 });
    expect(reducer(base, { tipo: "desconhecido" })).toBe(base);
  });
});
