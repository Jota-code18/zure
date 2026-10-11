/* Login pelo Supabase Auth (senhas nunca passam pelo app nem ficam no navegador). */
import { traduzirErro } from "./erros.ts";
import { supabase } from "./supabase.ts";

const origem = () => (typeof window !== "undefined" ? window.location.origin : undefined);

async function chamar(fn) {
  const { data, error } = await fn();
  if (error) throw traduzirErro(error);
  return data;
}

export const entrar = (email, senha) => chamar(() => supabase.auth.signInWithPassword({ email: email.trim().toLowerCase(), password: senha }));

/** Primeiro acesso: só funciona para e-mails convidados pelo dono. */
export async function primeiroAcesso(email, senha) {
  const data = await chamar(() => supabase.auth.signUp({ email: email.trim().toLowerCase(), password: senha, options: { emailRedirectTo: origem() } }));
  return { precisaConfirmar: !data.session };
}

export const esqueciSenha = (email) => chamar(() => supabase.auth.resetPasswordForEmail(email.trim().toLowerCase(), { redirectTo: origem() }));

export const definirNovaSenha = (senha) => chamar(() => supabase.auth.updateUser({ password: senha }));

export const sair = () => supabase.auth.signOut();

export async function sessaoAtual() {
  const { data } = await supabase.auth.getSession();
  return data.session;
}

export function aoMudarSessao(fn) {
  const { data } = supabase.auth.onAuthStateChange((evento, sessao) => fn(evento, sessao));
  return () => data.subscription.unsubscribe();
}
