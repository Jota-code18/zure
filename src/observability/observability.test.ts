import { describe, expect, it, vi } from "vitest";

describe("observabilidade", () => {
  it("cada fornecedor só liga com as próprias variáveis", async () => {
    const { fornecedoresAtivos, lerConfig } = await import("./index.ts");
    expect(fornecedoresAtivos(lerConfig({}))).toEqual([]);
    const tudo = lerConfig({
      VITE_SENTRY_DSN: "https://x@o.ingest.sentry.io/1",
      VITE_DATADOG_APPLICATION_ID: "app",
      VITE_DATADOG_CLIENT_TOKEN: "tok",
      VITE_NEW_RELIC_LICENSE_KEY: "lic",
      VITE_NEW_RELIC_APPLICATION_ID: "123",
      VITE_OTEL_EXPORTER_OTLP_ENDPOINT: "https://otel.exemplo/v1/traces",
      VITE_APP_VERSION: "abc1234",
    });
    expect(fornecedoresAtivos(tudo).map(([n]) => n)).toEqual(["sentry", "datadog", "newrelic", "otel"]);
    expect(tudo.versao).toBe("abc1234");
    expect(tudo.newRelic.agentId).toBe("123");
    expect(lerConfig({ VITE_DATADOG_APPLICATION_ID: "só id" }).datadog.site).toBe("datadoghq.com");
    expect(fornecedoresAtivos(lerConfig({ VITE_DATADOG_APPLICATION_ID: "só id" }))).toEqual([]);
  });

  it("guarda eventos até iniciar e não quebra sem fornecedores", async () => {
    vi.resetModules();
    const obs = await import("./index.ts");
    obs.registrarEvento("antes.de.iniciar");
    obs.identificarUsuario({ id: "u", role: "barbeiro" });
    const erro = vi.spyOn(console, "error").mockImplementation(() => {});
    obs.reportarErro("texto vira Error");
    expect(await obs.iniciarObservabilidade({})).toEqual([]);
    expect(await obs.medir("soma", async () => 1 + 1)).toBe(2);
    await expect(obs.medir("falha", async () => Promise.reject(new Error("x")))).rejects.toThrow("x");
    erro.mockRestore();
  });

  it("headers OTLP no formato chave=valor", async () => {
    const { lerHeaders } = await import("./headers.ts");
    expect(lerHeaders("api-key=abc, x-y = 1,invalido")).toEqual({ "api-key": "abc", "x-y": "1" });
    expect(lerHeaders(undefined)).toEqual({});
  });
});
