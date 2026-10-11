/* Backend em memória: usado no MODO DEMONSTRAÇÃO e nos testes.
 * Nada aqui toca o banco. Reproduz as mesmas regras das funções/RLS do Supabase,
 * para a demonstração se comportar igual ao app real. */
import { CONFIG_PUBLICA_PADRAO, PRODUTOS_INICIAIS } from "../domain/config.ts";
import { diaKey, mesmoDia } from "../domain/datas.ts";
import { uid } from "../domain/formato.ts";
import { ajusteEstoque, podeExcluir, subtotalDe, visivelPara } from "../domain/lancamento.ts";
import { ErroApp } from "./erros.ts";

const clonar = (v) => (typeof structuredClone === "function" ? structuredClone(v) : JSON.parse(JSON.stringify(v)));
const esperar = (ms) => (ms > 0 ? new Promise((r) => setTimeout(r, ms)) : Promise.resolve());

export function criarBackendMemoria({
  usuarios,
  dados = {},
  userId,
  atraso = 0,
  atrasoCarga = atraso,
  agora = () => Date.now(),
}: {
  usuarios: any[];
  dados?: Record<string, any>;
  userId: string;
  atraso?: number;
  atrasoCarga?: number;
  agora?: () => number;
}) {
  const db = {
    perfis: clonar(usuarios),
    produtos: clonar(dados.produtos || PRODUTOS_INICIAIS.map((p) => ({ ...p, ativo: true }))),
    clientes: clonar(dados.clientes || []),
    lancamentos: clonar(dados.lancamentos || []),
    saques: clonar(dados.saques || []),
    pontos: clonar(dados.pontos || []),
    fechamentos: clonar(dados.fechamentos || []),
    avaliacoes: clonar(dados.avaliacoes || []),
    ferias: clonar(dados.ferias || []),
    mesesFechados: clonar(dados.mesesFechados || []),
    convites: clonar(dados.convites || []),
    auditoria: [],
    configPublica: clonar(dados.configPublica || CONFIG_PUBLICA_PADRAO),
    configPrivada: clonar(dados.configPrivada || {}),
  };
  const ouvintes = new Set<(ev: any) => void>();
  const eu = () => db.perfis.find((p) => p.id === userId);
  const dono = () => eu()?.role === "admin";

  function exigir(cond) {
    if (!cond) throw new ErroApp("Você não tem permissão para isso.", { codigo: "SEM_PERMISSAO" });
  }

  /** Mesmas regras de leitura do banco (RLS). */
  function visivel(chave, o) {
    const u = eu();
    if (!u?.ativo) return false;
    if (u.role === "admin") return true;
    if (chave === "lancamentos") return visivelPara(u, o);
    if (["saques"].includes(chave)) return o.barbeiroId === u.id;
    if (["pontos", "fechamentos"].includes(chave)) return o.userId === u.id;
    if (["avaliacoes", "ferias", "mesesFechados", "convites"].includes(chave)) return false;
    return true;
  }

  function emitir(chave, obj, idKey = "id") {
    if (!visivel(chave, obj)) return;
    for (const fn of ouvintes) fn({ chave, tipo: "upsert", obj: clonar(obj), idKey });
  }

  function salvar(chave, obj, idKey = "id") {
    const lista = db[chave];
    const i = lista.findIndex((x) => x[idKey] === obj[idKey]);
    if (i >= 0) lista[i] = obj;
    else lista.unshift(obj);
    emitir(chave, obj, idKey);
    return clonar(obj);
  }

  function auditar(tabela, registroId, acao, antes, depois) {
    db.auditoria.unshift({ id: db.auditoria.length + 1, ts: agora(), usuarioId: userId, usuarioNome: eu()?.nome, tabela, registroId, acao, antes, depois });
  }

  function moverEstoque(delta) {
    for (const [id, q] of Object.entries(delta)) {
      const p = db.produtos.find((x) => x.id === id);
      if (p) salvar("produtos", { ...p, estoque: Math.max(0, p.estoque + q) });
    }
  }

  function normalizar(l, pendente) {
    if (!l.itens?.length) throw new ErroApp("Escolha pelo menos um serviço ou produto.");
    const subtotal = subtotalDe(l.itens);
    const gorjeta = Math.max(0, +(l.gorjeta || 0).toFixed(2));
    const total = +(subtotal + gorjeta).toFixed(2);
    if (pendente) return { subtotal, gorjeta, total, pagamentos: [{ forma: "FIADO", valor: total }] };
    const soma = l.pagamentos.reduce((a, p) => a + p.valor, 0);
    if (Math.abs(soma - total) > 0.01) throw new ErroApp("A soma dos pagamentos não bate com o total.");
    return { subtotal, gorjeta, total, pagamentos: l.pagamentos };
  }

  const op =
    (fn) =>
    async (...args) => {
      await esperar(atraso);
      return fn(...args);
    };

  return {
    modo: "memoria",
    userId,

    async carregar() {
      await esperar(atrasoCarga);
      const ver = (chave) => clonar(db[chave].filter((o) => visivel(chave, o)));
      return {
        perfis: clonar(db.perfis),
        produtos: clonar(db.produtos),
        clientes: ver("clientes"),
        lancamentos: ver("lancamentos"),
        saques: ver("saques"),
        pontos: ver("pontos"),
        fechamentos: ver("fechamentos"),
        avaliacoes: ver("avaliacoes"),
        ferias: ver("ferias"),
        mesesFechados: ver("mesesFechados"),
        convites: ver("convites"),
        configPublica: clonar(db.configPublica),
        configPrivada: dono() ? clonar(db.configPrivada) : {},
      };
    },

    assinar(fn, aoStatus?: (status: string) => void) {
      ouvintes.add(fn);
      aoStatus?.("SUBSCRIBED");
      return () => ouvintes.delete(fn);
    },

    registrarLancamento: op((l) => {
      const u = eu();
      exigir(u?.ativo);
      const barb = db.perfis.find((p) => p.id === l.barbeiroId && p.ativo !== false);
      if (!barb) throw new ErroApp("Barbeiro inválido ou inativo.");
      if (l.fiado && !l.clienteId) throw new ErroApp("Fiado precisa de cliente.");
      const n = normalizar(l, l.fiado);
      const ts = agora();
      const novo = {
        ...l,
        ...n,
        id: l.id || uid(),
        ts,
        barbeiroNome: barb.nome,
        lancadoPorId: u.id,
        lancadoPorNome: u.nome,
        clienteNome: l.clienteNome || "Cliente avulso",
        pago: !l.fiado,
        pagoEm: l.fiado ? null : ts,
      };
      auditar("lancamentos", novo.id, novo.lancadoPorId !== novo.barbeiroId ? "lancamento_por_outro" : "lancamento", null, novo);
      const r = salvar("lancamentos", novo);
      moverEstoque(ajusteEstoque([], novo.itens));
      return r;
    }),

    editarLancamento: op((l) => {
      exigir(dono());
      const velho = db.lancamentos.find((x) => x.id === l.id);
      if (!velho) throw new ErroApp("Lançamento não encontrado.");
      const barb = db.perfis.find((p) => p.id === l.barbeiroId) || db.perfis.find((p) => p.id === velho.barbeiroId);
      const pago = l.pago ?? !l.fiado;
      if (l.fiado && !pago && !l.clienteId) throw new ErroApp("Fiado precisa de cliente.");
      const n = normalizar(l, l.fiado && !pago);
      const novo = {
        ...velho,
        ...l,
        ...n,
        barbeiroId: barb.id,
        barbeiroNome: barb.nome,
        clienteNome: l.clienteNome || "Cliente avulso",
        pago,
        pagoEm: pago ? velho.pagoEm || l.ts || velho.ts : null,
        editadoEm: agora(),
        editadoPor: userId,
      };
      auditar("lancamentos", novo.id, "edicao", velho, novo);
      moverEstoque(ajusteEstoque(velho.itens, novo.itens));
      return salvar("lancamentos", novo);
    }),

    excluirLancamento: op((id, motivo) => {
      const l = db.lancamentos.find((x) => x.id === id);
      if (!l) throw new ErroApp("Lançamento não encontrado.");
      exigir(podeExcluir(eu(), l, agora()));
      if (l.excluidoEm) return clonar(l);
      const novo = { ...l, excluidoEm: agora(), excluidoPor: userId, motivoExclusao: motivo || null };
      auditar("lancamentos", id, "exclusao", l, novo);
      moverEstoque(ajusteEstoque(l.itens, []));
      return salvar("lancamentos", novo);
    }),

    restaurarLancamento: op((id) => {
      const l = db.lancamentos.find((x) => x.id === id);
      if (!l) throw new ErroApp("Lançamento não encontrado.");
      exigir(podeExcluir(eu(), l, agora()));
      if (!l.excluidoEm) return clonar(l);
      const novo = { ...l, excluidoEm: null, excluidoPor: null, motivoExclusao: null };
      auditar("lancamentos", id, "restauracao", l, novo);
      moverEstoque(ajusteEstoque([], l.itens));
      return salvar("lancamentos", novo);
    }),

    pagarFiado: op((id, forma) => {
      exigir(dono());
      const l = db.lancamentos.find((x) => x.id === id && x.fiado && !x.pago && !x.excluidoEm);
      if (!l) throw new ErroApp("Esse fiado já foi pago ou não existe mais.");
      const novo = { ...l, pago: true, pagoEm: agora(), pagamentos: [{ forma, valor: l.total }] };
      auditar("lancamentos", id, "pagamento_fiado", l, novo);
      return salvar("lancamentos", novo);
    }),

    registrarPonto: op(() => {
      exigir(eu()?.ativo);
      const dia = diaKey(agora());
      const existe = db.pontos.find((p) => p.userId === userId && p.dia === dia);
      return existe ? clonar(existe) : salvar("pontos", { id: uid(), userId, dia, ts: agora() });
    }),

    fecharCaixa: op((informado) => {
      const u = eu();
      exigir(u?.ativo);
      const esperado = { PIX: 0, DINHEIRO: 0, CARTAO: 0 };
      for (const l of db.lancamentos)
        if (l.barbeiroId === userId && l.pago && !l.excluidoEm && mesmoDia(l.pagoEm || l.ts, agora()))
          for (const p of l.pagamentos) if (esperado[p.forma] !== undefined) esperado[p.forma] += p.valor;
      return salvar("fechamentos", { id: uid(), userId, nome: u.nome, dia: diaKey(agora()), ts: agora(), informado, esperado });
    }),

    entradaEstoque: op((id, qtd) => {
      exigir(dono());
      const p = db.produtos.find((x) => x.id === id);
      auditar("produtos", id, "entrada_estoque", null, { quantidade: qtd, estoque: p.estoque + qtd });
      return salvar("produtos", { ...p, estoque: p.estoque + qtd });
    }),

    criarCliente: op((c) => {
      exigir(eu()?.ativo);
      const novo = { telefone: "", ...c, criadoEm: agora(), criadoPor: userId };
      auditar("clientes", novo.id, "insert", null, novo);
      return salvar("clientes", novo);
    }),
    atualizarCliente: op((id, patch) => {
      exigir(dono());
      const c = db.clientes.find((x) => x.id === id);
      return salvar("clientes", { ...c, ...patch });
    }),

    solicitarSaque: op((s) => {
      exigir(eu()?.ativo && s.barbeiroId === userId);
      return salvar("saques", { ...s, ts: agora(), status: "pendente" });
    }),
    resolverSaque: op((id, status) => {
      exigir(dono());
      const s = db.saques.find((x) => x.id === id);
      auditar("saques", id, "update", s, { ...s, status });
      return salvar("saques", { ...s, status, resolvidoEm: agora() });
    }),

    criarAvaliacao: op((a) => {
      exigir(dono());
      return salvar("avaliacoes", { ...a, ts: agora() });
    }),
    criarFerias: op((f) => {
      exigir(dono());
      return salvar("ferias", f);
    }),
    excluirFerias: op((id) => {
      exigir(dono());
      db.ferias = db.ferias.filter((f) => f.id !== id);
      for (const fn of ouvintes) fn({ chave: "ferias", tipo: "remover", id });
    }),
    salvarMesFechado: op((m) => {
      exigir(dono());
      return salvar("mesesFechados", { ...m, ts: agora() }, "mk");
    }),

    salvarConfig: op((tabela, dados) => {
      exigir(dono());
      const chave = tabela === "config" ? "configPublica" : "configPrivada";
      auditar(tabela, "1", "update", db[chave], dados);
      db[chave] = clonar(dados);
      for (const fn of ouvintes) fn({ chave, tipo: "config", dados: clonar(dados) });
      return dados;
    }),
    salvarProduto: op((p) => {
      exigir(dono());
      const atual = db.produtos.find((x) => x.id === p.id);
      return salvar("produtos", { ativo: true, estoque: 0, ordem: db.produtos.length + 1, ...atual, ...p });
    }),
    atualizarPerfil: op((id, linha) => {
      exigir(dono());
      const atual = db.perfis.find((x) => x.id === id);
      const novo = {
        ...atual,
        ...(linha.extra || {}),
        ...(linha.nome !== undefined ? { nome: linha.nome } : {}),
        ...(linha.ativo !== undefined ? { ativo: linha.ativo } : {}),
      };
      auditar("perfis", id, "update", atual, novo);
      return salvar("perfis", novo);
    }),
    salvarConvite: op((c) => {
      exigir(dono());
      const novo = { ...c, email: c.email.trim().toLowerCase(), criadoEm: agora(), usadoEm: null };
      return salvar("convites", novo, "email");
    }),
    excluirConvite: op((email) => {
      exigir(dono());
      db.convites = db.convites.filter((c) => c.email !== email);
      for (const fn of ouvintes) fn({ chave: "convites", tipo: "remover", id: email });
    }),

    carregarAuditoria: op(({ antesDe, limite = 50 }: { antesDe?: number; limite?: number } = {}) => {
      exigir(dono());
      return clonar(db.auditoria.filter((a) => !antesDe || a.ts < antesDe).slice(0, limite));
    }),

    enviarFoto: op((blob) => (typeof URL !== "undefined" && URL.createObjectURL ? URL.createObjectURL(blob) : "blob:foto")),
    urlFoto: async (caminho) => caminho,
  };
}
