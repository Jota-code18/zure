/* Ajustes › Estoque, Ponto e Férias. */
import { AlertTriangle, Bell, Check, Plus, Trash2 } from "lucide-react";
import { useMemo, useState } from "react";
import { useDados } from "../../data/DadosProvider.tsx";
import { previsaoFerias, resumoTexto, statusPonto } from "../../domain/calculos.ts";
import { diaKey, inicioDia, isoParaBR, mesmoDia, somarDias } from "../../domain/datas.ts";
import { brl, primeiroNome, uid } from "../../domain/formato.ts";
import { Btn, Card, H, inputBase } from "../../ui/base.tsx";
import { ListaAnimada } from "../../ui/estrutura.tsx";
import { GOLD } from "../../ui/tema.ts";
import { useAcao } from "../compartilhado/comum.tsx";

export function Estoque() {
  const { config, acoes } = useDados();
  const [rodar, ocupado] = useAcao();
  const [entrada, setEntrada] = useState({});
  const addEntrada = (p) => {
    const n = Number.parseInt(entrada[p.id], 10);
    if (!n || n <= 0) return;
    rodar(() => acoes.entradaEstoque(p.id, n), `+${n} ${p.nome.toLowerCase()} no estoque.`, { chave: p.id }).then(
      (r) => r && setEntrada((e) => ({ ...e, [p.id]: "" })),
    );
  };
  return (
    <Card pad="sm">
      <H>Estoque e bar</H>
      <div className="overflow-x-auto">
        <table className="w-full text-xs" style={{ minWidth: 480 }}>
          <thead>
            <tr className="text-neutral-500 text-left">
              {["Produto", "Estoque", "Custo", "Venda", "Lucro", "+ Entrada"].map((h) => (
                <th key={h} className="py-2 px-1 font-semibold">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {config.produtos.map((p) => {
              const baixo = p.estoque < 5;
              return (
                <tr key={p.id} className="border-t border-[#1d1d1d] transition-colors" style={{ background: baixo ? "rgba(239,68,68,.08)" : "transparent" }}>
                  <td className="py-2 px-1 font-bold">
                    {p.nome}
                    {baixo && <AlertTriangle size={12} className="inline ml-1 text-red-400" aria-label="Estoque baixo" />}
                  </td>
                  <td className="px-1 font-black tabular-nums" style={{ color: baixo ? "#f87171" : "#fff" }}>
                    {p.estoque}
                  </td>
                  <td className="px-1">{brl(p.custo)}</td>
                  <td className="px-1">{brl(p.preco)}</td>
                  <td className="px-1 text-green-400">{brl(p.preco - p.custo)}</td>
                  <td className="px-1">
                    <div className="flex gap-1">
                      <input
                        className={`${inputBase} w-16 px-2 py-1.5`}
                        inputMode="numeric"
                        placeholder="24"
                        value={entrada[p.id] || ""}
                        onChange={(e) => setEntrada((x) => ({ ...x, [p.id]: e.target.value.replace(/\D/g, "") }))}
                        aria-label={`Entrada de ${p.nome}`}
                      />
                      <Btn
                        tamanho="sm"
                        onClick={() => addEntrada(p)}
                        carregando={ocupado === p.id}
                        icone={<Plus size={14} />}
                        aria-label={`Adicionar entrada de ${p.nome}`}
                      />
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="text-[10px] text-neutral-600 mt-2">
        A venda desconta do estoque automaticamente (e volta se o lançamento for excluído). Alerta abaixo de 5 unidades.
      </p>
    </Card>
  );
}

export function Ponto() {
  const { users, lancamentos: todas, pontos, ferias } = useDados();
  const barbeiros = users.filter((u) => u.role === "barbeiro" && u.ativo !== false);
  const emFerias = (u, ts) => ferias.some((f) => f.userId === u.id && diaKey(ts) >= f.ini && diaKey(ts) <= f.fim);
  return (
    <Card pad="sm">
      <H>Controle de ponto (7 dias)</H>
      <div className="overflow-x-auto">
        <table className="w-full text-xs" style={{ minWidth: 340 }}>
          <thead>
            <tr className="text-neutral-500 text-left">
              <th className="py-2 px-1">Dia</th>
              {barbeiros.map((b) => (
                <th key={b.id} className="px-1">
                  {primeiroNome(b.nome)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {Array.from({ length: 7 }, (_, i) => somarDias(inicioDia(Date.now()), -i)).map((t) => {
              const k = diaKey(t);
              const hoje = mesmoDia(t, Date.now());
              const teveMovimento = todas.some((l) => diaKey(l.ts) === k);
              return (
                <tr key={k} className="border-t border-[#1d1d1d]">
                  <td className="py-2 px-1 text-neutral-400 whitespace-nowrap">
                    {hoje ? "Hoje" : new Date(t).toLocaleDateString("pt-BR", { weekday: "short", day: "2-digit", month: "2-digit" })}
                  </td>
                  {barbeiros.map((b) => {
                    let s: { t: string; c: string };
                    if (emFerias(b, t)) s = { t: "Férias", c: "#60a5fa" };
                    else if (!hoje && !teveMovimento && !pontos.some((p) => p.userId === b.id && p.dia === k)) s = { t: "—", c: "#444" };
                    else
                      s = statusPonto(
                        b,
                        pontos.find((p) => p.userId === b.id && p.dia === k),
                        t,
                      );
                    return (
                      <td key={b.id} className="px-1 font-semibold" style={{ color: s.c }}>
                        {s.t}
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="text-[10px] text-neutral-600 mt-2">
        Amarelo = atraso (+5 min da entrada). Vermelho = falta (sem registro 1h após a entrada). Dias sem movimento na loja não contam falta. O horário do ponto
        vem do servidor.
      </p>
    </Card>
  );
}

export function Ferias() {
  const { users, lancamentos: todas, config, ferias, clientes, acoes } = useDados();
  const [rodar, ocupado] = useAcao();
  const barbeiros = users.filter((u) => u.role === "barbeiro" && u.ativo !== false);
  const [fv, setFv] = useState({ userId: barbeiros[0]?.id || "", ini: "", fim: "" });
  const prev = useMemo(() => {
    const u = users.find((x) => x.id === fv.userId);
    if (!u || !fv.ini || !fv.fim || fv.fim < fv.ini) return null;
    return { u, ...previsaoFerias(u, users, todas, config, fv.ini, fv.fim) };
  }, [fv, users, todas, config]);
  const notifInicial = typeof Notification !== "undefined" ? Notification.permission : "unsupported";
  const [notif, setNotif] = useState(notifInicial);
  const lbl = "block text-[10px] text-neutral-500 mb-1";

  return (
    <div className="grid gap-4 lg:grid-cols-2 items-start">
      <Card className="space-y-3">
        <H>Modo férias</H>
        <label className="block">
          <span className={lbl}>Barbeiro</span>
          <select className={inputBase} value={fv.userId} onChange={(e) => setFv({ ...fv, userId: e.target.value })}>
            {barbeiros.map((b) => (
              <option key={b.id} value={b.id}>
                {b.nome}
              </option>
            ))}
          </select>
        </label>
        <div className="grid grid-cols-2 gap-3">
          <label>
            <span className={lbl}>Início</span>
            <input type="date" className={inputBase} value={fv.ini} onChange={(e) => setFv({ ...fv, ini: e.target.value })} />
          </label>
          <label>
            <span className={lbl}>Fim</span>
            <input type="date" className={inputBase} value={fv.fim} onChange={(e) => setFv({ ...fv, fim: e.target.value })} />
          </label>
        </div>
        {prev && (
          <div className="rounded-xl p-3 text-sm" style={{ background: "rgba(201,168,106,.1)", border: `1px solid ${GOLD}55` }}>
            Faturamento vai cair <b style={{ color: "#f87171" }}>{brl(prev.queda)}</b> ({prev.dias} dias úteis × {brl(prev.media)}/dia), precisa{" "}
            <b style={{ color: GOLD }}>
              +{prev.porPessoa} cortes {prev.refs.length > 1 ? "cada (" : ""}
              {prev.refs.map((r) => primeiroNome(r.nome)).join(" e ")}
              {prev.refs.length > 1 ? ")" : ""}
            </b>{" "}
            pra cobrir.
          </div>
        )}
        <Btn
          className="w-full"
          disabled={!prev}
          carregando={ocupado === "salvar"}
          onClick={() =>
            rodar(() => acoes.criarFerias({ id: uid(), userId: fv.userId, ini: fv.ini, fim: fv.fim }), "Férias salvas.", { chave: "salvar" }).then(
              (r) => r && setFv((v) => ({ ...v, ini: "", fim: "" })),
            )
          }
        >
          Salvar férias
        </Btn>
        <ListaAnimada
          itens={ferias}
          render={(f) => (
            <div className="flex items-center justify-between text-xs py-1.5 border-t border-[#1d1d1d]">
              <span>
                {primeiroNome(users.find((u) => u.id === f.userId)?.nome)} · {isoParaBR(f.ini)} a {isoParaBR(f.fim)}
              </span>
              <button
                type="button"
                onClick={() => rodar(() => acoes.excluirFerias(f.id), "Férias removidas.")}
                className="text-neutral-500 hover:text-red-400 p-1"
                aria-label="Remover férias"
              >
                <Trash2 size={14} />
              </button>
            </div>
          )}
        />
      </Card>
      <Card className="space-y-3">
        <H>Resumo diário às 19h</H>
        <p className="text-sm text-neutral-300">{resumoTexto(users, todas, config, clientes)}</p>
        <p className="text-[11px] text-neutral-500">
          Todo dia às 19h o app mostra esse resumo ao dono (com o app aberto). Ative os avisos do aparelho para receber como notificação.
        </p>
        {notif === "unsupported" && <p className="text-[11px] text-neutral-500">Este navegador não suporta notificações.</p>}
        {notif === "granted" && (
          <div className="text-xs text-green-400 flex items-center gap-1">
            <Check size={14} /> Notificações do aparelho ativas
          </div>
        )}
        {notif !== "unsupported" && notif !== "granted" && (
          <Btn onClick={async () => setNotif(await Notification.requestPermission())} className="w-full" icone={<Bell size={16} />}>
            Ativar notificações do aparelho
          </Btn>
        )}
      </Card>
    </div>
  );
}
