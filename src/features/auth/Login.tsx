/* Entrada: login real (Supabase Auth), primeiro acesso por convite, recuperação de senha e demonstração. */
import { AnimatePresence, motion } from "framer-motion";
import { Eye, KeyRound, Lock, Mail, PlayCircle } from "lucide-react";
import { useState } from "react";
import * as auth from "../../data/auth.ts";
import { useSessao } from "../../data/SessaoProvider.tsx";
import { Btn, inputGrande } from "../../ui/base.tsx";
import { Logo } from "../../ui/controles.tsx";
import { DUR, EASE_IN, EASE_OUT, GOLD } from "../../ui/tema.ts";

const MODOS = {
  entrar: { titulo: "Entrar", botao: "ENTRAR" },
  primeiro: { titulo: "Primeiro acesso", botao: "CRIAR MINHA SENHA" },
  esqueci: { titulo: "Esqueci a senha", botao: "ENVIAR LINK" },
};

function Campo({ icone: Icone, ...props }: { icone: React.ElementType; [outros: string]: any }) {
  return (
    <div className="relative">
      <Icone size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-neutral-500 pointer-events-none" />
      <input className={`${inputGrande} pl-11 py-4`} {...props} />
    </div>
  );
}

function Moldura({ children }: { children?: React.ReactNode }) {
  return (
    <main className="min-h-dvh grid lg:grid-cols-2 bg-[#0A0A0A]">
      <div className="hidden lg:flex items-center justify-center bg-[#2f2d2e] p-12" aria-hidden="true">
        <Logo tipo="z" className="max-h-[70vh] w-auto" />
      </div>
      <div className="flex items-center justify-center px-6 py-10">
        <motion.div
          initial={{ opacity: 0, y: 12, filter: "blur(4px)" }}
          animate={{ opacity: 1, y: 0, filter: "blur(0px)", transition: { duration: 0.35, ease: EASE_OUT } }}
          className="w-full max-w-sm"
        >
          {children}
        </motion.div>
      </div>
    </main>
  );
}

export function Login() {
  const { entrarDemo, supabaseConfigurado } = useSessao();
  const [modo, setModo] = useState("entrar");
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [msg, setMsg] = useState(null); // { tipo, texto }
  const [ocupado, setOcupado] = useState(false);

  const trocar = (m) => {
    setModo(m);
    setMsg(null);
  };

  const enviar = async (e) => {
    e.preventDefault();
    if (!supabaseConfigurado) return;
    setOcupado(true);
    setMsg(null);
    try {
      if (modo === "entrar") await auth.entrar(email, senha);
      else if (modo === "primeiro") {
        if (senha.length < 6) throw new Error("A senha precisa ter pelo menos 6 caracteres.");
        const { precisaConfirmar } = await auth.primeiroAcesso(email, senha);
        if (precisaConfirmar) setMsg({ tipo: "ok", texto: "Conta criada! Abra o e-mail que enviamos e toque no link para confirmar. Depois é só entrar." });
      } else {
        await auth.esqueciSenha(email);
        setMsg({ tipo: "ok", texto: "Se esse e-mail estiver cadastrado, você vai receber um link para criar uma nova senha." });
      }
    } catch (err) {
      setMsg({ tipo: "erro", texto: err.message });
    } finally {
      setOcupado(false);
    }
  };

  return (
    <Moldura>
      <div className="flex flex-col items-center mb-8">
        <Logo tipo="zure" className="w-60 rounded-2xl" />
        <p className="mt-4 text-xs tracking-[0.3em] text-neutral-500">GESTÃO TOTAL</p>
      </div>

      {supabaseConfigurado ? (
        <form onSubmit={enviar} className="space-y-3" aria-label={MODOS[modo].titulo}>
          <AnimatePresence mode="wait" initial={false}>
            <motion.h1
              key={modo}
              className="text-lg font-black text-center"
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0, transition: { duration: DUR.base, ease: EASE_OUT } }}
              exit={{ opacity: 0, transition: { duration: DUR.rapido, ease: EASE_IN } }}
            >
              {MODOS[modo].titulo}
            </motion.h1>
          </AnimatePresence>
          <Campo
            icone={Mail}
            type="email"
            placeholder="E-mail"
            autoComplete="email"
            autoCapitalize="none"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            aria-label="E-mail"
          />
          {modo !== "esqueci" && (
            <Campo
              icone={Lock}
              type="password"
              placeholder={modo === "primeiro" ? "Crie uma senha (mín. 6)" : "Senha"}
              autoComplete={modo === "primeiro" ? "new-password" : "current-password"}
              required
              minLength={modo === "primeiro" ? 6 : undefined}
              value={senha}
              onChange={(e) => setSenha(e.target.value)}
              aria-label="Senha"
            />
          )}
          <AnimatePresence>
            {msg && (
              <motion.p
                role={msg.tipo === "erro" ? "alert" : "status"}
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0, transition: { duration: DUR.base } }}
                exit={{ opacity: 0, transition: { duration: DUR.rapido } }}
                className={`text-sm text-center ${msg.tipo === "erro" ? "text-red-400" : "text-green-400"}`}
              >
                {msg.texto}
              </motion.p>
            )}
          </AnimatePresence>
          <Btn
            type="submit"
            tamanho="lg"
            className="w-full font-black text-lg py-4 rounded-2xl"
            carregando={ocupado}
            style={{ boxShadow: "0 10px 30px rgba(201,168,106,.25)" }}
          >
            {MODOS[modo].botao}
          </Btn>
          <div className="flex justify-between text-xs pt-1">
            {modo !== "entrar" ? (
              <button type="button" className="underline text-neutral-400" onClick={() => trocar("entrar")}>
                Voltar para entrar
              </button>
            ) : (
              <button type="button" className="underline text-neutral-400" onClick={() => trocar("primeiro")}>
                Primeiro acesso
              </button>
            )}
            {modo !== "esqueci" && (
              <button type="button" className="underline text-neutral-400" onClick={() => trocar("esqueci")}>
                Esqueci a senha
              </button>
            )}
          </div>
          {modo === "primeiro" && <p className="text-[11px] text-neutral-500 text-center">Use o e-mail que o dono cadastrou para você em Ajustes › Equipe.</p>}
        </form>
      ) : (
        <p className="text-sm text-amber-400 text-center">Banco de dados não configurado neste ambiente. Use a demonstração.</p>
      )}

      <div className="mt-8 pt-6 border-t border-[#1f1f1f]">
        <p className="text-[11px] text-neutral-500 text-center mb-3 flex items-center justify-center gap-1">
          <Eye size={12} /> Demonstração com dados fictícios — não mexe nos dados reais
        </p>
        <div className="grid grid-cols-2 gap-2">
          <Btn cor="#1a1a1a" texto={GOLD} onClick={() => entrarDemo("admin")} icone={<PlayCircle size={16} />} className="border border-[#2a2a2a]">
            Como dono
          </Btn>
          <Btn cor="#1a1a1a" texto={GOLD} onClick={() => entrarDemo("barbeiro")} icone={<PlayCircle size={16} />} className="border border-[#2a2a2a]">
            Como barbeiro
          </Btn>
        </div>
      </div>
    </Moldura>
  );
}

/** Depois de tocar no link do e-mail de recuperação. */
export function NovaSenha() {
  const { senhaRedefinida } = useSessao();
  const [senha, setSenha] = useState("");
  const [msg, setMsg] = useState(null);
  const [ocupado, setOcupado] = useState(false);
  const enviar = async (e) => {
    e.preventDefault();
    if (senha.length < 6) return setMsg("A senha precisa ter pelo menos 6 caracteres.");
    setOcupado(true);
    try {
      await auth.definirNovaSenha(senha);
      senhaRedefinida();
    } catch (err) {
      setMsg(err.message);
    } finally {
      setOcupado(false);
    }
  };
  return (
    <Moldura>
      <form onSubmit={enviar} className="space-y-3">
        <h1 className="text-lg font-black text-center">Crie sua nova senha</h1>
        <Campo
          icone={KeyRound}
          type="password"
          placeholder="Nova senha (mín. 6)"
          autoComplete="new-password"
          value={senha}
          onChange={(e) => setSenha(e.target.value)}
          aria-label="Nova senha"
        />
        {msg && (
          <p role="alert" className="text-sm text-red-400 text-center">
            {msg}
          </p>
        )}
        <Btn type="submit" tamanho="lg" className="w-full" carregando={ocupado}>
          SALVAR E ENTRAR
        </Btn>
      </form>
    </Moldura>
  );
}
