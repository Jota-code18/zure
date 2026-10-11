/* Adaptador OpenTelemetry (traces via OTLP/HTTP). Ativo com VITE_OTEL_EXPORTER_OTLP_ENDPOINT.
 * Serve para qualquer backend compatível: Grafana, Honeycomb, Datadog Agent, New Relic OTLP, Jaeger... */
import { trace } from "@opentelemetry/api";
import { OTLPTraceExporter } from "@opentelemetry/exporter-trace-otlp-http";
import { registerInstrumentations } from "@opentelemetry/instrumentation";
import { DocumentLoadInstrumentation } from "@opentelemetry/instrumentation-document-load";
import { FetchInstrumentation } from "@opentelemetry/instrumentation-fetch";
import { resourceFromAttributes } from "@opentelemetry/resources";
import { BatchSpanProcessor, WebTracerProvider } from "@opentelemetry/sdk-trace-web";
import { ATTR_SERVICE_NAME, ATTR_SERVICE_VERSION } from "@opentelemetry/semantic-conventions";
import { lerHeaders } from "./headers.ts";

export function iniciar(cfg) {
  const provider = new WebTracerProvider({
    resource: resourceFromAttributes({
      [ATTR_SERVICE_NAME]: cfg.servico,
      [ATTR_SERVICE_VERSION]: cfg.versao,
      "deployment.environment": cfg.ambiente,
    }),
    spanProcessors: [new BatchSpanProcessor(new OTLPTraceExporter({ url: cfg.otel.endpoint, headers: lerHeaders(cfg.otel.headers) }))],
  });
  provider.register();
  registerInstrumentations({
    instrumentations: [new DocumentLoadInstrumentation(), new FetchInstrumentation({ propagateTraceHeaderCorsUrls: [] })],
  });
  const tracer = trace.getTracer(cfg.servico, cfg.versao);
  let usuario = null;
  return {
    nome: "otel",
    erro: (e, ctx) => {
      const span = tracer.startSpan("erro");
      span.recordException(e);
      span.setAttributes({ ...achatar(ctx), ...(usuario ? { "user.id": usuario.id, "user.role": usuario.role } : {}) });
      span.setStatus({ code: 2, message: String(e?.message || e) });
      span.end();
    },
    evento: (nome, attrs) => {
      const span = tracer.startSpan(nome);
      span.setAttributes(achatar(attrs));
      span.end();
    },
    usuario: (u) => {
      usuario = u ? { id: u.id, role: u.role } : null;
    },
    span: (nome, fn, attrs) =>
      tracer.startActiveSpan(nome, async (span) => {
        span.setAttributes(achatar(attrs));
        try {
          return await fn();
        } catch (e) {
          span.recordException(e);
          span.setStatus({ code: 2 });
          throw e;
        } finally {
          span.end();
        }
      }),
  };
}

function achatar(o) {
  const out = {};
  for (const [k, v] of Object.entries(o || {})) if (v != null) out[k] = typeof v === "object" ? JSON.stringify(v) : v;
  return out;
}
