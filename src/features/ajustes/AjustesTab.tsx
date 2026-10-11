/* ABA AJUSTES (dono). Cada seção é carregada só quando aberta. */
import { AnimatePresence, motion } from "framer-motion";
import { lazy, Suspense, useState } from "react";
import { Chip } from "../../ui/base.tsx";
import { SkeletonTela } from "../../ui/carregamento.tsx";
import { entradaPagina } from "../../ui/tema.ts";

const carregarOperacao = () => import("./Operacao.tsx");
const carregarConfig = () => import("./Configuracao.tsx");

const SUBS: [string, string, React.ComponentType][] = [
  ["estoque", "Estoque", lazy(() => carregarOperacao().then((m) => ({ default: m.Estoque })))],
  ["equipe", "Equipe", lazy(() => import("./Equipe.tsx"))],
  ["ponto", "Ponto", lazy(() => carregarOperacao().then((m) => ({ default: m.Ponto })))],
  ["ferias", "Férias", lazy(() => carregarOperacao().then((m) => ({ default: m.Ferias })))],
  ["contas", "Contas", lazy(() => carregarConfig().then((m) => ({ default: m.Contas })))],
  ["catalogo", "Serviços e produtos", lazy(() => carregarConfig().then((m) => ({ default: m.Catalogo })))],
  ["dados", "Dados", lazy(() => import("./Dados.tsx"))],
];

export default function AjustesTab({ subInicial = "estoque" }: { subInicial?: string }) {
  const [sub, setSub] = useState(subInicial);
  const Atual = (SUBS.find(([k]) => k === sub) || SUBS[0])[2];
  return (
    <div className="space-y-4 pb-28 lg:pb-10">
      <h1 className="text-2xl font-black">Estoque e ajustes</h1>
      <div className="flex gap-2 flex-wrap" role="tablist" aria-label="Seções de ajustes">
        {SUBS.map(([k, l]) => (
          <Chip key={k} ativo={sub === k} onClick={() => setSub(k)} role="tab" aria-selected={sub === k}>
            {l}
          </Chip>
        ))}
      </div>
      <AnimatePresence mode="wait" initial={false}>
        <motion.div key={sub} {...entradaPagina}>
          <Suspense fallback={<SkeletonTela colunas={2} cartoes={2} rotulo="Carregando ajustes" />}>
            <Atual />
          </Suspense>
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
