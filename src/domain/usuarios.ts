/* Perfis, plano de carreira, metas e preços por barbeiro. */

const COR_NIVEIS = ["#ef4444", "#f59e0b", "#22c55e", "#3b82f6", "#C9A86A"];
export const corNivel = (i) => COR_NIVEIS[Math.min(i, COR_NIVEIS.length - 1)];

/** Plano de carreira (valores de referência com corte a R$60). Outros preços escalam proporcionalmente. */
export function planoPadrao(precoCorte) {
  const f = (precoCorte || 60) / 60;
  const r = (v) => Math.round((v * f) / 5) * 5;
  // Stryker disable next-line StringLiteral: nomes e textos dos níveis são conteúdo, não regra.
  return {
    tiers: [
      { id: "n1", nome: "VERMELHO", minFat: 0, comissao: 40, bonus: 0, premio: "Alerta! 2º mês seguido aqui = desligamento" },
      { id: "n2", nome: "ESTAGNADO", minFat: r(4500), comissao: 45, bonus: 0, premio: "Fica em observação" },
      { id: "n3", nome: "META MÍNIMA", minFat: r(6000), comissao: 50, bonus: 0, premio: "Mínimo para continuar na barbearia" },
      { id: "n4", nome: "META BOA", minFat: r(7200), comissao: 50, bonus: 200, premio: "50% + R$ 200 de bônus no PIX" },
      { id: "n5", nome: "META MÁXIMA", minFat: r(9000), comissao: 50, bonus: 200, premio: "50% + R$ 200 + KIT DEXTER completo" },
    ],
  };
}

const METAS_BASE = { metaAtendSemana: 25, metaAtendMes: 100, metaProdSemana: 150, metaProdMes: 600 };

/** Dados extras padrão de um novo perfil (vão no convite e depois no perfil). */
export function extraPadrao(role, precoCorte = 65) {
  if (role === "admin") return { entrada: "09:00", precos: { corte: precoCorte }, ...METAS_BASE, metaAtendSemana: 20, metaAtendMes: 80, plano: { tiers: [] } };
  return { entrada: "09:00", precos: { corte: precoCorte }, ...METAS_BASE, plano: planoPadrao(precoCorte) };
}

/** Garante que todo perfil tenha metas, preços e plano. */
export function comPadroes(u) {
  const precoCorte = u?.precos?.corte || 65;
  const base = { precos: {}, entrada: "09:00", ...METAS_BASE, plano: u.role === "admin" ? { tiers: [] } : planoPadrao(precoCorte) };
  const out = { ...base, ...u };
  if (!out.plano || !Array.isArray(out.plano.tiers)) out.plano = base.plano;
  return out;
}

export const precoServ = (u, s) => {
  const v = u?.precos ? u.precos[s.id] : undefined;
  return typeof v === "number" && v > 0 ? v : s.preco;
};

export const precoCorteDe = (u, config) => precoServ(u, (config.servicos || []).find((x) => x.id === "corte") || { id: "corte", preco: 65 });

export function nivelDe(u, fatServ) {
  const tiers = (u?.plano?.tiers || []).slice().sort((a, b) => a.minFat - b.minFat);
  if (!tiers.length) return null;
  let idx = 0;
  tiers.forEach((t, i) => {
    if (fatServ >= t.minFat) idx = i;
  });
  return { tiers, idx, atual: tiers[idx], proximo: tiers[idx + 1] || null, cor: corNivel(idx) };
}

export function ganhoNivel(tiers, i) {
  const t = tiers[i];
  const nxt = tiers[i + 1];
  const baixo = (t.minFat * t.comissao) / 100 + (t.bonus || 0);
  const alto = nxt ? ((nxt.minFat - 1) * t.comissao) / 100 + (t.bonus || 0) : null;
  return { baixo, alto };
}

export function cortesFaixa(tiers, i, preco) {
  const p = Math.max(1, preco);
  const lo = Math.ceil(tiers[i].minFat / p);
  const hi = tiers[i + 1] ? Math.ceil(tiers[i + 1].minFat / p) - 1 : null;
  if (i === 0 && hi != null) return `até ${hi} cortes`;
  return hi != null ? `${lo} a ${hi} cortes` : `${lo}+ cortes`;
}

/** Estimativa do lucro do dono se o barbeiro fechar o mês neste nível. */
export function lucroNivelDono(config, tiers, i) {
  const t = tiers[i];
  const nxt = tiers[i + 1];
  const fat = i === 0 && nxt ? nxt.minFat : t.minFat;
  const com = (fat * t.comissao) / 100 + (t.bonus || 0);
  const imp = (fat * config.imposto) / 100;
  const maq = (fat * config.maquininha) / 100;
  return fat - com - imp - maq - config.custoFixo / (config.rateioFixo || 2);
}
