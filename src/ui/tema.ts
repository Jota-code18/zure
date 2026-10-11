/* Tokens visuais e de movimento.
 *
 * Motion (skill Design Motion Principles): app de uso diário e alta frequência → peso principal Emil
 * (contenção, < 300ms), secundário Jakub (entrada = opacidade + translateY + blur; saída mais sutil).
 * Tudo respeita prefers-reduced-motion (MotionConfig reducedMotion="user" + CSS global).
 */

export const GOLD = "#C9A86A";
export const CARD = "#141414";
export const VERDE = "#22c55e";

/** Curvas: ease-out forte para entradas; ease-in suave para saídas; iOS para folhas (sheets). */
import type { MotionProps, Variants } from "framer-motion";

type Bezier = [number, number, number, number];

export const EASE_OUT: Bezier = [0.23, 1, 0.32, 1];
export const EASE_IN: Bezier = [0.55, 0, 1, 0.45];
export const EASE_IOS: Bezier = [0.32, 0.72, 0, 1];

export const DUR = { rapido: 0.14, base: 0.2, lento: 0.28 };

/** Entrada de página/seção: materializa (blur → nítido). Saída menor e mais rápida. */
export const entradaPagina: MotionProps = {
  initial: { opacity: 0, y: 8, filter: "blur(4px)" },
  animate: { opacity: 1, y: 0, filter: "blur(0px)", transition: { duration: DUR.lento, ease: EASE_OUT }, transitionEnd: { filter: "none" } },
  exit: { opacity: 0, y: -4, filter: "blur(2px)", transition: { duration: DUR.rapido, ease: EASE_IN } },
};

/** Itens de lista: só opacidade + deslocamento (blur em muitos itens pesa em celular fraco). */
export const entradaItem: MotionProps = {
  initial: { opacity: 0, y: 6 },
  animate: { opacity: 1, y: 0, transition: { duration: DUR.base, ease: EASE_OUT } },
  exit: { opacity: 0, x: -8, transition: { duration: DUR.rapido, ease: EASE_IN } },
};

/** Grupo com entrada escalonada curta (30ms, limitada) para seções de uma tela. */
export const grupo: Variants = {
  initial: {},
  animate: { transition: { staggerChildren: 0.03, delayChildren: 0.02 } },
};
export const filhoGrupo: Variants = {
  initial: { opacity: 0, y: 8 },
  animate: { opacity: 1, y: 0, transition: { duration: DUR.base, ease: EASE_OUT } },
};

export const transicaoLayout = { type: "spring" as const, duration: 0.3, bounce: 0 };

export const tooltipGrafico = {
  contentStyle: { background: "#111", border: "1px solid #333", borderRadius: 12, fontSize: 12 },
  labelStyle: { color: "#aaa" },
  itemStyle: { color: "#fff" },
};
export const eixoGrafico = { stroke: "#555", fontSize: 10, tickLine: false, axisLine: false };
