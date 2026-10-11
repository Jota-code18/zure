/* Skeletons (estado de carregamento com o formato do conteúdo) e imagem com carregamento sob demanda. */
import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useRef, useState } from "react";
import { DUR, EASE_OUT } from "./tema.ts";

export function Skeleton({ className = "", style = undefined, redondo = false }: { className?: string; style?: React.CSSProperties; redondo?: boolean }) {
  return <div className={`skeleton ${redondo ? "rounded-full" : "rounded-xl"} ${className}`} style={style} aria-hidden="true" />;
}

function SkeletonTexto({ linhas = 2, className = "" }: { linhas?: number; className?: string }) {
  return (
    <div className={`space-y-2 ${className}`} aria-hidden="true">
      {Array.from({ length: linhas }, (_, i) => (
        // biome-ignore lint/suspicious/noArrayIndexKey: placeholders fixos de carregamento
        <Skeleton key={i} className="h-3" style={{ width: `${i === linhas - 1 ? 60 : 100}%` }} />
      ))}
    </div>
  );
}

function SkeletonCard({ altura = 120, className = "" }: { altura?: number; className?: string }) {
  return (
    <div className={`rounded-2xl p-4 border border-[#1f1f1f] bg-[#111] ${className}`} aria-hidden="true">
      <Skeleton className="h-3 w-1/3 mb-4" />
      <Skeleton style={{ height: altura - 48 }} />
    </div>
  );
}

export function SkeletonLista({ itens = 4 }: { itens?: number }) {
  return (
    <div className="rounded-2xl p-4 border border-[#1f1f1f] bg-[#111] space-y-4" aria-hidden="true">
      {Array.from({ length: itens }, (_, i) => (
        // biome-ignore lint/suspicious/noArrayIndexKey: placeholders fixos de carregamento
        <div key={i} className="flex items-center gap-3">
          <Skeleton redondo className="w-9 h-9 shrink-0" />
          <div className="flex-1">
            <SkeletonTexto linhas={2} />
          </div>
          <Skeleton className="h-4 w-16" />
        </div>
      ))}
    </div>
  );
}

/** Esqueleto genérico de uma tela: título + grade de cartões. */
export function SkeletonTela({ colunas = 1, cartoes = 4, rotulo = "Carregando" }: { colunas?: number; cartoes?: number; rotulo?: string }) {
  const blocos = Array.from({ length: cartoes }, (_, n) => ({ id: `bloco-${n}`, lista: n % 3 === 2, altura: n % 2 ? 150 : 110 }));
  return (
    <output className="block space-y-4" aria-busy="true" aria-label={rotulo}>
      <Skeleton className="h-7 w-48" />
      <div className={`grid gap-4 ${colunas > 1 ? "lg:grid-cols-2" : ""}`}>
        {blocos.map((b) => (b.lista ? <SkeletonLista key={b.id} itens={3} /> : <SkeletonCard key={b.id} altura={b.altura} />))}
      </div>
    </output>
  );
}

/**
 * Imagem carregada só quando chega perto da tela (IntersectionObserver).
 * `resolver` (opcional) transforma o caminho em URL apenas nesse momento — fotos privadas.
 * Enquanto carrega: skeleton. Ao carregar: entra de desfocado para nítido.
 */
export function ImagemLazy({
  src,
  alt = "",
  className = "",
  onVisivel = undefined,
  ...rest
}: {
  src?: string | null;
  alt?: string;
  className?: string;
  onVisivel?: () => void;
  [outros: string]: any;
}) {
  const ref = useRef(null);
  const [visivel, setVisivel] = useState(false);
  const [carregou, setCarregou] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (typeof IntersectionObserver === "undefined") {
      setVisivel(true);
      return;
    }
    const io = new IntersectionObserver(
      (entradas) => {
        if (entradas.some((e) => e.isIntersecting)) {
          setVisivel(true);
          io.disconnect();
        }
      },
      { rootMargin: "200px" },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  useEffect(() => {
    if (visivel) onVisivel?.();
  }, [visivel, onVisivel]);

  return (
    <div ref={ref} className={`relative overflow-hidden ${className}`}>
      <AnimatePresence>
        {!carregou && (
          <motion.div className="absolute inset-0" exit={{ opacity: 0, transition: { duration: DUR.base } }}>
            <Skeleton className="w-full h-full rounded-none" />
          </motion.div>
        )}
      </AnimatePresence>
      {visivel && src && (
        <motion.img
          src={src}
          alt={alt}
          loading="lazy"
          decoding="async"
          onLoad={() => setCarregou(true)}
          initial={{ opacity: 0, filter: "blur(6px)" }}
          animate={carregou ? { opacity: 1, filter: "blur(0px)", transition: { duration: DUR.lento, ease: EASE_OUT } } : {}}
          className="w-full h-full object-cover"
          {...rest}
        />
      )}
    </div>
  );
}
