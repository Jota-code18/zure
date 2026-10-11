/* Configuração da barbearia: valores padrão e montagem do objeto `config` usado pelas telas. */

export const SERVICOS_INICIAIS = [
  { id: "corte", nome: "CORTE", preco: 65 },
  { id: "barba", nome: "BARBA", preco: 35 },
  { id: "combo", nome: "COMBO", preco: 90 },
  { id: "sobrancelha", nome: "SOBRANCELHA", preco: 15 },
  { id: "pigmentacao", nome: "PIGMENTAÇÃO", preco: 30 },
];

export const PRODUTOS_INICIAIS = [
  { id: "pomada", nome: "POMADA", custo: 25, preco: 60, estoque: 10, ordem: 1 },
  { id: "shampoo", nome: "SHAMPOO", custo: 30, preco: 70, estoque: 8, ordem: 2 },
  { id: "oleo", nome: "ÓLEO", custo: 20, preco: 55, estoque: 8, ordem: 3 },
  { id: "cerveja", nome: "CERVEJA", custo: 2.5, preco: 6, estoque: 24, ordem: 4 },
  { id: "agua", nome: "ÁGUA", custo: 1, preco: 3, estoque: 24, ordem: 5 },
];

/** Parte da configuração que todos os usuários logados leem (preços, missões, metas de bebida). */
export const CONFIG_PUBLICA_PADRAO = {
  servicos: SERVICOS_INICIAIS,
  comissaoProduto: 30,
  metaBebida: { produtoId: "cerveja", qtd: 20, bonus: 40 },
  missoes: [
    { id: "m1", titulo: "Venda 2 combos hoje", itemId: "combo", alvo: 2, bonus: 20 },
    { id: "m2", titulo: "Venda 3 cervejas hoje", itemId: "cerveja", alvo: 3, bonus: 5 },
    { id: "m3", titulo: "Faça 3 sobrancelhas hoje", itemId: "sobrancelha", alvo: 3, bonus: 10 },
  ],
};

/** Parte só do dono: custos, impostos, contas. Barbeiros não leem (regra no banco). */
const CONFIG_PRIVADA_PADRAO = {
  contas: [
    { id: "aluguel", nome: "Aluguel", valor: 1326, dia: 0 },
    { id: "internet", nome: "Internet", valor: 138, dia: 0 },
    { id: "toalhas", nome: "Toalhas (lavanderia)", valor: 420, dia: 0 },
    { id: "iptv", nome: "IPTV", valor: 35, dia: 0 },
    { id: "youtube", nome: "YouTube", valor: 34.9, dia: 0 },
    { id: "empregada", nome: "Empregada", valor: 300, dia: 0 },
    { id: "agua", nome: "Água", valor: 190, dia: 0 },
    { id: "energia", nome: "Energia", valor: 600, dia: 0 },
  ],
  contasPagas: {},
  rateioFixo: 2,
  faturamentoBase: 14000,
  cadeiras: 3,
  imposto: 6,
  maquininha: 1.5,
  salarioMeta: 6000,
  googleLink: "",
};

const CHAVES_PRIVADAS = Object.keys(CONFIG_PRIVADA_PADRAO);

/** Separa um patch de configuração entre a parte pública e a privada. */
export function separarConfig(patch) {
  const publica = {};
  const privada = {};
  for (const [k, v] of Object.entries(patch)) {
    if (k === "produtos" || k === "custoFixo") continue;
    if (CHAVES_PRIVADAS.includes(k)) privada[k] = v;
    else publica[k] = v;
  }
  return { publica, privada };
}

/** Junta padrão + dados salvos + produtos e calcula o custo fixo (soma das contas). */
export function montarConfig(publica, privada, produtos) {
  const c = { ...CONFIG_PUBLICA_PADRAO, ...CONFIG_PRIVADA_PADRAO, ...(publica || {}), ...(privada || {}) };
  const soma = (c.contas || []).reduce((a, x) => a + (Number(x.valor) || 0), 0);
  const lista = (produtos || []).filter((p) => p.ativo !== false).sort((a, b) => (a.ordem || 0) - (b.ordem || 0));
  return { ...c, produtos: lista, custoFixo: +soma.toFixed(2) };
}

export const FORMAS = ["PIX", "DINHEIRO", "CARTAO"];
export const FORMA_LABEL = { PIX: "PIX", DINHEIRO: "Dinheiro", CARTAO: "Cartão", FIADO: "Fiado", DIVIDIDO: "Dividido" };

export const itemNome = (config, id) => [...config.servicos, ...config.produtos].find((x) => x.id === id)?.nome?.toLowerCase() || id;
