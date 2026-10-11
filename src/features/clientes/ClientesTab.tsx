/* ABA CLIENTES (dono) — sumidos, fiados, banco de talentos, avaliações, ficha do cliente. */
import { AlertTriangle, Camera, ChevronDown, MessageCircle, Search } from "lucide-react";
import { useMemo, useState } from "react";
import { useDados } from "../../data/DadosProvider.tsx";
import { CORTES, sumidosDe } from "../../domain/calculos.ts";
import { FORMA_LABEL, FORMAS } from "../../domain/config.ts";
import { DIA, dataBR } from "../../domain/datas.ts";
import { brl, norm, primeiroNome, uid, waLink } from "../../domain/formato.ts";
import { Avatar, Btn, Card, Chip, H, inputBase, TextField, Vazio } from "../../ui/base.tsx";
import { Estrelas } from "../../ui/controles.tsx";
import { Aparecer, ListaAnimada, Revelar } from "../../ui/estrutura.tsx";
import { GOLD } from "../../ui/tema.ts";
import { Foto, useAcao } from "../compartilhado/comum.tsx";
import { reduzirImagem } from "../compartilhado/imagem.ts";

function AvatarCliente({ c }: { c: any }) {
  if (!c.fotoDepois) return <Avatar nome={c.nome} size={40} />;
  return <Foto caminho={c.fotoDepois} alt={c.nome} className="rounded-full shrink-0 w-10 h-10" />;
}

export default function ClientesTab() {
  const { users, lancamentos: todas, config, clientes, avaliacoes, acoes } = useDados();
  const [rodar, ocupado] = useAcao();
  const [busca, setBusca] = useState("");
  const [aberto, setAberto] = useState(null);
  const [pagando, setPagando] = useState(null);
  const [ultimaNota, setUltimaNota] = useState(null);
  const [limite, setLimite] = useState(40);

  const stats = useMemo(() => {
    const m = {};
    for (const c of clientes) m[c.id] = { visitas: 0, gasto: 0, ult: 0, ultCorte: 0, barbeiros: new Set() };
    for (const l of todas) {
      const s = m[l.clienteId];
      if (!s) continue;
      s.visitas++;
      if (l.pago) s.gasto += l.total;
      s.ult = Math.max(s.ult, l.ts);
      if (l.itens.some((i) => i.tipo === "servico" && CORTES.includes(i.id))) s.ultCorte = Math.max(s.ultCorte, l.ts);
      s.barbeiros.add(l.barbeiroId);
    }
    return m;
  }, [clientes, todas]);

  const sumidos = useMemo(() => sumidosDe(clientes, todas), [clientes, todas]);
  const fiados = todas.filter((l) => l.fiado && !l.pago).sort((a, b) => a.ts - b.ts);
  const totalFiado = fiados.reduce((a, l) => a + l.total, 0);

  const talentos = useMemo(
    () =>
      users
        .filter((u) => u.role === "barbeiro")
        .map((u) => ({
          u,
          n: clientes.filter((c) => {
            const s = stats[c.id];
            return s && s.visitas >= 2 && s.barbeiros.size === 1 && s.barbeiros.has(u.id);
          }).length,
        }))
        .filter((x) => x.n > 0)
        .sort((a, b) => b.n - a.n),
    [users, clientes, stats],
  );

  const lista = useMemo(() => {
    const q = norm(busca);
    return clientes.filter((c) => !q || norm(c.nome).includes(q)).sort((a, b) => (stats[b.id]?.ult || 0) - (stats[a.id]?.ult || 0));
  }, [clientes, busca, stats]);

  const mediaNota = avaliacoes.length ? avaliacoes.reduce((a, x) => a + x.nota, 0) / avaliacoes.length : 0;
  const baixas = avaliacoes.filter((a) => a.nota <= 3).slice(0, 5);
  const nomeCliente = (id) => clientes.find((c) => c.id === id)?.nome || "Cliente";

  const marcarPago = (l, forma) =>
    rodar(() => acoes.pagarFiado(l.id, forma), `Fiado de ${l.clienteNome} pago no ${FORMA_LABEL[forma]}. Comissão liberada.`, { chave: `fiado:${l.id}` }).then(
      (r) => r && setPagando(null),
    );

  const subirFoto = async (c, campo, file) => {
    if (!file) return;
    await rodar(
      async () => {
        const blob = await reduzirImagem(file, 900);
        const caminho = await acoes.enviarFoto(blob, "clientes");
        return acoes.atualizarCliente(c.id, { [campo]: caminho });
      },
      "Foto salva.",
      { chave: `foto:${c.id}:${campo}` },
    );
  };

  const avaliar = (c, nota) =>
    rodar(() => acoes.criarAvaliacao({ id: uid(), clienteId: c.id, nota }), null, { chave: "nota" }).then((r) => r && setUltimaNota({ c, nota }));

  const msgGoogle = (c) =>
    `Oi ${primeiroNome(c.nome)}! Que bom que você curtiu 🙌 Pode nos avaliar no Google? Ajuda muito a barbearia! ${config.googleLink || ""}`.trim();
  const msgSumido = (c) => `Fala ${primeiroNome(c.nome)}! Faz um tempinho que você não aparece por aqui. Bora marcar aquele corte? 💈`;

  return (
    <div className="space-y-4 pb-28 lg:pb-10">
      <h1 className="text-2xl font-black">Clientes</h1>
      <Revelar className="grid gap-4 lg:grid-cols-2 items-start">
        <div className="space-y-4">
          <Card>
            <H right={<span className="text-sm font-black text-amber-400">{brl(totalFiado)}</span>}>Fiados / devedores</H>
            {fiados.length === 0 && <Vazio>Ninguém devendo.</Vazio>}
            <ListaAnimada
              itens={fiados}
              render={(l) => (
                <div className="py-2.5 border-b border-[#1d1d1d] last:border-0">
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <div className="font-bold text-sm truncate">{l.clienteNome}</div>
                      <div className="text-[11px] text-neutral-500">
                        {brl(l.total)} · {primeiroNome(l.barbeiroNome)} · {dataBR(l.ts)} ({Math.floor((Date.now() - l.ts) / DIA)}d)
                      </div>
                    </div>
                    <Btn tamanho="sm" onClick={() => setPagando(pagando?.id === l.id ? null : l)}>
                      Marcar como pago
                    </Btn>
                  </div>
                  <Aparecer show={pagando?.id === l.id} className="mt-2 flex gap-2 flex-wrap items-center">
                    <span className="text-xs text-neutral-400 w-full">Pago em qual forma? (libera a comissão e entra no faturamento de hoje)</span>
                    {FORMAS.map((k) => (
                      <Btn key={k} tamanho="sm" cor="#262626" texto="#fff" carregando={ocupado === `fiado:${l.id}`} onClick={() => marcarPago(l, k)}>
                        {FORMA_LABEL[k]}
                      </Btn>
                    ))}
                    <Chip onClick={() => setPagando(null)}>Cancelar</Chip>
                  </Aparecer>
                </div>
              )}
            />
            <p className="text-[10px] text-neutral-600 mt-2">Fiado conta nas metas, mas não gera comissão nem faturamento até ser pago.</p>
          </Card>

          <section aria-label="Clientes sumidos">
            <H>Clientes sumidos (+30 dias)</H>
            {sumidos.length === 0 ? (
              <Card>
                <Vazio>Nenhum cliente sumido. 👏</Vazio>
              </Card>
            ) : (
              <div className="space-y-2">
                {sumidos.slice(0, 8).map(({ c, dias }) => (
                  <div
                    key={c.id}
                    className="rounded-2xl p-3 flex items-center justify-between gap-3"
                    style={{ background: "rgba(239,68,68,.1)", border: "1px solid rgba(239,68,68,.5)" }}
                  >
                    <div className="min-w-0">
                      <div className="font-bold text-sm truncate">{c.nome}</div>
                      <div className="text-[11px] text-red-300">sumido há {dias} dias</div>
                    </div>
                    {c.telefone ? (
                      <a
                        href={waLink(c.telefone, msgSumido(c))}
                        target="_blank"
                        rel="noreferrer"
                        className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold bg-green-600 text-white active:scale-[0.97] transition-transform shrink-0"
                      >
                        <MessageCircle size={14} /> WhatsApp
                      </a>
                    ) : (
                      <span className="text-[10px] text-neutral-500">sem telefone</span>
                    )}
                  </div>
                ))}
                {sumidos.length > 8 && <p className="text-[11px] text-neutral-500">+{sumidos.length - 8} outros na lista de clientes.</p>}
              </div>
            )}
          </section>

          <Card>
            <H>Banco de talentos</H>
            {talentos.length === 0 && <Vazio>Ainda sem clientes recorrentes suficientes.</Vazio>}
            {talentos.map(({ u, n }) => (
              <div key={u.id} className="flex items-center gap-2 py-1.5 text-sm">
                <AlertTriangle size={16} className="text-amber-400 shrink-0" />
                <span>
                  <b>{n}</b> cliente{n > 1 ? "s" : ""} só {n > 1 ? "cortam" : "corta"} com <b>{primeiroNome(u.nome)}</b> - risco se ele sair
                </span>
              </div>
            ))}
          </Card>

          <Card>
            <H
              right={
                avaliacoes.length > 0 && (
                  <span className="text-sm font-black" style={{ color: GOLD }}>
                    ★ {mediaNota.toFixed(1)}
                  </span>
                )
              }
            >
              Avaliações
            </H>
            {avaliacoes.length === 0 && <Vazio>Abra um cliente na lista para registrar a nota dele.</Vazio>}
            {baixas.length > 0 && (
              <div className="rounded-xl p-3 mb-2" style={{ background: "rgba(239,68,68,.08)", border: "1px solid rgba(239,68,68,.35)" }}>
                <div className="text-[11px] font-bold text-red-300 mb-1">Notas baixas (só você vê)</div>
                {baixas.map((a) => (
                  <div key={a.id} className="text-xs flex justify-between py-0.5">
                    <span>{nomeCliente(a.clienteId)}</span>
                    <span className="text-red-300">{"★".repeat(a.nota)}</span>
                  </div>
                ))}
              </div>
            )}
            <Aparecer show={!!ultimaNota} className="rounded-xl p-3 text-sm bg-[rgba(201,168,106,.1)]">
              {ultimaNota?.nota === 5 && (
                <>
                  Nota 5 de {primeiroNome(ultimaNota.c.nome)}! Peça uma avaliação no Google.
                  {ultimaNota.c.telefone ? (
                    <a
                      href={waLink(ultimaNota.c.telefone, msgGoogle(ultimaNota.c))}
                      target="_blank"
                      rel="noreferrer"
                      className="block mt-2 text-center py-2 rounded-xl font-bold bg-green-600 text-white"
                    >
                      Pedir avaliação no Google
                    </a>
                  ) : (
                    <div className="text-[11px] text-neutral-500 mt-1">Cadastre o WhatsApp do cliente para enviar o pedido.</div>
                  )}
                </>
              )}
              {ultimaNota && ultimaNota.nota <= 3 && (
                <>
                  Nota {ultimaNota.nota}: fica só com você. Vale conversar com {primeiroNome(ultimaNota.c.nome)} para resolver.
                </>
              )}
              {ultimaNota?.nota === 4 && <>Nota 4 registrada. Obrigado pelo feedback!</>}
            </Aparecer>
          </Card>
        </div>

        <section aria-label="Todos os clientes">
          <H right={<span className="text-[11px] text-neutral-500">{clientes.length} clientes</span>}>Todos os clientes</H>
          <div className="relative mb-3">
            <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-neutral-500 pointer-events-none" />
            <input
              className={`${inputBase} pl-10`}
              placeholder="Buscar cliente"
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              aria-label="Buscar cliente"
            />
          </div>
          {lista.length === 0 && <Vazio>Nenhum cliente encontrado.</Vazio>}
          <ListaAnimada
            className="space-y-2"
            itens={lista.slice(0, limite)}
            render={(c) => {
              const s = stats[c.id] || { visitas: 0, gasto: 0, ult: 0, ultCorte: 0 };
              const open = aberto === c.id;
              const minhaNota = avaliacoes.find((a) => a.clienteId === c.id);
              let quando = "sem visitas";
              if (s.ultCorte) quando = `último corte ${dataBR(s.ultCorte)}`;
              else if (s.ult) quando = `última visita ${dataBR(s.ult)}`;
              return (
                <div className="rounded-2xl p-3 bg-[#141414] border border-[#222]">
                  <button type="button" onClick={() => setAberto(open ? null : c.id)} className="w-full text-left" aria-expanded={open}>
                    <div className="flex items-center gap-3">
                      <AvatarCliente c={c} />
                      <div className="flex-1 min-w-0">
                        <div className="font-bold text-sm truncate">{c.nome}</div>
                        <div className="text-[11px] text-neutral-500">{quando}</div>
                      </div>
                      <div className="text-right">
                        <div className="text-sm font-black" style={{ color: GOLD }}>
                          {brl(s.gasto)}
                        </div>
                        <div className="text-[10px] text-neutral-500">
                          {s.visitas} visita{s.visitas !== 1 ? "s" : ""} · ticket {brl(s.visitas ? s.gasto / s.visitas : 0)}
                        </div>
                      </div>
                      <ChevronDown
                        size={16}
                        className="text-neutral-500 transition-transform duration-200"
                        style={{ transform: open ? "rotate(180deg)" : "none" }}
                      />
                    </div>
                  </button>
                  <Aparecer show={open} className="mt-3 pt-3 border-t border-[#222] space-y-3">
                    <label className="block">
                      <span className="block text-[10px] text-neutral-500 mb-1">WhatsApp</span>
                      <TextField
                        value={c.telefone || ""}
                        onChange={(v) => rodar(() => acoes.atualizarCliente(c.id, { telefone: v }), "WhatsApp salvo.")}
                        placeholder="62999998888"
                        inputMode="tel"
                      />
                    </label>
                    <div className="grid grid-cols-2 gap-3">
                      {[
                        ["fotoAntes", "Antes"],
                        ["fotoDepois", "Depois"],
                      ].map(([campo, rot]) => (
                        <label key={campo} className="block cursor-pointer">
                          <span className="block text-[10px] text-neutral-500 mb-1">{rot}</span>
                          {c[campo] ? (
                            <Foto caminho={c[campo]} alt={rot} className="w-full h-28 rounded-xl border border-[#333]" />
                          ) : (
                            <div className="h-28 rounded-xl border border-dashed border-[#3a3a3a] flex flex-col items-center justify-center text-neutral-500 text-xs gap-1">
                              {ocupado === `foto:${c.id}:${campo}` ? (
                                "Enviando…"
                              ) : (
                                <>
                                  <Camera size={18} /> Adicionar
                                </>
                              )}
                            </div>
                          )}
                          <input
                            type="file"
                            accept="image/*"
                            className="hidden"
                            onChange={(e) => {
                              subirFoto(c, campo, e.target.files?.[0]);
                              e.target.value = "";
                            }}
                          />
                        </label>
                      ))}
                    </div>
                    <div>
                      <div className="text-[10px] text-neutral-500 mb-1">Avaliação do cliente {minhaNota ? `(última: ${minhaNota.nota}★)` : ""}</div>
                      <Estrelas valor={minhaNota?.nota || 0} onChange={(n) => avaliar(c, n)} />
                    </div>
                  </Aparecer>
                </div>
              );
            }}
          />
          {lista.length > limite && (
            <Btn className="w-full mt-3" cor="#262626" texto="#fff" onClick={() => setLimite((n) => n + 40)}>
              Mostrar mais ({lista.length - limite})
            </Btn>
          )}
        </section>
      </Revelar>
    </div>
  );
}
