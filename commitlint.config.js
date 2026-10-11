export default {
  extends: ["@commitlint/config-conventional"],
  rules: {
    // Mensagens em português são bem-vindas; só exigimos o formato "tipo(escopo): descrição".
    "subject-case": [0],
    "body-max-line-length": [1, "always", 120],
  },
};
