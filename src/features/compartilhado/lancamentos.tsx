/* Linha de lançamento e modal de correção/exclusão (dono). */
import { Minus, Pencil, Plus, RotateCcw, Trash2 } from "lucide-react";
import { useMemo, useRef, useState } from "react";
import { useDados } from "../../data/DadosProvider.tsx";
import { FORMA_LABEL, FORMAS } from "../../domain/config.ts";
import { dataBR, hora } from "../../domain/datas.ts";
import { brl, descreverItens, num, primeiroNome } from "../../domain/formato.ts";
import { lancadoPorOutro, montarPagamentos, podeEditar, podeExcluir, subtotalDe } from "../../domain/lancamento.ts";
import { precoServ } from "../../domain/usuarios.ts";
import { Btn, Chip, inputBase, NumField } from "../../ui/base.tsx";
import { Aparecer, Modal } from "../../ui/estrutura.tsx";
import { GOLD } from "../../ui/tema.ts";
import { Foto, useAcao } from "./comum.tsx";

function rotuloPagamento(l) {
  if (l.fiado && !l.pago) return "FIADO (pendente)";
  const formas = l.pagamentos.map((p) => FORMA_LABEL[p.forma] || p.forma).join(" + ");
  return l.fiado ? `${formas} (fiado pago)` : formas;
}

export function LinhaLancamento({
  l,
  mostrarData = false,
  mostrarBarbeiro = false,
  acoes = null,
  aoAbrirFoto = null,
}: {
  l: any;
  mostrarData?: boolean;
  mostrarBarbeiro?: boolean;
  acoes?: React.ReactNode;
  aoAbrirFoto?: ((caminho: string) => void) | null;
}) {
  return (
    <div className="flex items-center justify-between gap-3 py-2.5 border-b border-[#1d1d1d] last:border-0" style={{ opacity: l._pendente ? 0.6 : 1 }}>
      <div className="min-w-0 flex-1">
        <div className={`text-sm truncate ${l.excluidoEm ? "line-through text-neutral-500" : "text-white"}`}>{descreverItens(l.itens)}</div>
        <div className="text-[11px] text-neutral-500 flex flex-wrap gap-x-1.5">
          <span>{mostrarData ? `${dataBR(l.ts)} ${hora(l.ts)}` : hora(l.ts)}</span>
          <span>· {l.clienteNome}</span>
          {mostrarBarbeiro && <span>· {primeiroNome(l.barbeiroNome)}</span>}
          <span className={l.fiado && !l.pago ? "text-amber-400" : ""}>· {rotuloPagamento(l)}</span>
          {lancadoPorOutro(l) && <span style={{ color: GOLD }}>· lançado por {primeiroNome(l.lancadoPorNome)}</span>}
          {l.editadoEm && <span className="text-sky-400">· corrigido</span>}
          {l.excluidoEm && <span className="text-red-400">· excluído{l.motivoExclusao ? `: ${l.motivoExclusao}` : ""}</span>}
          {l._pendente && <span>· salvando…</span>}
        </div>
      </div>
      {l.comprovante && aoAbrirFoto && (
        <button type="button" onClick={() => aoAbrirFoto(l.comprovante)} className="shrink-0" aria-label="Ver comprovante">
          <Foto caminho={l.comprovante} alt="Comprovante" className="w-9 h-9 rounded-lg border border-[#333]" />
        </button>
      )}
      <div className="flex items-center gap-2 shrink-0">
        <span className="text-sm font-bold">{brl(l.total)}</span>
        {acoes}
      </div>
    </div>
  );
}

const paraLocal = (ms) => {
  const d = new Date(ms);
  const p = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
};

function estadoInicial(l) {
  let forma = l.pagamentos[0]?.forma || "PIX";
  if (l.fiado && !l.pago) forma = "FIADO";
  else if (l.pagamentos.length > 1) forma = "DIVIDIDO";
  return {
    barbeiroId: l.barbeiroId,
    clienteId: l.clienteId || "",
    ts: paraLocal(l.ts),
    itens: l.itens.map((i) => ({ ...i })),
    gorjeta: l.gorjeta || 0,
    forma,
    formaA: l.pagamentos[0]?.forma === "FIADO" ? "PIX" : l.pagamentos[0]?.forma || "PIX",
    formaB: l.pagamentos[1]?.forma || "CARTAO",
    valorA: l.pagamentos.length > 1 ? l.pagamentos[0].valor : 0,
  };
}

/** Modal do dono para corrigir, excluir ou restaurar um lançamento. Tudo fica no histórico. */
export function EditarLancamento({ l, aoFechar }: { l: any; aoFechar: () => void }) {
  const ultimo = useRef(l);
  if (l) ultimo.current = l;
  const atual = l || ultimo.current;
  return (
    <Modal aberto={!!l} aoFechar={aoFechar} titulo={atual?.excluidoEm ? "Lançamento excluído" : "Corrigir lançamento"}>
      {atual && <FormularioLancamento key={atual.id} l={atual} aoFechar={aoFechar} />}
    </Modal>
  );
}

function FormularioLancamento({ l, aoFechar }: { l: any; aoFechar: () => void }) {
  const { user, users, clientes, config, acoes } = useDados();
  const [rodar, ocupado] = useAcao();
  const [f, setF] = useState(() => estadoInicial(l));
  const [motivo, setMotivo] = useState("");
  const [confirmarExclusao, setConfirmarExclusao] = useState(false);
  const [novoItem, setNovoItem] = useState("");

  const barbeiro = users.find((u) => u.id === f.barbeiroId);
  const subtotal = f ? subtotalDe(f.itens) : 0;
  const total = +(subtotal + (f?.gorjeta || 0)).toFixed(2);
  const catalogo = useMemo(
    () => [
      ...config.servicos.map((s) => ({ ...s, tipo: "servico", chave: `s:${s.id}` })),
      ...config.produtos.map((p) => ({ ...p, tipo: "produto", chave: `p:${p.id}` })),
    ],
    [config],
  );

  const editavel = podeEditar(user) && !l.excluidoEm;
  const set = (patch) => setF((x) => ({ ...x, ...patch }));
  const mudarQtd = (idx, d) => set({ itens: f.itens.map((i, j) => (j === idx ? { ...i, qtd: i.qtd + d } : i)).filter((i) => i.qtd > 0) });
  const mudarPreco = (idx, v) => set({ itens: f.itens.map((i, j) => (j === idx ? { ...i, preco: v } : i)) });
  const adicionar = () => {
    const item = catalogo.find((c) => c.chave === novoItem);
    if (!item) return;
    const preco = item.tipo === "servico" ? precoServ(barbeiro, item) : item.preco;
    const existe = f.itens.findIndex((i) => i.id === item.id && i.tipo === item.tipo);
    if (existe >= 0) mudarQtd(existe, 1);
    else set({ itens: [...f.itens, { tipo: item.tipo, id: item.id, nome: item.nome, qtd: 1, preco, custo: item.custo || 0 }] });
    setNovoItem("");
  };

  const salvar = () => {
    const cliente = clientes.find((c) => c.id === f.clienteId);
    if (!f.itens.length) return;
    if (f.forma === "FIADO" && !cliente) return;
    const pendente = f.forma === "FIADO";
    const pagamentos = pendente ? [{ forma: "FIADO", valor: total }] : montarPagamentos(f.forma, total, f);
    rodar(
      () =>
        acoes.editarLancamento({
          ...l,
          barbeiroId: f.barbeiroId,
          clienteId: cliente?.id || null,
          clienteNome: cliente?.nome || "Cliente avulso",
          ts: f.ts === paraLocal(l.ts) ? l.ts : new Date(f.ts).getTime(),
          itens: f.itens,
          gorjeta: f.gorjeta,
          pagamentos,
          fiado: pendente || l.fiado,
          pago: !pendente,
        }),
      "Lançamento corrigido. A alteração ficou registrada no histórico.",
      { chave: "salvar" },
    ).then((r) => r && aoFechar());
  };

  const excluir = () =>
    rodar(() => acoes.excluirLancamento(l.id, motivo), "Lançamento excluído.", {
      chave: "excluir",
      acao: { rotulo: "Desfazer", fn: () => acoes.restaurarLancamento(l.id) },
    }).then((r) => r && aoFechar());

  const restaurar = () => rodar(() => acoes.restaurarLancamento(l.id), "Lançamento restaurado.", { chave: "restaurar" }).then((r) => r && aoFechar());

  const divOk = f.forma !== "DIVIDIDO" || (f.valorA > 0 && f.valorA < total);
  const fiadoOk = f.forma !== "FIADO" || !!f.clienteId;
  const lbl = "block text-[10px] text-neutral-500 mb-1";

  return (
    <div className="space-y-4 pb-2">
      <p className="text-[11px] text-neutral-500">
        Lançado em {dataBR(l.ts)} às {hora(l.ts)} por {l.lancadoPorNome || l.barbeiroNome}
        {l.editadoEm ? ` · última correção em ${dataBR(l.editadoEm)} ${hora(l.editadoEm)}` : ""}
      </p>

      <fieldset disabled={!editavel} className="space-y-4 disabled:opacity-60">
        <div className="grid sm:grid-cols-2 gap-3">
          <label>
            <span className={lbl}>Quem atendeu</span>
            <select className={inputBase} value={f.barbeiroId} onChange={(e) => set({ barbeiroId: e.target.value })}>
              {users.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.nome}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span className={lbl}>Data e hora</span>
            <input type="datetime-local" className={inputBase} value={f.ts} onChange={(e) => set({ ts: e.target.value })} />
          </label>
          <label className="sm:col-span-2">
            <span className={lbl}>Cliente</span>
            <select className={inputBase} value={f.clienteId} onChange={(e) => set({ clienteId: e.target.value })}>
              <option value="">Cliente avulso</option>
              {clientes
                .slice()
                .sort((a, b) => a.nome.localeCompare(b.nome))
                .map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.nome}
                  </option>
                ))}
            </select>
          </label>
        </div>

        <div>
          <span className={lbl}>Itens</span>
          <div className="space-y-2">
            {f.itens.map((i, idx) => (
              <div key={`${i.tipo}:${i.id}`} className="flex items-center gap-2 rounded-xl bg-[#0f0f0f] p-2">
                <span className="flex-1 text-sm truncate">{i.nome}</span>
                <button
                  type="button"
                  className="w-8 h-8 rounded-full bg-neutral-800 flex items-center justify-center"
                  onClick={() => mudarQtd(idx, -1)}
                  aria-label={`Diminuir ${i.nome}`}
                >
                  <Minus size={14} />
                </button>
                <span className="w-6 text-center text-sm font-bold">{i.qtd}</span>
                <button
                  type="button"
                  className="w-8 h-8 rounded-full bg-neutral-800 flex items-center justify-center"
                  onClick={() => mudarQtd(idx, 1)}
                  aria-label={`Aumentar ${i.nome}`}
                >
                  <Plus size={14} />
                </button>
                <NumField value={i.preco} prefix="R$" className="w-24" onChange={(v) => mudarPreco(idx, v)} aria-label={`Preço de ${i.nome}`} />
              </div>
            ))}
            <div className="flex gap-2">
              <select className={inputBase} value={novoItem} onChange={(e) => setNovoItem(e.target.value)} aria-label="Adicionar item">
                <option value="">Adicionar serviço ou produto…</option>
                {catalogo.map((c) => (
                  <option key={c.chave} value={c.chave}>
                    {c.tipo === "servico" ? "Serviço" : "Produto"} · {c.nome}
                  </option>
                ))}
              </select>
              <Btn tamanho="sm" onClick={adicionar} disabled={!novoItem} icone={<Plus size={14} />} aria-label="Adicionar item" />
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <label>
            <span className={lbl}>Gorjeta</span>
            <NumField value={f.gorjeta} prefix="R$" onChange={(v) => set({ gorjeta: v })} />
          </label>
          <div>
            <span className={lbl}>Total</span>
            <div className="text-2xl font-black" style={{ color: GOLD }}>
              {brl(total)}
            </div>
          </div>
        </div>

        <div>
          <span className={lbl}>Pagamento</span>
          <div className="flex gap-2 flex-wrap">
            {[...FORMAS, "DIVIDIDO", "FIADO"].map((k) => (
              <Chip key={k} ativo={f.forma === k} onClick={() => set({ forma: k })}>
                {FORMA_LABEL[k]}
              </Chip>
            ))}
          </div>
          <Aparecer show={f.forma === "DIVIDIDO"} className="mt-3 grid grid-cols-[1fr_auto] gap-2 items-center">
            <select className={inputBase} value={f.formaA} onChange={(e) => set({ formaA: e.target.value })} aria-label="1ª forma">
              {FORMAS.map((k) => (
                <option key={k} value={k}>
                  {FORMA_LABEL[k]}
                </option>
              ))}
            </select>
            <NumField value={f.valorA} prefix="R$" className="w-28" onChange={(v) => set({ valorA: num(v) })} aria-label="Valor da 1ª forma" />
            <select className={inputBase} value={f.formaB} onChange={(e) => set({ formaB: e.target.value })} aria-label="2ª forma">
              {FORMAS.map((k) => (
                <option key={k} value={k}>
                  {FORMA_LABEL[k]}
                </option>
              ))}
            </select>
            <span className="w-28 text-sm text-neutral-300 px-3">{brl(Math.max(0, total - f.valorA))}</span>
          </Aparecer>
          {!fiadoOk && <p className="text-xs text-amber-400 mt-2">Fiado precisa de cliente.</p>}
        </div>
      </fieldset>

      {editavel && (
        <Btn
          className="w-full"
          tamanho="lg"
          onClick={salvar}
          carregando={ocupado === "salvar"}
          disabled={!f.itens.length || !divOk || !fiadoOk}
          icone={<Pencil size={16} />}
        >
          Salvar correção
        </Btn>
      )}

      {l.excluidoEm
        ? podeExcluir(user, l) && (
            <Btn className="w-full" cor="#262626" texto="#fff" onClick={restaurar} carregando={ocupado === "restaurar"} icone={<RotateCcw size={16} />}>
              Restaurar lançamento
            </Btn>
          )
        : podeExcluir(user, l) && (
            <div className="rounded-2xl border border-red-900/60 p-3 space-y-2">
              {!confirmarExclusao ? (
                <Btn className="w-full" cor="#2a1414" texto="#fca5a5" onClick={() => setConfirmarExclusao(true)} icone={<Trash2 size={16} />}>
                  Excluir lançamento
                </Btn>
              ) : (
                <>
                  <label>
                    <span className={lbl}>Motivo (opcional, fica no histórico)</span>
                    <input className={inputBase} value={motivo} onChange={(e) => setMotivo(e.target.value)} placeholder="ex.: lançado em duplicidade" />
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    <Btn cor="#262626" texto="#fff" onClick={() => setConfirmarExclusao(false)}>
                      Cancelar
                    </Btn>
                    <Btn cor="#b91c1c" texto="#fff" onClick={excluir} carregando={ocupado === "excluir"} icone={<Trash2 size={16} />}>
                      Excluir
                    </Btn>
                  </div>
                  <p className="text-[10px] text-neutral-500">O estoque volta automaticamente. Dá para restaurar depois.</p>
                </>
              )}
            </div>
          )}
    </div>
  );
}
