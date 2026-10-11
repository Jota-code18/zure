/* ABA METAS — carteira por semana, metas, plano de carreira, resultados por período. */
import { Plus, Trash2, Trophy, Wallet } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { useDados } from "../../data/DadosProvider.tsx";
import { calc, metasProgresso, progressoMissoes, riscoVermelho, serieDe } from "../../domain/calculos.ts";
import { carteiraSemanas, montarSaque } from "../../domain/carteira.ts";
import { itemNome } from "../../domain/config.ts";
import { DIA, diaKey, inicioSemana, mesLabel, mkOf, rangeMes, rangePeriodo } from "../../domain/datas.ts";
import { brl, pct, primeiroNome, uid } from "../../domain/formato.ts";
import { corNivel, cortesFaixa, ganhoNivel, lucroNivelDono, nivelDe, planoPadrao, precoCorteDe, precoServ } from "../../domain/usuarios.ts";
import { Btn, Card, Chip, H, NumField, TextField, Vazio } from "../../ui/base.tsx";
import { PeriodoBar } from "../../ui/controles.tsx";
import { ListaAnimada, Revelar } from "../../ui/estrutura.tsx";
import { Confetti } from "../../ui/feedback.tsx";
import { Barra } from "../../ui/progresso.tsx";
import { eixoGrafico, GOLD, tooltipGrafico, VERDE } from "../../ui/tema.ts";
import { useAcao } from "../compartilhado/comum.tsx";
import { MetasCompactas } from "../compartilhado/metas.tsx";
import { gravarLocal, lerLocal, usePeriodo } from "../compartilhado/preferencias.ts";

function CarteiraCard({
  alvo,
  cart,
  podeSacar,
  pendente,
  aoSacar,
  sacando,
}: {
  alvo: any;
  cart: any;
  podeSacar: boolean;
  pendente: any;
  aoSacar: () => void;
  sacando: boolean;
}) {
  const [todas, setTodas] = useState(false);
  const semanas = todas ? cart.semanas : cart.semanas.slice(0, 3);
  return (
    <Card style={{ background: "linear-gradient(135deg,#1c1710,#141414)", border: `1px solid ${GOLD}55` }}>
      <div className="flex items-center gap-2 text-neutral-400 text-xs mb-1">
        <Wallet size={14} /> CARTEIRA
      </div>
      <div className="text-3xl font-black tabular-nums" style={{ color: GOLD }}>
        {brl(cart.disponivel)}
      </div>
      <p className="text-xs text-neutral-400 mt-1">
        {podeSacar ? "Disponível para sacar" : `Disponível para ${primeiroNome(alvo.nome)} sacar`} (inclui saldo de semanas anteriores)
      </p>
      <div className="mt-3 space-y-2">
        <ListaAnimada
          itens={semanas}
          chave={(s) => s.chave}
          render={(s) => (
            <div className="rounded-xl bg-black/30 px-3 py-2 text-xs">
              <div className="flex justify-between gap-2">
                <span className="font-bold text-neutral-200">
                  {s.atual ? "Esta semana" : "Semana"} · {s.rotulo}
                </span>
                <span className="font-black" style={{ color: s.disponivel > 0 ? GOLD : "#737373" }}>
                  {brl(s.disponivel)}
                </span>
              </div>
              <div className="text-[11px] text-neutral-500 mt-0.5">
                Ganhou {brl(s.ganho)} (comissão {brl(s.comissao)} + gorjetas {brl(s.gorjeta)}){s.sacado > 0 && ` · já pedido ${brl(s.sacado)}`}
                {s.pendente > 0 && <span className="text-amber-400"> · {brl(s.pendente)} em análise</span>}
              </div>
            </div>
          )}
        />
      </div>
      {cart.semanas.length > 3 && (
        <button type="button" className="mt-2 text-[11px] underline text-neutral-400" onClick={() => setTodas((v) => !v)}>
          {todas ? "Mostrar só as recentes" : `Ver todas as ${cart.semanas.length} semanas com saldo`}
        </button>
      )}
      {podeSacar && (
        <Btn className="w-full mt-3" onClick={aoSacar} carregando={sacando} disabled={cart.disponivel <= 0 || !!pendente}>
          {pendente ? `Saque de ${brl(pendente.valor)} em análise` : `Solicitar saque de ${brl(cart.disponivel)}`}
        </Btn>
      )}
    </Card>
  );
}

function PlanoCard({ alvo, todas, config, fatServ, verLucro }: { alvo: any; todas: any[]; config: any; fatServ: number; verLucro: boolean }) {
  const niv = nivelDe(alvo, fatServ);
  if (!niv) return null;
  const { tiers, idx, atual, proximo } = niv;
  const preco = precoCorteDe(alvo, config);
  const falta = proximo ? Math.max(0, proximo.minFat - fatServ) : 0;
  const prog = proximo ? Math.min(100, ((fatServ - atual.minFat) / Math.max(1, proximo.minFat - atual.minFat)) * 100) : 100;
  const risco = riscoVermelho(alvo, todas);
  let aviso = null;
  if (risco.doisSeguidos)
    aviso = verLucro
      ? `${primeiroNome(alvo.nome)} está no VERMELHO 2 meses seguidos (regra do plano: desligamento).`
      : "Você está no vermelho 2 meses seguidos. Esse é o limite do plano. Dá tempo de reagir!";
  else if (risco.vermAnt)
    aviso = risco.cedo
      ? "Mês passado fechou no VERMELHO. Este mês é decisivo (a avaliação começa depois do dia 7)."
      : "Mês passado fechou no VERMELHO. Este mês precisa sair dele.";
  return (
    <Card style={{ border: `1px solid ${niv.cor}66` }}>
      <H>Plano de carreira</H>
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-2xl font-black" style={{ color: niv.cor }}>
            {atual.nome}
          </div>
          <div className="text-xs text-neutral-400">
            Comissão de {atual.comissao}% no mês{atual.bonus ? ` + R$ ${atual.bonus} de bônus` : ""}
          </div>
        </div>
        <div className="text-right">
          <div className="text-[10px] text-neutral-500">Serviços pagos no mês</div>
          <div className="text-lg font-black">{brl(fatServ)}</div>
        </div>
      </div>
      <div className="mt-3">
        <Barra valor={prog} cor={niv.cor} altura="h-3" rotulo="Progresso para o próximo nível" />
      </div>
      <p className="text-xs mt-2 text-neutral-300">
        {proximo ? (
          <>
            Faltam <b style={{ color: GOLD }}>{brl(falta)}</b> (≈ {Math.ceil(falta / Math.max(1, preco))} cortes de {brl(preco)}) para{" "}
            <b style={{ color: corNivel(idx + 1) }}>{proximo.nome}</b>: {proximo.comissao}%{proximo.bonus ? ` + R$ ${proximo.bonus}` : ""}
          </>
        ) : (
          "Você está no nível máximo! 🏆"
        )}
      </p>
      {aviso && (
        <div
          className="mt-3 rounded-xl px-3 py-2 text-xs font-bold"
          style={{ background: "rgba(239,68,68,.12)", border: "1px solid rgba(239,68,68,.5)", color: "#fca5a5" }}
        >
          ⚠ {aviso}
        </div>
      )}
      <div className="mt-4 space-y-2">
        {tiers.map((t, i) => {
          const g = ganhoNivel(tiers, i);
          const ativo = i === idx;
          let ganho = `a partir de ${brl(g.baixo)}`;
          if (g.alto != null) ganho = i === 0 ? `até ${brl(g.alto)}` : `${brl(g.baixo)} a ${brl(g.alto)}`;
          return (
            <div
              key={t.id}
              className="rounded-xl p-3 text-xs"
              style={{
                background: ativo ? `${corNivel(i)}1f` : "#0f0f0f",
                border: `1px solid ${ativo ? corNivel(i) : "#1f1f1f"}`,
                borderLeft: `4px solid ${corNivel(i)}`,
              }}
            >
              <div className="flex justify-between items-center gap-2 flex-wrap">
                <b style={{ color: corNivel(i) }}>
                  {t.nome}
                  {ativo ? " · você está aqui" : ""}
                </b>
                <span className="text-neutral-400">{i === 0 && tiers[1] ? `abaixo de ${brl(tiers[1].minFat)}` : `a partir de ${brl(t.minFat)}`}</span>
              </div>
              <div className="text-neutral-400 mt-0.5">
                {cortesFaixa(tiers, i, preco)} · comissão {t.comissao}%{t.bonus ? ` + R$ ${t.bonus}` : ""}
              </div>
              <div className="mt-1 text-neutral-200">Ganha {ganho}</div>
              {verLucro && (
                <div className="text-neutral-500">
                  Seu lucro estimado:{" "}
                  <b className={lucroNivelDono(config, tiers, i) >= 0 ? "text-green-400" : "text-red-400"}>{brl(lucroNivelDono(config, tiers, i))}</b>
                </div>
              )}
              {t.premio && <div className="text-neutral-500 mt-0.5">{t.premio}</div>}
            </div>
          );
        })}
      </div>
      {verLucro && (
        <p className="text-[10px] text-neutral-600 mt-2">
          Lucro estimado = faturamento − comissão − bônus − imposto − cartão − (custo fixo ÷ {config.rateioFixo || 2}).
        </p>
      )}
    </Card>
  );
}

function EditorMetas({ alvo, config }: { alvo: any; config: any }) {
  const { acoes } = useDados();
  const [rodar] = useAcao();
  const ehAdmin = alvo.role === "admin";
  const upd = (patch) => rodar(() => acoes.atualizarPerfil(alvo.id, patch));
  const tiers = (alvo.plano?.tiers || []).slice().sort((a, b) => a.minFat - b.minFat);
  const setTiers = (t) => upd({ plano: { ...(alvo.plano || {}), tiers: t } });
  const updTier = (id, patch) => setTiers(alvo.plano.tiers.map((t) => (t.id === id ? { ...t, ...patch } : t)));
  const addTier = () => {
    const ult = tiers[tiers.length - 1];
    setTiers([
      ...(alvo.plano?.tiers || []),
      { id: uid(), nome: "NOVO NÍVEL", minFat: ult ? ult.minFat + 500 : 0, comissao: ult ? ult.comissao : 50, bonus: 0, premio: "" },
    ]);
  };
  const delTier = (id) => {
    if (tiers.length <= 1) return;
    if (window.confirm("Remover este nível?")) setTiers(alvo.plano.tiers.filter((t) => t.id !== id));
  };
  const lbl = "block text-[10px] text-neutral-500 mb-1";
  return (
    <Revelar className="grid gap-4 lg:grid-cols-2 items-start">
      <div className="space-y-4">
        <Card className="space-y-3">
          <H>Metas de {primeiroNome(alvo.nome)}</H>
          <div className="grid grid-cols-2 gap-3">
            <label>
              <span className={lbl}>Clientes por semana</span>
              <NumField value={alvo.metaAtendSemana} onChange={(v) => upd({ metaAtendSemana: Math.round(v) })} />
            </label>
            <label>
              <span className={lbl}>Clientes por mês</span>
              <NumField value={alvo.metaAtendMes} onChange={(v) => upd({ metaAtendMes: Math.round(v) })} />
            </label>
            <label>
              <span className={lbl}>Produtos por semana</span>
              <NumField value={alvo.metaProdSemana} prefix="R$" onChange={(v) => upd({ metaProdSemana: v })} />
            </label>
            <label>
              <span className={lbl}>Produtos por mês</span>
              <NumField value={alvo.metaProdMes} prefix="R$" onChange={(v) => upd({ metaProdMes: v })} />
            </label>
          </div>
          <p className="text-[10px] text-neutral-600">Cliente = atendimento com algum serviço (fiado conta). Produtos = valor vendido em R$.</p>
        </Card>
        <Card className="space-y-3">
          <H>Preços de {primeiroNome(alvo.nome)}</H>
          <p className="text-[11px] text-neutral-500">Cada barbeiro pode cobrar um valor diferente. O Lançar usa o preço de quem atendeu.</p>
          {config.servicos.map((s) => (
            <div key={s.id} className="flex items-center gap-3">
              <span className="flex-1 text-sm">
                {s.nome}
                <span className="text-[10px] text-neutral-600"> (padrão {brl(s.preco)})</span>
              </span>
              <NumField
                value={precoServ(alvo, s)}
                prefix="R$"
                className="w-28"
                onChange={(v) => upd({ precos: { ...(alvo.precos || {}), [s.id]: v } })}
                aria-label={`Preço de ${s.nome}`}
              />
            </div>
          ))}
        </Card>
      </div>
      {ehAdmin ? (
        <p className="text-xs text-neutral-500">O dono não recebe comissão, então não tem plano de carreira.</p>
      ) : (
        <Card className="space-y-3">
          <H
            right={
              <button
                type="button"
                className="text-[11px] underline text-neutral-400"
                onClick={() => window.confirm("Voltar o plano deste barbeiro para o padrão?") && upd({ plano: planoPadrao(precoCorteDe(alvo, config)) })}
              >
                restaurar padrão
              </button>
            }
          >
            Plano de carreira
          </H>
          <p className="text-[11px] text-neutral-500">
            O nível é decidido pelo faturamento de serviços pagos no mês. A comissão do nível vale para o mês todo.
          </p>
          {tiers.map((t, i) => (
            <div key={t.id} className="rounded-xl p-3 space-y-2" style={{ background: "#0f0f0f", borderLeft: `4px solid ${corNivel(i)}` }}>
              <div className="flex gap-2 items-center">
                <div className="flex-1">
                  <TextField value={t.nome} onChange={(v) => updTier(t.id, { nome: v.toUpperCase() })} aria-label="Nome do nível" />
                </div>
                <button type="button" onClick={() => delTier(t.id)} className="text-neutral-500 hover:text-red-400 px-1" aria-label="Remover nível">
                  <Trash2 size={16} />
                </button>
              </div>
              <div className="grid grid-cols-3 gap-2">
                <label>
                  <span className={lbl}>A partir de</span>
                  <NumField value={t.minFat} prefix="R$" onChange={(v) => updTier(t.id, { minFat: v })} />
                </label>
                <label>
                  <span className={lbl}>Comissão</span>
                  <NumField value={t.comissao} suffix="%" onChange={(v) => updTier(t.id, { comissao: v })} />
                </label>
                <label>
                  <span className={lbl}>Bônus PIX</span>
                  <NumField value={t.bonus || 0} prefix="R$" onChange={(v) => updTier(t.id, { bonus: v })} />
                </label>
              </div>
              <label className="block">
                <span className={lbl}>Prêmio / observação</span>
                <TextField value={t.premio || ""} onChange={(v) => updTier(t.id, { premio: v })} placeholder="ex: KIT DEXTER completo" />
              </label>
            </div>
          ))}
          <Btn onClick={addTier} className="w-full" cor="#262626" texto="#fff" icone={<Plus size={16} />}>
            Novo nível
          </Btn>
        </Card>
      )}
    </Revelar>
  );
}

export default function MetasTab() {
  const { user, users, lancamentos: todas, config, saques, acoes } = useDados();
  const [rodar, ocupado] = useAcao();
  const ehDono = user.role === "admin";
  const [sel, setSel] = useState(user.id);
  const [vista, setVista] = useState("painel");
  const [periodo, setPeriodo] = usePeriodo("periodo_metas");
  const [confete, setConfete] = useState(false);
  const alvo = (ehDono && users.find((u) => u.id === sel)) || user;
  const alvoDono = alvo.role === "admin";

  const agora = Math.floor(Date.now() / 60000) * 60000;
  const mk = mkOf(agora);
  const [mi, mf] = rangeMes(mk);
  const rg = rangePeriodo(periodo, agora);
  const len = rg.fim - rg.ini;
  const decorrido = rg.fim <= agora ? len : Math.max(DIA, agora - rg.ini);

  const c = useMemo(() => calc(alvo, todas, config, rg.ini, rg.fim), [alvo, todas, config, rg.ini, rg.fim]);
  const cm = useMemo(() => calc(alvo, todas, config, mi, mf), [alvo, todas, config, mi, mf]);
  const prev = useMemo(() => calc(alvo, todas, config, rg.ini - len, rg.ini - len + decorrido), [alvo, todas, config, rg.ini, len, decorrido]);
  const cart = useMemo(() => carteiraSemanas(alvo, todas, config, saques), [alvo, todas, config, saques]);
  const cresc = pct(c.fat, prev.fat);
  const serie = useMemo(() => serieDe(c, rg.ini, rg.fim), [c, rg.ini, rg.fim]);

  // Ranking só para o dono: barbeiros não veem números dos colegas.
  const rank = useMemo(() => {
    if (!ehDono) return null;
    const r = users
      .filter((u) => u.ativo !== false)
      .map((u) => ({ u, c: calc(u, todas, config, rg.ini, rg.fim) }))
      .filter((x) => x.c.atend > 0 || x.u.id === alvo.id);
    return { fat: [...r].sort((a, b) => b.c.fat - a.c.fat), tk: [...r].sort((a, b) => b.c.ticket - a.c.ticket) };
  }, [ehDono, users, todas, config, alvo, rg.ini, rg.fim]);

  // Confete só no marco (meta batida pela 1ª vez neste aparelho).
  useEffect(() => {
    if (alvoDono || alvo.id !== user.id) return;
    const p = metasProgresso(alvo, todas);
    const chaves = [];
    if (p.semana.metaCli > 0 && p.semana.clientes >= p.semana.metaCli) chaves.push(`metaSem:${diaKey(inicioSemana(Date.now()))}:${alvo.id}`);
    if (p.mes.metaCli > 0 && p.mes.clientes >= p.mes.metaCli) chaves.push(`metaMes:${mk}:${alvo.id}`);
    const nova = chaves.find((k) => !lerLocal(k, false));
    for (const k of chaves) gravarLocal(k, true);
    if (nova) {
      setConfete(true);
      setTimeout(() => setConfete(false), 1900);
    }
  }, [todas, alvo, alvoDono, user.id, mk]);

  let dica = "Bom ritmo. Falta pouco para R$70 de ticket.";
  if (c.atend === 0) dica = "Sem atendimentos pagos neste período.";
  else if (c.ticket < 60) dica = "Ofereça mais combo!";
  else if (c.ticket > 70) dica = "Excelente!";

  const missoes = progressoMissoes(alvo, todas, config);
  const mb = config.metaBebida;
  const bebidaNome = mb ? itemNome(config, mb.produtoId) : "";
  const pendente = saques.find((s) => s.barbeiroId === alvo.id && s.status === "pendente");
  const linhasTabela = serie
    .filter((x) => x.atend > 0)
    .slice()
    .reverse()
    .slice(0, 40);
  const porMes = (rg.fim - rg.ini) / DIA > 62;

  const solicitar = () =>
    rodar(() => acoes.solicitarSaque({ id: uid(), ...montarSaque(alvo, cart) }), "Saque solicitado. O dono vai analisar.", { chave: "saque" });

  return (
    <div className="space-y-4 pb-28 lg:pb-10">
      <Confetti show={confete} />

      {ehDono && (
        <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:justify-between">
          <div className="flex gap-2 flex-wrap">
            {users
              .filter((u) => u.ativo !== false)
              .map((u) => (
                <Chip key={u.id} ativo={sel === u.id} onClick={() => setSel(u.id)}>
                  {u.id === user.id ? "Eu" : primeiroNome(u.nome)}
                </Chip>
              ))}
          </div>
          <div className="flex gap-2">
            <Chip ativo={vista === "painel"} onClick={() => setVista("painel")}>
              Painel
            </Chip>
            <Chip ativo={vista === "editar"} onClick={() => setVista("editar")}>
              Editar metas
            </Chip>
          </div>
        </div>
      )}

      <div>
        <h1 className="text-2xl font-black">{ehDono && alvo.id !== user.id ? `Metas de ${primeiroNome(alvo.nome)}` : `Olá ${primeiroNome(alvo.nome)}!`}</h1>
        <p className="text-xs text-neutral-500">{mesLabel(mk)}</p>
      </div>

      {vista === "editar" && ehDono ? (
        <EditorMetas key={alvo.id} alvo={alvo} config={config} />
      ) : (
        <Revelar key={`${alvo.id}-${periodo.tipo}`} className="grid gap-4 lg:grid-cols-2 items-start">
          <div className="space-y-4">
            {!alvoDono && (
              <CarteiraCard alvo={alvo} cart={cart} podeSacar={alvo.id === user.id} pendente={pendente} aoSacar={solicitar} sacando={ocupado === "saque"} />
            )}
            <MetasCompactas u={alvo} todas={todas} config={config} />
            {!alvoDono && <PlanoCard alvo={alvo} todas={todas} config={config} fatServ={cm.fatServ} verLucro={ehDono} />}
            {!alvoDono && (
              <Card>
                <H>Missões de hoje</H>
                {missoes.length === 0 && <Vazio>Nenhuma missão hoje.</Vazio>}
                {missoes.map((m) => {
                  const ok = m.n >= m.alvo;
                  return (
                    <div key={m.id} className="mb-3 last:mb-0">
                      <div className="flex justify-between text-sm gap-2">
                        <span className={ok ? "line-through text-neutral-500" : ""}>{m.titulo}</span>
                        <span className="font-bold" style={{ color: GOLD }}>
                          +{brl(m.bonus)}
                        </span>
                      </div>
                      <div className="mt-1.5">
                        <Barra valor={(m.n / m.alvo) * 100} cor={ok ? VERDE : GOLD} altura="h-2" rotulo={m.titulo} />
                      </div>
                      <div className="text-[10px] text-neutral-500 mt-0.5">
                        {Math.min(m.n, m.alvo)}/{m.alvo} {ok ? "✓ cumprida" : ""}
                        {m.fiado > 0 && <span className="text-amber-400"> · +{m.fiado} em fiado (conta quando pagar)</span>}
                      </div>
                    </div>
                  );
                })}
              </Card>
            )}
            {!alvoDono && mb && (
              <Card>
                <H>Meta {bebidaNome} (mês)</H>
                <div className="flex justify-between text-sm mb-1.5">
                  <span>
                    {Math.min(cm.bebidas, mb.qtd)}/{mb.qtd} vendidas
                  </span>
                  <span className="font-bold" style={{ color: GOLD }}>
                    +{brl(mb.bonus)}
                  </span>
                </div>
                <Barra valor={(cm.bebidas / mb.qtd) * 100} altura="h-3" rotulo={`Meta de ${bebidaNome}`} />
                <p className="text-xs text-neutral-400 mt-2">
                  {cm.bebidas >= mb.qtd ? `Meta batida! ${brl(mb.bonus)} extra garantido.` : `Faltam ${mb.qtd - cm.bebidas} pra ganhar ${brl(mb.bonus)} extra`}
                </p>
              </Card>
            )}
          </div>

          <div className="space-y-4">
            <Card>
              <H>Ver resultados de</H>
              <PeriodoBar valor={periodo} onChange={setPeriodo} />
            </Card>
            <Card>
              <H>Resumo · {rg.label}</H>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-2 xl:grid-cols-3 gap-3">
                <div>
                  <div className="text-[11px] text-neutral-500">Faturamento</div>
                  <div className="numero font-black">{brl(c.fat)}</div>
                  <div className="text-[10px] font-bold" style={{ color: cresc >= 0 ? VERDE : "#ef4444" }}>
                    {cresc >= 0 ? "▲ +" : "▼ "}
                    {cresc.toFixed(0)}% vs anterior
                  </div>
                </div>
                <div>
                  <div className="text-[11px] text-neutral-500">Clientes atendidos</div>
                  <div className="numero font-black">{c.clientes}</div>
                  <div className="text-[10px] text-neutral-500">{c.cortes} cortes</div>
                </div>
                <div>
                  <div className="text-[11px] text-neutral-500">Ticket médio</div>
                  <div className="numero font-black" style={{ color: c.ticket > 70 ? VERDE : c.ticket < 60 && c.atend ? "#f59e0b" : "#fff" }}>
                    {brl(c.ticket)}
                  </div>
                </div>
                {alvoDono ? (
                  <div>
                    <div className="text-[11px] text-neutral-500">Gorjetas</div>
                    <div className="numero font-black">{brl(c.gorjeta)}</div>
                  </div>
                ) : (
                  <div>
                    <div className="text-[11px] text-neutral-500">Comissão</div>
                    <div className="numero font-black" style={{ color: GOLD }}>
                      {brl(c.comissao)}
                    </div>
                    <div className="text-[10px] text-neutral-500">+ gorjetas {brl(c.gorjeta)}</div>
                  </div>
                )}
                <div>
                  <div className="text-[11px] text-neutral-500">Produtos vendidos</div>
                  <div className="numero font-black">{brl(c.fatProd)}</div>
                </div>
                {ehDono && (
                  <div>
                    <div className="text-[11px] text-neutral-500">Lucro deixado pra casa</div>
                    <div className="numero font-black text-green-400">{brl(c.casa)}</div>
                  </div>
                )}
              </div>
              <div className="mt-3 text-xs rounded-xl px-3 py-2" style={{ background: "rgba(201,168,106,.1)", color: GOLD }}>
                💡 {dica}
              </div>
              {!alvoDono && (c.bonusBebida > 0 || c.bonusMissoes > 0 || c.bonusTier > 0) && (
                <p className="text-[11px] text-neutral-500 mt-2">
                  Inclui bônus: plano {brl(c.bonusTier)} · bebida {brl(c.bonusBebida)} · missões {brl(c.bonusMissoes)}
                </p>
              )}
            </Card>

            <Card>
              <H>Faturamento no período</H>
              {serie.length === 0 ? (
                <Vazio>Sem dados neste período.</Vazio>
              ) : (
                <div style={{ height: 180 }}>
                  <ResponsiveContainer>
                    <LineChart data={serie} margin={{ left: -18, right: 6, top: 6 }}>
                      <CartesianGrid stroke="#1f1f1f" vertical={false} />
                      <XAxis dataKey="rot" {...eixoGrafico} interval={Math.max(0, Math.floor(serie.length / 6))} />
                      <YAxis {...eixoGrafico} />
                      <Tooltip {...tooltipGrafico} formatter={(v) => [brl(v), "Faturamento"]} />
                      <Line type="monotone" dataKey="fat" stroke={GOLD} strokeWidth={2.5} dot={serie.length <= 8} animationDuration={500} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              )}
              <p className="text-[11px] text-neutral-500 mt-3 mb-1">Ticket médio no período</p>
              <div style={{ height: 130 }}>
                <ResponsiveContainer>
                  <LineChart data={serie} margin={{ left: -18, right: 6, top: 6 }}>
                    <CartesianGrid stroke="#1f1f1f" vertical={false} />
                    <XAxis dataKey="rot" {...eixoGrafico} interval={Math.max(0, Math.floor(serie.length / 6))} />
                    <YAxis {...eixoGrafico} />
                    <Tooltip {...tooltipGrafico} formatter={(v) => [brl(v), "Ticket"]} />
                    <Line type="monotone" dataKey="ticket" stroke={VERDE} strokeWidth={2.5} connectNulls dot={false} animationDuration={500} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </Card>

            {linhasTabela.length > 0 && (
              <Card pad="sm">
                <H>{porMes ? "Mês a mês" : "Dia a dia"}</H>
                <div className="max-h-80 overflow-y-auto">
                  <table className="w-full text-xs">
                    <thead className="sticky top-0 bg-[#141414]">
                      <tr className="text-neutral-500 text-left">
                        <th className="py-1.5 px-1">{porMes ? "Mês" : "Dia"}</th>
                        <th className="px-1">Clientes</th>
                        <th className="px-1">Faturou</th>
                        <th className="px-1">Ticket</th>
                      </tr>
                    </thead>
                    <tbody>
                      {linhasTabela.map((x) => (
                        <tr key={x.rot} className="border-t border-[#1d1d1d]">
                          <td className="py-1.5 px-1 text-neutral-400">{x.rot}</td>
                          <td className="px-1">{x.atend}</td>
                          <td className="px-1 font-bold">{brl(x.fat)}</td>
                          <td className="px-1">{brl(x.ticket)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </Card>
            )}

            {rank && (
              <Card>
                <H right={<Trophy size={16} style={{ color: GOLD }} />}>Ranking · {rg.label}</H>
                <div className="grid grid-cols-2 gap-3">
                  {(
                    [
                      ["Faturamento", rank.fat, (x) => brl(x.c.fat)],
                      ["Ticket médio", rank.tk, (x) => brl(x.c.ticket)],
                    ] as [string, any[], (x: any) => string][]
                  ).map(([t, lista, f]) => (
                    <div key={t}>
                      <div className="text-[10px] text-neutral-500 mb-1">{t}</div>
                      {lista.map((x, i) => (
                        <div
                          key={x.u.id}
                          className="flex items-center justify-between gap-2 text-xs py-1.5 border-b border-[#1d1d1d] last:border-0"
                          style={{ color: x.u.id === alvo.id ? GOLD : "#d4d4d4", fontWeight: x.u.id === alvo.id ? 800 : 500 }}
                        >
                          <span>
                            {i + 1}º {primeiroNome(x.u.nome)}
                          </span>
                          <span>{f(x)}</span>
                        </div>
                      ))}
                    </div>
                  ))}
                </div>
                <p className="text-[10px] text-neutral-600 mt-2">Só o dono vê o ranking com valores da equipe.</p>
              </Card>
            )}
          </div>
        </Revelar>
      )}
    </div>
  );
}
