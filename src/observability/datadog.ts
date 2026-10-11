/* Adaptador Datadog RUM. Ativo com VITE_DATADOG_APPLICATION_ID + VITE_DATADOG_CLIENT_TOKEN. */
import { datadogRum } from "@datadog/browser-rum";

export function iniciar(cfg) {
  datadogRum.init({
    applicationId: cfg.datadog.applicationId,
    clientToken: cfg.datadog.clientToken,
    site: cfg.datadog.site,
    service: cfg.servico,
    env: cfg.ambiente,
    version: cfg.versao,
    sessionSampleRate: 100,
    sessionReplaySampleRate: 0,
    trackUserInteractions: true,
    trackResources: true,
    trackLongTasks: true,
    defaultPrivacyLevel: "mask-user-input",
  });
  return {
    nome: "datadog",
    erro: (e, ctx) => datadogRum.addError(e, ctx),
    evento: (nome, attrs) => datadogRum.addAction(nome, attrs),
    usuario: (u) => (u ? datadogRum.setUser({ id: u.id, role: u.role }) : datadogRum.clearUser()),
  };
}
