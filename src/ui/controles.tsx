/* Controles específicos: seletor de período, estrelas, logo. */
import { motion } from "framer-motion";
import { ChevronLeft, ChevronRight, Star } from "lucide-react";
import { useState } from "react";
import { DIA, diaKey, PERIODOS, rangePeriodo } from "../domain/datas.ts";
import { Chip, inputBase } from "./base.tsx";
import { CARD, DUR, EASE_OUT, GOLD } from "./tema.ts";

export function PeriodoBar({ valor, onChange }: { valor: any; onChange: (v: any) => void }) {
  const r = rangePeriodo(valor);
  const off = valor.off || 0;
  const set = (patch) => onChange({ ...valor, ...patch });
  const escolher = (k) => {
    if (k === "custom") {
      const hoje = Date.now();
      onChange({ ...valor, tipo: k, off: 0, de: valor.de || diaKey(hoje - 6 * DIA), ate: valor.ate || diaKey(hoje) });
    } else onChange({ ...valor, tipo: k, off: 0 });
  };
  return (
    <div className="space-y-2">
      <div className="flex gap-2 flex-wrap">
        {PERIODOS.map(([k, l]) => (
          <Chip key={k} ativo={valor.tipo === k} onClick={() => escolher(k)}>
            {l}
          </Chip>
        ))}
      </div>
      {valor.tipo !== "custom" ? (
        <div className="flex items-center justify-between rounded-xl px-2 py-1.5" style={{ background: CARD, border: "1px solid #222" }}>
          <button
            type="button"
            onClick={() => set({ off: off + 1 })}
            className="w-10 h-10 rounded-lg flex items-center justify-center active:scale-[0.97]"
            aria-label="Período anterior"
          >
            <ChevronLeft size={20} />
          </button>
          <div className="text-center min-w-0">
            <motion.div
              key={r.label}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1, transition: { duration: DUR.rapido } }}
              className="text-sm font-black truncate"
            >
              {r.label}
            </motion.div>
            {off > 0 && (
              <button type="button" onClick={() => set({ off: 0 })} className="text-[10px] underline" style={{ color: GOLD }}>
                voltar para o atual
              </button>
            )}
          </div>
          <button
            type="button"
            onClick={() => set({ off: Math.max(0, off - 1) })}
            disabled={off <= 0}
            className="w-10 h-10 rounded-lg flex items-center justify-center active:scale-[0.97] disabled:opacity-25"
            aria-label="Próximo período"
          >
            <ChevronRight size={20} />
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-2">
          <label>
            <span className="block text-[10px] text-neutral-500 mb-1">De</span>
            <input type="date" className={inputBase} value={valor.de || ""} onChange={(e) => set({ de: e.target.value })} />
          </label>
          <label>
            <span className="block text-[10px] text-neutral-500 mb-1">Até</span>
            <input type="date" className={inputBase} value={valor.ate || ""} onChange={(e) => set({ ate: e.target.value })} />
          </label>
        </div>
      )}
    </div>
  );
}

export function Estrelas({ valor, onChange }: { valor: number; onChange: (n: number) => void }) {
  return (
    <div className="flex gap-1">
      {[1, 2, 3, 4, 5].map((n) => (
        <motion.button
          type="button"
          key={n}
          onClick={() => onChange(n)}
          whileTap={{ scale: 0.9 }}
          aria-label={`${n} estrela${n > 1 ? "s" : ""}`}
          aria-pressed={n <= valor}
        >
          <Star size={26} fill={n <= valor ? GOLD : "none"} style={{ color: n <= valor ? GOLD : "#555", transition: `color ${DUR.base}s` }} />
        </motion.button>
      ))}
    </div>
  );
}

export function Logo({ tipo = "z", className = "" }: { tipo?: "z" | "zure"; className?: string }) {
  const [erro, setErro] = useState(false);
  const src = tipo === "z" ? "/logo-z.webp" : "/logo-zure.webp";
  if (erro)
    return (
      <div className={`font-black tracking-[0.3em] ${className}`} style={{ color: GOLD, fontFamily: "serif" }}>
        ZURE
      </div>
    );
  return (
    <motion.img
      src={src}
      alt="Zure Barbearia"
      onError={() => setErro(true)}
      className={className}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1, transition: { duration: DUR.lento, ease: EASE_OUT } }}
      decoding="async"
    />
  );
}
