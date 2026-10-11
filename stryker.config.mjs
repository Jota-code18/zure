// Teste de mutação: o Stryker altera as regras de negócio (troca > por >=, + por -, etc.)
// e confere se algum teste falha. Mutante que "sobrevive" = regra sem teste de verdade.
export default {
  testRunner: "vitest",
  plugins: ["@stryker-mutator/vitest-runner"],
  vitest: { configFile: "vite.config.js", related: false },
  mutate: ["src/domain/**/*.ts", "!src/domain/**/*.test.ts", "!src/domain/demo.ts"],
  reporters: ["clear-text", "progress", "html", "json"],
  htmlReporter: { fileName: "reports/mutation/index.html" },
  jsonReporter: { fileName: "reports/mutation/mutation.json" },
  thresholds: { high: 85, low: 70, break: 60 },
  coverageAnalysis: "perTest",
  concurrency: 4,
  timeoutMS: 20000,
  tempDirName: ".stryker-tmp",
};
