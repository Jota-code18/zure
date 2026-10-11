/** "chave=valor,chave2=valor2" → objeto de headers (formato padrão do OTEL_EXPORTER_OTLP_HEADERS). */
export function lerHeaders(texto?: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const par of String(texto || "").split(",")) {
    const i = par.indexOf("=");
    if (i > 0) out[par.slice(0, i).trim()] = par.slice(i + 1).trim();
  }
  return out;
}
