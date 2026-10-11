/* Gestão › Visão geral (dono). */
import { Pencil, TrendingDown, TrendingUp } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Bar, BarChart, CartesianGrid, Cell, Legend, Line, LineChart, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { useDados } from "../../data/DadosProvider.tsx";
import { contasAlertas, dreMes, dreRange, fatServMes, metasProgresso } from "../../domain/calculos.ts";
import { FORMA_LABEL, FORMAS } from "../../domain/config.ts";
import { DIA, diaKey, diasNoMes, hora, inicioDia, inicioSemana, mesLabel, mkOf, rangeMes, rangePeriodo, somarDias } from "../../domain/datas.ts";
import { brl, pct, pctBR, primeiroNome, tempoAtras } from "../../domain/formato.ts";
import { nivelDe, precoCorteDe } from "../../domain/usuarios.ts";
import { Btn, Card, Chip, H, NumField, Vazio } from "../../ui/base.tsx";
import { PeriodoBar } from "../../ui/controles.tsx";
import { ListaAnimada, Modal, Revelar } from "../../ui/estrutura.tsx";
import { BarraMeta } from "../../ui/progresso.tsx";
import { eixoGrafico, GOLD, tooltipGrafico, VERDE } from "../../ui/tema.ts";
import { AvatarUsuario, Foto, useAcao } from "../compartilhado/comum.tsx";
import { EditarLancamento, LinhaLancamento } from "../compartilhado/lancamentos.tsx";
import { usePeriodo } from "../compartilhado/preferencias.ts";

const CORES_PIE = { Comissões: "#C9A86A", Produtos: "#8b5cf6", "Imposto+Maq.": "#f59e0b", "Custo fixo": "#64748b", Lucro: "#22c55e" };
const COR_STATUS = { atrasada: "#ef4444", hoje: "#f59e0b", breve: "#fb923c", paga: "#22c55e", ok: "#737373", semdata: "#525252" };

function txtStatus(a) {
  if (a.status === "atrasada") return "Atrasada";
  if (a.status === "hoje") return "Vence HOJE";
  if (a.status === "breve") return `Vence em ${a.falta} ${a.falta === 1 ? "dia" : "dias"}`;
  if (a.status === "paga") return "Paga ✓";
  if (a.status === "semdata") return "Sem data";
  return `Dia ${a.diaV}`;
}

function Kpi({ rotulo, valor, sub = "", cor = undefined }: { rotulo: string; valor: string; sub?: string; cor?: string }) {
  return (
    <Card>
      <div className="text-[11px] text-neutral-500">{rotulo}</div>
      <div className="numero font-black" style={{ color: cor }}>
        {valor}
      </div>
      {sub && <div className="text-[10px] text-neutral-500">{sub}</div>}
    </Card>
  );
}

function AoVivo({ conexao }: { conexao: string }) {
  const ok = conexao === "online";
  return (
    <span className={`flex items-center gap-1 text-[10px] ${ok ? "text-green-400" : "text-amber-400"}`}>
      <span className={`w-2 h-2 rounded-full ${ok ? "bg-green-500" : "bg-amber-500"}`} aria-hidden="true" />
      {ok ? "AO VIVO" : "RECONECTANDO"}
    </span>
  );
}

export default function VisaoGeral() {
  const { users, lancamentos: todas, config, saques, fechamentos, conexao, acoes } = useDados();
  const [rodar, ocupado] = useAcao();
  const [periodo, setPeriodo] = usePeriodo("periodo_gestao");
  const [ordem, setOrdem] = useState("fat");
  const [foto, setFoto] = useState(null);
  const [editando, setEditando] = useState(null);
  const [comModo, setComModo] = useState("50");
  const [simul, setSimul] = useState({});
  const [, tick] = useState(0);
  useEffect(() => {
    const i = setInterval(() => tick((x) => x + 1), 30000);
    return () => clearInterval(i);
  }, []);

  const agora = Math.floor(Date.now() / 60000) * 60000;
  const mkAtual = mkOf(agora);
  const rg = rangePeriodo(periodo, agora);
  const len = rg.fim - rg.ini;
  const decorrido = rg.fim <= agora ? len : Math.max(DIA, agora - rg.ini);
  const hojeIni = inicioDia(agora);
  const semIni = inicioSemana(agora);
  const [mesIni, mesFim] = rangeMes(mkAtual);

  const d = useMemo(() => dreRange(users, todas, config, rg.ini, rg.fim), [users, todas, config, rg.ini, rg.fim]);
  const dPrev = useMemo(() => dreRange(users, todas, config, rg.ini - len, rg.ini - len + decorrido), [users, todas, config, rg.ini, len, decorrido]);
  const dMes = useMemo(() => dreRange(users, todas, config, mesIni, mesFim), [users, todas, config, mesIni, mesFim]);
  const dHoje = useMemo(() => dreRange(users, todas, config, hojeIni, somarDias(hojeIni, 1)), [users, todas, config, hojeIni]);
  const dSem = useMemo(() => dreRange(users, todas, config, semIni, somarDias(semIni, 7)), [users, todas, config, semIni]);

  const diasMes = diasNoMes(mkAtual);
  const diasPass = new Date().getDate();
  const fatProj = (dMes.fat / diasPass) * diasMes;
  const lucroProj = ((dMes.lucro + dMes.fixo) / diasPass) * diasMes - dMes.fixo;
  const cresc = pct(d.fat, dPrev.fat);
  const mkRef = mkOf(Math.min(rg.fim, agora + 1) - 1);

  const linhas = useMemo(() => {
    const l = d.porUser.filter((x) => x.u.ativo !== false || x.c.atend > 0);
    return [...l].sort((a, b) => (ordem === "fat" ? b.c.fat - a.c.fat : b.c.ticket - a.c.ticket));
  }, [d, ordem]);

  const serie6 = useMemo(() => {
    const out = [];
    const base = new Date();
    for (let i = 5; i >= 0; i--) {
      const k = mkOf(new Date(base.getFullYear(), base.getMonth() - i, 1).getTime());
      const x = dreMes(users, todas, config, k);
      out.push({ mes: `${k.slice(5)}/${k.slice(2, 4)}`, fat: +x.fat.toFixed(0), lucro: +x.lucro.toFixed(0) });
    }
    return out;
  }, [users, todas, config]);

  const pie = [
    { name: "Comissões", value: d.comissoes },
    { name: "Produtos", value: d.custoProd },
    { name: "Imposto+Maq.", value: d.imposto + d.maq },
    { name: "Custo fixo", value: d.fixo },
    { name: "Lucro", value: Math.max(0, d.lucro) },
  ].filter((x) => x.value > 0);

  const feed = useMemo(() => [...todas].sort((a, b) => b.ts - a.ts).slice(0, 12), [todas]);
  const hojeKey = diaKey(Date.now());
  const barbeiros = users.filter((u) => u.role === "barbeiro" && u.ativo !== false);
  const fechHoje = fechamentos.filter((f) => f.dia === hojeKey);
  const fechAnt = fechamentos.filter((f) => f.dia !== hojeKey).slice(0, 5);

  const meta = config.salarioMeta;
  const podeTirar = Math.max(0, Math.min(dMes.lucro, meta));
  const faltaSal = Math.max(0, meta - Math.max(0, dMes.lucro));
  const lucroAtend = dMes.atend > 0 ? (dMes.lucro + dMes.fixo) / dMes.atend : dMes.ticket * 0.4;
  const cortesFalta = lucroAtend > 0 ? Math.ceil(faltaSal / lucroAtend) : 0;
  const saquesPend = saques.filter((s) => s.status === "pendente");

  const baseFat = dMes.fat > 0 && diasPass >= 5 ? fatProj : config.faturamentoBase;
  const fixoPct = baseFat > 0 ? (config.custoFixo / baseFat) * 100 : 0;
  const linhasCorte = users
    .filter((u) => u.ativo !== false)
    .map((u) => {
      const preco = simul[u.id] !== undefined ? simul[u.id] : precoCorteDe(u, config);
      const cMes = (dMes.porUser.find((x) => x.u.id === u.id) || { c: { fatServ: 0 } }).c;
      const nivAt = nivelDe(u, cMes.fatServ);
      let com = 50;
      if (u.role === "admin") com = 0;
      else if (comModo !== "50" && nivAt) com = nivAt.atual.comissao;
      const vCom = (preco * com) / 100;
      const vImp = (preco * config.imposto) / 100;
      const vMaq = (preco * config.maquininha) / 100;
      const margem = preco - vCom - vImp - vMaq;
      const vFix = (preco * fixoPct) / 100;
      return { u, preco, com, vCom, vImp, vMaq, margem, vFix, lucro: margem - vFix };
    });

  const alertasContas = contasAlertas(config);
  const ordemContas = [...alertasContas].sort((a, b) => (a.semData ? 99 : a.diaV) - (b.semData ? 99 : b.diaV));
  const togglePaga = (id) =>
    rodar(
      () =>
        acoes.atualizarConfig((cfg) => {
          const atual = cfg.contasPagas?.[mkAtual] || [];
          const novo = atual.includes(id) ? atual.filter((x) => x !== id) : [...atual, id];
          return { ...cfg, contasPagas: { ...(cfg.contasPagas || {}), [mkAtual]: novo } };
        }),
      null,
      { chave: `conta:${id}` },
    );
  const totalPago = alertasContas.filter((a) => a.paga).reduce((s, a) => s + (Number(a.c.valor) || 0), 0);

  const linhaDre = (rot: string, v: number, neg = false, forte = false) => (
    <div className={`flex justify-between py-1.5 text-sm ${forte ? "font-black border-t border-[#2a2a2a] mt-1 pt-2" : ""}`}>
      <span className={forte ? "" : "text-neutral-400"}>{rot}</span>
      <span style={{ color: forte ? (v >= 0 ? VERDE : "#ef4444") : neg ? "#f87171" : "#fff" }}>
        {neg ? "− " : ""}
        {brl(Math.abs(v))}
      </span>
    </div>
  );

  return (
    <>
      <Revelar className="space-y-4">
        {/* Ao vivo hoje */}
        <Card style={{ border: `1px solid ${GOLD}66` }}>
          <H right={<AoVivo conexao={conexao} />}>Barbearia hoje</H>
          <div className="grid grid-cols-3 gap-3 mb-3">
            <div>
              <div className="text-[11px] text-neutral-500">Faturando</div>
              <div className="numero-grande font-black" style={{ color: GOLD }}>
                {brl(dHoje.fat)}
              </div>
            </div>
            <div>
              <div className="text-[11px] text-neutral-500">Comissões</div>
              <div className="numero-grande font-black">{brl(dHoje.comissoes)}</div>
            </div>
            <div>
              <div className="text-[11px] text-neutral-500">Sobra pra casa</div>
              <div className="numero-grande font-black text-green-400">{brl(dHoje.porUser.reduce((a, x) => a + x.c.casa, 0))}</div>
            </div>
          </div>
          <div className="grid lg:grid-cols-3 lg:gap-x-6">
            {dHoje.porUser
              .filter((x) => x.u.ativo !== false || x.c.atend > 0)
              .map(({ u, c }) => {
                const niv = nivelDe(u, (dMes.porUser.find((x) => x.u.id === u.id) || { c: { fatServ: 0 } }).c.fatServ);
                return (
                  <div key={u.id} className="flex items-center gap-3 py-2 border-t border-[#1d1d1d] text-xs">
                    <AvatarUsuario u={u} size={30} />
                    <div className="flex-1 min-w-0">
                      <div className="font-bold text-sm truncate">
                        {primeiroNome(u.nome)}
                        {niv && (
                          <span className="ml-2 text-[10px]" style={{ color: niv.cor }}>
                            {niv.atual.nome} · {niv.atual.comissao}%
                          </span>
                        )}
                      </div>
                      <div className="text-neutral-500">
                        {c.clientes} cliente{c.clientes === 1 ? "" : "s"} · gorjeta {brl(c.gorjeta)}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="font-black">{brl(c.fat)}</div>
                      <div style={{ color: GOLD }}>{u.role === "admin" ? "dono" : `comissão ${brl(c.comissao)}`}</div>
                    </div>
                  </div>
                );
              })}
          </div>
          <div className="grid grid-cols-2 gap-3 mt-2 pt-2 border-t border-[#1d1d1d] text-xs">
            <div>
              <span className="text-neutral-500">Semana: </span>
              <b>{brl(dSem.fat)}</b>
            </div>
            <div>
              <span className="text-neutral-500">Mês: </span>
              <b>{brl(dMes.fat)}</b>
            </div>
          </div>
          <p className="text-[10px] text-neutral-600 mt-2">Faturamento e comissão contam só o que foi pago. Fiado entra quando for quitado.</p>
        </Card>

        {/* Período + KPIs */}
        <Card>
          <H>Ver resultados de</H>
          <PeriodoBar valor={periodo} onChange={setPeriodo} />
        </Card>
        <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-6 gap-3">
          <Kpi rotulo={`Faturamento · ${rg.label}`} valor={brl(d.fat)} cor={GOLD} />
          <Kpi rotulo="Lucro líquido" valor={brl(d.lucro)} sub={`margem ${d.margem.toFixed(1)}%`} cor={d.lucro >= 0 ? VERDE : "#ef4444"} />
          <Card>
            <div className="text-[11px] text-neutral-500">Vs período anterior</div>
            <div className="numero flex items-center gap-1 font-black" style={{ color: cresc >= 0 ? VERDE : "#ef4444" }}>
              {cresc >= 0 ? <TrendingUp size={18} /> : <TrendingDown size={18} />}
              {cresc >= 0 ? "+" : ""}
              {cresc.toFixed(0)}%
            </div>
          </Card>
          <Kpi rotulo="Ticket médio" valor={brl(d.ticket)} />
          <Kpi rotulo="% custo fixo" valor={`${d.fat > 0 ? ((d.fixo / d.fat) * 100).toFixed(1) : "—"}%`} sub={`${brl(config.custoFixo)} por mês`} />
          <Kpi rotulo="Clientes / cortes" valor={`${d.porUser.reduce((a, x) => a + x.c.clientes, 0)} / ${d.cortes}`} sub={`${d.atend} atendimentos`} />
        </div>

        <div className="lg:columns-2 gap-4 [&>*]:mb-4 [&>*]:break-inside-avoid">
          <Card style={{ border: `1px solid ${GOLD}55` }}>
            <H>Previsão do fim do mês</H>
            <p className="text-sm">
              {dMes.fat <= 0 ? "Sem dados suficientes ainda." : `Se manter o ritmo, vai faturar ${brl(fatProj)} e lucrar ${brl(lucroProj)}.`}
            </p>
            <p className="text-[11px] text-neutral-500 mt-1">
              Projeção simples (regra de três) pelo ritmo de {diasPass} de {diasMes} dias.
            </p>
          </Card>

          <Card style={{ border: `1px solid ${GOLD}55` }}>
            <H>Salário do dono (mês atual)</H>
            <div className="flex items-center gap-3 mb-3">
              <span className="text-sm text-neutral-400">Quero tirar</span>
              <NumField value={meta} prefix="R$" onChange={(v) => rodar(() => acoes.atualizarConfig((c) => ({ ...c, salarioMeta: v })))} className="w-36" />
            </div>
            {dMes.lucro >= meta ? (
              <p className="text-sm">
                Meta batida! Já pode tirar <b style={{ color: VERDE }}>{brl(meta)}</b> e ainda sobra {brl(dMes.lucro - meta)}.
              </p>
            ) : (
              <p className="text-sm">
                Já pode tirar <b style={{ color: GOLD }}>{brl(podeTirar)}</b>, faltam <b>{brl(faltaSal)}</b>
                {cortesFalta > 0 && (
                  <>
                    {" "}
                    = <b style={{ color: GOLD }}>+{cortesFalta} cortes</b>
                  </>
                )}
              </p>
            )}
            <p className="text-[10px] text-neutral-600 mt-2">Calculado sobre o lucro líquido do mês, depois do custo fixo.</p>
          </Card>

          {/* Saques */}
          <Card style={saquesPend.length ? { border: "1px solid #facc1566" } : undefined}>
            <H>Saques dos barbeiros</H>
            {saquesPend.length === 0 && <Vazio>Nenhum saque pendente.</Vazio>}
            <ListaAnimada
              itens={saquesPend}
              render={(s) => (
                <div className="flex items-center justify-between gap-3 py-2 border-b border-[#1d1d1d] last:border-0">
                  <div className="min-w-0">
                    <div className="text-sm font-bold">
                      {primeiroNome(s.nome)} · {brl(s.valor)}
                    </div>
                    <div className="text-[10px] text-neutral-500">
                      {tempoAtras(s.ts)}
                      {s.periodos?.length > 0 && ` · ${s.periodos.map((p) => `${p.rotulo || p.semana}: ${brl(p.valor)}`).join(" · ")}`}
                    </div>
                  </div>
                  <div className="flex gap-2 shrink-0">
                    <Btn
                      tamanho="sm"
                      carregando={ocupado === `pago:${s.id}`}
                      onClick={() => rodar(() => acoes.resolverSaque(s.id, "pago"), "Saque marcado como pago.", { chave: `pago:${s.id}` })}
                    >
                      Pago
                    </Btn>
                    <Btn
                      tamanho="sm"
                      cor="#262626"
                      texto="#fff"
                      carregando={ocupado === `rec:${s.id}`}
                      onClick={() =>
                        rodar(() => acoes.resolverSaque(s.id, "recusado"), "Saque recusado. O valor volta para a carteira.", { chave: `rec:${s.id}` })
                      }
                    >
                      Recusar
                    </Btn>
                  </div>
                </div>
              )}
            />
          </Card>

          {/* Metas da equipe */}
          <Card>
            <H>Metas da equipe</H>
            {users
              .filter((u) => u.ativo !== false)
              .map((u) => {
                const p = metasProgresso(u, todas);
                return (
                  <div key={u.id} className="py-3 border-t border-[#1d1d1d] first:border-0 first:pt-0">
                    <div className="flex items-center gap-2 mb-2">
                      <AvatarUsuario u={u} size={24} />
                      <b className="text-sm">{primeiroNome(u.nome)}</b>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <BarraMeta rotulo="Clientes semana" atual={p.semana.clientes} meta={p.semana.metaCli} />
                        <BarraMeta rotulo="Produtos semana" atual={p.semana.prod} meta={p.semana.metaProd} dinheiro />
                      </div>
                      <div>
                        <BarraMeta rotulo="Clientes mês" atual={p.mes.clientes} meta={p.mes.metaCli} />
                        <BarraMeta rotulo="Produtos mês" atual={p.mes.prod} meta={p.mes.metaProd} dinheiro />
                      </div>
                    </div>
                  </div>
                );
              })}
            <p className="text-[10px] text-neutral-600 mt-2">Para mudar metas, preços e plano: aba Metas › Editar metas.</p>
          </Card>

          {/* Comandas ao vivo */}
          <Card>
            <H right={<AoVivo conexao={conexao} />}>Comandas ao vivo</H>
            {feed.length === 0 && <Vazio>Nenhum lançamento ainda.</Vazio>}
            <ListaAnimada
              itens={feed}
              render={(l) => (
                <div>
                  <div className="text-[10px] text-neutral-500 pt-1">{tempoAtras(l.ts)}</div>
                  <LinhaLancamento
                    l={l}
                    mostrarBarbeiro
                    aoAbrirFoto={(f) => setFoto(f)}
                    acoes={
                      <button
                        type="button"
                        onClick={() => setEditando(l)}
                        className="text-neutral-500 hover:text-white p-1"
                        aria-label={`Corrigir lançamento de ${l.clienteNome}`}
                      >
                        <Pencil size={15} />
                      </button>
                    }
                  />
                </div>
              )}
            />
            <p className="text-[10px] text-neutral-600 mt-2">Use o lápis para corrigir ou excluir. Lista completa em Gestão › Lançamentos.</p>
          </Card>
        </div>

        {/* Ranking completo */}
        <Card pad="sm">
          <H
            right={
              <div className="flex gap-2">
                <Chip ativo={ordem === "fat"} onClick={() => setOrdem("fat")}>
                  Faturamento
                </Chip>
                <Chip ativo={ordem === "tk"} onClick={() => setOrdem("tk")}>
                  Ticket médio
                </Chip>
              </div>
            }
          >
            Ranking · {rg.label}
          </H>
          <div className="overflow-x-auto -mx-1">
            <table className="w-full text-xs" style={{ minWidth: 680 }}>
              <thead>
                <tr className="text-neutral-500 text-left">
                  {["Barbeiro", "Clientes", "Faturam.", "Ticket", "Comissão", "Gorjetas", "Lucro casa", "Nível do mês"].map((h) => (
                    <th key={h} className="py-2 px-1 font-semibold">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {linhas.map(({ u, c }, i) => {
                  const niv = nivelDe(u, fatServMes(u, todas, mkRef));
                  return (
                    <tr key={u.id} className="border-t border-[#1d1d1d]">
                      <td className="py-2 px-1">
                        <div className="flex items-center gap-2">
                          <span className="text-neutral-500 w-3">{i + 1}</span>
                          <AvatarUsuario u={u} size={28} />
                          <span className="font-bold">{primeiroNome(u.nome)}</span>
                        </div>
                      </td>
                      <td className="px-1">{c.clientes}</td>
                      <td className="px-1 font-bold" style={{ color: ordem === "fat" ? GOLD : "#fff" }}>
                        {brl(c.fat)}
                      </td>
                      <td className="px-1" style={{ color: ordem === "tk" ? GOLD : "#fff", fontWeight: ordem === "tk" ? 700 : 400 }}>
                        {brl(c.ticket)}
                      </td>
                      <td className="px-1">{u.role === "admin" ? "—" : brl(c.comissao)}</td>
                      <td className="px-1">{brl(c.gorjeta)}</td>
                      <td className="px-1 text-green-400">{brl(c.casa)}</td>
                      <td className="px-1">
                        {niv ? (
                          <span className="font-bold" style={{ color: niv.cor }}>
                            {niv.atual.nome}
                          </span>
                        ) : (
                          <span className="text-neutral-500">Dono</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>

        {/* Gráficos */}
        <div className="lg:columns-2 gap-4 [&>*]:mb-4 [&>*]:break-inside-avoid">
          <Card>
            <H>Comparativo da equipe · {rg.label}</H>
            <div style={{ height: 220 }}>
              <ResponsiveContainer>
                <BarChart
                  data={linhas.map((x) => ({ nome: primeiroNome(x.u.nome), Faturamento: +x.c.fat.toFixed(0), "Lucro casa": +x.c.casa.toFixed(0) }))}
                  margin={{ left: -15, right: 6 }}
                >
                  <CartesianGrid stroke="#1f1f1f" vertical={false} />
                  <XAxis dataKey="nome" {...eixoGrafico} />
                  <YAxis {...eixoGrafico} />
                  <Tooltip {...tooltipGrafico} formatter={(v) => brl(v)} cursor={{ fill: "rgba(255,255,255,.03)" }} />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                  <Bar dataKey="Faturamento" fill={GOLD} radius={[6, 6, 0, 0]} animationDuration={500} />
                  <Bar dataKey="Lucro casa" fill={VERDE} radius={[6, 6, 0, 0]} animationDuration={500} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </Card>
          <Card>
            <H>Crescimento em 6 meses</H>
            <div style={{ height: 220 }}>
              <ResponsiveContainer>
                <LineChart data={serie6} margin={{ left: -10, right: 10 }}>
                  <CartesianGrid stroke="#1f1f1f" vertical={false} />
                  <XAxis dataKey="mes" {...eixoGrafico} />
                  <YAxis {...eixoGrafico} />
                  <Tooltip {...tooltipGrafico} formatter={(v) => brl(v)} />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                  <Line type="monotone" dataKey="fat" name="Faturamento" stroke={GOLD} strokeWidth={2.5} animationDuration={500} />
                  <Line type="monotone" dataKey="lucro" name="Lucro" stroke={VERDE} strokeWidth={2.5} animationDuration={500} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </Card>

          <Card>
            <H>DRE · {rg.label}</H>
            {linhaDre("Faturamento", d.fat)}
            {linhaDre("Comissões e bônus", d.comissoes, true)}
            {linhaDre("Custo de produtos", d.custoProd, true)}
            {linhaDre(`Imposto (${config.imposto}%)`, d.imposto, true)}
            {linhaDre(`Maquininha (${config.maquininha}% no cartão)`, d.maq, true)}
            {linhaDre("Custo fixo (proporcional aos dias)", d.fixo, true)}
            {linhaDre(`Lucro (margem ${d.margem.toFixed(1)}%)`, d.lucro, false, true)}
            <p className="text-[10px] text-neutral-600 mt-2">Gorjetas ficam fora do DRE (100% do barbeiro): {brl(d.gorjetas)}.</p>
          </Card>
          <Card>
            <H>Custos vs lucro · {rg.label}</H>
            {pie.length === 0 ? (
              <Vazio>Sem dados no período.</Vazio>
            ) : (
              <div style={{ height: 240 }}>
                <ResponsiveContainer>
                  <PieChart>
                    <Pie data={pie} dataKey="value" nameKey="name" innerRadius={50} outerRadius={80} paddingAngle={2} stroke="none" animationDuration={500}>
                      {pie.map((p) => (
                        <Cell key={p.name} fill={CORES_PIE[p.name]} />
                      ))}
                    </Pie>
                    <Tooltip {...tooltipGrafico} formatter={(v) => brl(v)} />
                    <Legend wrapperStyle={{ fontSize: 11 }} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            )}
          </Card>
        </div>

        {/* Lucro real por corte */}
        <Card className="space-y-3">
          <H>Lucro real por corte</H>
          <div className="flex gap-2 flex-wrap">
            <Chip ativo={comModo === "50"} onClick={() => setComModo("50")}>
              Comissão 50%
            </Chip>
            <Chip ativo={comModo === "nivel"} onClick={() => setComModo("nivel")}>
              Comissão do nível atual
            </Chip>
          </div>
          <p className="text-[11px] text-neutral-500">
            Custo fixo = {pctBR(fixoPct)} do faturamento ({brl(config.custoFixo)} ÷ {brl(baseFat)}
            {dMes.fat > 0 && diasPass >= 5 ? ", ritmo do mês" : ", faturamento base"}). Imposto {config.imposto}% e cartão {config.maquininha}% em todo corte.
            Altere o preço para simular.
          </p>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {linhasCorte.map((x) => (
              <div key={x.u.id} className="rounded-xl bg-[#0f0f0f] p-3 text-sm">
                <div className="flex items-center justify-between gap-3 mb-2">
                  <b className="text-xs tracking-wider">{x.u.role === "admin" ? "SEU CORTE" : `CORTE DO ${primeiroNome(x.u.nome).toUpperCase()}`}</b>
                  <NumField
                    value={x.preco}
                    prefix="R$"
                    className="w-28"
                    onChange={(v) => setSimul((s) => ({ ...s, [x.u.id]: v }))}
                    aria-label="Preço simulado"
                  />
                </div>
                {[
                  [`Comissão ${x.com}%`, x.vCom],
                  [`Imposto ${config.imposto}%`, x.vImp],
                  [`Taxa cartão ${config.maquininha}%`, x.vMaq],
                ].map(([r, v]) => (
                  <div key={r} className="flex justify-between text-neutral-400 text-xs py-0.5">
                    <span>(−) {r}</span>
                    <span>− {brl(v)}</span>
                  </div>
                ))}
                <div className="flex justify-between text-xs py-1 border-t border-[#222] mt-1">
                  <span>Margem que sobra</span>
                  <b>{brl(x.margem)}</b>
                </div>
                <div className="flex justify-between text-neutral-400 text-xs py-0.5">
                  <span>(−) C. fixo por corte ({pctBR(fixoPct)})</span>
                  <span>− {brl(x.vFix)}</span>
                </div>
                <div className="flex justify-between items-center border-t border-[#2a2a2a] mt-1 pt-2">
                  <span className="text-[11px] font-bold tracking-widest text-neutral-400">LUCRO REAL</span>
                  <span className="text-lg font-black" style={{ color: x.lucro >= 20 ? VERDE : x.lucro >= 10 ? "#f59e0b" : "#ef4444" }}>
                    {brl(x.lucro)} <span className="text-[10px] text-neutral-500 font-semibold">por corte</span>
                  </span>
                </div>
                {x.lucro < 10 && (
                  <div className="text-[11px] mt-1" style={{ color: "#fca5a5" }}>
                    ⚠ Esse corte quase não deixa lucro depois da comissão e do custo fixo.
                  </div>
                )}
              </div>
            ))}
          </div>
        </Card>

        {/* Contas a pagar */}
        <div className="lg:columns-2 gap-4 [&>*]:mb-4 [&>*]:break-inside-avoid">
          <Card>
            <H
              right={
                <span className="text-xs font-black" style={{ color: GOLD }}>
                  {brl(config.custoFixo)}/mês
                </span>
              }
            >
              Contas a pagar · {mesLabel(mkAtual)}
            </H>
            {ordemContas.length === 0 && <Vazio>Nenhuma conta cadastrada. Adicione em Ajustes › Contas.</Vazio>}
            {ordemContas.map((a) => (
              <div key={a.c.id} className="flex items-center gap-3 py-2.5 border-t border-[#1d1d1d] first:border-0">
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-semibold truncate">{a.c.nome}</div>
                  <div className="text-[11px]" style={{ color: COR_STATUS[a.status] }}>
                    {txtStatus(a)}
                    {a.semData ? " · defina o dia em Ajustes › Contas" : ""}
                  </div>
                </div>
                <div className="text-sm font-black">{brl(a.c.valor)}</div>
                <Btn
                  tamanho="sm"
                  onClick={() => togglePaga(a.c.id)}
                  carregando={ocupado === `conta:${a.c.id}`}
                  cor={a.paga ? "#14301d" : "#262626"}
                  texto={a.paga ? "#4ade80" : "#fff"}
                >
                  {a.paga ? "Paga ✓" : "Marcar paga"}
                </Btn>
              </div>
            ))}
            <p className="text-[11px] text-neutral-500 mt-2">
              Pago neste mês: {brl(totalPago)} · falta pagar: {brl(Math.max(0, config.custoFixo - totalPago))}.
            </p>
          </Card>

          {/* Caixa cego */}
          <Card>
            <H>Caixa cego de hoje</H>
            {barbeiros.length === 0 && <Vazio>Nenhum barbeiro ativo.</Vazio>}
            {barbeiros.map((b) => {
              const f = fechHoje.find((x) => x.userId === b.id);
              if (!f)
                return (
                  <div key={b.id} className="flex justify-between py-2 text-sm border-b border-[#1d1d1d]">
                    <span>{primeiroNome(b.nome)}</span>
                    <span className="text-neutral-500">ainda não fechou</span>
                  </div>
                );
              const diffs = FORMAS.map((k) => ({
                k,
                dif: +((f.informado[k] || 0) - (f.esperado[k] || 0)).toFixed(2),
                inf: f.informado[k] || 0,
                esp: f.esperado[k] || 0,
              }));
              const total = diffs.reduce((a, x) => a + x.dif, 0);
              return (
                <div key={b.id} className="py-2 border-b border-[#1d1d1d] last:border-0">
                  <div className="flex justify-between text-sm font-bold">
                    <span>
                      {primeiroNome(b.nome)} <span className="text-[10px] text-neutral-500 font-normal">{hora(f.ts)}</span>
                    </span>
                    <span style={{ color: Math.abs(total) < 0.01 ? VERDE : "#ef4444" }}>
                      {Math.abs(total) < 0.01 ? "Batendo ✓" : `Divergência ${total > 0 ? "+" : "−"}${brl(Math.abs(total))}`}
                    </span>
                  </div>
                  <div className="grid grid-cols-3 gap-2 mt-1 text-[11px]">
                    {diffs.map((x) => (
                      <div key={x.k} className="rounded-lg bg-[#0f0f0f] p-2">
                        <div className="text-neutral-500">{FORMA_LABEL[x.k]}</div>
                        <div>Informou {brl(x.inf)}</div>
                        <div className="text-neutral-500">Esperado {brl(x.esp)}</div>
                        <div style={{ color: Math.abs(x.dif) < 0.01 ? VERDE : "#ef4444" }}>
                          {Math.abs(x.dif) < 0.01 ? "OK" : `${x.dif > 0 ? "+" : "−"}${brl(Math.abs(x.dif))}`}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
            {fechAnt.length > 0 && (
              <div className="mt-3">
                <div className="text-[10px] text-neutral-500 mb-1">Fechamentos anteriores</div>
                {fechAnt.map((f) => {
                  const total = FORMAS.reduce((a, k) => a + ((f.informado[k] || 0) - (f.esperado[k] || 0)), 0);
                  return (
                    <div key={f.id} className="flex justify-between text-xs py-1">
                      <span className="text-neutral-400">
                        {f.dia.split("-").reverse().join("/")} · {primeiroNome(f.nome)}
                      </span>
                      <span style={{ color: Math.abs(total) < 0.01 ? VERDE : "#ef4444" }}>
                        {Math.abs(total) < 0.01 ? "OK" : `${total > 0 ? "+" : "−"}${brl(Math.abs(total))}`}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </Card>
        </div>
      </Revelar>

      <Modal aberto={!!foto} aoFechar={() => setFoto(null)} titulo="Comprovante">
        {foto && <Foto caminho={foto} alt="Comprovante" className="w-full min-h-64 rounded-xl mb-2" />}
      </Modal>
      <EditarLancamento l={editando} aoFechar={() => setEditando(null)} />
    </>
  );
}
