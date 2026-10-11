import { describe, expect, it, vi } from "vitest";
import { criarBackendSupabase } from "./backend-supabase.ts";

/** Cliente Supabase falso: registra cada chamada encadeada e responde com `respostas[tabela|rpc]`. */
function clienteFalso(respostas: Record<string, any> = {}) {
  const chamadas: any[] = [];
  const consulta = (alvo: string) => {
    const passos: any[] = [];
    const builder: any = new Proxy(
      {},
      {
        get(_, metodo: string) {
          if (metodo === "then") {
            const r = respostas[alvo];
            const valor = typeof r === "function" ? r(passos) : r;
            chamadas.push({ alvo, passos });
            return (ok: any) => Promise.resolve(valor?.error ? valor : { data: valor ?? [], error: null }).then(ok);
          }
          return (...args: any[]) => {
            passos.push([metodo, ...args]);
            return builder;
          };
        },
      },
    );
    return builder;
  };
  const canais: any[] = [];
  const sb = {
    from: (t: string) => consulta(t),
    rpc: (fn: string, args: any) => {
      chamadas.push({ alvo: `rpc:${fn}`, args });
      const r = respostas[`rpc:${fn}`];
      return Promise.resolve(r?.error ? r : { data: r, error: null });
    },
    storage: {
      from: (bucket: string) => ({
        upload: (caminho: string) => {
          chamadas.push({ alvo: `storage:${bucket}`, caminho });
          return Promise.resolve({ data: { path: caminho }, error: null });
        },
        createSignedUrl: (caminho: string, seg: number) => Promise.resolve({ data: { signedUrl: `https://assinado/${caminho}?t=${seg}` }, error: null }),
      }),
    },
    channel: (nome: string) => {
      const c: any = { nome, ouvintes: [] };
      c.on = (_tipo: string, filtro: any, fn: any) => {
        c.ouvintes.push({ filtro, fn });
        return c;
      };
      c.subscribe = (fn: any) => {
        fn("SUBSCRIBED");
        return c;
      };
      canais.push(c);
      return c;
    },
    removeChannel: vi.fn(),
  };
  return { sb, chamadas, canais };
}

const linhaLanc = {
  id: "l1",
  ts: "2026-10-11T13:00:00Z",
  barbeiro_id: "g",
  barbeiro_nome: "Gabriel",
  lancado_por: "n",
  lancado_por_nome: "Nathanael",
  cliente_id: null,
  cliente_nome: "Cliente avulso",
  itens: [{ tipo: "servico", id: "corte", qtd: 1, preco: 60 }],
  subtotal: 60,
  gorjeta: 0,
  total: 60,
  pagamentos: [{ forma: "PIX", valor: 60 }],
  fiado: false,
  pago: true,
  pago_em: "2026-10-11T13:00:00Z",
};

describe("backend Supabase (contrato com o SQL)", () => {
  it("carrega todas as tabelas, paginando de 1000 em 1000", async () => {
    const muitos = Array.from({ length: 1000 }, (_, i) => ({ ...linhaLanc, id: `l${i}` }));
    let pagina = 0;
    const { sb } = clienteFalso({
      lancamentos: () => (pagina++ === 0 ? muitos : [linhaLanc]),
      perfis: [{ id: "g", nome: "Gabriel", email: "g@x", role: "barbeiro", ativo: true, extra: { entrada: "09:00" } }],
      config: { dados: { comissaoProduto: 25 } },
      config_privada: null,
    });
    const b = criarBackendSupabase(sb, "g");
    const e = await b.carregar();
    expect(e.lancamentos).toHaveLength(1001);
    expect(e.perfis[0]).toMatchObject({ id: "g", entrada: "09:00" });
    expect(e.configPublica).toEqual({ comissaoProduto: 25 });
    expect(e.configPrivada).toEqual({});
  });

  it("chama as funções do banco com os nomes e parâmetros certos", async () => {
    const { sb, chamadas } = clienteFalso({
      "rpc:registrar_lancamento": linhaLanc,
      "rpc:editar_lancamento": linhaLanc,
      "rpc:excluir_lancamento": linhaLanc,
      "rpc:restaurar_lancamento": linhaLanc,
      "rpc:pagar_fiado": linhaLanc,
      "rpc:registrar_ponto": { id: "p", user_id: "g", dia: "2026-10-11", ts: "2026-10-11T12:00:00Z" },
      "rpc:fechar_caixa": { id: "f", user_id: "g", informado: { PIX: 1 }, esperado: { PIX: 1 } },
      "rpc:entrada_estoque": { id: "cerveja", nome: "CERVEJA", custo: "2.5", preco: "6", estoque: 30 },
    });
    const b = criarBackendSupabase(sb, "g");
    const l = await b.registrarLancamento({ id: "l1", barbeiroId: "g", itens: [], pagamentos: [], clienteNome: "X" });
    expect(l).toMatchObject({ id: "l1", lancadoPorId: "n", total: 60 });
    await b.editarLancamento({ id: "l1", ts: 0, barbeiroId: "g", itens: [], pagamentos: [] });
    await b.excluirLancamento("l1", "duplicado");
    await b.restaurarLancamento("l1");
    await b.pagarFiado("l1", "PIX");
    expect((await b.registrarPonto()).dia).toBe("2026-10-11");
    expect((await b.fecharCaixa({ PIX: 1 })).esperado).toEqual({ PIX: 1 });
    expect((await b.entradaEstoque("cerveja", 6)).custo).toBe(2.5);
    const rpcs = chamadas.filter((c) => c.alvo.startsWith("rpc:"));
    expect(rpcs.map((c) => c.alvo)).toEqual([
      "rpc:registrar_lancamento",
      "rpc:editar_lancamento",
      "rpc:excluir_lancamento",
      "rpc:restaurar_lancamento",
      "rpc:pagar_fiado",
      "rpc:registrar_ponto",
      "rpc:fechar_caixa",
      "rpc:entrada_estoque",
    ]);
    expect(Object.keys(rpcs[0].args)).toEqual(["p"]);
    expect(rpcs[0].args.p).toMatchObject({ id: "l1", barbeiro_id: "g", cliente_nome: "X" });
    expect(rpcs[1].args).toMatchObject({ p_id: "l1" });
    expect(rpcs[2].args).toEqual({ p_id: "l1", p_motivo: "duplicado" });
    expect(rpcs[4].args).toEqual({ p_id: "l1", p_forma: "PIX" });
    expect(rpcs[6].args).toEqual({ p_informado: { PIX: 1 } });
    expect(rpcs[7].args).toEqual({ p_id: "cerveja", p_qtd: 6 });
  });

  it("insere/atualiza tabelas com colunas em snake_case", async () => {
    const { sb, chamadas } = clienteFalso({
      clientes: { id: "c", nome: "Ana", telefone: "", criado_por: "g" },
      saques: { id: "s", barbeiro_id: "g", valor: "10", status: "pendente", periodos: [] },
      perfis: { id: "g", nome: "G", email: "g@x", role: "barbeiro", ativo: true, extra: {} },
      convites: { email: "a@b.c", nome: "A", role: "barbeiro", extra: {} },
      produtos: { id: "x", nome: "X", custo: 1, preco: 2, estoque: 0 },
      avaliacoes: { id: "a", cliente_id: "c", nota: 5 },
      ferias: { id: "f", user_id: "g", ini: "2026-11-01", fim: "2026-11-02" },
      meses_fechados: { mk: "2026-09", fat: "1", lucro: "1", atend: 1 },
      auditoria: [{ id: 1, ts: "2026-10-11T12:00:00Z", acao: "edicao", tabela: "lancamentos" }],
    });
    const b = criarBackendSupabase(sb, "g");
    expect((await b.criarCliente({ id: "c", nome: "Ana" })).criadoPor).toBe("g");
    await b.atualizarCliente("c", { fotoAntes: "x" });
    expect((await b.solicitarSaque({ id: "s", barbeiroId: "g", nome: "G", valor: 10, status: "pendente" })).valor).toBe(10);
    await b.resolverSaque("s", "pago");
    await b.atualizarPerfil("g", { ativo: false });
    await b.salvarConvite({ email: "a@b.c", nome: "A" });
    await b.excluirConvite("a@b.c");
    await b.salvarProduto({ id: "x", preco: 2 });
    await b.criarAvaliacao({ id: "a", clienteId: "c", nota: 5 });
    await b.criarFerias({ id: "f", userId: "g", ini: "2026-11-01", fim: "2026-11-02" });
    await b.excluirFerias("f");
    await b.salvarMesFechado({ mk: "2026-09", fat: 1, lucro: 1, atend: 1 });
    await b.salvarConfig("config_privada", { imposto: 6 });
    expect((await b.carregarAuditoria({ antesDe: Date.now() }))[0].acao).toBe("edicao");
    const insertCliente = chamadas.find((c) => c.alvo === "clientes").passos[0];
    expect(insertCliente).toEqual(["insert", { id: "c", nome: "Ana", criado_por: "g" }]);
    const updCliente = chamadas.filter((c) => c.alvo === "clientes")[1].passos[0];
    expect(updCliente).toEqual(["update", { foto_antes: "x" }]);
    const resolver = chamadas.filter((c) => c.alvo === "saques")[1].passos[0];
    expect(resolver[1]).toMatchObject({ status: "pago", resolvido_por: "g" });
    const auditoria = chamadas.find((c) => c.alvo === "auditoria").passos.map((p) => p[0]);
    expect(auditoria).toEqual(["select", "order", "limit", "lt"]);
  });

  it("fotos vão para o bucket privado na pasta do usuário e voltam como URL assinada", async () => {
    const { sb, chamadas } = clienteFalso();
    const b = criarBackendSupabase(sb, "g");
    const caminho = await b.enviarFoto(new Blob(["x"]), "proprio");
    expect(caminho).toMatch(/^g\/.+\.jpg$/);
    expect(await b.enviarFoto(new Blob(["x"]), "clientes")).toMatch(/^clientes\//);
    expect(chamadas.filter((c) => c.alvo === "storage:fotos")).toHaveLength(2);
    expect(await b.urlFoto("g/a.jpg")).toBe("https://assinado/g/a.jpg?t=3600");
  });

  it("tempo real converte cada mudança para o formato do app", () => {
    const { sb, canais } = clienteFalso();
    const b = criarBackendSupabase(sb, "g");
    const eventos: any[] = [];
    const status = vi.fn();
    const parar = b.assinar((e) => eventos.push(e), status);
    const canal = canais[0];
    const ouvinte = (t: string) => canal.ouvintes.find((o) => o.filtro.table === t).fn;
    ouvinte("lancamentos")({ eventType: "INSERT", new: linhaLanc });
    ouvinte("convites")({ eventType: "DELETE", old: { email: "a@b.c" } });
    ouvinte("config")({ new: { dados: { x: 1 } } });
    expect(eventos[0]).toMatchObject({ chave: "lancamentos", tipo: "upsert", obj: { id: "l1", lancadoPorId: "n" } });
    expect(eventos[1]).toEqual({ chave: "convites", tipo: "remover", id: "a@b.c" });
    expect(eventos[2]).toEqual({ chave: "configPublica", tipo: "config", dados: { x: 1 } });
    expect(status).toHaveBeenCalledWith("SUBSCRIBED");
    parar();
    expect(sb.removeChannel).toHaveBeenCalled();
  });

  it("erros do banco viram mensagens em português", async () => {
    const { sb } = clienteFalso({ "rpc:pagar_fiado": { error: { message: "FIADO_NAO_ENCONTRADO" } } });
    await expect(criarBackendSupabase(sb, "g").pagarFiado("x", "PIX")).rejects.toThrow(/já foi pago/);
  });
});
