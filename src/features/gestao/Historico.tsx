/* Gestão › Histórico: auditoria de tudo que mudou (quem, quando, o quê). Só o dono vê. */
import { useCallback, useEffect, useState } from "react";
import { useDados } from "../../data/DadosProvider.tsx";
import { dataBR, hora } from "../../domain/datas.ts";
import { brl, descreverItens, primeiroNome } from "../../domain/formato.ts";
import { Btn, Card, Chip, H, Vazio } from "../../ui/base.tsx";
import { SkeletonLista } from "../../ui/carregamento.tsx";
import { ListaAnimada, Revelar } from "../../ui/estrutura.tsx";
import { GOLD } from "../../ui/tema.ts";
import { useAcao } from "../compartilhado/comum.tsx";

const ACOES = {
  lancamento: ["Lançamento", "#a3a3a3"],
  lancamento_por_outro: ["Lançou para outro barbeiro", GOLD],
  edicao: ["Correção", "#38bdf8"],
  exclusao: ["Exclusão", "#ef4444"],
  restauracao: ["Restauração", "#22c55e"],
  pagamento_fiado: ["Fiado pago", "#22c55e"],
  entrada_estoque: ["Entrada de estoque", "#a3a3a3"],
  insert: ["Criação", "#a3a3a3"],
  update: ["Alteração", "#a3a3a3"],
  delete: ["Remoção", "#ef4444"],
};

const TABELAS = {
  lancamentos: "Lançamento",
  saques: "Saque",
  perfis: "Equipe",
  convites: "Convite",
  config: "Configuração",
  config_privada: "Custos",
  clientes: "Cliente",
  ferias: "Férias",
  produtos: "Produto",
};

const FILTROS: [string, string, (a: any) => boolean][] = [
  ["todos", "Tudo", () => true],
  ["lanc", "Lançamentos", (a) => a.tabela === "lancamentos"],
  ["sensivel", "Exclusões e correções", (a) => ["exclusao", "edicao", "restauracao", "lancamento_por_outro"].includes(a.acao)],
  ["equipe", "Equipe e ajustes", (a) => ["perfis", "convites", "config", "config_privada", "produtos"].includes(a.tabela)],
];

/** O banco grava snake_case; o modo demonstração grava o objeto do app. Normaliza os dois. */
const normalizar = (o) =>
  o && {
    ...o,
    cliente_nome: o.cliente_nome ?? o.clienteNome,
    barbeiro_nome: o.barbeiro_nome ?? o.barbeiroNome,
    barbeiro_id: o.barbeiro_id ?? o.barbeiroId,
    lancado_por_nome: o.lancado_por_nome ?? o.lancadoPorNome,
    motivo_exclusao: o.motivo_exclusao ?? o.motivoExclusao,
  };

function descrever(registro) {
  const a = { ...registro, antes: normalizar(registro.antes), depois: normalizar(registro.depois) };
  const l = a.depois || a.antes || {};
  if (a.tabela === "lancamentos") {
    const base = `${descreverItens(l.itens || [])} · ${l.cliente_nome || ""} · ${brl(l.total)} · atendido por ${primeiroNome(l.barbeiro_nome)}`;
    if (a.acao === "lancamento_por_outro") return `${base} · lançado por ${primeiroNome(l.lancado_por_nome)}`;
    if (a.acao === "edicao" && a.antes) {
      const mud = [];
      if (Number(a.antes.total) !== Number(l.total)) mud.push(`total ${brl(a.antes.total)} → ${brl(l.total)}`);
      if (a.antes.barbeiro_id !== l.barbeiro_id) mud.push(`barbeiro ${primeiroNome(a.antes.barbeiro_nome)} → ${primeiroNome(l.barbeiro_nome)}`);
      if (JSON.stringify(a.antes.pagamentos) !== JSON.stringify(l.pagamentos)) mud.push("forma de pagamento");
      if (a.antes.ts !== l.ts) mud.push("data");
      if (a.antes.cliente_nome !== l.cliente_nome) mud.push(`cliente ${a.antes.cliente_nome} → ${l.cliente_nome}`);
      return `${base}${mud.length ? ` · mudou: ${mud.join(", ")}` : ""}`;
    }
    if (a.acao === "exclusao" && l.motivo_exclusao) return `${base} · motivo: ${l.motivo_exclusao}`;
    return base;
  }
  if (a.tabela === "saques") return `${l.nome || ""} · ${brl(l.valor)} · ${l.status || ""}`;
  if (a.acao === "entrada_estoque") return `${a.registroId} +${l.quantidade} (estoque ${l.estoque})`;
  return a.registroId || "";
}

export default function Historico() {
  const { acoes } = useDados();
  const [rodar, ocupado] = useAcao();
  const [lista, setLista] = useState(null);
  const [fim, setFim] = useState(false);
  const [filtro, setFiltro] = useState("todos");

  const carregar = useCallback(
    async (antesDe?: number) => {
      const novos = await rodar(() => acoes.carregarAuditoria({ antesDe, limite: 50 }), null, { chave: "mais" });
      if (!novos) return;
      setFim(novos.length < 50);
      setLista((l) => (antesDe ? [...(l || []), ...novos] : novos));
    },
    [acoes, rodar],
  );

  useEffect(() => {
    carregar();
  }, [carregar]);

  const filtrar = FILTROS.find(([k]) => k === filtro)[2];
  const visiveis = (lista || []).filter(filtrar);

  return (
    <Revelar className="space-y-4 max-w-4xl">
      <Card>
        <H>Histórico de alterações</H>
        <p className="text-[11px] text-neutral-500 mb-3">
          Tudo o que muda no sistema fica registrado aqui: quem lançou para quem, correções, exclusões, pagamentos de fiado e mudanças na equipe. Ninguém
          consegue apagar este histórico pelo app.
        </p>
        <div className="flex gap-2 flex-wrap">
          {FILTROS.map(([k, r]) => (
            <Chip key={k} ativo={filtro === k} onClick={() => setFiltro(k)}>
              {r}
            </Chip>
          ))}
        </div>
      </Card>
      {lista === null ? (
        <SkeletonLista itens={6} />
      ) : (
        <Card>
          {visiveis.length === 0 && <Vazio>Nada registrado com esse filtro.</Vazio>}
          <ListaAnimada
            itens={visiveis}
            render={(a) => {
              const [rotulo, cor] = ACOES[a.acao] || [a.acao, "#a3a3a3"];
              return (
                <div className="py-2.5 border-b border-[#1d1d1d] last:border-0">
                  <div className="flex items-center justify-between gap-2 text-xs">
                    <span className="font-bold" style={{ color: cor }}>
                      {rotulo} <span className="text-neutral-500 font-normal">· {TABELAS[a.tabela] || a.tabela}</span>
                    </span>
                    <span className="text-neutral-500 whitespace-nowrap">
                      {dataBR(a.ts)} {hora(a.ts)}
                    </span>
                  </div>
                  <div className="text-sm text-neutral-200 mt-0.5 break-words">{descrever(a)}</div>
                  <div className="text-[11px] text-neutral-500">por {a.usuarioNome || "sistema"}</div>
                </div>
              );
            }}
          />
          {!fim && (
            <Btn className="w-full mt-3" cor="#262626" texto="#fff" carregando={ocupado === "mais"} onClick={() => carregar(lista[lista.length - 1]?.ts)}>
              Carregar mais
            </Btn>
          )}
        </Card>
      )}
    </Revelar>
  );
}
