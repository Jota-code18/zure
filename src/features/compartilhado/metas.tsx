/* Resumo de metas (usado no Lançar, em Metas e na Gestão). */
import { useMemo } from "react";
import { fatServMes, metasProgresso } from "../../domain/calculos.ts";
import { mkOf } from "../../domain/datas.ts";
import { brl, primeiroNome } from "../../domain/formato.ts";
import { corNivel, nivelDe, precoCorteDe } from "../../domain/usuarios.ts";
import { Card, Rotulo } from "../../ui/base.tsx";
import { BarraMeta } from "../../ui/progresso.tsx";
import { GOLD } from "../../ui/tema.ts";

export function MetasCompactas({ u, todas, config, comanda = null }: { u: any; todas: any[]; config: any; comanda?: { cli: number; prod: number } | null }) {
  const pr = useMemo(() => metasProgresso(u, todas), [u, todas]);
  const addC = comanda?.cli || 0;
  const addP = comanda?.prod || 0;
  const sem = { ...pr.semana, clientes: pr.semana.clientes + addC, prod: pr.semana.prod + addP };
  const mes = { ...pr.mes, clientes: pr.mes.clientes + addC, prod: pr.mes.prod + addP };
  const fatMes = u.role !== "admin" ? fatServMes(u, todas, mkOf(Date.now())) : 0;
  const niv = u.role !== "admin" ? nivelDe(u, fatMes) : null;
  const preco = precoCorteDe(u, config);
  return (
    <section className="mb-5" aria-label={`Metas de ${primeiroNome(u.nome)}`}>
      <Rotulo>
        METAS DE {primeiroNome(u.nome).toUpperCase()}
        {(addC > 0 || addP > 0) && <span className="text-neutral-600"> · contando esta comanda</span>}
      </Rotulo>
      <Card>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <div className="text-[10px] tracking-widest text-neutral-500 mb-2">ESTA SEMANA</div>
            <BarraMeta rotulo="Clientes" atual={sem.clientes} meta={sem.metaCli} />
            <BarraMeta rotulo="Produtos" atual={sem.prod} meta={sem.metaProd} dinheiro />
          </div>
          <div>
            <div className="text-[10px] tracking-widest text-neutral-500 mb-2">ESTE MÊS</div>
            <BarraMeta rotulo="Clientes" atual={mes.clientes} meta={mes.metaCli} />
            <BarraMeta rotulo="Produtos" atual={mes.prod} meta={mes.metaProd} dinheiro />
          </div>
        </div>
        {niv && (
          <div className="mt-3 pt-3 border-t border-[#222] text-xs">
            <span className="font-black" style={{ color: niv.cor }}>
              {niv.atual.nome}
            </span>
            <span className="text-neutral-400"> · comissão {niv.atual.comissao}%</span>
            {niv.proximo && (
              <div className="text-neutral-400 mt-0.5">
                Faltam <b style={{ color: GOLD }}>{brl(Math.max(0, niv.proximo.minFat - fatMes))}</b> (≈{" "}
                {Math.ceil(Math.max(0, niv.proximo.minFat - fatMes) / Math.max(1, preco))} cortes) para{" "}
                <b style={{ color: corNivel(niv.idx + 1) }}>{niv.proximo.nome}</b>
              </div>
            )}
          </div>
        )}
        <p className="text-[10px] text-neutral-600 mt-2">Metas contam fiado. Faturamento, comissão e bônus só contam o que foi pago.</p>
      </Card>
    </section>
  );
}
