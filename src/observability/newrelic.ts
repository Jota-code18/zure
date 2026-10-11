/* Adaptador New Relic Browser. Ativo com VITE_NEW_RELIC_LICENSE_KEY + VITE_NEW_RELIC_APPLICATION_ID. */
import { BrowserAgent } from "@newrelic/browser-agent/loaders/browser-agent";

export function iniciar(cfg) {
  const nr = cfg.newRelic;
  const agente = new BrowserAgent({
    init: { distributed_tracing: { enabled: false }, privacy: { cookies_enabled: true }, ajax: { deny_list: [] } },
    info: { beacon: "bam.nr-data.net", errorBeacon: "bam.nr-data.net", licenseKey: nr.licenseKey, applicationID: nr.applicationId, sa: 1 },
    loader_config: { accountID: nr.accountId, trustKey: nr.trustKey, agentID: nr.agentId, licenseKey: nr.licenseKey, applicationID: nr.applicationId },
  });
  agente.setCustomAttribute("ambiente", cfg.ambiente);
  agente.setCustomAttribute("versao", cfg.versao);
  return {
    nome: "newrelic",
    erro: (e, ctx) => agente.noticeError(e, ctx),
    evento: (nome, attrs) => agente.addPageAction(nome, attrs),
    usuario: (u) => {
      agente.setUserId(u ? u.id : null);
      agente.setCustomAttribute("role", u ? u.role : null);
    },
  };
}
