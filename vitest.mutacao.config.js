// Configuração usada só pelo Stryker: roda apenas os testes unitários das regras de negócio,
// que são os que devem "matar" mutantes em src/domain (rápidos, sem DOM).
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["src/domain/**/*.test.ts"],
  },
});
