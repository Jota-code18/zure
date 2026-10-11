/* Cliente Supabase. A chave publicável é pública por natureza: a segurança vem das regras (RLS) do banco. */
import { createClient } from "@supabase/supabase-js";

const url = import.meta.env.VITE_SUPABASE_URL;
const chave = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

export const supabaseConfigurado = Boolean(url && chave);

export const supabase = supabaseConfigurado
  ? createClient(url, chave, { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true } })
  : null;
