/* Ajustes › Equipe: perfis e convites. Senhas não aparecem nem são guardadas pelo app. */
import { KeyRound, Mail, Trash2, UserPlus } from "lucide-react";
import { useState } from "react";
import { esqueciSenha } from "../../data/auth.ts";
import { useDados } from "../../data/DadosProvider.tsx";
import { primeiroNome } from "../../domain/formato.ts";
import { extraPadrao } from "../../domain/usuarios.ts";
import { Btn, Card, Chip, H, inputBase, NumField, TextField, Vazio } from "../../ui/base.tsx";
import { ListaAnimada } from "../../ui/estrutura.tsx";
import { useToast } from "../../ui/feedback.tsx";
import { GOLD } from "../../ui/tema.ts";
import { AvatarUsuario, useAcao } from "../compartilhado/comum.tsx";
import { reduzirImagem } from "../compartilhado/imagem.ts";

const lbl = "block text-[10px] text-neutral-500 mb-1";
const emailValido = (e) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e);

export default function Equipe() {
  const { user, users, convites, modoDemo, acoes } = useDados();
  const [rodar, ocupado] = useAcao();
  const toast = useToast();
  const [novo, setNovo] = useState({ nome: "", email: "", role: "barbeiro", preco: 65 });
  const [erro, setErro] = useState("");
  const pendentes = convites.filter((c) => !c.usadoEm);
  const upd = (id: string, patch: Record<string, any>, msg?: string) =>
    rodar(() => acoes.atualizarPerfil(id, patch), msg, { chave: `${id}:${Object.keys(patch)[0]}` });

  const convidar = () => {
    const email = novo.email.trim().toLowerCase();
    if (!novo.nome.trim() || !emailValido(email)) return setErro("Preencha nome e um e-mail válido.");
    if (users.some((u) => u.email === email) || pendentes.some((c) => c.email === email)) return setErro("Esse e-mail já está na equipe ou convidado.");
    setErro("");
    rodar(
      () => acoes.salvarConvite({ email, nome: novo.nome.trim(), role: novo.role, extra: extraPadrao(novo.role, novo.preco) }),
      `${primeiroNome(novo.nome)} convidado. Peça para abrir o app e tocar em “Primeiro acesso” com esse e-mail.`,
      { chave: "convite" },
    ).then((r) => r && setNovo({ nome: "", email: "", role: "barbeiro", preco: 65 }));
  };

  const fotoUser = async (u, file) => {
    if (!file) return;
    await rodar(
      async () => {
        const blob = await reduzirImagem(file, 320);
        const caminho = await acoes.enviarFoto(blob, "perfis");
        return acoes.atualizarPerfil(u.id, { foto: caminho });
      },
      "Foto atualizada.",
      { chave: `${u.id}:foto` },
    );
  };

  const resetSenha = (u) => {
    if (modoDemo) return toast.ok("Na demonstração não há e-mail de verdade.");
    return rodar(() => esqueciSenha(u.email), `Enviamos para ${u.email} um link para criar uma nova senha.`, { chave: `${u.id}:senha` });
  };

  return (
    <div className="grid gap-4 lg:grid-cols-2 items-start">
      <Card className="space-y-3">
        <H>Equipe</H>
        <ListaAnimada
          className="space-y-3"
          itens={users}
          render={(u) => (
            <div className="rounded-xl bg-[#0f0f0f] p-3 space-y-2" style={{ opacity: u.ativo === false ? 0.55 : 1, transition: "opacity .2s" }}>
              <div className="flex items-center gap-3">
                <label className="cursor-pointer relative" aria-label={`Trocar foto de ${u.nome}`}>
                  <AvatarUsuario u={u} size={44} />
                  {ocupado === `${u.id}:foto` && <span className="absolute inset-0 rounded-full bg-black/60 skeleton" />}
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => {
                      fotoUser(u, e.target.files?.[0]);
                      e.target.value = "";
                    }}
                  />
                </label>
                <div className="flex-1 min-w-0">
                  <TextField value={u.nome} onChange={(v) => upd(u.id, { nome: v })} aria-label="Nome" />
                  <div className="text-[11px] text-neutral-500 mt-1 truncate">
                    <Mail size={11} className="inline mr-1" />
                    {u.email} · {u.role === "admin" ? "dono" : "barbeiro"}
                  </div>
                </div>
                {u.role === "barbeiro" && u.id !== user.id && (
                  <button
                    type="button"
                    onClick={() =>
                      (u.ativo !== false ? window.confirm(`Desativar ${primeiroNome(u.nome)}? Ele perde o acesso na hora (o histórico continua).`) : true) &&
                      upd(u.id, { ativo: u.ativo === false }, u.ativo === false ? "Acesso reativado." : "Acesso desativado.")
                    }
                    className="text-[10px] px-2 py-1 rounded-full border transition-colors"
                    style={{ borderColor: u.ativo === false ? "#555" : "#22c55e", color: u.ativo === false ? "#888" : "#22c55e" }}
                  >
                    {u.ativo === false ? "Inativo" : "Ativo"}
                  </button>
                )}
              </div>
              <div className="grid grid-cols-2 gap-2 items-end">
                {u.role === "barbeiro" ? (
                  <label>
                    <span className={lbl}>Horário de entrada</span>
                    <input type="time" className={inputBase} value={u.entrada || "09:00"} onChange={(e) => upd(u.id, { entrada: e.target.value })} />
                  </label>
                ) : (
                  <span />
                )}
                <Btn
                  tamanho="sm"
                  cor="#262626"
                  texto="#fff"
                  onClick={() => resetSenha(u)}
                  carregando={ocupado === `${u.id}:senha`}
                  icone={<KeyRound size={14} />}
                >
                  Link de nova senha
                </Btn>
              </div>
            </div>
          )}
        />
        <p className="text-[10px] text-neutral-500">
          Metas, comissão por nível e preço de cada um: aba <b style={{ color: GOLD }}>Metas › Editar metas</b>. Desativar corta o acesso na hora, sem apagar o
          histórico.
        </p>
      </Card>

      <div className="space-y-4">
        <Card className="space-y-3">
          <H>Convidar para a equipe</H>
          <p className="text-[11px] text-neutral-500">
            Só e-mails convidados aqui conseguem criar conta. A pessoa cria a própria senha em “Primeiro acesso” — você nunca vê nem digita a senha dela.
          </p>
          <input
            className={inputBase}
            placeholder="Nome"
            value={novo.nome}
            onChange={(e) => setNovo({ ...novo, nome: e.target.value })}
            aria-label="Nome do convidado"
          />
          <input
            className={inputBase}
            placeholder="E-mail"
            type="email"
            autoCapitalize="none"
            value={novo.email}
            onChange={(e) => setNovo({ ...novo, email: e.target.value })}
            aria-label="E-mail do convidado"
          />
          <div className="grid grid-cols-2 gap-2 items-end">
            <div className="flex gap-2">
              <Chip ativo={novo.role === "barbeiro"} onClick={() => setNovo({ ...novo, role: "barbeiro" })}>
                Barbeiro
              </Chip>
              <Chip ativo={novo.role === "admin"} onClick={() => setNovo({ ...novo, role: "admin" })}>
                Dono
              </Chip>
            </div>
            <label>
              <span className={lbl}>Preço do corte dele</span>
              <NumField value={novo.preco} prefix="R$" onChange={(v) => setNovo({ ...novo, preco: v })} />
            </label>
          </div>
          {erro && <p className="text-xs text-red-400">{erro}</p>}
          <Btn onClick={convidar} className="w-full" carregando={ocupado === "convite"} icone={<UserPlus size={16} />}>
            Convidar
          </Btn>
          <p className="text-[10px] text-neutral-600">O plano de carreira é montado automaticamente a partir do preço do corte (dá para ajustar depois).</p>
        </Card>

        <Card>
          <H>Convites pendentes</H>
          {pendentes.length === 0 && <Vazio>Nenhum convite esperando.</Vazio>}
          <ListaAnimada
            itens={pendentes}
            chave={(c) => c.email}
            render={(c) => (
              <div className="flex items-center justify-between gap-2 py-2 border-b border-[#1d1d1d] last:border-0 text-sm">
                <div className="min-w-0">
                  <div className="font-bold truncate">{c.nome}</div>
                  <div className="text-[11px] text-neutral-500 truncate">
                    {c.email} · {c.role === "admin" ? "dono" : "barbeiro"}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => window.confirm(`Cancelar o convite de ${c.nome}?`) && rodar(() => acoes.excluirConvite(c.email), "Convite cancelado.")}
                  className="text-neutral-500 hover:text-red-400 p-1"
                  aria-label={`Cancelar convite de ${c.nome}`}
                >
                  <Trash2 size={15} />
                </button>
              </div>
            )}
          />
        </Card>
      </div>
    </div>
  );
}
