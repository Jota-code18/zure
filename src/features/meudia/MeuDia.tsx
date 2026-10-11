/* ABA MEU DIA (barbeiro) — ponto, caixa cego, lançamentos de hoje, saques. */
import { Check, Clock, Trash2 } from "lucide-react";
import { useState } from "react";
import { useDados } from "../../data/DadosProvider.tsx";
import { statusPonto, totaisLista } from "../../domain/calculos.ts";
import { FORMA_LABEL, FORMAS } from "../../domain/config.ts";
import { dataBR, diaKey, hora, mesmoDia } from "../../domain/datas.ts";
import { brl } from "../../domain/formato.ts";
import { podeExcluir } from "../../domain/lancamento.ts";
import { Btn, Card, H, NumField, TrocaIcone, Vazio } from "../../ui/base.tsx";
import { Aparecer, ListaAnimada, Revelar } from "../../ui/estrutura.tsx";
import { GOLD } from "../../ui/tema.ts";
import { useAcao } from "../compartilhado/comum.tsx";
import { EditarLancamento, LinhaLancamento } from "../compartilhado/lancamentos.tsx";

const COR_SAQUE = { pago: "#22c55e", recusado: "#ef4444", pendente: "#facc15" };

export default function MeuDia() {
  const { user, lancamentos: todas, pontos, fechamentos, saques, acoes } = useDados();
  const [rodar, ocupado] = useAcao();
  const [caixa, setCaixa] = useState({ PIX: "", DINHEIRO: "", CARTAO: "" });
  const [aberto, setAberto] = useState(null);
  const hojeKey = diaKey(Date.now());
  const meuPonto = pontos.find((p) => p.userId === user.id && p.dia === hojeKey);
  const sp = statusPonto(user, meuPonto, Date.now());
  const fechou = fechamentos.find((f) => f.userId === user.id && f.dia === hojeKey);

  const meusHoje = todas.filter((l) => l.barbeiroId === user.id && mesmoDia(l.ts, Date.now()));
  const paraColegas = todas.filter((l) => l.barbeiroId !== user.id && l.lancadoPorId === user.id && mesmoDia(l.ts, Date.now()));
  const tot = totaisLista(meusHoje);
  const meusSaques = saques.filter((s) => s.barbeiroId === user.id).slice(0, 6);

  const acaoExcluir = (l) =>
    podeExcluir(user, l) ? (
      <button type="button" onClick={() => setAberto(l)} className="text-neutral-500 hover:text-red-400 p-1" aria-label="Excluir lançamento">
        <Trash2 size={16} />
      </button>
    ) : null;

  return (
    <div className="space-y-4 pb-28 lg:pb-10">
      <h1 className="text-2xl font-black">Meu dia</h1>
      <Revelar className="grid gap-4 lg:grid-cols-2 items-start">
        <div className="space-y-4">
          <Card>
            <H>Ponto</H>
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="font-bold" style={{ color: sp.c }}>
                  {sp.t}
                </div>
                <div className="text-xs text-neutral-500">Entrada prevista {user.entrada || "09:00"}</div>
              </div>
              <Btn
                onClick={() => rodar(() => acoes.registrarPonto(), "Ponto registrado!", { chave: "ponto" })}
                disabled={!!meuPonto}
                carregando={ocupado === "ponto"}
                icone={<TrocaIcone chave={meuPonto ? "ok" : "relogio"}>{meuPonto ? <Check size={16} /> : <Clock size={16} />}</TrocaIcone>}
              >
                {meuPonto ? "Registrado" : "Cheguei"}
              </Btn>
            </div>
            <p className="text-[10px] text-neutral-600 mt-2">O horário vem do servidor, não do relógio do celular.</p>
          </Card>

          <Card>
            <H>Caixa cego do dia</H>
            {fechou ? (
              <div className="text-sm">
                <div className="flex items-center gap-2 text-green-400 font-bold mb-1">
                  <Check size={16} /> Caixa fechado às {hora(fechou.ts)}
                </div>
                <p className="text-xs text-neutral-500">O dono confere os valores. Obrigado!</p>
              </div>
            ) : (
              <>
                <p className="text-xs text-neutral-500 mb-3">Conte o que entrou hoje em cada forma. Você não vê o valor esperado.</p>
                {FORMAS.map((k) => (
                  <label key={k} className="flex items-center gap-3 mb-2">
                    <span className="w-20 text-sm text-neutral-300">{FORMA_LABEL[k]}</span>
                    <NumField value={caixa[k]} prefix="R$" onChange={(v) => setCaixa((c) => ({ ...c, [k]: v }))} className="flex-1" />
                  </label>
                ))}
                <Btn
                  className="w-full mt-2"
                  carregando={ocupado === "caixa"}
                  onClick={() =>
                    window.confirm("Fechar o caixa de hoje? Depois não dá para mudar.") &&
                    rodar(
                      () => acoes.fecharCaixa({ PIX: Number(caixa.PIX) || 0, DINHEIRO: Number(caixa.DINHEIRO) || 0, CARTAO: Number(caixa.CARTAO) || 0 }),
                      "Caixa fechado!",
                      {
                        chave: "caixa",
                      },
                    )
                  }
                >
                  Fechar caixa
                </Btn>
              </>
            )}
          </Card>

          <Card>
            <H>Meus saques</H>
            {meusSaques.length === 0 && <Vazio>Nenhum saque pedido ainda. Peça na aba Metas.</Vazio>}
            <ListaAnimada
              itens={meusSaques}
              render={(s) => (
                <div className="py-2 border-b border-[#1d1d1d] last:border-0 text-sm">
                  <div className="flex justify-between gap-2">
                    <span className="text-neutral-400">{dataBR(s.ts)}</span>
                    <span className="font-bold">{brl(s.valor)}</span>
                    <span style={{ color: COR_SAQUE[s.status] }}>{s.status}</span>
                  </div>
                  {s.periodos?.length > 0 && (
                    <div className="text-[10px] text-neutral-500">{s.periodos.map((p) => `${p.rotulo || p.semana}: ${brl(p.valor)}`).join(" · ")}</div>
                  )}
                </div>
              )}
            />
          </Card>
        </div>

        <div className="space-y-4">
          <Card>
            <H
              right={
                <span className="text-xs font-bold text-right" style={{ color: GOLD }}>
                  {brl(tot.pago)}
                  {tot.fiado > 0 && <span className="block text-[10px] text-amber-400">+ {brl(tot.fiado)} fiado</span>}
                </span>
              }
            >
              Atendidos por você hoje
            </H>
            {meusHoje.length === 0 && <Vazio>Nada lançado ainda.</Vazio>}
            <ListaAnimada itens={meusHoje} render={(l) => <LinhaLancamento l={l} acoes={acaoExcluir(l)} />} />
            <p className="text-[10px] text-neutral-600 mt-2">Excluir fica registrado no histórico do dono. Só dá para excluir lançamentos de hoje.</p>
          </Card>

          <Aparecer show={paraColegas.length > 0}>
            <Card>
              <H>Você lançou para colegas hoje</H>
              <ListaAnimada itens={paraColegas} render={(l) => <LinhaLancamento l={l} mostrarBarbeiro acoes={acaoExcluir(l)} />} />
            </Card>
          </Aparecer>
        </div>
      </Revelar>
      <EditarLancamento l={aberto} aoFechar={() => setAberto(null)} />
    </div>
  );
}
