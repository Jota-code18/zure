/* Backend real: Supabase (Postgres + RLS + Realtime + Storage). */
import { medir } from "../observability/index.ts";
import { traduzirErro } from "./erros.ts";
import * as M from "./mapeamento.ts";

const PAGINA = 1000;

export function criarBackendSupabase(sb, userId) {
  async function q(nome, fn) {
    return medir(`db.${nome}`, async () => {
      const { data, error } = await fn();
      if (error) throw traduzirErro(error);
      return data;
    });
  }

  /** Busca todas as linhas, de 1000 em 1000 (limite padrão do Supabase). */
  async function tudo(tabela, ordem, asc = false) {
    const out = [];
    for (let de = 0; ; de += PAGINA) {
      const linhas = await q(`listar.${tabela}`, () =>
        sb
          .from(tabela)
          .select("*")
          .order(ordem, { ascending: asc })
          .range(de, de + PAGINA - 1),
      );
      out.push(...linhas);
      if (linhas.length < PAGINA) return out;
    }
  }

  const rpc = (fn: string, args?: Record<string, unknown>) => q(`rpc.${fn}`, () => sb.rpc(fn, args));
  const lanc = async (fn, args) => M.lancamento.deLinha(await rpc(fn, args));

  return {
    modo: "supabase",
    userId,

    async carregar() {
      const [perfis, produtos, clientes, lancamentos, saques, pontos, fechamentos, avaliacoes, ferias, meses, convites, cfg, cfgPriv] = await Promise.all([
        tudo("perfis", "nome", true),
        tudo("produtos", "ordem", true),
        tudo("clientes", "nome", true),
        tudo("lancamentos", "ts"),
        tudo("saques", "ts"),
        tudo("pontos", "ts"),
        tudo("fechamentos", "ts"),
        tudo("avaliacoes", "ts"),
        tudo("ferias", "ini"),
        tudo("meses_fechados", "mk"),
        tudo("convites", "criado_em"),
        q("config", () => sb.from("config").select("dados").maybeSingle()),
        q("config_privada", () => sb.from("config_privada").select("dados").maybeSingle()),
      ]);
      return {
        perfis: perfis.map(M.perfil.deLinha),
        produtos: produtos.map(M.produto.deLinha),
        clientes: clientes.map(M.cliente.deLinha),
        lancamentos: lancamentos.map(M.lancamento.deLinha),
        saques: saques.map(M.saque.deLinha),
        pontos: pontos.map(M.ponto.deLinha),
        fechamentos: fechamentos.map(M.fechamento.deLinha),
        avaliacoes: avaliacoes.map(M.avaliacao.deLinha),
        ferias: ferias.map(M.ferias.deLinha),
        mesesFechados: meses.map(M.mesFechado.deLinha),
        convites: convites.map(M.convite.deLinha),
        configPublica: cfg?.dados || {},
        configPrivada: cfgPriv?.dados || {},
      };
    },

    /** Tempo real: cada mudança no banco chega aqui (já filtrada pelas regras de acesso). */
    assinar(aoMudar, aoStatus?: (status: string) => void) {
      const canal = sb.channel(`zure-${userId}`);
      for (const [tabela, def] of Object.entries(M.TABELAS)) {
        canal.on("postgres_changes", { event: "*", schema: "public", table: tabela }, (ev) => {
          if (ev.eventType === "DELETE") aoMudar({ chave: def.chave, tipo: "remover", id: ev.old?.[def.id] });
          else aoMudar({ chave: def.chave, tipo: "upsert", obj: def.mapa.deLinha(ev.new), idKey: def.id });
        });
      }
      for (const tabela of ["config", "config_privada"]) {
        canal.on("postgres_changes", { event: "UPDATE", schema: "public", table: tabela }, (ev) =>
          aoMudar({ chave: tabela === "config" ? "configPublica" : "configPrivada", tipo: "config", dados: ev.new.dados }),
        );
      }
      canal.subscribe((status) => aoStatus?.(status));
      return () => sb.removeChannel(canal);
    },

    registrarLancamento: (l) => lanc("registrar_lancamento", { p: M.lancamento.paraPayload(l) }),
    editarLancamento: (l) => lanc("editar_lancamento", { p_id: l.id, p: M.lancamento.paraPayload(l) }),
    excluirLancamento: (id, motivo) => lanc("excluir_lancamento", { p_id: id, p_motivo: motivo || null }),
    restaurarLancamento: (id) => lanc("restaurar_lancamento", { p_id: id }),
    pagarFiado: (id, forma) => lanc("pagar_fiado", { p_id: id, p_forma: forma }),

    async registrarPonto() {
      return M.ponto.deLinha(await rpc("registrar_ponto"));
    },
    async fecharCaixa(informado) {
      return M.fechamento.deLinha(await rpc("fechar_caixa", { p_informado: informado }));
    },
    async entradaEstoque(id, qtd) {
      return M.produto.deLinha(await rpc("entrada_estoque", { p_id: id, p_qtd: qtd }));
    },

    async criarCliente(c) {
      const r = await q("clientes.criar", () =>
        sb
          .from("clientes")
          .insert({ ...M.cliente.paraLinha(c), criado_por: userId })
          .select()
          .single(),
      );
      return M.cliente.deLinha(r);
    },
    async atualizarCliente(id, patch) {
      const r = await q("clientes.atualizar", () => sb.from("clientes").update(M.cliente.paraLinha(patch)).eq("id", id).select().single());
      return M.cliente.deLinha(r);
    },

    async solicitarSaque(s) {
      const r = await q("saques.criar", () => sb.from("saques").insert(M.saque.paraLinha(s)).select().single());
      return M.saque.deLinha(r);
    },
    async resolverSaque(id, status) {
      const r = await q("saques.resolver", () =>
        sb.from("saques").update({ status, resolvido_em: new Date().toISOString(), resolvido_por: userId }).eq("id", id).select().single(),
      );
      return M.saque.deLinha(r);
    },

    async criarAvaliacao(a) {
      return M.avaliacao.deLinha(await q("avaliacoes.criar", () => sb.from("avaliacoes").insert(M.avaliacao.paraLinha(a)).select().single()));
    },
    async criarFerias(f) {
      return M.ferias.deLinha(await q("ferias.criar", () => sb.from("ferias").insert(M.ferias.paraLinha(f)).select().single()));
    },
    async excluirFerias(id) {
      await q("ferias.excluir", () => sb.from("ferias").delete().eq("id", id));
    },
    async salvarMesFechado(m) {
      return M.mesFechado.deLinha(await q("meses.salvar", () => sb.from("meses_fechados").upsert(M.mesFechado.paraLinha(m)).select().single()));
    },

    async salvarConfig(tabela, dados) {
      await q(`${tabela}.salvar`, () => sb.from(tabela).update({ dados, atualizado_em: new Date().toISOString() }).eq("id", 1));
      return dados;
    },
    async salvarProduto(p) {
      return M.produto.deLinha(await q("produtos.salvar", () => sb.from("produtos").upsert(M.produto.paraLinha(p)).select().single()));
    },
    async atualizarPerfil(id, linha) {
      return M.perfil.deLinha(await q("perfis.atualizar", () => sb.from("perfis").update(linha).eq("id", id).select().single()));
    },
    async salvarConvite(c) {
      return M.convite.deLinha(await q("convites.salvar", () => sb.from("convites").upsert(M.convite.paraLinha(c)).select().single()));
    },
    async excluirConvite(email) {
      await q("convites.excluir", () => sb.from("convites").delete().eq("email", email));
    },

    async carregarAuditoria({ antesDe, limite = 50 }: { antesDe?: number; limite?: number } = {}) {
      let consulta = sb.from("auditoria").select("*").order("ts", { ascending: false }).limit(limite);
      if (antesDe) consulta = consulta.lt("ts", new Date(antesDe).toISOString());
      return (await q("auditoria.listar", () => consulta)).map(M.auditoria.deLinha);
    },

    /** Envia a foto para o bucket privado e devolve o caminho salvo no banco. */
    async enviarFoto(blob, pasta) {
      const caminho = `${pasta === "proprio" ? userId : pasta}/${crypto.randomUUID()}.jpg`;
      await q("fotos.enviar", () => sb.storage.from("fotos").upload(caminho, blob, { contentType: "image/jpeg", upsert: false }));
      return caminho;
    },
    async urlFoto(caminho) {
      const r = await q("fotos.url", () => sb.storage.from("fotos").createSignedUrl(caminho, 3600));
      return r.signedUrl;
    },
  };
}
