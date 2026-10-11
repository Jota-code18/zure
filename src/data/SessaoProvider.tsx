/* Sessão: login real (Supabase Auth) ou MODO DEMONSTRAÇÃO (memória, nunca toca o banco). */
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { gerarDemo, USUARIOS_DEMO } from "../domain/demo.ts";
import { identificarUsuario, registrarEvento } from "../observability/index.ts";
import * as auth from "./auth.ts";
import { criarBackendMemoria } from "./backend-memoria.ts";
import { criarBackendSupabase } from "./backend-supabase.ts";
import { supabase, supabaseConfigurado } from "./supabase.ts";

const SessaoCtx = createContext(null);

function criarBackendDemo(role, { atraso = 250, atrasoCarga = 700 } = {}) {
  const usuario = USUARIOS_DEMO.find((u) => u.role === role) || USUARIOS_DEMO[0];
  return criarBackendMemoria({ usuarios: USUARIOS_DEMO, dados: gerarDemo(USUARIOS_DEMO), userId: usuario.id, atraso, atrasoCarga });
}

export function SessaoProvider({ children, backendInicial = null }: { children?: React.ReactNode; backendInicial?: any }) {
  // status: carregando | deslogado | logado | recuperacao | demo
  const [status, setStatus] = useState(() => {
    if (backendInicial) return "demo";
    return supabaseConfigurado ? "carregando" : "deslogado";
  });
  const [backend, setBackend] = useState(backendInicial);

  useEffect(() => {
    if (!supabaseConfigurado || backendInicial) return;
    let vivo = true;
    const aplicar = (sessao, evento?: string) => {
      if (!vivo) return;
      if (sessao?.user) {
        setBackend((b) => (b?.modo === "supabase" && b.userId === sessao.user.id ? b : criarBackendSupabase(supabase, sessao.user.id)));
        if (evento === "PASSWORD_RECOVERY") setStatus("recuperacao");
        else setStatus((st) => (st === "recuperacao" ? st : "logado"));
      } else {
        setBackend((b) => (b?.modo === "memoria" ? b : null));
        setStatus((st) => (st === "demo" ? st : "deslogado"));
      }
    };
    auth.sessaoAtual().then((s) => aplicar(s));
    const parar = auth.aoMudarSessao((evento, s) => aplicar(s, evento));
    return () => {
      vivo = false;
      parar();
    };
  }, [backendInicial]);

  const entrarDemo = useCallback((role) => {
    registrarEvento("demo.entrar", { role });
    setBackend(criarBackendDemo(role));
    setStatus("demo");
  }, []);

  const sair = useCallback(async () => {
    identificarUsuario(null);
    if (status === "demo") {
      setBackend(null);
      setStatus("deslogado");
      return;
    }
    await auth.sair();
  }, [status]);

  const senhaRedefinida = useCallback(() => setStatus("logado"), []);

  const valor = useMemo(
    () => ({ status, backend, entrarDemo, sair, senhaRedefinida, supabaseConfigurado }),
    [status, backend, entrarDemo, sair, senhaRedefinida],
  );
  return <SessaoCtx.Provider value={valor}>{children}</SessaoCtx.Provider>;
}

export function useSessao() {
  const v = useContext(SessaoCtx);
  if (!v) throw new Error("useSessao precisa estar dentro de <SessaoProvider>");
  return v;
}
