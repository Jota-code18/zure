/* Datas e períodos. Todos os timestamps são em milissegundos (horário local do aparelho). */

export const DIA = 86400000;

export const mkOf = (ts) => {
  const d = new Date(ts);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
};

export const rangeMes = (mk) => {
  const [y, m] = mk.split("-").map(Number);
  return [new Date(y, m - 1, 1).getTime(), new Date(y, m, 1).getTime()];
};

export const mesLabel = (mk) => {
  const [y, m] = mk.split("-").map(Number);
  const s = new Date(y, m - 1, 1).toLocaleDateString("pt-BR", { month: "long", year: "numeric" });
  return s.charAt(0).toUpperCase() + s.slice(1);
};

export const inicioDia = (ts) => {
  const d = new Date(ts);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
};

/** Segunda-feira 00:00 da semana de `ts`. */
export const inicioSemana = (ts) => {
  const d = new Date(inicioDia(ts));
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  return d.getTime();
};

/** Soma dias respeitando o calendário (não quebra em horário de verão). */
export const somarDias = (ts, n) => {
  const d = new Date(ts);
  d.setDate(d.getDate() + n);
  return d.getTime();
};

export const diaKey = (ts) => {
  const d = new Date(ts);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

export const hora = (ts) => new Date(ts).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
export const dataBR = (ts) => new Date(ts).toLocaleDateString("pt-BR");
export const ddmm = (ts) => new Date(ts).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
export const mesmoDia = (a, b) => diaKey(a) === diaKey(b);

export const diasNoMes = (mk) => {
  const [y, m] = mk.split("-").map(Number);
  return new Date(y, m, 0).getDate();
};

export const minutosDe = (ts) => {
  const d = new Date(ts);
  return d.getHours() * 60 + d.getMinutes();
};

export const hhmm = (s) => {
  const [h, m] = String(s || "09:00")
    .split(":")
    .map(Number);
  return (h || 0) * 60 + (m || 0);
};

export const isoParaBR = (iso) =>
  String(iso || "")
    .split("-")
    .reverse()
    .join("/");

export const rotuloSemana = (ini) => `${ddmm(ini)} a ${ddmm(somarDias(ini, 6))}`;

/* ---------- períodos (dia, semana, mês, ano, datas) ---------- */
export const PERIODO_PADRAO = { tipo: "mes", off: 0, de: "", ate: "" };
export const PERIODOS = [
  ["dia", "Dia"],
  ["semana", "Semana"],
  ["mes", "Mês"],
  ["ano", "Ano"],
  ["custom", "Datas"],
];

export function rangePeriodo(p, ref = Date.now()) {
  const off = Math.max(0, p.off || 0);
  const hoje = inicioDia(ref);
  if (p.tipo === "dia") {
    const ini = somarDias(hoje, -off);
    let label = dataBR(ini);
    if (off === 0) label = "Hoje";
    else if (off === 1) label = "Ontem";
    return { ini, fim: somarDias(ini, 1), label };
  }
  if (p.tipo === "semana") {
    const ini = somarDias(inicioSemana(ref), -7 * off);
    let nome = "Semana";
    if (off === 0) nome = "Esta semana";
    else if (off === 1) nome = "Semana passada";
    return { ini, fim: somarDias(ini, 7), label: `${nome} · ${rotuloSemana(ini)}` };
  }
  if (p.tipo === "ano") {
    const y = new Date(ref).getFullYear() - off;
    return { ini: new Date(y, 0, 1).getTime(), fim: new Date(y + 1, 0, 1).getTime(), label: String(y) };
  }
  if (p.tipo === "custom") {
    const a = p.de ? new Date(`${p.de}T00:00:00`).getTime() : Number.NaN;
    const b = p.ate ? new Date(`${p.ate}T00:00:00`).getTime() : Number.NaN;
    if (!Number.isNaN(a) && !Number.isNaN(b) && b >= a) return { ini: a, fim: somarDias(b, 1), label: `${dataBR(a)} a ${dataBR(b)}` };
    return { ini: somarDias(hoje, -6), fim: somarDias(hoje, 1), label: "Últimos 7 dias" };
  }
  const d = new Date(ref);
  const base = new Date(d.getFullYear(), d.getMonth() - off, 1);
  return {
    ini: base.getTime(),
    fim: new Date(base.getFullYear(), base.getMonth() + 1, 1).getTime(),
    label: mesLabel(mkOf(base.getTime())),
  };
}
