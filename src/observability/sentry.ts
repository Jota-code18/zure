/* Adaptador Sentry: erros e performance. Ativo só com VITE_SENTRY_DSN. */
import * as Sentry from "@sentry/react";

export function iniciar(cfg) {
  Sentry.init({
    dsn: cfg.sentryDsn,
    environment: cfg.ambiente,
    release: cfg.versao,
    integrations: [Sentry.browserTracingIntegration()],
    tracesSampleRate: cfg.amostragem,
  });
  return {
    nome: "sentry",
    erro: (e, ctx) => Sentry.captureException(e, { extra: ctx }),
    evento: (nome, attrs) => Sentry.addBreadcrumb({ category: "zure", message: nome, data: attrs, level: "info" }),
    usuario: (u) => Sentry.setUser(u ? { id: u.id, segment: u.role } : null),
  };
}
