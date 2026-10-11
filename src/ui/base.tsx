/* Componentes base. */
import { AnimatePresence, motion } from "framer-motion";
import { Loader2 } from "lucide-react";
import { useEffect, useState } from "react";
import { CARD, DUR, EASE_OUT, filhoGrupo, GOLD } from "./tema.ts";

export const inputBase =
  "w-full bg-[#0f0f0f] border border-[#2a2a2a] rounded-xl px-3 py-2.5 text-white placeholder:text-neutral-600 outline-none focus:border-[#C9A86A] text-sm transition-colors";

export const inputGrande =
  "w-full bg-[#141414] border border-[#2a2a2a] rounded-2xl px-4 py-3.5 text-white placeholder:text-neutral-500 outline-none focus:border-[#C9A86A] transition-colors";

const PADS = { sm: "p-3", md: "p-4", lg: "p-5" };

/** Cartão. Dentro de um <Revelar>, entra junto com o escalonamento da tela. */
export function Card({
  children,
  className = "",
  style = undefined,
  pad = "md",
  ...rest
}: {
  children?: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
  pad?: "sm" | "md" | "lg";
  [outros: string]: any;
}) {
  return (
    <motion.div
      variants={filhoGrupo}
      className={`rounded-2xl ${PADS[pad]} ${className}`}
      style={{ background: CARD, border: "1px solid #222", boxShadow: "0 8px 24px rgba(0,0,0,.5)", ...style }}
      {...rest}
    >
      {children}
    </motion.div>
  );
}

export function H({ children, right = null, as: Tag = "h3" }: { children?: React.ReactNode; right?: React.ReactNode; as?: React.ElementType }) {
  return (
    <div className="flex items-center justify-between gap-2 mb-2 flex-wrap">
      <Tag className="text-[11px] font-bold tracking-widest text-neutral-500 uppercase">{children}</Tag>
      {right}
    </div>
  );
}

export function Rotulo({ children, className = "" }: { children?: React.ReactNode; className?: string }) {
  return <span className={`text-[11px] font-bold tracking-widest text-neutral-500 mb-2 block ${className}`}>{children}</span>;
}

export function Chip({
  ativo = false,
  onClick = undefined,
  children,
  ...rest
}: {
  ativo?: boolean;
  onClick?: () => void;
  children?: React.ReactNode;
  [outros: string]: any;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={rest.role ? undefined : !!ativo}
      className="px-4 py-2 rounded-full text-xs font-bold whitespace-nowrap active:scale-[0.97] transition-[transform,background-color,color] duration-150"
      style={{ background: ativo ? GOLD : CARD, color: ativo ? "#000" : "#d4d4d4", border: `1px solid ${ativo ? GOLD : "#2a2a2a"}` }}
      {...rest}
    >
      {children}
    </button>
  );
}

const TAMANHOS = { sm: "px-3 py-2 text-xs", md: "px-4 py-3 text-sm", lg: "px-5 py-4 text-base" };

/** Botão com estado de carregamento: o ícone vira spinner (troca animada) e o botão trava. */
export function Btn({
  children = null,
  onClick = undefined,
  cor = GOLD,
  texto = "#000",
  className = "",
  style = undefined,
  disabled = false,
  carregando = false,
  icone = null,
  tamanho = "md",
  type = "button",
  ...rest
}: {
  children?: React.ReactNode;
  onClick?: (e?: any) => void;
  cor?: string;
  texto?: string;
  className?: string;
  style?: React.CSSProperties;
  disabled?: boolean;
  carregando?: boolean;
  icone?: React.ReactNode;
  tamanho?: "sm" | "md" | "lg";
  type?: "button" | "submit";
  [outros: string]: any;
}) {
  return (
    <motion.button
      type={type}
      whileTap={disabled || carregando ? undefined : { scale: 0.97 }}
      onClick={onClick}
      disabled={disabled || carregando}
      aria-busy={carregando || undefined}
      className={`rounded-xl font-bold flex items-center justify-center gap-2 disabled:opacity-40 ${TAMANHOS[tamanho]} ${className}`}
      style={{ background: cor, color: texto, ...style }}
      {...rest}
    >
      <TrocaIcone chave={carregando ? "carregando" : "icone"}>{carregando ? <Loader2 size={16} className="animate-spin" /> : icone}</TrocaIcone>
      {children}
    </motion.button>
  );
}

/** Troca de ícone com opacidade + escala + blur (Jakub). */
export function TrocaIcone({ chave, children }: { chave: string; children?: React.ReactNode }) {
  if (!children) return null;
  return (
    <AnimatePresence mode="popLayout" initial={false}>
      <motion.span
        key={chave}
        className="inline-flex"
        initial={{ opacity: 0, scale: 0.8, filter: "blur(4px)" }}
        animate={{ opacity: 1, scale: 1, filter: "blur(0px)" }}
        exit={{ opacity: 0, scale: 0.8, filter: "blur(4px)" }}
        transition={{ duration: DUR.rapido, ease: EASE_OUT }}
      >
        {children}
      </motion.span>
    </AnimatePresence>
  );
}

export function NumField({
  value,
  onChange,
  prefix = "",
  suffix = "",
  className = "",
  ...rest
}: {
  value: any;
  onChange: (v: number) => void;
  prefix?: string;
  suffix?: string;
  className?: string;
  [outros: string]: any;
}) {
  const [txt, setTxt] = useState(String(value ?? ""));
  useEffect(() => setTxt(String(value ?? "")), [value]);
  const commit = () => {
    const n = Number.parseFloat(String(txt).replace(",", "."));
    if (Number.isNaN(n)) return setTxt(String(value ?? ""));
    if (n !== value) onChange(n);
  };
  return (
    <div className={`relative ${className}`}>
      {prefix && <span className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-500 text-xs pointer-events-none">{prefix}</span>}
      <input
        className={inputBase + (prefix ? " pl-8" : "") + (suffix ? " pr-8" : "")}
        inputMode="decimal"
        value={txt}
        onChange={(e) => setTxt(e.target.value.replace(/[^0-9,.]/g, ""))}
        onBlur={commit}
        onKeyDown={(e) => e.key === "Enter" && e.currentTarget.blur()}
        {...rest}
      />
      {suffix && <span className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-500 text-xs pointer-events-none">{suffix}</span>}
    </div>
  );
}

export function TextField({
  value,
  onChange,
  className = "",
  ...rest
}: {
  value: string;
  onChange: (v: string) => void;
  className?: string;
  [outros: string]: any;
}) {
  const [txt, setTxt] = useState(value ?? "");
  useEffect(() => setTxt(value ?? ""), [value]);
  return (
    <input
      className={`${inputBase} ${className}`}
      value={txt}
      onChange={(e) => setTxt(e.target.value)}
      onBlur={() => txt !== value && onChange(txt)}
      onKeyDown={(e) => e.key === "Enter" && e.currentTarget.blur()}
      {...rest}
    />
  );
}

/** Avatar: foto (já resolvida em URL) ou inicial dourada. */
export function Avatar({ nome, url = null, size = 36 }: { nome?: string; url?: string | null; size?: number }) {
  const [falhou, setFalhou] = useState(false);
  if (url && !falhou)
    return (
      <img
        src={url}
        alt={nome}
        onError={() => setFalhou(true)}
        className="rounded-full object-cover shrink-0"
        style={{ width: size, height: size }}
        loading="lazy"
        decoding="async"
      />
    );
  return (
    <div
      className="rounded-full flex items-center justify-center font-black text-black shrink-0"
      style={{ width: size, height: size, background: GOLD, fontSize: size * 0.42 }}
      aria-hidden="true"
    >
      {String(nome || "?")
        .charAt(0)
        .toUpperCase()}
    </div>
  );
}

export function Vazio({ children }: { children?: React.ReactNode }) {
  return <p className="text-xs text-neutral-500">{children}</p>;
}
