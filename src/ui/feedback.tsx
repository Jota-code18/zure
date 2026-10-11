/* Toasts, confete (só em marcos raros), barra de progresso global. */
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { X } from "lucide-react";
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { DUR, EASE_IN, EASE_OUT, GOLD } from "./tema.ts";

const ToastCtx = createContext(null);

/**
 * Toasts empilhados. Celular: topo; desktop: canto inferior direito (convenção, fora do conteúdo).
 * Pausam enquanto o dedo/mouse está em cima. Podem ter ação (ex.: "Desfazer").
 */
export function ToastProvider({ children }: { children?: React.ReactNode }) {
  const [lista, setLista] = useState([]);
  const timers = useRef(new Map());

  const fechar = useCallback((id) => {
    clearTimeout(timers.current.get(id));
    timers.current.delete(id);
    setLista((l) => l.filter((t) => t.id !== id));
  }, []);

  const agendar = useCallback(
    (id, ms) => {
      clearTimeout(timers.current.get(id));
      timers.current.set(
        id,
        setTimeout(() => fechar(id), ms),
      );
    },
    [fechar],
  );

  const mostrar = useCallback(
    (texto: string, { tipo = "ok", acao, duracao }: { tipo?: string; acao?: { rotulo: string; fn: () => void }; duracao?: number } = {}) => {
      const id = Math.random().toString(36).slice(2);
      const ms = duracao ?? (acao ? 6000 : tipo === "erro" ? 5000 : 4000);
      setLista((l) => [...l.slice(-2), { id, texto, tipo, acao, ms }]);
      agendar(id, ms);
      return id;
    },
    [agendar],
  );

  useEffect(() => {
    const t = timers.current;
    return () => {
      for (const x of t.values()) clearTimeout(x);
    };
  }, []);

  const api = useMemo(
    () => ({ ok: (t, o) => mostrar(t, { ...o, tipo: "ok" }), erro: (t, o) => mostrar(t, { ...o, tipo: "erro" }), fechar }),
    [mostrar, fechar],
  );

  return (
    <ToastCtx.Provider value={api}>
      {children}
      <section
        aria-live="polite"
        aria-label="Avisos"
        className="fixed z-[80] inset-x-0 top-3 px-3 flex flex-col items-center gap-2 pointer-events-none lg:inset-x-auto lg:top-auto lg:bottom-6 lg:right-6 lg:items-end"
      >
        <AnimatePresence initial={false}>
          {lista.map((t) => (
            <motion.div
              key={t.id}
              layout
              role={t.tipo === "erro" ? "alert" : "status"}
              initial={{ opacity: 0, y: -16, filter: "blur(4px)" }}
              animate={{ opacity: 1, y: 0, filter: "blur(0px)", transition: { duration: DUR.lento, ease: EASE_OUT } }}
              exit={{ opacity: 0, scale: 0.96, transition: { duration: DUR.rapido, ease: EASE_IN } }}
              onPointerEnter={() => clearTimeout(timers.current.get(t.id))}
              onPointerLeave={() => agendar(t.id, 2000)}
              className="pointer-events-auto w-full max-w-sm px-4 py-3 rounded-2xl text-sm font-semibold shadow-2xl flex items-start gap-2"
              style={{
                background: t.tipo === "erro" ? "#7f1d1d" : "#14301d",
                color: "#fff",
                border: `1px solid ${t.tipo === "erro" ? "#ef4444" : "#22c55e"}`,
              }}
            >
              <span className="flex-1">{t.texto}</span>
              {t.acao && (
                <button
                  type="button"
                  className="shrink-0 text-xs font-black underline underline-offset-2"
                  style={{ color: GOLD }}
                  onClick={() => {
                    t.acao.fn();
                    fechar(t.id);
                  }}
                >
                  {t.acao.rotulo}
                </button>
              )}
              <button type="button" aria-label="Fechar aviso" className="shrink-0 opacity-70 hover:opacity-100" onClick={() => fechar(t.id)}>
                <X size={14} />
              </button>
            </motion.div>
          ))}
        </AnimatePresence>
      </section>
    </ToastCtx.Provider>
  );
}

export function useToast() {
  const v = useContext(ToastCtx);
  if (!v) throw new Error("useToast precisa estar dentro de <ToastProvider>");
  return v;
}

/** Confete: reservado para marcos raros (meta batida), nunca para ações repetidas. */
export function Confetti({ show }: { show: boolean }) {
  const reduzir = useReducedMotion();
  const pecas = useMemo(
    () =>
      Array.from({ length: 40 }, (_, i) => ({
        id: i,
        x: (Math.random() - 0.5) * 380,
        y: -(Math.random() * 240 + 120),
        r: Math.random() * 720 - 360,
        c: ["#C9A86A", "#F5E6C0", "#FFFFFF", "#E0C98F"][i % 4],
        s: 6 + Math.random() * 6,
      })),
    [],
  );
  if (reduzir || typeof document === "undefined") return null;
  return createPortal(
    <AnimatePresence>
      {show && (
        <div className="fixed inset-0 pointer-events-none flex items-center justify-center z-50" aria-hidden="true">
          {pecas.map((p) => (
            <motion.span
              key={p.id}
              initial={{ x: 0, y: 0, opacity: 1, rotate: 0 }}
              animate={{ x: p.x, y: [0, p.y, p.y + 560], opacity: [1, 1, 0], rotate: p.r }}
              transition={{ duration: 1.6, ease: EASE_OUT }}
              style={{ position: "absolute", width: p.s, height: p.s * 0.5, background: p.c, borderRadius: 2 }}
            />
          ))}
        </div>
      )}
    </AnimatePresence>,
    document.body,
  );
}

/** Barra fina no topo enquanto algo está sendo salvo/carregado. */
export function BarraProgressoGlobal({ ativo }: { ativo: boolean }) {
  return (
    <AnimatePresence>
      {ativo && (
        <motion.div
          className="fixed top-0 inset-x-0 h-0.5 z-[90] overflow-hidden pointer-events-none"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1, transition: { duration: DUR.rapido } }}
          exit={{ opacity: 0, transition: { duration: DUR.base, delay: 0.1 } }}
          role="progressbar"
          aria-label="Salvando"
        >
          <div className="barra-indeterminada h-full w-1/3" style={{ background: GOLD }} />
        </motion.div>
      )}
    </AnimatePresence>
  );
}
