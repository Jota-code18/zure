/* Gestão › Lançamentos: lista completa com filtros; o dono corrige, exclui ou restaura. */
import { Pencil, Search } from "lucide-react";
import { useMemo, useState } from "react";
import { useDados } from "../../data/DadosProvider.tsx";
import { totaisLista } from "../../domain/calculos.ts";
import { rangePeriodo } from "../../domain/datas.ts";
import { brl, norm, primeiroNome } from "../../domain/formato.ts";
import { lancadoPorOutro } from "../../domain/lancamento.ts";
import { Btn, Card, Chip, H, inputBase, Vazio } from "../../ui/base.tsx";
import { PeriodoBar } from "../../ui/controles.tsx";
import { ListaAnimada, Modal, Revelar } from "../../ui/estrutura.tsx";
import { GOLD } from "../../ui/tema.ts";
import { Foto } from "../compartilhado/comum.tsx";
import { EditarLancamento, LinhaLancamento } from "../compartilhado/lancamentos.tsx";
import { usePeriodo } from "../compartilhado/preferencias.ts";

const FILTROS: [string, string][] = [
  ["todos", "Todos"],
  ["fiado", "Fiado pendente"],
  ["outro", "Lançado por outro"],
  ["corrigidos", "Corrigidos"],
  ["excluidos", "Excluídos"],
];

export default function Lancamentos() {
  const { users, lancamentosTodos } = useDados();
  const [periodo, setPeriodo] = usePeriodo("periodo_lancamentos");
  const [barbeiro, setBarbeiro] = useState("");
  const [filtro, setFiltro] = useState("todos");
  const [busca, setBusca] = useState("");
  const [limite, setLimite] = useState(50);
  const [editando, setEditando] = useState(null);
  const [foto, setFoto] = useState(null);
  const rg = rangePeriodo(periodo);

  const lista = useMemo(() => {
    const q = norm(busca);
    return lancamentosTodos
      .filter((l) => l.ts >= rg.ini && l.ts < rg.fim)
      .filter((l) => !barbeiro || l.barbeiroId === barbeiro)
      .filter((l) => !q || norm(l.clienteNome).includes(q) || norm(l.itens.map((i) => i.nome).join(" ")).includes(q))
      .filter((l) => {
        if (filtro === "excluidos") return !!l.excluidoEm;
        if (l.excluidoEm) return false;
        if (filtro === "fiado") return l.fiado && !l.pago;
        if (filtro === "outro") return lancadoPorOutro(l);
        if (filtro === "corrigidos") return !!l.editadoEm;
        return true;
      })
      .sort((a, b) => b.ts - a.ts);
  }, [lancamentosTodos, rg.ini, rg.fim, barbeiro, busca, filtro]);

  const tot = totaisLista(lista.filter((l) => !l.excluidoEm));

  return (
    <>
      <Revelar className="grid gap-4 lg:grid-cols-[340px_minmax(0,1fr)] items-start">
        <div className="space-y-4 lg:sticky lg:top-6">
          <Card>
            <H>Período</H>
            <PeriodoBar valor={periodo} onChange={setPeriodo} />
          </Card>
          <Card className="space-y-3">
            <H>Filtros</H>
            <div className="relative">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-500 pointer-events-none" />
              <input
                className={`${inputBase} pl-9`}
                placeholder="Cliente ou item"
                value={busca}
                onChange={(e) => setBusca(e.target.value)}
                aria-label="Buscar lançamento"
              />
            </div>
            <div className="flex gap-2 flex-wrap">
              <Chip ativo={!barbeiro} onClick={() => setBarbeiro("")}>
                Equipe toda
              </Chip>
              {users.map((u) => (
                <Chip key={u.id} ativo={barbeiro === u.id} onClick={() => setBarbeiro(u.id)}>
                  {primeiroNome(u.nome)}
                </Chip>
              ))}
            </div>
            <div className="flex gap-2 flex-wrap">
              {FILTROS.map(([k, r]) => (
                <Chip key={k} ativo={filtro === k} onClick={() => setFiltro(k)}>
                  {r}
                </Chip>
              ))}
            </div>
          </Card>
          <Card>
            <div className="grid grid-cols-3 gap-2 text-center">
              <div>
                <div className="text-[10px] text-neutral-500">Lançamentos</div>
                <div className="text-lg font-black">{lista.length}</div>
              </div>
              <div>
                <div className="text-[10px] text-neutral-500">Pago</div>
                <div className="text-lg font-black" style={{ color: GOLD }}>
                  {brl(tot.pago)}
                </div>
              </div>
              <div>
                <div className="text-[10px] text-neutral-500">Fiado</div>
                <div className="text-lg font-black text-amber-400">{brl(tot.fiado)}</div>
              </div>
            </div>
          </Card>
        </div>

        <Card>
          <H>{rg.label}</H>
          {lista.length === 0 && <Vazio>Nenhum lançamento com esses filtros.</Vazio>}
          <ListaAnimada
            itens={lista.slice(0, limite)}
            render={(l) => (
              <LinhaLancamento
                l={l}
                mostrarData
                mostrarBarbeiro
                aoAbrirFoto={setFoto}
                acoes={
                  <button
                    type="button"
                    onClick={() => setEditando(l)}
                    className="text-neutral-500 hover:text-white p-1"
                    aria-label={`Abrir lançamento de ${l.clienteNome}`}
                  >
                    <Pencil size={15} />
                  </button>
                }
              />
            )}
          />
          {lista.length > limite && (
            <Btn className="w-full mt-3" cor="#262626" texto="#fff" onClick={() => setLimite((n) => n + 50)}>
              Mostrar mais ({lista.length - limite} restantes)
            </Btn>
          )}
        </Card>
      </Revelar>
      <EditarLancamento l={editando} aoFechar={() => setEditando(null)} />
      <Modal aberto={!!foto} aoFechar={() => setFoto(null)} titulo="Comprovante">
        {foto && <Foto caminho={foto} alt="Comprovante" className="w-full min-h-64 rounded-xl mb-2" />}
      </Modal>
    </>
  );
}
