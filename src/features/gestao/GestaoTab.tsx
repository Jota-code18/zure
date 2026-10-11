/* ABA GESTÃO (dono): visão geral, lançamentos e histórico — cada sub-aba carregada sob demanda. */
import { AnimatePresence, motion } from "framer-motion";
import { lazy, Suspense, useState } from "react";
import { Chip } from "../../ui/base.tsx";
import { SkeletonTela } from "../../ui/carregamento.tsx";
import { entradaPagina } from "../../ui/tema.ts";

const VisaoGeral = lazy(() => import("./VisaoGeral.tsx"));
const Lancamentos = lazy(() => import("./Lancamentos.tsx"));
const Historico = lazy(() => import("./Historico.tsx"));

const SUBS: [string, string, React.ComponentType][] = [
  ["geral", "Visão geral", VisaoGeral],
  ["lancamentos", "Lançamentos", Lancamentos],
  ["historico", "Histórico", Historico],
];

export default function GestaoTab() {
  const [sub, setSub] = useState("geral");
  const Atual = SUBS.find(([k]) => k === sub)[2];
  return (
    <div className="space-y-4 pb-28 lg:pb-10">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <h1 className="text-2xl font-black">Gestão total</h1>
        <div className="flex gap-2 flex-wrap" role="tablist" aria-label="Seções da gestão">
          {SUBS.map(([k, r]) => (
            <Chip key={k} ativo={sub === k} onClick={() => setSub(k)} role="tab" aria-selected={sub === k}>
              {r}
            </Chip>
          ))}
        </div>
      </div>
      <AnimatePresence mode="wait" initial={false}>
        <motion.div key={sub} {...entradaPagina}>
          <Suspense fallback={<SkeletonTela colunas={2} cartoes={6} rotulo="Carregando gestão" />}>
            <Atual />
          </Suspense>
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
