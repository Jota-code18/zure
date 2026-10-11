/* Ajustes › Contas e Catálogo (serviços, produtos, custos, bebida, missões). */
import { Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import { useDados } from "../../data/DadosProvider.tsx";
import { brl, num as nz, slug, uid } from "../../domain/formato.ts";
import { Btn, Card, H, inputBase, NumField, TextField } from "../../ui/base.tsx";
import { ListaAnimada } from "../../ui/estrutura.tsx";
import { GOLD } from "../../ui/tema.ts";
import { useAcao } from "../compartilhado/comum.tsx";

const lbl = "block text-[10px] text-neutral-500 mb-1";

/** Atualiza a configuração com aviso de erro (otimista: a tela muda na hora). */
function useConfig() {
  const { acoes } = useDados();
  const [rodar] = useAcao();
  return (fn) => rodar(() => acoes.atualizarConfig(fn));
}

export function Contas() {
  const { config } = useDados();
  const upd = useConfig();
  const [nova, setNova] = useState({ nome: "", valor: "" });
  const updConta = (id, patch) => upd((c) => ({ ...c, contas: c.contas.map((x) => (x.id === id ? { ...x, ...patch } : x)) }));
  const addConta = () => {
    const v = nz(nova.valor);
    if (!nova.nome.trim() || v <= 0) return;
    upd((c) => ({ ...c, contas: [...c.contas, { id: uid(), nome: nova.nome.trim(), valor: v, dia: 0 }] }));
    setNova({ nome: "", valor: "" });
  };
  return (
    <div className="grid gap-4 lg:grid-cols-2 items-start">
      <Card className="space-y-3">
        <H
          right={
            <span className="text-sm font-black" style={{ color: GOLD }}>
              {brl(config.custoFixo)}
            </span>
          }
        >
          Contas fixas do mês
        </H>
        <p className="text-[11px] text-neutral-500">
          Defina o dia do vencimento. O app avisa 2 dias antes e no dia (aviso no topo e notificação do aparelho com o app aberto). O total vira o custo fixo da
          barbearia.
        </p>
        <ListaAnimada
          className="space-y-2"
          itens={config.contas}
          render={(c) => (
            <div className="rounded-xl border border-[#262626] p-2 space-y-1.5">
              <div className="flex items-center gap-2">
                <div className="flex-1">
                  <TextField value={c.nome} onChange={(v) => updConta(c.id, { nome: v })} aria-label="Nome da conta" />
                </div>
                <button
                  type="button"
                  onClick={() => upd((cf) => ({ ...cf, contas: cf.contas.filter((x) => x.id !== c.id) }))}
                  className="w-9 h-9 rounded-full bg-neutral-900 flex items-center justify-center text-red-400"
                  aria-label={`Remover conta ${c.nome}`}
                >
                  <Trash2 size={15} />
                </button>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <label>
                  <span className={lbl}>Valor</span>
                  <NumField value={c.valor} prefix="R$" onChange={(v) => updConta(c.id, { valor: v })} />
                </label>
                <label>
                  <span className={lbl}>Vence todo dia (1–31)</span>
                  <NumField value={c.dia || 0} onChange={(v) => updConta(c.id, { dia: Math.max(0, Math.min(31, Math.round(v))) })} />
                </label>
              </div>
            </div>
          )}
        />
        <div className="flex gap-2 pt-1">
          <input
            className={inputBase}
            placeholder="Nova conta"
            value={nova.nome}
            onChange={(e) => setNova({ ...nova, nome: e.target.value })}
            aria-label="Nome da nova conta"
          />
          <input
            className={`${inputBase} w-24`}
            placeholder="R$"
            inputMode="decimal"
            value={nova.valor}
            onChange={(e) => setNova({ ...nova, valor: e.target.value.replace(/[^0-9,.]/g, "") })}
            aria-label="Valor da nova conta"
          />
          <Btn onClick={addConta} tamanho="sm" icone={<Plus size={16} />} aria-label="Adicionar conta" />
        </div>
      </Card>
      <Card className="space-y-3">
        <H>Parâmetros do lucro</H>
        <div className="grid grid-cols-2 gap-3">
          <label>
            <span className={lbl}>Rateio do custo fixo (÷)</span>
            <NumField value={config.rateioFixo || 2} onChange={(v) => upd((c) => ({ ...c, rateioFixo: Math.max(1, v) }))} />
          </label>
          <label>
            <span className={lbl}>Faturamento base/mês</span>
            <NumField value={config.faturamentoBase} prefix="R$" onChange={(v) => upd((c) => ({ ...c, faturamentoBase: v }))} />
          </label>
          <label>
            <span className={lbl}>Imposto</span>
            <NumField value={config.imposto} suffix="%" onChange={(v) => upd((c) => ({ ...c, imposto: v }))} />
          </label>
          <label>
            <span className={lbl}>Maquininha (cartão)</span>
            <NumField value={config.maquininha} suffix="%" onChange={(v) => upd((c) => ({ ...c, maquininha: v }))} />
          </label>
          <label>
            <span className={lbl}>Nº de cadeiras</span>
            <NumField value={config.cadeiras} onChange={(v) => upd((c) => ({ ...c, cadeiras: Math.max(1, Math.round(v)) }))} />
          </label>
          <label>
            <span className={lbl}>Salário meta do dono</span>
            <NumField value={config.salarioMeta} prefix="R$" onChange={(v) => upd((c) => ({ ...c, salarioMeta: v }))} />
          </label>
          <label className="col-span-2">
            <span className={lbl}>Comissão sobre produtos (% do lucro do produto)</span>
            <NumField value={config.comissaoProduto ?? 30} suffix="%" onChange={(v) => upd((c) => ({ ...c, comissaoProduto: v }))} />
          </label>
          <label className="col-span-2">
            <span className={lbl}>Link de avaliação do Google</span>
            <TextField value={config.googleLink || ""} onChange={(v) => upd((c) => ({ ...c, googleLink: v }))} placeholder="https://g.page/..." />
          </label>
        </div>
        <p className="text-[10px] text-neutral-600">{brl(config.custoFixo / (config.cadeiras || 3))} de custo fixo por cadeira. Esses números só o dono vê.</p>
      </Card>
    </div>
  );
}

export function Catalogo() {
  const { config, acoes } = useDados();
  const [rodar, ocupado] = useAcao();
  const upd = useConfig();
  const [novoProd, setNovoProd] = useState({ nome: "", custo: "", preco: "", estoque: "" });
  const [novoServ, setNovoServ] = useState({ nome: "", preco: "" });
  const todosItens = [...config.servicos, ...config.produtos];

  const addServico = () => {
    if (!novoServ.nome.trim()) return;
    upd((c) => ({
      ...c,
      servicos: [...c.servicos, { id: `${slug(novoServ.nome)}-${uid().slice(0, 4)}`, nome: novoServ.nome.trim().toUpperCase(), preco: nz(novoServ.preco) }],
    }));
    setNovoServ({ nome: "", preco: "" });
  };
  const addProduto = () => {
    if (!novoProd.nome.trim()) return;
    rodar(
      () =>
        acoes.salvarProduto({
          id: `${slug(novoProd.nome)}-${uid().slice(0, 4)}`,
          nome: novoProd.nome.trim().toUpperCase(),
          custo: nz(novoProd.custo),
          preco: nz(novoProd.preco),
          estoque: Number.parseInt(novoProd.estoque, 10) || 0,
          ordem: config.produtos.length + 1,
        }),
      "Produto adicionado.",
      { chave: "produto" },
    ).then((r) => r && setNovoProd({ nome: "", custo: "", preco: "", estoque: "" }));
  };
  const updMissao = (id, patch) => upd((c) => ({ ...c, missoes: c.missoes.map((m) => (m.id === id ? { ...m, ...patch } : m)) }));

  return (
    <div className="grid gap-4 lg:grid-cols-2 items-start">
      <div className="space-y-4">
        <Card className="space-y-3">
          <H>Preços dos serviços</H>
          {config.servicos.map((s) => (
            <div key={s.id} className="flex items-center gap-2">
              <div className="flex-1">
                <TextField
                  value={s.nome}
                  onChange={(v) => upd((c) => ({ ...c, servicos: c.servicos.map((x) => (x.id === s.id ? { ...x, nome: v.toUpperCase() } : x)) }))}
                  aria-label="Nome do serviço"
                />
              </div>
              <NumField
                value={s.preco}
                prefix="R$"
                className="w-28"
                onChange={(v) => upd((c) => ({ ...c, servicos: c.servicos.map((x) => (x.id === s.id ? { ...x, preco: v } : x)) }))}
                aria-label={`Preço de ${s.nome}`}
              />
            </div>
          ))}
          <div className="flex gap-2 pt-1">
            <input
              className={inputBase}
              placeholder="Novo serviço"
              value={novoServ.nome}
              onChange={(e) => setNovoServ({ ...novoServ, nome: e.target.value })}
              aria-label="Nome do novo serviço"
            />
            <input
              className={`${inputBase} w-24`}
              placeholder="R$"
              inputMode="decimal"
              value={novoServ.preco}
              onChange={(e) => setNovoServ({ ...novoServ, preco: e.target.value.replace(/[^0-9,.]/g, "") })}
              aria-label="Preço do novo serviço"
            />
            <Btn onClick={addServico} tamanho="sm" icone={<Plus size={16} />} aria-label="Adicionar serviço" />
          </div>
          <p className="text-[10px] text-neutral-600">Preço por barbeiro: aba Metas › Editar metas.</p>
        </Card>

        <Card className="space-y-3">
          <H>Meta de bebida e bônus</H>
          <label className="block">
            <span className={lbl}>Produto da meta</span>
            <select
              className={inputBase}
              value={config.metaBebida?.produtoId}
              onChange={(e) => upd((c) => ({ ...c, metaBebida: { ...c.metaBebida, produtoId: e.target.value } }))}
            >
              {config.produtos.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.nome}
                </option>
              ))}
            </select>
          </label>
          <div className="grid grid-cols-2 gap-3">
            <label>
              <span className={lbl}>Quantidade no mês</span>
              <NumField value={config.metaBebida?.qtd} onChange={(v) => upd((c) => ({ ...c, metaBebida: { ...c.metaBebida, qtd: Math.round(v) } }))} />
            </label>
            <label>
              <span className={lbl}>Bônus fixo</span>
              <NumField value={config.metaBebida?.bonus} prefix="R$" onChange={(v) => upd((c) => ({ ...c, metaBebida: { ...c.metaBebida, bonus: v } }))} />
            </label>
          </div>
        </Card>
      </div>

      <div className="space-y-4">
        <Card className="space-y-3">
          <H>Produtos e bebidas</H>
          {config.produtos.map((p) => (
            <div key={p.id} className="rounded-xl bg-[#0f0f0f] p-2.5">
              <div className="text-xs font-bold mb-1.5">{p.nome}</div>
              <div className="grid grid-cols-2 gap-2">
                <label>
                  <span className={lbl}>Custo</span>
                  <NumField value={p.custo} prefix="R$" onChange={(v) => rodar(() => acoes.salvarProduto({ id: p.id, custo: v }))} />
                </label>
                <label>
                  <span className={lbl}>Venda</span>
                  <NumField value={p.preco} prefix="R$" onChange={(v) => rodar(() => acoes.salvarProduto({ id: p.id, preco: v }))} />
                </label>
              </div>
            </div>
          ))}
          <div className="rounded-xl border border-dashed border-[#333] p-2.5 space-y-2">
            <div className="text-xs font-bold">Novo produto / bebida</div>
            <input
              className={inputBase}
              placeholder="Nome"
              value={novoProd.nome}
              onChange={(e) => setNovoProd({ ...novoProd, nome: e.target.value })}
              aria-label="Nome do produto"
            />
            <div className="grid grid-cols-3 gap-2">
              {[
                ["custo", "Custo R$"],
                ["preco", "Venda R$"],
                ["estoque", "Estoque"],
              ].map(([k, ph]) => (
                <input
                  key={k}
                  className={inputBase}
                  placeholder={ph}
                  inputMode="decimal"
                  value={novoProd[k]}
                  onChange={(e) => setNovoProd({ ...novoProd, [k]: e.target.value.replace(/[^0-9,.]/g, "") })}
                  aria-label={ph}
                />
              ))}
            </div>
            <Btn onClick={addProduto} className="w-full" carregando={ocupado === "produto"} icone={<Plus size={16} />}>
              Adicionar produto
            </Btn>
          </div>
        </Card>

        <Card className="space-y-3">
          <H>Missões diárias</H>
          <ListaAnimada
            className="space-y-2"
            itens={config.missoes}
            render={(m) => (
              <div className="rounded-xl bg-[#0f0f0f] p-2.5 space-y-2">
                <div className="flex gap-2">
                  <div className="flex-1">
                    <TextField value={m.titulo} onChange={(v) => updMissao(m.id, { titulo: v })} aria-label="Título da missão" />
                  </div>
                  <button
                    type="button"
                    onClick={() => upd((c) => ({ ...c, missoes: c.missoes.filter((x) => x.id !== m.id) }))}
                    className="text-neutral-500 hover:text-red-400 px-1"
                    aria-label="Remover missão"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <select className={inputBase} value={m.itemId} onChange={(e) => updMissao(m.id, { itemId: e.target.value })} aria-label="Item da missão">
                    {todosItens.map((i) => (
                      <option key={i.id} value={i.id}>
                        {i.nome}
                      </option>
                    ))}
                  </select>
                  <NumField value={m.alvo} suffix="un" onChange={(v) => updMissao(m.id, { alvo: Math.max(1, Math.round(v)) })} aria-label="Quantidade alvo" />
                  <NumField value={m.bonus} prefix="R$" onChange={(v) => updMissao(m.id, { bonus: v })} aria-label="Bônus" />
                </div>
              </div>
            )}
          />
          <Btn
            onClick={() =>
              upd((c) => ({ ...c, missoes: [...c.missoes, { id: uid(), titulo: "Nova missão", itemId: c.servicos[0]?.id || "", alvo: 2, bonus: 10 }] }))
            }
            className="w-full"
            cor="#262626"
            texto="#fff"
            icone={<Plus size={16} />}
          >
            Nova missão
          </Btn>
          <p className="text-[10px] text-neutral-600">Missões contam só vendas pagas no dia (fiado entra quando for pago).</p>
        </Card>
      </div>
    </div>
  );
}
