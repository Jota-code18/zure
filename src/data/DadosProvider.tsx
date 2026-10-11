/* Estado compartilhado do app + ações. Funciona igual com o backend Supabase ou o de memória (demo). */
import { createContext, useCallback, useContext, useEffect, useMemo, useReducer, useRef, useState } from "react";
import { montarConfig, separarConfig } from "../domain/config.ts";
import { ajusteEstoque } from "../domain/lancamento.ts";
import { comPadroes } from "../domain/usuarios.ts";
import { identificarUsuario, registrarEvento, reportarErro } from "../observability/index.ts";
import { traduzirErro } from "./erros.ts";
import { perfil as mapaPerfil } from "./mapeamento.ts";

const DadosCtx = createContext(null);

const VAZIO = {
  carregando: true,
  erro: null,
  pendentes: 0,
  conexao: "conectando",
  perfis: [],
  produtos: [],
  clientes: [],
  lancamentos: [],
  saques: [],
  pontos: [],
  fechamentos: [],
  avaliacoes: [],
  ferias: [],
  mesesFechados: [],
  convites: [],
  configPublica: {},
  configPrivada: {},
};

function upsert(lista, obj, idKey = "id") {
  const i = lista.findIndex((x) => x[idKey] === obj[idKey]);
  if (i < 0) return [obj, ...lista];
  const nova = lista.slice();
  nova[i] = obj;
  return nova;
}

export function reducer(s, a) {
  switch (a.tipo) {
    case "carregado":
      return { ...s, ...a.estado, carregando: false, erro: null };
    case "erroCarga":
      return { ...s, carregando: false, erro: a.erro };
    case "upsert":
      return { ...s, [a.chave]: upsert(s[a.chave] || [], a.obj, a.idKey) };
    case "remover": {
      const idKey = a.idKey || (a.chave === "convites" ? "email" : a.chave === "mesesFechados" ? "mk" : "id");
      return { ...s, [a.chave]: (s[a.chave] || []).filter((x) => x[idKey] !== a.id) };
    }
    case "config":
      return { ...s, [a.chave]: a.dados };
    case "pendentes":
      return { ...s, pendentes: Math.max(0, s.pendentes + a.delta) };
    case "conexao":
      return { ...s, conexao: a.conexao };
    default:
      return s;
  }
}

export function DadosProvider({ backend, modoDemo = false, children }: { backend: any; modoDemo?: boolean; children?: React.ReactNode }) {
  const [s, dispatch] = useReducer(reducer, VAZIO);
  const ref = useRef(s);
  ref.current = s;
  const [versao, setVersao] = useState(0);

  const recarregar = useCallback(() => setVersao((v) => v + 1), []);

  // biome-ignore lint/correctness/useExhaustiveDependencies: `versao` existe só para forçar a recarga.
  useEffect(() => {
    let vivo = true;
    backend
      .carregar()
      .then((estado) => vivo && dispatch({ tipo: "carregado", estado }))
      .catch((e) => {
        reportarErro(e, { etapa: "carregar" });
        if (vivo) dispatch({ tipo: "erroCarga", erro: traduzirErro(e) });
      });
    return () => {
      vivo = false;
    };
  }, [backend, versao]);

  // Tempo real + recarga quando a conexão volta (para não perder nada que mudou offline).
  useEffect(() => {
    let caiu = false;
    const parar = backend.assinar(
      (ev) => {
        if (ev.tipo === "config") dispatch({ tipo: "config", chave: ev.chave, dados: ev.dados });
        else if (ev.tipo === "remover") dispatch({ tipo: "remover", chave: ev.chave, id: ev.id });
        else dispatch({ tipo: "upsert", chave: ev.chave, obj: ev.obj, idKey: ev.idKey });
      },
      (status) => {
        if (status === "SUBSCRIBED") {
          dispatch({ tipo: "conexao", conexao: "online" });
          if (caiu) recarregar();
          caiu = false;
        } else if (["CHANNEL_ERROR", "TIMED_OUT", "CLOSED"].includes(status)) {
          caiu = true;
          dispatch({ tipo: "conexao", conexao: "offline" });
        }
      },
    );
    const voltou = () => recarregar();
    window.addEventListener("online", voltou);
    return () => {
      parar();
      window.removeEventListener("online", voltou);
    };
  }, [backend, recarregar]);

  /** Roda uma ação no backend com barra de progresso global, tradução de erro e telemetria. */
  const executar = useCallback(async (nome, fn) => {
    dispatch({ tipo: "pendentes", delta: 1 });
    try {
      const r = await fn();
      registrarEvento(nome);
      return r;
    } catch (e) {
      const erro = traduzirErro(e);
      if (["DESCONHECIDO", "REDE"].includes(erro.codigo)) reportarErro(e, { acao: nome });
      throw erro;
    } finally {
      dispatch({ tipo: "pendentes", delta: -1 });
    }
  }, []);

  const fotos = useRef(new Map());

  const acoes = useMemo(() => {
    const salvarEm =
      (chave: string, idKey = "id") =>
      (obj) => {
        dispatch({ tipo: "upsert", chave, obj, idKey });
        return obj;
      };
    const moverEstoqueLocal = (delta) => {
      for (const [id, q] of Object.entries(delta)) {
        const p = ref.current.produtos.find((x) => x.id === id);
        if (p) dispatch({ tipo: "upsert", chave: "produtos", obj: { ...p, estoque: Math.max(0, p.estoque + q) } });
      }
    };
    const lanc = salvarEm("lancamentos");

    return {
      /** Otimista: aparece na hora; se o servidor recusar, desfaz e avisa. */
      async registrarLancamento(l) {
        dispatch({ tipo: "upsert", chave: "lancamentos", obj: { ...l, _pendente: true } });
        const delta = ajusteEstoque([], l.itens);
        moverEstoqueLocal(delta);
        try {
          return lanc(await executar("lancamento.registrar", () => backend.registrarLancamento(l)));
        } catch (e) {
          dispatch({ tipo: "remover", chave: "lancamentos", id: l.id });
          moverEstoqueLocal(Object.fromEntries(Object.entries(delta).map(([k, v]) => [k, -v])));
          throw e;
        }
      },
      editarLancamento: async (l) => lanc(await executar("lancamento.editar", () => backend.editarLancamento(l))),
      excluirLancamento: async (id, motivo) => lanc(await executar("lancamento.excluir", () => backend.excluirLancamento(id, motivo))),
      restaurarLancamento: async (id) => lanc(await executar("lancamento.restaurar", () => backend.restaurarLancamento(id))),
      pagarFiado: async (id, forma) => lanc(await executar("fiado.pagar", () => backend.pagarFiado(id, forma))),

      criarCliente: async (c) => salvarEm("clientes")(await executar("cliente.criar", () => backend.criarCliente(c))),
      atualizarCliente: async (id, patch) => salvarEm("clientes")(await executar("cliente.atualizar", () => backend.atualizarCliente(id, patch))),

      solicitarSaque: async (sq) => salvarEm("saques")(await executar("saque.solicitar", () => backend.solicitarSaque(sq))),
      resolverSaque: async (id, status) => salvarEm("saques")(await executar("saque.resolver", () => backend.resolverSaque(id, status))),

      registrarPonto: async () => salvarEm("pontos")(await executar("ponto.registrar", () => backend.registrarPonto())),
      fecharCaixa: async (inf) => salvarEm("fechamentos")(await executar("caixa.fechar", () => backend.fecharCaixa(inf))),

      criarAvaliacao: async (a) => salvarEm("avaliacoes")(await executar("avaliacao.criar", () => backend.criarAvaliacao(a))),
      criarFerias: async (f) => salvarEm("ferias")(await executar("ferias.criar", () => backend.criarFerias(f))),
      async excluirFerias(id) {
        await executar("ferias.excluir", () => backend.excluirFerias(id));
        dispatch({ tipo: "remover", chave: "ferias", id });
      },
      salvarMesFechado: async (m) => salvarEm("mesesFechados", "mk")(await executar("mes.fechar", () => backend.salvarMesFechado(m))),

      /** Recebe uma função (config atual → nova config) e salva só a parte que mudou. */
      async atualizarConfig(fn) {
        const { configPublica, configPrivada, produtos } = ref.current;
        const base = montarConfig(configPublica, configPrivada, produtos);
        const nova = fn(base);
        const alterado = {};
        for (const k of Object.keys(nova)) if (JSON.stringify(nova[k]) !== JSON.stringify(base[k])) alterado[k] = nova[k];
        const { publica, privada } = separarConfig(alterado);
        const partes = [
          ["config", "configPublica", publica, configPublica],
          ["config_privada", "configPrivada", privada, configPrivada],
        ].filter(([, , patch]) => Object.keys(patch).length);
        if (!partes.length) return;
        for (const [, chave, patch, atual] of partes) dispatch({ tipo: "config", chave, dados: { ...atual, ...patch } });
        try {
          await executar("config.salvar", () => Promise.all(partes.map(([tabela, , patch, atual]) => backend.salvarConfig(tabela, { ...atual, ...patch }))));
        } catch (e) {
          for (const [, chave, , atual] of partes) dispatch({ tipo: "config", chave, dados: atual });
          throw e;
        }
      },
      salvarProduto: async (p) => salvarEm("produtos")(await executar("produto.salvar", () => backend.salvarProduto(p))),
      entradaEstoque: async (id, q) => salvarEm("produtos")(await executar("estoque.entrada", () => backend.entradaEstoque(id, q))),

      async atualizarPerfil(id, patch) {
        const atual = ref.current.perfis.find((p) => p.id === id);
        const linha = mapaPerfil.paraLinha(patch, atual);
        dispatch({ tipo: "upsert", chave: "perfis", obj: { ...atual, ...patch } });
        try {
          return salvarEm("perfis")(await executar("perfil.atualizar", () => backend.atualizarPerfil(id, linha)));
        } catch (e) {
          dispatch({ tipo: "upsert", chave: "perfis", obj: atual });
          throw e;
        }
      },
      salvarConvite: async (c) => salvarEm("convites", "email")(await executar("convite.salvar", () => backend.salvarConvite(c))),
      async excluirConvite(email) {
        await executar("convite.excluir", () => backend.excluirConvite(email));
        dispatch({ tipo: "remover", chave: "convites", id: email });
      },

      carregarAuditoria: (opts) => executar("auditoria.listar", () => backend.carregarAuditoria(opts)),
      enviarFoto: (blob, pasta) => executar("foto.enviar", () => backend.enviarFoto(blob, pasta)),

      /** URL temporária de uma foto privada (cache de 50 min). */
      urlFoto(caminho) {
        if (!caminho) return Promise.resolve(null);
        if (/^(data:|blob:|https?:)/.test(caminho)) return Promise.resolve(caminho);
        const cache = fotos.current.get(caminho);
        if (cache && cache.expira > Date.now()) return cache.promessa;
        const promessa = backend.urlFoto(caminho).catch((e) => {
          fotos.current.delete(caminho);
          throw e;
        });
        fotos.current.set(caminho, { promessa, expira: Date.now() + 50 * 60000 });
        return promessa;
      },
      recarregar,
    };
  }, [backend, executar, recarregar]);

  const users = useMemo(() => s.perfis.map(comPadroes), [s.perfis]);
  const user = useMemo(() => users.find((u) => u.id === backend.userId) || null, [users, backend.userId]);
  const config = useMemo(() => montarConfig(s.configPublica, s.configPrivada, s.produtos), [s.configPublica, s.configPrivada, s.produtos]);
  const lancamentos = useMemo(() => s.lancamentos.filter((l) => !l.excluidoEm), [s.lancamentos]);

  useEffect(() => {
    identificarUsuario(user);
  }, [user]);

  const valor = useMemo(
    () => ({
      ...s,
      modoDemo,
      user,
      users,
      config,
      lancamentos,
      lancamentosTodos: s.lancamentos,
      acoes,
    }),
    [s, modoDemo, user, users, config, lancamentos, acoes],
  );

  return <DadosCtx.Provider value={valor}>{children}</DadosCtx.Provider>;
}

export function useDados() {
  const v = useContext(DadosCtx);
  if (!v) throw new Error("useDados precisa estar dentro de <DadosProvider>");
  return v;
}

/** Resolve o caminho de uma foto privada em URL (só quando `ativo`, para carregar sob demanda). */
export function useFotoUrl(caminho, ativo = true) {
  const { acoes } = useDados();
  const [url, setUrl] = useState(null);
  const [erro, setErro] = useState(false);
  useEffect(() => {
    if (!caminho || !ativo) return;
    let vivo = true;
    setErro(false);
    acoes
      .urlFoto(caminho)
      .then((u) => vivo && setUrl(u))
      .catch(() => vivo && setErro(true));
    return () => {
      vivo = false;
    };
  }, [caminho, ativo, acoes]);
  return { url: caminho ? url : null, erro };
}
