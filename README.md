# Zure Barbearia · Gestão total

App interno da Zure Barbearia: caixa (lançamentos), metas e plano de carreira, comissões e carteira semanal,
clientes e fiados, estoque, ponto, caixa cego e DRE. Funciona no celular (instalável como app) e no computador.

## Como funciona

| Camada | Pasta | O que faz |
| --- | --- | --- |
| Regras de negócio | `src/domain` | Comissão por nível, metas, carteira, DRE, permissões. TypeScript puro, 100% testado. |
| Dados | `src/data` | Supabase (Postgres + RLS + Realtime + Storage) ou backend em memória (demonstração e testes). |
| Interface | `src/ui` | Componentes, skeletons, motion e toasts. |
| Telas | `src/features` | Lançar, Metas, Meu dia, Gestão, Clientes, Ajustes. |
| Casca | `src/app` | Login, navegação responsiva (menu inferior no celular, lateral no desktop). |
| Observabilidade | `src/observability` | Sentry, Datadog RUM, New Relic e OpenTelemetry, todos opcionais. |

As fronteiras entre camadas são verificadas pelo `arch-contract` (`arch-contract.yaml`).

### Regras importantes

- **Fiado** não entra em faturamento, comissão nem bônus até ser pago (entra na data do pagamento). Conta nas metas.
- **Carteira**: o saldo de cada semana continua disponível nas semanas seguintes, marcado com o período. O saque registra quanto saiu de cada semana.
- **Lançar para outro barbeiro** é permitido e fica registrado (quem lançou + histórico).
- **Barbeiros** não veem faturamento dos colegas, ranking com valores, lucro da casa, custos nem o histórico (garantido pelo banco, não só pela tela).
- **Correção e exclusão**: o dono corrige/exclui qualquer lançamento; o barbeiro exclui só os de hoje que atendeu ou lançou. Exclusão é lógica (pode ser desfeita) e devolve o estoque. Tudo fica na aba Gestão › Histórico.
- **Não existe "apagar tudo"** e a **demonstração** roda só na memória do navegador ("Ver demonstração" na tela de entrada).

## Rodar localmente

```bash
npm install
cp .env.example .env.local   # preencha VITE_SUPABASE_URL e VITE_SUPABASE_PUBLISHABLE_KEY
npm run dev
```

Sem as variáveis do Supabase o app abre só no modo demonstração.

## Banco de dados (Supabase)

1. Rode `supabase/migrations/20261011000000_inicial.sql` no SQL Editor do projeto (ou `npx supabase db push`).
2. Cadastre o primeiro dono como convite (troque o e-mail):
   ```sql
   insert into public.convites (email, nome, role, extra)
   values ('email-do-dono@exemplo.com', 'Gustavo', 'admin',
           '{"entrada":"09:00","precos":{"corte":65},"metaAtendSemana":20,"metaAtendMes":80,"metaProdSemana":150,"metaProdMes":600,"plano":{"tiers":[]}}');
   ```
3. O dono abre o app › **Primeiro acesso** › cria a senha. Depois convida os barbeiros em **Ajustes › Equipe**.
4. Em **Authentication › URL Configuration**, coloque a URL da Vercel como *Site URL* (links de confirmação e de nova senha).

`npm run test:sql` aplica as migrações num Postgres real (PGlite) e testa RLS, funções e auditoria.

## Qualidade

| Comando | Ferramenta |
| --- | --- |
| `npm run lint` | Biome (lint + formatação) |
| `npm run typecheck` | TypeScript |
| `npm run knip` | Knip (código, exports e dependências sem uso) |
| `npm run arch` | arch-contract (regras de arquitetura) |
| `npm run test:coverage` | Vitest (unitários + integração) com cobertura → Codecov |
| `npm run test:sql` | Banco real (PGlite) |
| `npm run test:e2e` | Playwright em 320 px, celular, tablet e desktop |
| `npm run test:mutation` | Stryker (teste de mutação das regras de negócio) |
| `npm run check` | Tudo acima, menos e2e e mutação |

Commits seguem o padrão Conventional Commits (verificado pelo commitlint no `commit-msg`). O GitHub Actions roda tudo
em cada push/PR (`.github/workflows/ci.yml`) e a mutação toda segunda (`mutacao.yml`).

## Observabilidade

Cada fornecedor liga sozinho quando suas variáveis existem (veja `.env.example`) e o SDK só é baixado nesse caso.
Nunca são enviados nomes de clientes, e-mails ou valores digitados: só ids, papel (dono/barbeiro) e nomes de eventos.

## Deploy (Vercel)

Importe o repositório na Vercel (framework Vite) e configure `VITE_SUPABASE_URL` e `VITE_SUPABASE_PUBLISHABLE_KEY`.
O `vercel.json` já traz rotas do SPA, cache dos assets e cabeçalhos de segurança (CSP, HSTS, etc.).
