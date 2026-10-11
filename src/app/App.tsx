/* Raiz do app: providers, portão de autenticação e casca responsiva (menu inferior no celular, lateral no desktop). */
import { AnimatePresence, MotionConfig, motion } from "framer-motion";
import { BarChart3, CalendarCheck, Eye, LogOut, type LucideIcon, Scissors, Settings, Target, Users, WifiOff } from "lucide-react";
import { lazy, Suspense, useEffect, useMemo, useState } from "react";
import { DadosProvider, useDados } from "../data/DadosProvider.tsx";
import { SessaoProvider, useSessao } from "../data/SessaoProvider.tsx";
import { contasAlertas, sumidosDe } from "../domain/calculos.ts";
import { primeiroNome } from "../domain/formato.ts";
import { Login, NovaSenha } from "../features/auth/Login.tsx";
import { AvisosDono, Resumo19 } from "../features/avisos/Avisos.tsx";
import { AvatarUsuario } from "../features/compartilhado/comum.tsx";
import { Skeleton, SkeletonTela } from "../ui/carregamento.tsx";
import { Logo } from "../ui/controles.tsx";
import { BarraProgressoGlobal, ToastProvider } from "../ui/feedback.tsx";
import { entradaPagina, GOLD } from "../ui/tema.ts";
import { ErroBoundary } from "./ErroBoundary.tsx";

const carregadores = {
  lancar: () => import("../features/lancar/Lancar.tsx"),
  metas: () => import("../features/metas/MetasTab.tsx"),
  meudia: () => import("../features/meudia/MeuDia.tsx"),
  gestao: () => import("../features/gestao/GestaoTab.tsx"),
  clientes: () => import("../features/clientes/ClientesTab.tsx"),
  ajustes: () => import("../features/ajustes/AjustesTab.tsx"),
};
const TELAS = Object.fromEntries(Object.entries(carregadores).map(([k, f]) => [k, lazy(f)]));

const NAV_DONO: [string, string, LucideIcon][] = [
  ["lancar", "Lançar", Scissors],
  ["metas", "Metas", Target],
  ["gestao", "Gestão", BarChart3],
  ["clientes", "Clientes", Users],
  ["ajustes", "Ajustes", Settings],
];
const NAV_BARBEIRO: [string, string, LucideIcon][] = [
  ["lancar", "Lançar", Scissors],
  ["metas", "Metas", Target],
  ["meudia", "Meu dia", CalendarCheck],
];

/** Pré-carrega as outras telas quando o aparelho estiver ocioso (troca de aba fica instantânea). */
function usePrecarregar(abas) {
  useEffect(() => {
    const ocioso = window.requestIdleCallback || ((fn) => setTimeout(fn, 1500));
    const id = ocioso(() => {
      for (const k of abas) carregadores[k]?.();
    });
    return () => (window.cancelIdleCallback || clearTimeout)(id);
  }, [abas]);
}

function Badge({ n }: { n?: number }) {
  return (
    <AnimatePresence>
      {n > 0 && (
        <motion.span
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.9 }}
          className="min-w-[16px] h-4 px-1 rounded-full bg-red-600 text-white text-[9px] font-black flex items-center justify-center"
          aria-label={`${n} avisos`}
        >
          {n}
        </motion.span>
      )}
    </AnimatePresence>
  );
}

function CascaEsqueleto() {
  return (
    <div className="min-h-dvh bg-[#0A0A0A] lg:pl-64" aria-busy="true">
      <aside className="hidden lg:flex fixed inset-y-0 left-0 w-64 flex-col gap-4 p-6 border-r border-[#1c1c1c]">
        <Skeleton className="h-12 w-24" />
        {Array.from({ length: 5 }, (_, i) => (
          // biome-ignore lint/suspicious/noArrayIndexKey: placeholders fixos de carregamento
          <Skeleton key={i} className="h-10" />
        ))}
      </aside>
      <div className="lg:hidden h-16 border-b border-[#1c1c1c] px-4 flex items-center gap-3">
        <Skeleton className="h-10 w-10" />
        <Skeleton className="h-4 w-32" />
      </div>
      <div className="mx-auto w-full max-w-2xl lg:max-w-6xl px-4 lg:px-8 pt-4 lg:pt-8">
        <SkeletonTela colunas={2} cartoes={4} rotulo="Carregando seus dados" />
      </div>
    </div>
  );
}

function Shell() {
  const { carregando, erro, user, lancamentos, clientes, config, saques, pendentes, conexao, modoDemo, acoes } = useDados();
  const { sair } = useSessao();
  const [aba, setAba] = useState("lancar");
  const [subAjustes, setSubAjustes] = useState("estoque");
  const ehDono = user?.role === "admin";
  const nav = ehDono ? NAV_DONO : NAV_BARBEIRO;
  const abaValida = nav.some(([k]) => k === aba) ? aba : "lancar";
  usePrecarregar(useMemo(() => nav.map(([k]) => k), [nav]));

  const alertas = useMemo(() => {
    if (!ehDono) return {};
    return {
      clientes: lancamentos.filter((l) => l.fiado && !l.pago).length + sumidosDe(clientes, lancamentos).length,
      ajustes: config.produtos.filter((p) => p.estoque < 5).length,
      gestao:
        saques.filter((s) => s.status === "pendente").length +
        contasAlertas(config).filter((a) => !a.paga && ["hoje", "atrasada", "breve"].includes(a.status)).length,
    };
  }, [ehDono, lancamentos, clientes, config, saques]);

  const irPara = (k: string, sub?: string) => {
    if (sub) setSubAjustes(sub);
    setAba(k);
    window.scrollTo({ top: 0 });
  };

  if (carregando) return <CascaEsqueleto />;
  if (erro)
    return (
      <div className="min-h-dvh flex flex-col items-center justify-center gap-4 p-6 text-center" role="alert">
        <WifiOff size={32} className="text-amber-400" />
        <p className="text-sm text-neutral-300 max-w-sm">{erro.message}</p>
        <button type="button" onClick={acoes.recarregar} className="px-5 py-3 rounded-xl font-bold text-black" style={{ background: GOLD }}>
          Tentar de novo
        </button>
      </div>
    );
  if (!user || user.ativo === false)
    return (
      <div className="min-h-dvh flex flex-col items-center justify-center gap-4 p-6 text-center" role="alert">
        <p className="text-sm text-neutral-300 max-w-sm">Seu acesso está desativado. Fale com o dono da barbearia.</p>
        <button type="button" onClick={sair} className="px-5 py-3 rounded-xl font-bold bg-neutral-800">
          Sair
        </button>
      </div>
    );

  const Tela = TELAS[abaValida];

  return (
    <div className="min-h-dvh text-white bg-[#0A0A0A] lg:pl-64">
      <BarraProgressoGlobal ativo={pendentes > 0} />

      {/* ---------- lateral (desktop) ---------- */}
      <aside className="hidden lg:flex fixed inset-y-0 left-0 z-40 w-64 flex-col border-r border-[#1c1c1c] bg-[#0c0c0c]" aria-label="Barra lateral">
        <div className="p-6 pb-4">
          <Logo tipo="zure" className="w-40 rounded-xl" />
        </div>
        <nav className="flex-1 px-3 space-y-1" aria-label="Menu">
          {nav.map(([k, label, Icon]) => {
            const ativo = abaValida === k;
            return (
              <button
                type="button"
                key={k}
                onClick={() => irPara(k)}
                onMouseEnter={() => carregadores[k]?.()}
                aria-current={ativo ? "page" : undefined}
                className="relative w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-bold transition-colors duration-150 hover:bg-white/[0.04]"
                style={{ color: ativo ? GOLD : "#a3a3a3" }}
              >
                {ativo && (
                  <motion.span
                    layoutId="nav-lateral"
                    className="absolute inset-0 rounded-xl bg-[rgba(201,168,106,.1)] border border-[rgba(201,168,106,.3)]"
                    transition={{ type: "spring", duration: 0.3, bounce: 0 }}
                  />
                )}
                <Icon size={20} strokeWidth={ativo ? 2.6 : 2} className="relative" />
                <span className="relative flex-1 text-left">{label}</span>
                <span className="relative">
                  <Badge n={alertas[k]} />
                </span>
              </button>
            );
          })}
        </nav>
        <div className="p-4 border-t border-[#1c1c1c] flex items-center gap-3">
          <AvatarUsuario u={user} size={36} />
          <div className="flex-1 min-w-0">
            <div className="text-sm font-bold truncate">{user.nome}</div>
            <div className="text-[10px] tracking-widest" style={{ color: GOLD }}>
              {ehDono ? "DONO" : "BARBEIRO"}
            </div>
          </div>
          <button
            type="button"
            onClick={sair}
            className="w-9 h-9 rounded-full bg-[#141414] border border-[#262626] flex items-center justify-center hover:border-[#3a3a3a]"
            aria-label="Sair"
          >
            <LogOut size={16} className="text-neutral-300" />
          </button>
        </div>
      </aside>

      {/* ---------- cabeçalho (celular/tablet) ---------- */}
      <header
        className="lg:hidden sticky top-0 z-30 flex items-center justify-between px-4 py-3 backdrop-blur"
        style={{ background: "rgba(10,10,10,.92)", borderBottom: "1px solid #1c1c1c" }}
      >
        <div className="flex items-center gap-3">
          <Logo tipo="z" className="h-10 w-auto rounded-lg" />
          <div>
            <div className="text-sm font-bold leading-tight">Olá, {primeiroNome(user.nome)}!</div>
            <div className="text-[10px] tracking-widest" style={{ color: GOLD }}>
              {ehDono ? "DONO" : "BARBEIRO"}
            </div>
          </div>
        </div>
        <button
          type="button"
          onClick={sair}
          className="w-10 h-10 rounded-full bg-[#141414] border border-[#262626] flex items-center justify-center active:scale-[0.97]"
          aria-label="Sair"
        >
          <LogOut size={18} className="text-neutral-300" />
        </button>
      </header>

      {modoDemo && (
        <div
          className="sticky top-[65px] lg:top-0 z-20 flex items-center justify-center gap-2 px-4 py-2 text-[11px] font-bold text-black"
          style={{ background: GOLD }}
          role="status"
        >
          <Eye size={14} /> MODO DEMONSTRAÇÃO · dados fictícios, nada é salvo no banco
          <button type="button" onClick={sair} className="underline ml-1">
            sair
          </button>
        </div>
      )}
      <AnimatePresence>
        {conexao === "offline" && !modoDemo && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="sticky top-[65px] lg:top-0 z-20 flex items-center justify-center gap-2 px-4 py-2 text-[11px] font-bold bg-amber-500 text-black"
            role="status"
          >
            <WifiOff size={14} /> Sem conexão em tempo real. Reconectando…
          </motion.div>
        )}
      </AnimatePresence>

      <main className="mx-auto w-full max-w-2xl lg:max-w-6xl 2xl:max-w-7xl px-4 lg:px-8 pt-3 lg:pt-8">
        {ehDono && (
          <>
            <AvisosDono irPara={irPara} />
            <Resumo19 />
          </>
        )}
        <AnimatePresence mode="wait" initial={false}>
          <motion.div key={abaValida} {...entradaPagina}>
            <Suspense fallback={<SkeletonTela colunas={2} cartoes={4} />}>{abaValida === "ajustes" ? <Tela subInicial={subAjustes} /> : <Tela />}</Suspense>
          </motion.div>
        </AnimatePresence>
      </main>

      {/* ---------- menu inferior (celular/tablet) ---------- */}
      <nav
        className="lg:hidden fixed bottom-0 left-0 right-0 z-50 flex px-1 pt-2"
        style={{
          paddingBottom: "max(10px, env(safe-area-inset-bottom))",
          background: "rgba(12,12,12,.96)",
          borderTop: "1px solid #1f1f1f",
          backdropFilter: "blur(10px)",
        }}
        aria-label="Menu"
      >
        {nav.map(([k, label, Icon]) => {
          const ativo = abaValida === k;
          return (
            <button
              type="button"
              key={k}
              onClick={() => irPara(k)}
              aria-current={ativo ? "page" : undefined}
              className="relative flex-1 min-w-0 flex flex-col items-center gap-0.5 px-1 py-1 active:scale-[0.97] transition-[color,transform] duration-150"
              style={{ color: ativo ? GOLD : "#737373" }}
            >
              <Icon size={22} strokeWidth={ativo ? 2.6 : 2} />
              <span className="text-[10px] font-bold truncate max-w-full">{label}</span>
              <span className="absolute -top-0.5 right-[calc(50%-24px)]">
                <Badge n={alertas[k]} />
              </span>
            </button>
          );
        })}
      </nav>
    </div>
  );
}

function Portao() {
  const { status, backend } = useSessao();
  if (status === "carregando") return <CascaEsqueleto />;
  if (status === "recuperacao") return <NovaSenha />;
  if ((status === "logado" || status === "demo") && backend)
    return (
      <DadosProvider key={`${backend.modo}:${backend.userId}`} backend={backend} modoDemo={status === "demo"}>
        <Shell />
      </DadosProvider>
    );
  return <Login />;
}

export default function App({ backendInicial = null }: { backendInicial?: any }) {
  return (
    <MotionConfig reducedMotion="user">
      <ErroBoundary>
        <ToastProvider>
          <SessaoProvider backendInicial={backendInicial}>
            <Portao />
          </SessaoProvider>
        </ToastProvider>
      </ErroBoundary>
    </MotionConfig>
  );
}
