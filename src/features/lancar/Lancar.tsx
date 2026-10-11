/* ABA LANÇAR — o caixa. Uso de alta frequência: motion mínimo e rápido (só feedback). */
import { AnimatePresence, motion } from "framer-motion";
import { Banknote, BookOpen, Camera, Check, Clock, CreditCard, Layers, Minus, QrCode, Search, UserPlus, X } from "lucide-react";
import { useMemo, useRef, useState } from "react";
import { useDados } from "../../data/DadosProvider.tsx";
import { metasProgresso, totaisLista } from "../../domain/calculos.ts";
import { FORMA_LABEL, FORMAS } from "../../domain/config.ts";
import { mesmoDia } from "../../domain/datas.ts";
import { brl, capitalizar, norm, num, primeiroNome, uid } from "../../domain/formato.ts";
import { montarItens, montarLancamento, montarPagamentos, podeExcluir, subtotalDe, validarLancamento } from "../../domain/lancamento.ts";
import { precoServ } from "../../domain/usuarios.ts";
import { Btn, Card, inputGrande, Rotulo, TrocaIcone } from "../../ui/base.tsx";
import { Aparecer, ListaAnimada, NoCorpo } from "../../ui/estrutura.tsx";
import { Confetti, useToast } from "../../ui/feedback.tsx";
import { CARD, DUR, EASE_OUT, GOLD } from "../../ui/tema.ts";
import { AvatarUsuario, useAcao } from "../compartilhado/comum.tsx";
import { reduzirImagem } from "../compartilhado/imagem.ts";
import { LinhaLancamento } from "../compartilhado/lancamentos.tsx";
import { MetasCompactas } from "../compartilhado/metas.tsx";

const PAGTOS = [
  { id: "PIX", Icon: QrCode },
  { id: "DINHEIRO", Icon: Banknote },
  { id: "CARTAO", Icon: CreditCard },
  { id: "FIADO", Icon: BookOpen },
  { id: "DIVIDIDO", Icon: Layers },
];

function ItemBtn({
  nome,
  preco,
  qtd,
  onAdd,
  onSub,
  extra = "",
  desabilitado = false,
}: {
  nome: string;
  preco: number;
  qtd: number;
  onAdd: () => void;
  onSub: () => void;
  extra?: string;
  desabilitado?: boolean;
}) {
  return (
    <div className="relative">
      <motion.button
        type="button"
        whileTap={{ scale: 0.96 }}
        onClick={onAdd}
        disabled={desabilitado}
        className="w-full h-full rounded-2xl p-3 text-left disabled:opacity-40 transition-[background-color,border-color] duration-150"
        style={{
          background: qtd > 0 ? "rgba(201,168,106,.14)" : CARD,
          border: `1.5px solid ${qtd > 0 ? GOLD : "#262626"}`,
          boxShadow: "0 6px 18px rgba(0,0,0,.45)",
          minHeight: 72,
        }}
        aria-label={`Adicionar ${nome}`}
      >
        <div className="text-[11px] font-bold tracking-wider text-neutral-300 break-words">{nome}</div>
        <div className="text-base sm:text-lg font-black mt-0.5" style={{ color: GOLD }}>
          {brl(preco)}
        </div>
        {extra && <div className="text-[10px] text-neutral-500">{extra}</div>}
      </motion.button>
      <AnimatePresence initial={false}>
        {qtd > 0 && (
          <>
            <motion.div
              key="qtd"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1, transition: { duration: DUR.rapido, ease: EASE_OUT } }}
              exit={{ opacity: 0, scale: 0.9, transition: { duration: 0.1 } }}
              className="absolute -top-2 -right-2 min-w-[26px] h-[26px] px-1.5 rounded-full flex items-center justify-center text-xs font-black text-black pointer-events-none"
              style={{ background: GOLD }}
            >
              {qtd}
            </motion.div>
            <motion.button
              key="menos"
              type="button"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1, transition: { duration: DUR.rapido, ease: EASE_OUT } }}
              exit={{ opacity: 0, scale: 0.9, transition: { duration: 0.1 } }}
              onClick={onSub}
              className="absolute -bottom-2 -right-2 w-8 h-8 rounded-full bg-neutral-800 border border-neutral-600 flex items-center justify-center active:scale-[0.97]"
              aria-label={`Remover um ${nome}`}
            >
              <Minus size={14} className="text-white" />
            </motion.button>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}

export default function Lancar() {
  const { user, users, config, clientes, lancamentos, acoes } = useDados();
  const toast = useToast();
  const [rodar, ocupado] = useAcao();
  const [busca, setBusca] = useState("");
  const [cliente, setCliente] = useState(null);
  const [telNovo, setTelNovo] = useState("");
  const [servSel, setServSel] = useState({});
  const [prodSel, setProdSel] = useState({});
  const [gorjeta, setGorjeta] = useState("");
  const [forma, setForma] = useState("PIX");
  const [formaA, setFormaA] = useState("PIX");
  const [formaB, setFormaB] = useState("CARTAO");
  const [valorA, setValorA] = useState("");
  const [comp, setComp] = useState(null); // { preview, promessa, status }
  const [confete, setConfete] = useState(false);
  const [sucesso, setSucesso] = useState(false);
  const [atendenteId, setAtendenteId] = useState(user.id);
  const topoCliente = useRef(null);
  const atendente = users.find((u) => u.id === atendenteId) || user;
  const ehDono = user.role === "admin";
  const paraOutro = atendente.id !== user.id;
  const verMetas = ehDono || !paraOutro;

  const itens = useMemo(() => montarItens(config, atendente, servSel, prodSel), [config, servSel, prodSel, atendente]);
  const subtotal = subtotalDe(itens);
  const valorGorjeta = num(gorjeta);
  const total = +(subtotal + valorGorjeta).toFixed(2);
  const vA = Math.min(num(valorA), total);
  const vB = Math.max(0, +(total - vA).toFixed(2));

  const resultados = useMemo(() => {
    const q = norm(busca);
    if (!q) return [];
    return clientes.filter((c) => norm(c.nome).includes(q)).slice(0, 5);
  }, [busca, clientes]);
  const existeExato = clientes.some((c) => norm(c.nome) === norm(busca));

  const criarCliente = () => {
    const nome = busca.trim();
    if (!nome) return;
    rodar(() => acoes.criarCliente({ id: uid(), nome, telefone: telNovo.trim() }), null, { chave: "cliente" }).then((novo) => {
      if (!novo) return;
      setCliente(novo);
      setBusca("");
      setTelNovo("");
    });
  };

  /* Aviso de preço diferente do que o cliente pagava (histórico). */
  const avisosPreco = useMemo(() => {
    if (!cliente) return [];
    const res = [];
    for (const sv of config.servicos) {
      if (!servSel[sv.id]) continue;
      const ult = lancamentos.find((l) => l.clienteId === cliente.id && l.itens.some((i) => i.id === sv.id && i.tipo === "servico"));
      if (!ult) continue;
      const antigo = ult.itens.find((i) => i.id === sv.id).preco;
      const novoP = precoServ(atendente, sv);
      if (antigo !== novoP) res.push(`${primeiroNome(cliente.nome)} pagava ${brl(antigo)} em ${sv.nome.toLowerCase()}, novo valor ${brl(novoP)}`);
    }
    return res;
  }, [cliente, servSel, config, lancamentos, atendente]);

  const addServ = (id) => setServSel((s) => ({ ...s, [id]: (s[id] || 0) + 1 }));
  const subServ = (id) => setServSel((s) => ({ ...s, [id]: Math.max(0, (s[id] || 0) - 1) }));
  const addProd = (p) => {
    if ((prodSel[p.id] || 0) >= p.estoque) return toast.erro(`Estoque de ${p.nome.toLowerCase()} acabou`);
    setProdSel((s) => ({ ...s, [p.id]: (s[p.id] || 0) + 1 }));
  };
  const subProd = (id) => setProdSel((s) => ({ ...s, [id]: Math.max(0, (s[id] || 0) - 1) }));

  const mostrarComprovante = forma === "PIX" || (forma === "DIVIDIDO" && (formaA === "PIX" || formaB === "PIX"));

  /** A foto começa a subir assim que é escolhida; o "Dar baixa" só espera se ainda não terminou. */
  const onFoto = async (e) => {
    const f = e.target.files?.[0];
    e.target.value = "";
    if (!f) return;
    try {
      const blob = await reduzirImagem(f);
      const preview = URL.createObjectURL(blob);
      const promessa = acoes.enviarFoto(blob, "proprio");
      setComp({ preview, promessa, status: "enviando" });
      promessa.then(
        () => setComp((c) => (c?.promessa === promessa ? { ...c, status: "ok" } : c)),
        () => setComp((c) => (c?.promessa === promessa ? { ...c, status: "erro" } : c)),
      );
    } catch {
      toast.erro("Não consegui ler a foto");
    }
  };

  const snapshot = () => ({ cliente, servSel, prodSel, gorjeta, forma, formaA, formaB, valorA, comp, atendenteId });
  const restaurar = (s) => {
    setCliente(s.cliente);
    setServSel(s.servSel);
    setProdSel(s.prodSel);
    setGorjeta(s.gorjeta);
    setForma(s.forma);
    setFormaA(s.formaA);
    setFormaB(s.formaB);
    setValorA(s.valorA);
    setComp(s.comp);
    setAtendenteId(s.atendenteId);
  };
  const reset = () => {
    setCliente(null);
    setBusca("");
    setServSel({});
    setProdSel({});
    setGorjeta("");
    setForma("PIX");
    setValorA("");
    setComp(null);
  };

  const lancar = async () => {
    const erro = validarLancamento({ itens, forma, cliente, total, valorA: vA });
    if (erro) {
      if (forma === "FIADO" && !cliente) topoCliente.current?.scrollIntoView({ behavior: "smooth", block: "center" });
      return toast.erro(erro);
    }
    let comprovante = null;
    if (mostrarComprovante && comp) {
      try {
        comprovante = await comp.promessa;
      } catch {
        return toast.erro("A foto do comprovante não subiu. Remova a foto ou tente de novo.");
      }
    }
    const l = montarLancamento({
      id: uid(),
      ts: Date.now(),
      atendente,
      user,
      cliente,
      itens,
      gorjeta: valorGorjeta,
      forma,
      pagamentos: forma === "FIADO" ? undefined : montarPagamentos(forma, total, { formaA, formaB, valorA: vA }),
      comprovante,
    });

    // Metas (só para o próprio barbeiro ou o dono) e marco de meta batida → confete.
    const prog = metasProgresso(atendente, lancamentos);
    const cli1 = itens.some((i) => i.tipo === "servico") ? 1 : 0;
    const pr1 = itens.filter((i) => i.tipo === "produto").reduce((a, i) => a + i.preco * i.qtd, 0);
    const bateu = (atual, meta, add) => meta > 0 && atual < meta && atual + add >= meta;
    const marco = bateu(prog.semana.clientes, prog.semana.metaCli, cli1) || bateu(prog.mes.clientes, prog.mes.metaCli, cli1);
    const nm = primeiroNome(atendente.nome);
    const faltaSem = Math.max(0, prog.semana.metaCli - prog.semana.clientes - cli1);
    const faltaMes = Math.max(0, prog.mes.metaCli - prog.mes.clientes - cli1);
    const faltaProd = Math.max(0, prog.semana.metaProd - prog.semana.prod - pr1);
    const txtMeta = verMetas
      ? [
          prog.semana.metaCli > 0 && (faltaSem > 0 ? `faltam ${faltaSem} clientes p/ a meta da semana` : "meta de clientes da semana BATIDA!"),
          prog.mes.metaCli > 0 && faltaMes > 0 && `${faltaMes} p/ a do mês`,
          prog.semana.metaProd > 0 && (faltaProd > 0 ? `produtos: faltam ${brl(faltaProd)} na semana` : "meta de produtos da semana BATIDA!"),
        ]
          .filter(Boolean)
          .join(" · ")
      : "";

    const antes = snapshot();
    reset();
    setSucesso(true);
    setTimeout(() => setSucesso(false), 1200);
    try {
      await acoes.registrarLancamento(l);
      if (marco && verMetas) {
        setConfete(true);
        setTimeout(() => setConfete(false), 1800);
      }
      toast.ok(
        (forma === "FIADO" ? `Fiado de ${brl(total)} na comanda de ${nm} (sem comissão até pagar)` : `Baixa de ${brl(total)} na comanda de ${nm}`) +
          (txtMeta ? ` · ${nm}: ${txtMeta}` : ""),
        {
          acao: podeExcluir(user, l)
            ? { rotulo: "Desfazer", fn: () => rodar(() => acoes.excluirLancamento(l.id, "desfeito logo após lançar"), "Lançamento desfeito.") }
            : undefined,
        },
      );
    } catch (e) {
      setSucesso(false);
      restaurar(antes);
      toast.erro(`${e.message} A comanda voltou para a tela.`);
    }
  };

  /* Comanda de hoje: barbeiro vê a própria; lançando para colega, vê só o que ELE lançou (sem totais do colega). */
  const hoje = lancamentos.filter((l) => l.barbeiroId === atendente.id && mesmoDia(l.ts, Date.now()) && (ehDono || !paraOutro || l.lancadoPorId === user.id));
  const tot = totaisLista(hoje);
  const comandaMeta = {
    cli: itens.some((i) => i.tipo === "servico") ? 1 : 0,
    prod: itens.filter((i) => i.tipo === "produto").reduce((a, i) => a + i.preco * i.qtd, 0),
  };
  const selectCls = "bg-[#141414] border border-[#2a2a2a] rounded-xl px-3 py-3 text-white outline-none focus:border-[#C9A86A] flex-1 min-w-0";
  const vazio = itens.length === 0;

  const botaoBaixa = (
    <motion.button
      type="button"
      whileTap={{ scale: 0.97 }}
      onClick={lancar}
      className="w-full py-5 rounded-2xl text-black font-black text-lg sm:text-xl flex items-center justify-center gap-2 transition-opacity duration-150"
      style={{ background: `linear-gradient(135deg, #E3C98F, ${GOLD})`, boxShadow: "0 12px 34px rgba(201,168,106,.35)", opacity: vazio && !sucesso ? 0.55 : 1 }}
    >
      <TrocaIcone chave={sucesso ? "ok" : "check"}>{sucesso ? <Check size={26} strokeWidth={3.5} /> : <Check size={24} strokeWidth={3} />}</TrocaIcone>
      {sucesso ? "LANÇADO!" : `DAR BAIXA ${brl(total)}`}
      {!sucesso && <span className="text-xs font-bold opacity-70 hidden min-[360px]:inline">· {primeiroNome(atendente.nome)}</span>}
    </motion.button>
  );

  return (
    <div className="pb-56 lg:pb-10">
      <Confetti show={confete} />
      <div className="lg:grid lg:grid-cols-[minmax(0,1fr)_400px] lg:gap-8 xl:grid-cols-[minmax(0,1fr)_440px]">
        {/* ---------- coluna principal ---------- */}
        <div>
          <section className="mb-5" aria-label="Quem atendeu">
            <Rotulo>QUEM ATENDEU</Rotulo>
            <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1 sem-barra">
              {users
                .filter((u) => u.ativo !== false)
                .map((u) => {
                  const ativo = atendenteId === u.id;
                  return (
                    <button
                      type="button"
                      key={u.id}
                      onClick={() => setAtendenteId(u.id)}
                      aria-pressed={ativo}
                      className="flex items-center gap-2 pl-1.5 pr-4 py-1.5 rounded-full whitespace-nowrap active:scale-[0.97] transition-[background-color,color] duration-150"
                      style={{ background: ativo ? GOLD : CARD, color: ativo ? "#000" : "#d4d4d4", border: `1.5px solid ${ativo ? GOLD : "#262626"}` }}
                    >
                      <AvatarUsuario u={u} size={28} />
                      <span className="text-sm font-bold">{primeiroNome(u.nome)}</span>
                    </button>
                  );
                })}
            </div>
            <Aparecer show={paraOutro && !ehDono}>
              <p className="text-[11px] text-neutral-500 mt-2">
                Lançando para <b style={{ color: GOLD }}>{primeiroNome(atendente.nome)}</b>. Fica registrado que foi você quem lançou.
              </p>
            </Aparecer>
          </section>

          {verMetas && <MetasCompactas u={atendente} todas={lancamentos} config={config} comanda={comandaMeta} />}

          <section className="mb-5" ref={topoCliente} aria-label="Cliente">
            <Rotulo>CLIENTE</Rotulo>
            {cliente ? (
              <motion.div
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0, transition: { duration: DUR.base, ease: EASE_OUT } }}
                className="flex items-center justify-between rounded-2xl px-4 py-3.5"
                style={{ background: "rgba(201,168,106,.12)", border: `1.5px solid ${GOLD}` }}
              >
                <div>
                  <div className="font-bold text-white">{cliente.nome}</div>
                  {cliente.telefone && <div className="text-xs text-neutral-400">{cliente.telefone}</div>}
                </div>
                <button
                  type="button"
                  onClick={() => setCliente(null)}
                  className="w-9 h-9 rounded-full bg-neutral-800 flex items-center justify-center active:scale-[0.97]"
                  aria-label="Trocar cliente"
                >
                  <X size={16} className="text-white" />
                </button>
              </motion.div>
            ) : (
              <>
                <div className="relative">
                  <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-neutral-500 pointer-events-none" />
                  <input
                    className={`${inputGrande} pl-11`}
                    placeholder="Buscar ou criar cliente (opcional)"
                    value={busca}
                    onChange={(e) => setBusca(e.target.value)}
                    aria-label="Buscar ou criar cliente"
                  />
                </div>
                <Aparecer show={!!busca.trim()} className="mt-2 rounded-2xl overflow-hidden border border-[#262626] bg-[#141414]">
                  {resultados.map((c) => (
                    <button
                      type="button"
                      key={c.id}
                      onClick={() => {
                        setCliente(c);
                        setBusca("");
                      }}
                      className="w-full text-left px-4 py-3 border-b border-[#1f1f1f] text-white hover:bg-neutral-900 active:bg-neutral-800 transition-colors"
                    >
                      {c.nome}
                      {c.telefone && <span className="text-xs text-neutral-500 ml-2">{c.telefone}</span>}
                    </button>
                  ))}
                  {!existeExato && (
                    <div className="p-3">
                      <input
                        className={`${inputGrande} mb-2 py-2.5 text-sm`}
                        placeholder="WhatsApp (opcional) ex: 62999998888"
                        value={telNovo}
                        inputMode="tel"
                        onChange={(e) => setTelNovo(e.target.value)}
                        aria-label="WhatsApp do novo cliente"
                      />
                      <Btn className="w-full" onClick={criarCliente} carregando={ocupado === "cliente"} icone={<UserPlus size={18} />}>
                        Criar “{busca.trim()}”
                      </Btn>
                    </div>
                  )}
                </Aparecer>
              </>
            )}
          </section>

          <section className="mb-5" aria-label="Serviços">
            <Rotulo>SERVIÇOS</Rotulo>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {config.servicos.map((s) => (
                <ItemBtn
                  key={s.id}
                  nome={s.nome}
                  preco={precoServ(atendente, s)}
                  qtd={servSel[s.id] || 0}
                  onAdd={() => addServ(s.id)}
                  onSub={() => subServ(s.id)}
                />
              ))}
            </div>
            <ListaAnimada
              itens={avisosPreco.map((t) => ({ id: t, t }))}
              render={(a) => (
                <div
                  className="mt-3 rounded-xl px-3 py-2.5 text-xs flex gap-2 items-start"
                  style={{ background: "rgba(234,179,8,.1)", border: "1px solid rgba(234,179,8,.4)", color: "#facc15" }}
                >
                  <Clock size={14} className="mt-0.5 shrink-0" /> {a.t}
                </div>
              )}
            />
          </section>

          <section className="mb-5" aria-label="Produtos e bebidas">
            <Rotulo>
              PRODUTO / BEBIDA <span className="text-neutral-600">(opcional)</span>
            </Rotulo>
            <div className="grid grid-cols-2 min-[400px]:grid-cols-3 lg:grid-cols-3 xl:grid-cols-4 gap-3">
              {config.produtos.map((p) => (
                <ItemBtn
                  key={p.id}
                  nome={p.nome}
                  preco={p.preco}
                  qtd={prodSel[p.id] || 0}
                  onAdd={() => addProd(p)}
                  onSub={() => subProd(p.id)}
                  desabilitado={p.estoque <= 0}
                  extra={p.estoque <= 0 ? "sem estoque" : `${p.estoque} em estoque`}
                />
              ))}
            </div>
          </section>

          <section className="mb-5" aria-label="Gorjeta">
            <Rotulo>
              GORJETA <span className="text-neutral-600">(100% do barbeiro)</span>
            </Rotulo>
            <div className="relative">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-neutral-400 font-bold pointer-events-none">R$</span>
              <input
                className={`${inputGrande} pl-12`}
                inputMode="decimal"
                placeholder="0,00"
                value={gorjeta}
                onChange={(e) => setGorjeta(e.target.value.replace(/[^0-9,.]/g, ""))}
                aria-label="Gorjeta"
              />
            </div>
          </section>
        </div>

        {/* ---------- coluna da comanda (fixa no desktop) ---------- */}
        <div className="lg:sticky lg:top-6 lg:self-start">
          <section className="mb-5" aria-label="Comanda atual">
            <Rotulo>COMANDA ATUAL · {primeiroNome(atendente.nome).toUpperCase()}</Rotulo>
            <div
              className="rounded-2xl p-4 transition-[border-color] duration-200"
              style={{ background: CARD, border: `1.5px solid ${vazio ? "#262626" : GOLD}` }}
            >
              {vazio ? (
                <p className="text-xs text-neutral-500">Toque nos serviços e produtos. O valor soma sozinho aqui.</p>
              ) : (
                <>
                  <ListaAnimada
                    itens={itens.map((i) => ({ ...i, chave: i.tipo + i.id }))}
                    chave={(i) => i.chave}
                    render={(i) => (
                      <div className="flex justify-between text-sm py-1">
                        <span className="text-neutral-200">
                          {i.qtd > 1 ? `${i.qtd}x ` : ""}
                          {capitalizar(i.nome)}
                        </span>
                        <span className="font-semibold">{brl(i.preco * i.qtd)}</span>
                      </div>
                    )}
                  />
                  {valorGorjeta > 0 && (
                    <div className="flex justify-between text-sm py-1 text-neutral-400">
                      <span>Gorjeta</span>
                      <span>{brl(valorGorjeta)}</span>
                    </div>
                  )}
                  <div className="flex justify-between items-center border-t border-[#2a2a2a] mt-2 pt-3">
                    <span className="text-xs font-bold tracking-widest text-neutral-400">TOTAL</span>
                    <span className="text-3xl font-black tabular-nums" style={{ color: GOLD }}>
                      {brl(total)}
                    </span>
                  </div>
                </>
              )}
            </div>
          </section>

          <section className="mb-5" aria-label="Forma de pagamento">
            <Rotulo>FORMA DE PAGAMENTO</Rotulo>
            <div className="grid grid-cols-2 gap-3">
              {PAGTOS.map(({ id, Icon }, i) => {
                const ativo = forma === id;
                return (
                  <motion.button
                    type="button"
                    key={id}
                    whileTap={{ scale: 0.97 }}
                    onClick={() => setForma(id)}
                    aria-pressed={ativo}
                    className={`flex items-center justify-center gap-2 py-3.5 rounded-2xl font-bold transition-[background-color,color] duration-150 ${i === PAGTOS.length - 1 ? "col-span-2" : ""}`}
                    style={{ background: ativo ? GOLD : CARD, color: ativo ? "#000" : "#d4d4d4", border: `1.5px solid ${ativo ? GOLD : "#262626"}` }}
                  >
                    <Icon size={18} /> {FORMA_LABEL[id]}
                  </motion.button>
                );
              })}
            </div>

            <Aparecer show={forma === "FIADO"}>
              <p className="mt-3 text-xs text-amber-400">
                Vai para a lista de devedores. Conta nas metas, mas só entra no faturamento e na comissão quando for pago.
              </p>
            </Aparecer>

            <Aparecer show={forma === "DIVIDIDO"} className="mt-4 rounded-2xl p-3 border border-[#262626] bg-[#141414] space-y-2">
              <div className="flex gap-2">
                <select className={selectCls} value={formaA} onChange={(e) => setFormaA(e.target.value)} aria-label="1ª forma de pagamento">
                  {FORMAS.map((k) => (
                    <option key={k} value={k}>
                      {FORMA_LABEL[k]}
                    </option>
                  ))}
                </select>
                <input
                  className={selectCls}
                  inputMode="decimal"
                  placeholder="Valor R$"
                  value={valorA}
                  onChange={(e) => setValorA(e.target.value.replace(/[^0-9,.]/g, ""))}
                  aria-label="Valor da 1ª forma"
                />
              </div>
              <div className="flex gap-2">
                <select className={selectCls} value={formaB} onChange={(e) => setFormaB(e.target.value)} aria-label="2ª forma de pagamento">
                  {FORMAS.map((k) => (
                    <option key={k} value={k}>
                      {FORMA_LABEL[k]}
                    </option>
                  ))}
                </select>
                <div className={`${selectCls} flex items-center text-neutral-300`}>{brl(vB)}</div>
              </div>
            </Aparecer>

            <Aparecer show={mostrarComprovante} className="mt-4">
              {comp ? (
                <div className="relative inline-block">
                  <img src={comp.preview} alt="Comprovante" className="h-28 rounded-xl border border-[#333]" />
                  {comp.status === "enviando" && (
                    <div className="absolute inset-x-1 bottom-1 h-1 rounded-full overflow-hidden bg-black/50" role="progressbar" aria-label="Enviando foto">
                      <div className="barra-indeterminada h-full w-1/3" style={{ background: GOLD }} />
                    </div>
                  )}
                  {comp.status === "erro" && (
                    <div className="absolute inset-0 rounded-xl bg-red-900/70 flex items-center justify-center text-[11px] font-bold p-2 text-center">
                      Falhou. Remova e tente de novo.
                    </div>
                  )}
                  <button
                    type="button"
                    onClick={() => setComp(null)}
                    className="absolute -top-2 -right-2 w-8 h-8 rounded-full bg-red-600 flex items-center justify-center"
                    aria-label="Remover foto do comprovante"
                  >
                    <X size={14} className="text-white" />
                  </button>
                </div>
              ) : (
                <label className="flex items-center justify-center gap-2 py-3 rounded-2xl text-sm font-semibold text-neutral-300 border border-dashed border-[#3a3a3a] cursor-pointer active:scale-[0.97] transition-transform">
                  <Camera size={18} /> Foto do comprovante PIX (opcional)
                  <input type="file" accept="image/*" className="hidden" onChange={onFoto} />
                </label>
              )}
            </Aparecer>
          </section>

          <div className="hidden lg:block mb-6">{botaoBaixa}</div>

          {hoje.length > 0 && (
            <section className="mb-6" aria-label="Comanda de hoje">
              <div className="flex items-center justify-between mb-2">
                <Rotulo className="mb-0">
                  {paraOutro && !ehDono
                    ? `SEUS LANÇAMENTOS PARA ${primeiroNome(atendente.nome).toUpperCase()} HOJE`
                    : `COMANDA DE HOJE · ${primeiroNome(atendente.nome).toUpperCase()}`}
                </Rotulo>
                {(ehDono || !paraOutro) && (
                  <span className="text-sm font-black text-right" style={{ color: GOLD }}>
                    {brl(tot.pago)}
                    {tot.fiado > 0 && <span className="block text-[10px] text-amber-400 font-bold">+ {brl(tot.fiado)} fiado</span>}
                  </span>
                )}
              </div>
              <Card pad="sm" className="px-4">
                <ListaAnimada itens={hoje.slice(0, 12)} render={(l) => <LinhaLancamento l={l} />} />
              </Card>
            </section>
          )}
        </div>
      </div>

      {/* Botão fixo no celular/tablet */}
      <NoCorpo>
        <div
          className="lg:hidden fixed left-0 right-0 px-4 pt-3 pb-3 z-40"
          style={{ bottom: "calc(64px + env(safe-area-inset-bottom))", background: "linear-gradient(to top, #0A0A0A 70%, rgba(10,10,10,0))" }}
        >
          <div className="max-w-2xl mx-auto">{botaoBaixa}</div>
        </div>
      </NoCorpo>
    </div>
  );
}
