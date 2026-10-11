/* Estruturas animadas: tela com entrada escalonada, lista com entrada/saída e modal responsivo. */
import { AnimatePresence, motion } from "framer-motion";
import { X } from "lucide-react";
import { useEffect, useId, useRef } from "react";
import { createPortal } from "react-dom";
import { DUR, EASE_IN, EASE_IOS, EASE_OUT, entradaItem, grupo, transicaoLayout } from "./tema.ts";

/** Container de tela: os <Card> filhos entram em sequência curta (30ms). */
export function Revelar({ children, className = "", as = "div" }: { children?: React.ReactNode; className?: string; as?: string }) {
  const Comp = motion[as] || motion.div;
  return (
    <Comp className={className} variants={grupo} initial="initial" animate="animate">
      {children}
    </Comp>
  );
}

/**
 * Lista com entrada/saída de itens e reposicionamento suave (FLIP).
 * `initial={false}`: na primeira renderização nada anima (evita "cascata" a cada troca de aba);
 * só itens que chegam ou saem depois animam.
 */
export function ListaAnimada({
  itens,
  chave = (x) => x.id,
  render,
  className = "",
  as = "div",
}: {
  itens: any[];
  chave?: (x: any) => React.Key;
  render: (x: any, i: number) => React.ReactNode;
  className?: string;
  as?: React.ElementType;
}) {
  const Comp = as;
  return (
    <Comp className={className}>
      <AnimatePresence initial={false}>
        {itens.map((x, i) => (
          <motion.div key={chave(x)} layout="position" transition={{ layout: transicaoLayout }} {...entradaItem}>
            {render(x, i)}
          </motion.div>
        ))}
      </AnimatePresence>
    </Comp>
  );
}

/** Mostra/esconde um bloco com altura animada por transform (sem animar height). */
export function Aparecer({ show, children, className = "" }: { show: boolean; children?: React.ReactNode; className?: string }) {
  return (
    <AnimatePresence initial={false}>
      {show && (
        <motion.div
          className={className}
          initial={{ opacity: 0, y: -6 }}
          animate={{ opacity: 1, y: 0, transition: { duration: DUR.base, ease: EASE_OUT } }}
          exit={{ opacity: 0, y: -4, transition: { duration: DUR.rapido, ease: EASE_IN } }}
        >
          {children}
        </motion.div>
      )}
    </AnimatePresence>
  );
}

/**
 * Modal responsivo: no celular é uma folha que sobe de baixo (curva iOS);
 * no desktop é um diálogo central que cresce levemente. Fecha com Esc ou tocando fora.
 */
export function Modal({
  aberto,
  aoFechar,
  titulo,
  children = null,
  largura = "max-w-lg",
}: {
  aberto: boolean;
  aoFechar: () => void;
  titulo: string;
  children?: React.ReactNode;
  largura?: string;
}) {
  const id = useId();
  const painel = useRef(null);
  const desktop = typeof window !== "undefined" && window.matchMedia?.("(min-width: 1024px)").matches;

  useEffect(() => {
    if (!aberto) return;
    const anterior = document.activeElement as HTMLElement | null;
    const esc = (e) => e.key === "Escape" && aoFechar();
    document.addEventListener("keydown", esc);
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    painel.current?.focus();
    return () => {
      document.removeEventListener("keydown", esc);
      document.body.style.overflow = overflow;
      anterior?.focus?.();
    };
  }, [aberto, aoFechar]);

  const variantes = desktop
    ? {
        initial: { opacity: 0, scale: 0.96, filter: "blur(4px)" },
        animate: { opacity: 1, scale: 1, filter: "blur(0px)", transition: { duration: DUR.base, ease: EASE_OUT } },
        exit: { opacity: 0, scale: 0.98, transition: { duration: DUR.rapido, ease: EASE_IN } },
      }
    : {
        initial: { y: "100%" },
        animate: { y: 0, transition: { duration: 0.32, ease: EASE_IOS } },
        exit: { y: "100%", transition: { duration: 0.22, ease: EASE_IOS } },
      };

  if (typeof document === "undefined") return null;
  return createPortal(
    <AnimatePresence>
      {aberto && (
        <div className="fixed inset-0 z-[70] flex items-end lg:items-center justify-center">
          <motion.div
            className="absolute inset-0 bg-black/70"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1, transition: { duration: DUR.base } }}
            exit={{ opacity: 0, transition: { duration: DUR.rapido } }}
            onClick={aoFechar}
            aria-hidden="true"
          />
          <motion.div
            ref={painel}
            role="dialog"
            aria-modal="true"
            aria-labelledby={id}
            tabIndex={-1}
            {...variantes}
            className={`relative w-full ${largura} max-h-[92dvh] overflow-y-auto rounded-t-3xl lg:rounded-3xl bg-[#121212] border border-[#262626] outline-none`}
            style={{ paddingBottom: "max(16px, env(safe-area-inset-bottom))" }}
          >
            <div className="sticky top-0 z-10 flex items-center justify-between gap-3 px-5 pt-4 pb-3 bg-[#121212]/95 backdrop-blur">
              <div className="lg:hidden absolute left-1/2 -translate-x-1/2 top-1.5 w-10 h-1 rounded-full bg-neutral-700" aria-hidden="true" />
              <h2 id={id} className="text-lg font-black">
                {titulo}
              </h2>
              <button
                type="button"
                onClick={aoFechar}
                aria-label="Fechar"
                className="w-9 h-9 rounded-full bg-neutral-800 flex items-center justify-center active:scale-[0.97]"
              >
                <X size={16} />
              </button>
            </div>
            <div className="px-5">{children}</div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>,
    document.body,
  );
}

/** Renderiza direto no <body>: elementos fixos não ficam presos em ancestrais animados. */
export function NoCorpo({ children }: { children?: React.ReactNode }) {
  if (typeof document === "undefined") return null;
  return createPortal(children, document.body);
}
