/* Avisos do dono: contas a vencer, barbeiro no vermelho e resumo diário das 19h. */
import { AlertTriangle, Bell, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useDados } from "../../data/DadosProvider.tsx";
import { contasAlertas, resumoTexto, riscoVermelho } from "../../domain/calculos.ts";
import { diaKey } from "../../domain/datas.ts";
import { brl, primeiroNome } from "../../domain/formato.ts";
import { Aparecer } from "../../ui/estrutura.tsx";
import { GOLD } from "../../ui/tema.ts";
import { gravarLocal, lerLocal } from "../compartilhado/preferencias.ts";

function notificar(titulo, corpo) {
  try {
    if (typeof Notification !== "undefined" && Notification.permission === "granted") new Notification(titulo, { body: corpo, icon: "/icon-192.png" });
  } catch {
    /* sem suporte */
  }
}

export function AvisosDono({ irPara }: { irPara: (aba: string, sub?: string) => void }) {
  const { users, lancamentos: todas, config } = useDados();
  const [fechado, setFechado] = useState(() => lerLocal("avisos_fechado", ""));
  const hojeK = diaKey(Date.now());
  const itens = useMemo(() => {
    const out = [];
    for (const a of contasAlertas(config)) {
      if (a.paga) continue;
      if (a.status === "hoje") out.push({ k: `c${a.c.id}`, cor: "#ef4444", t: `${a.c.nome} vence HOJE (${brl(a.c.valor)})` });
      else if (a.status === "atrasada") out.push({ k: `c${a.c.id}`, cor: "#ef4444", t: `${a.c.nome} está ATRASADA (venceu dia ${a.diaV})` });
      else if (a.status === "breve")
        out.push({ k: `c${a.c.id}`, cor: "#f59e0b", t: `${a.c.nome} vence em ${a.falta} dia${a.falta > 1 ? "s" : ""} (${brl(a.c.valor)})` });
    }
    for (const u of users.filter((x) => x.role === "barbeiro" && x.ativo !== false))
      if (riscoVermelho(u, todas).doisSeguidos) out.push({ k: `r${u.id}`, cor: "#ef4444", t: `${primeiroNome(u.nome)}: 2º mês seguido no VERMELHO` });
    return out;
  }, [config, users, todas]);
  const semData = useMemo(() => contasAlertas(config).filter((a) => a.semData && !a.paga).length, [config]);
  const chave = `${hojeK}|${itens.map((i) => i.k).join(",")}`;

  useEffect(() => {
    if (!itens.length || lerLocal("avisos_notif", "") === chave) return;
    gravarLocal("avisos_notif", chave);
    notificar("Zure Barbearia", itens.map((i) => i.t).join("\n"));
  }, [chave, itens]);

  const mostrar = (itens.length > 0 || semData > 0) && fechado !== chave;
  return (
    <Aparecer show={mostrar} className="mb-4">
      <div className="rounded-2xl p-3 text-sm" style={{ background: "rgba(239,68,68,.1)", border: "1px solid rgba(239,68,68,.45)" }} role="status">
        <div className="flex items-start justify-between gap-2">
          <div className="space-y-1 min-w-0">
            {itens.map((i) => (
              <div key={i.k} className="flex items-start gap-1.5 font-semibold" style={{ color: i.cor }}>
                <AlertTriangle size={15} className="mt-0.5 shrink-0" /> <span>{i.t}</span>
              </div>
            ))}
            {semData > 0 && (
              <button type="button" onClick={() => irPara("ajustes", "contas")} className="text-xs text-neutral-300 underline text-left">
                {semData} conta{semData > 1 ? "s" : ""} sem dia de vencimento — defina em Ajustes › Contas para receber o aviso
              </button>
            )}
          </div>
          <button
            type="button"
            onClick={() => {
              gravarLocal("avisos_fechado", chave);
              setFechado(chave);
            }}
            className="w-8 h-8 shrink-0 rounded-full bg-neutral-800 flex items-center justify-center"
            aria-label="Fechar aviso"
          >
            <X size={14} />
          </button>
        </div>
        {itens.some((i) => i.k[0] === "c") && (
          <button type="button" onClick={() => irPara("gestao")} className="mt-2 text-xs font-bold" style={{ color: GOLD }}>
            Ver contas em Gestão →
          </button>
        )}
      </div>
    </Aparecer>
  );
}

export function Resumo19() {
  const { users, lancamentos: todas, config, clientes } = useDados();
  const [texto, setTexto] = useState(null);
  useEffect(() => {
    const checar = () => {
      if (new Date().getHours() < 19) return;
      const k = `resumo:${diaKey(Date.now())}`;
      if (lerLocal(k, false)) return;
      gravarLocal(k, true);
      const t = resumoTexto(users, todas, config, clientes);
      setTexto(t);
      notificar("Zure Barbearia · resumo do dia", t);
    };
    checar();
    const i = setInterval(checar, 60000);
    return () => clearInterval(i);
  }, [users, todas, config, clientes]);

  return (
    <Aparecer show={!!texto} className="mb-4">
      <div className="rounded-2xl p-4" style={{ background: "#1a1610", border: `1px solid ${GOLD}` }} role="status">
        <div className="flex items-center gap-2 text-xs font-bold mb-1" style={{ color: GOLD }}>
          <Bell size={14} /> RESUMO DO DIA · 19h
        </div>
        <p className="text-sm text-white">{texto}</p>
        <button type="button" onClick={() => setTexto(null)} className="mt-3 text-xs font-bold px-4 py-2 rounded-xl text-black" style={{ background: GOLD }}>
          Fechar
        </button>
      </div>
    </Aparecer>
  );
}
