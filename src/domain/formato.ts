/* Formatação e utilidades puras (sem React, sem rede). */

export const brl = (n) => (Number(n) || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

export const shortR = (v) => `R$${Math.round(v).toLocaleString("pt-BR")}`;

export const pctBR = (v) => `${v.toFixed(2).replace(".", ",")}%`;

/** Converte texto digitado ("12,50") em número >= 0. */
export const num = (v) => {
  const n = Number.parseFloat(String(v).replace(",", "."));
  return Number.isNaN(n) || n < 0 ? 0 : n;
};

export const uid = () =>
  typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(36) + Math.random().toString(36).slice(2, 10);

export const norm = (s) =>
  String(s || "")
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .trim();

export const slug = (s) =>
  norm(s)
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "") || "item";

export const primeiroNome = (n) => String(n || "").split(" ")[0];

export const capitalizar = (s) => {
  const t = String(s || "");
  return t.charAt(0) + t.slice(1).toLowerCase();
};

export const pct = (a, b) => {
  if (b > 0) return ((a - b) / b) * 100;
  return a > 0 ? 100 : 0;
};

export const waLink = (tel, texto) => {
  const n = String(tel || "").replace(/\D/g, "");
  const full = n.length <= 11 ? `55${n}` : n;
  return `https://wa.me/${full}?text=${encodeURIComponent(texto)}`;
};

export const tempoAtras = (ts, agora = Date.now()) => {
  const m = Math.floor((agora - ts) / 60000);
  if (m < 1) return "agora";
  if (m < 60) return `${m} min atrás`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h} h atrás`;
  return `${Math.floor(h / 24)} d atrás`;
};

export const descreverItens = (itens) => itens.map((i) => (i.qtd > 1 ? `${i.qtd}x ` : "") + i.nome.toLowerCase()).join(" + ");
