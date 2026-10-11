/* Observabilidade com fornecedores plugáveis.
 *
 * Sentry, Datadog RUM, New Relic e OpenTelemetry ficam DESLIGADOS até existir a variável de ambiente
 * de cada um. Cada SDK só é baixado (import dinâmico) quando está ativo, então não pesa no app.
 * Nunca enviamos nome de cliente, e-mail ou valores digitados: só ids, papel e nomes de eventos.
 */

const estado = { adaptadores: [], fila: [], iniciado: false, usuario: null };

export function lerConfig(env: Record<string, any>) {
  return {
    servico: "zure-barbearia",
    versao: env.VITE_APP_VERSION || "dev",
    ambiente: env.VITE_APP_ENV || env.MODE || "development",
    amostragem: Number(env.VITE_TRACES_SAMPLE_RATE || 0.2),
    sentryDsn: env.VITE_SENTRY_DSN,
    datadog: {
      applicationId: env.VITE_DATADOG_APPLICATION_ID,
      clientToken: env.VITE_DATADOG_CLIENT_TOKEN,
      site: env.VITE_DATADOG_SITE || "datadoghq.com",
    },
    newRelic: {
      licenseKey: env.VITE_NEW_RELIC_LICENSE_KEY,
      applicationId: env.VITE_NEW_RELIC_APPLICATION_ID,
      accountId: env.VITE_NEW_RELIC_ACCOUNT_ID,
      trustKey: env.VITE_NEW_RELIC_TRUST_KEY || env.VITE_NEW_RELIC_ACCOUNT_ID,
      agentId: env.VITE_NEW_RELIC_AGENT_ID || env.VITE_NEW_RELIC_APPLICATION_ID,
    },
    otel: { endpoint: env.VITE_OTEL_EXPORTER_OTLP_ENDPOINT, headers: env.VITE_OTEL_EXPORTER_OTLP_HEADERS },
  };
}

/** Quais fornecedores estão configurados. */
export function fornecedoresAtivos(cfg) {
  const ativos = [];
  if (cfg.sentryDsn) ativos.push(["sentry", () => import("./sentry.ts")]);
  if (cfg.datadog.applicationId && cfg.datadog.clientToken) ativos.push(["datadog", () => import("./datadog.ts")]);
  if (cfg.newRelic.licenseKey && cfg.newRelic.applicationId) ativos.push(["newrelic", () => import("./newrelic.ts")]);
  if (cfg.otel.endpoint) ativos.push(["otel", () => import("./otel.ts")]);
  return ativos;
}

export async function iniciarObservabilidade(env: Record<string, any> = import.meta.env) {
  const cfg = lerConfig(env);
  const carregados = await Promise.allSettled(fornecedoresAtivos(cfg).map(async ([, carregar]) => (await carregar()).iniciar(cfg)));
  estado.adaptadores = carregados.filter((r) => r.status === "fulfilled").map((r) => r.value);
  estado.iniciado = true;
  if (estado.usuario) for (const a of estado.adaptadores) a.usuario(estado.usuario);
  for (const [tipo, ...args] of estado.fila.splice(0)) despachar(tipo, ...args);
  if (typeof window !== "undefined") {
    window.addEventListener("unhandledrejection", (ev) => reportarErro(ev.reason, { origem: "promise" }));
  }
  return estado.adaptadores.map((a) => a.nome);
}

function despachar(tipo, ...args) {
  for (const a of estado.adaptadores) {
    try {
      a[tipo]?.(...args);
    } catch {
      /* um fornecedor com problema não derruba o app */
    }
  }
}

function enviar(tipo, ...args) {
  if (!estado.iniciado) {
    if (estado.fila.length < 100) estado.fila.push([tipo, ...args]);
    return;
  }
  despachar(tipo, ...args);
}

export function reportarErro(erro, contexto = {}) {
  if (import.meta.env?.DEV) console.error("[zure]", erro, contexto);
  enviar("erro", erro instanceof Error ? erro : new Error(String(erro)), contexto);
}

export function registrarEvento(nome, atributos = {}) {
  enviar("evento", nome, atributos);
}

export function identificarUsuario(u) {
  estado.usuario = u ? { id: u.id, role: u.role } : null;
  enviar("usuario", estado.usuario);
}

/** Mede uma operação assíncrona: vira span no OpenTelemetry e evento com duração nos demais. */
export async function medir(nome, fn, atributos = {}) {
  const otel = estado.adaptadores.find((a) => a.span);
  const inicio = typeof performance !== "undefined" ? performance.now() : Date.now();
  try {
    return otel ? await otel.span(nome, fn, atributos) : await fn();
  } finally {
    const ms = Math.round((typeof performance !== "undefined" ? performance.now() : Date.now()) - inicio);
    for (const a of estado.adaptadores) if (a !== otel) a.evento?.(nome, { ...atributos, duracao_ms: ms });
  }
}
