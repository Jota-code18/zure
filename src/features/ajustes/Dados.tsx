/* Ajustes › Dados: fechar mês, Excel e backup. Não existe "apagar tudo" nem "carregar demonstração" aqui. */
import { Download, FileJson, ShieldCheck } from "lucide-react";
import { useMemo, useState } from "react";
import { useDados } from "../../data/DadosProvider.tsx";
import { dreMes, dt } from "../../domain/calculos.ts";
import { diaKey, mesLabel, mkOf } from "../../domain/datas.ts";
import { brl } from "../../domain/formato.ts";
import { Btn, Card, H, inputBase } from "../../ui/base.tsx";
import { ListaAnimada } from "../../ui/estrutura.tsx";
import { useAcao } from "../compartilhado/comum.tsx";

function baixar(nome, conteudo, tipo) {
  const url = URL.createObjectURL(new Blob([conteudo], { type: tipo }));
  const a = document.createElement("a");
  a.href = url;
  a.download = nome;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export default function Dados() {
  const dados = useDados();
  const { users, lancamentos: todas, config, clientes, mesesFechados, acoes } = dados;
  const [rodar, ocupado] = useAcao();
  const [mk, setMk] = useState(mkOf(Date.now()));
  const meses = useMemo(() => {
    const s = new Set([mkOf(Date.now())]);
    for (const l of todas) s.add(mkOf(dt(l)));
    return [...s].sort().reverse();
  }, [todas]);

  const exportar = () =>
    rodar(
      async () => {
        const { exportarExcel } = await import("./exportarExcel.ts");
        await exportarExcel({ users, todas, config, clientes, mk });
      },
      "Excel baixado.",
      { chave: "excel" },
    );

  const fechar = () => {
    if (!window.confirm(`Fechar ${mesLabel(mk)} e baixar o Excel?`)) return;
    const d = dreMes(users, todas, config, mk);
    rodar(
      async () => {
        await acoes.salvarMesFechado({ mk, fat: d.fat, lucro: d.lucro, atend: d.atend });
        const { exportarExcel } = await import("./exportarExcel.ts");
        await exportarExcel({ users, todas, config, clientes, mk });
      },
      `${mesLabel(mk)} fechado.`,
      { chave: "fechar" },
    );
  };

  const backup = () => {
    const { acoes: _a, carregando: _c, erro: _e, pendentes: _p, conexao: _x, ...resto } = dados;
    baixar(`zure-backup-${diaKey(Date.now())}.json`, JSON.stringify({ geradoEm: new Date().toISOString(), ...resto }, null, 2), "application/json");
  };

  return (
    <div className="grid gap-4 lg:grid-cols-2 items-start">
      <Card className="space-y-3">
        <H>Fechar mês e exportar</H>
        <select className={inputBase} value={mk} onChange={(e) => setMk(e.target.value)} aria-label="Mês">
          {meses.map((m) => (
            <option key={m} value={m}>
              {mesLabel(m)}
            </option>
          ))}
        </select>
        <Btn onClick={fechar} className="w-full" carregando={ocupado === "fechar"} icone={<Download size={16} />}>
          Fechar mês e exportar Excel
        </Btn>
        <Btn onClick={exportar} className="w-full" cor="#262626" texto="#fff" carregando={ocupado === "excel"}>
          Só exportar Excel (sem fechar)
        </Btn>
        <p className="text-[10px] text-neutral-600">O Excel traz DRE, equipe, lançamentos, fiados, estoque e clientes.</p>
        <ListaAnimada
          itens={mesesFechados.slice().sort((a, b) => b.mk.localeCompare(a.mk))}
          chave={(m) => m.mk}
          render={(m) => (
            <div className="flex justify-between text-xs py-1.5 border-t border-[#1d1d1d]">
              <span>{mesLabel(m.mk)}</span>
              <span>
                {brl(m.fat)} · lucro <b style={{ color: m.lucro >= 0 ? "#22c55e" : "#ef4444" }}>{brl(m.lucro)}</b>
              </span>
            </div>
          )}
        />
      </Card>
      <Card className="space-y-3">
        <H>Segurança dos dados</H>
        <ul className="text-[12px] text-neutral-400 space-y-2">
          <li className="flex gap-2">
            <ShieldCheck size={16} className="text-green-400 shrink-0" /> Tudo fica salvo no banco na nuvem e aparece na hora para toda a equipe.
          </li>
          <li className="flex gap-2">
            <ShieldCheck size={16} className="text-green-400 shrink-0" /> Não existe “apagar tudo”. Exclusões são uma a uma, podem ser desfeitas e ficam no
            Histórico.
          </li>
          <li className="flex gap-2">
            <ShieldCheck size={16} className="text-green-400 shrink-0" /> Para mostrar o app a alguém, use “Ver demonstração” na tela de entrada: roda separado,
            com dados fictícios, sem tocar nos dados reais.
          </li>
        </ul>
        <Btn onClick={backup} className="w-full" cor="#262626" texto="#fff" icone={<FileJson size={16} />}>
          Baixar backup completo (JSON)
        </Btn>
      </Card>
    </div>
  );
}
