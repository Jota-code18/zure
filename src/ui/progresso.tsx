/* Barras de progresso. Animam com transform (scaleX), nunca com width. */
import { motion } from "framer-motion";
import { brl, shortR } from "../domain/formato.ts";
import { DUR, EASE_OUT, GOLD, VERDE } from "./tema.ts";

export function Barra({ valor, cor = GOLD, altura = "h-2.5", rotulo = "" }: { valor: number; cor?: string; altura?: string; rotulo?: string }) {
  const p = Math.max(0, Math.min(100, Number.isFinite(valor) ? valor : 0));
  return (
    <div
      className={`${altura} rounded-full bg-neutral-800 overflow-hidden`}
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(p)}
      aria-label={rotulo}
    >
      <motion.div
        className="h-full w-full rounded-full origin-left"
        style={{ background: cor }}
        initial={{ scaleX: 0 }}
        animate={{ scaleX: p / 100 }}
        transition={{ duration: 0.6, ease: EASE_OUT }}
      />
    </div>
  );
}

export function BarraMeta({ rotulo, atual, meta, dinheiro = false }: { rotulo: string; atual: number; meta: number; dinheiro?: boolean }) {
  const fmt = dinheiro ? shortR : (v) => String(Math.round(v));
  const p = meta > 0 ? Math.min(100, (atual / meta) * 100) : 0;
  const ok = meta > 0 && atual >= meta;
  const falta = Math.max(0, meta - atual);
  let texto: string;
  if (meta <= 0) texto = "Sem meta definida";
  else if (ok) texto = "Meta batida! 🎉";
  else if (dinheiro) texto = `Faltam ${brl(falta)}`;
  else texto = `${falta === 1 ? "Falta" : "Faltam"} ${falta} ${falta === 1 ? "cliente" : "clientes"}`;
  return (
    <div className="mb-3 last:mb-0">
      <div className="flex flex-wrap justify-between items-baseline gap-x-2 text-xs">
        <span className="text-neutral-300 font-semibold">{rotulo}</span>
        <span className="font-black whitespace-nowrap" style={{ color: ok ? VERDE : "#fff" }}>
          {fmt(atual)}
          <span className="text-neutral-500 font-semibold"> / {fmt(meta)}</span>
        </span>
      </div>
      <div className="mt-1">
        <Barra valor={p} cor={ok ? VERDE : GOLD} rotulo={rotulo} />
      </div>
      <motion.div
        key={texto}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1, transition: { duration: DUR.base } }}
        className="text-[11px] font-bold mt-1"
        style={{ color: ok ? VERDE : GOLD }}
      >
        {texto}
      </motion.div>
    </div>
  );
}
