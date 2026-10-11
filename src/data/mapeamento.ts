/* Conversão entre linhas do banco (snake_case, datas ISO) e objetos do app (camelCase, ms). */

const ms = (v) => (v ? Date.parse(v) : null);
const iso = (v) => (v == null ? null : new Date(v).toISOString());
const n = (v) => (v == null ? 0 : Number(v));

const COLUNAS_PERFIL = ["id", "nome", "email", "role", "ativo"];

export const perfil = {
  deLinha: (r) => ({ ...(r.extra || {}), id: r.id, nome: r.nome, email: r.email, role: r.role, ativo: r.ativo }),
  /** Patch do app → colunas + extra (mescla com o extra atual). */
  paraLinha: (patch, atual) => {
    const out: Record<string, any> = {};
    const extra: Record<string, any> = { ...extraDe(atual) };
    let mudouExtra = false;
    for (const [k, v] of Object.entries(patch)) {
      if (k === "nome" || k === "ativo") out[k] = v;
      else if (!COLUNAS_PERFIL.includes(k)) {
        extra[k] = v;
        mudouExtra = true;
      }
    }
    if (mudouExtra) out.extra = extra;
    return out;
  },
};

function extraDe(u) {
  const extra: Record<string, any> = {};
  for (const [k, v] of Object.entries(u || {})) if (!COLUNAS_PERFIL.includes(k)) extra[k] = v;
  return extra;
}

export const convite = {
  deLinha: (r) => ({ email: r.email, nome: r.nome, role: r.role, extra: r.extra || {}, criadoEm: ms(r.criado_em), usadoEm: ms(r.usado_em) }),
  paraLinha: (c) => ({ email: c.email.trim().toLowerCase(), nome: c.nome.trim(), role: c.role || "barbeiro", extra: c.extra || {} }),
};

export const produto = {
  deLinha: (r) => ({ id: r.id, nome: r.nome, custo: n(r.custo), preco: n(r.preco), estoque: r.estoque, ordem: r.ordem, ativo: r.ativo }),
  paraLinha: (p) => {
    const out: Record<string, any> = {};
    for (const k of ["id", "nome", "custo", "preco", "estoque", "ordem", "ativo"]) if (p[k] !== undefined) out[k] = p[k];
    return out;
  },
};

export const cliente = {
  deLinha: (r) => ({
    id: r.id,
    nome: r.nome,
    telefone: r.telefone || "",
    fotoAntes: r.foto_antes,
    fotoDepois: r.foto_depois,
    criadoEm: ms(r.criado_em),
    criadoPor: r.criado_por,
  }),
  paraLinha: (c) => {
    const out: Record<string, any> = {};
    if (c.id !== undefined) out.id = c.id;
    if (c.nome !== undefined) out.nome = c.nome;
    if (c.telefone !== undefined) out.telefone = c.telefone;
    if (c.fotoAntes !== undefined) out.foto_antes = c.fotoAntes;
    if (c.fotoDepois !== undefined) out.foto_depois = c.fotoDepois;
    if (c.criadoPor !== undefined) out.criado_por = c.criadoPor;
    return out;
  },
};

export const lancamento = {
  deLinha: (r) => ({
    id: r.id,
    ts: ms(r.ts),
    barbeiroId: r.barbeiro_id,
    barbeiroNome: r.barbeiro_nome,
    lancadoPorId: r.lancado_por,
    lancadoPorNome: r.lancado_por_nome,
    clienteId: r.cliente_id,
    clienteNome: r.cliente_nome,
    itens: (r.itens || []).map((i) => ({ ...i, qtd: n(i.qtd), preco: n(i.preco), custo: n(i.custo) })),
    subtotal: n(r.subtotal),
    gorjeta: n(r.gorjeta),
    total: n(r.total),
    pagamentos: (r.pagamentos || []).map((p) => ({ forma: p.forma, valor: n(p.valor) })),
    fiado: r.fiado,
    pago: r.pago,
    pagoEm: ms(r.pago_em),
    comprovante: r.comprovante,
    editadoEm: ms(r.editado_em),
    editadoPor: r.editado_por,
    excluidoEm: ms(r.excluido_em),
    excluidoPor: r.excluido_por,
    motivoExclusao: r.motivo_exclusao,
  }),
  /** Payload das funções registrar_lancamento / editar_lancamento. */
  paraPayload: (l) => ({
    id: l.id,
    ts: l.ts ? iso(l.ts) : undefined,
    barbeiro_id: l.barbeiroId,
    cliente_id: l.clienteId || "",
    cliente_nome: l.clienteNome,
    itens: l.itens,
    gorjeta: l.gorjeta || 0,
    pagamentos: l.pagamentos,
    fiado: !!l.fiado,
    pago: !!l.pago,
    comprovante: l.comprovante || "",
  }),
};

export const saque = {
  deLinha: (r) => ({
    id: r.id,
    barbeiroId: r.barbeiro_id,
    nome: r.nome,
    valor: n(r.valor),
    ts: ms(r.ts),
    status: r.status,
    periodos: (r.periodos || []).map((p) => ({ ...p, valor: n(p.valor) })),
    resolvidoEm: ms(r.resolvido_em),
  }),
  paraLinha: (s) => ({ id: s.id, barbeiro_id: s.barbeiroId, nome: s.nome, valor: s.valor, status: s.status, periodos: s.periodos || [] }),
};

export const ponto = { deLinha: (r) => ({ id: r.id, userId: r.user_id, dia: r.dia, ts: ms(r.ts) }) };

export const fechamento = {
  deLinha: (r) => ({
    id: r.id,
    userId: r.user_id,
    nome: r.nome,
    dia: r.dia,
    ts: ms(r.ts),
    informado: mapaNum(r.informado),
    esperado: mapaNum(r.esperado),
  }),
};

function mapaNum(o) {
  const out: Record<string, any> = {};
  for (const [k, v] of Object.entries(o || {})) out[k] = n(v);
  return out;
}

export const avaliacao = {
  deLinha: (r) => ({ id: r.id, clienteId: r.cliente_id, nota: r.nota, ts: ms(r.ts) }),
  paraLinha: (a) => ({ id: a.id, cliente_id: a.clienteId, nota: a.nota }),
};

export const ferias = {
  deLinha: (r) => ({ id: r.id, userId: r.user_id, ini: r.ini, fim: r.fim }),
  paraLinha: (f) => ({ id: f.id, user_id: f.userId, ini: f.ini, fim: f.fim }),
};

export const mesFechado = {
  deLinha: (r) => ({ mk: r.mk, ts: ms(r.ts), fat: n(r.fat), lucro: n(r.lucro), atend: r.atend }),
  paraLinha: (m) => ({ mk: m.mk, fat: +m.fat.toFixed(2), lucro: +m.lucro.toFixed(2), atend: m.atend }),
};

export const auditoria = {
  deLinha: (r) => ({
    id: r.id,
    ts: ms(r.ts),
    usuarioId: r.usuario_id,
    usuarioNome: r.usuario_nome,
    tabela: r.tabela,
    registroId: r.registro_id,
    acao: r.acao,
    antes: r.antes,
    depois: r.depois,
  }),
};

/** Tabela do banco → chave no estado do app e mapeador. */
export const TABELAS = {
  perfis: { chave: "perfis", mapa: perfil, id: "id" },
  convites: { chave: "convites", mapa: convite, id: "email" },
  produtos: { chave: "produtos", mapa: produto, id: "id" },
  clientes: { chave: "clientes", mapa: cliente, id: "id" },
  lancamentos: { chave: "lancamentos", mapa: lancamento, id: "id" },
  saques: { chave: "saques", mapa: saque, id: "id" },
  pontos: { chave: "pontos", mapa: ponto, id: "id" },
  fechamentos: { chave: "fechamentos", mapa: fechamento, id: "id" },
  avaliacoes: { chave: "avaliacoes", mapa: avaliacao, id: "id" },
  ferias: { chave: "ferias", mapa: ferias, id: "id" },
  meses_fechados: { chave: "mesesFechados", mapa: mesFechado, id: "mk" },
};
