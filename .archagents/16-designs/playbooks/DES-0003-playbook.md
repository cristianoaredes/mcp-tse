---
id: DES-0003-playbook
created_at: 2026-11-22T02:02:28Z
status: approved
design: DES-0003
ticket: TCK-0003
approved_at: 2026-11-22T02:02:28Z
approved_by: null
executed_at: 2026-11-22T02:07:34Z
executed_runs:
  - RUN-20261122-020300-tck-0003
dry_run_supported: true
total_steps: 3
destructive_steps: 0
environments:
  - dev
estimated_duration: 30min-2h
branch_prefix: fix/
branch_name: fix/TCK-0003-auto-cargo-election
commit_per_step: false
commit_message_format: "fix(TCK-0003): passo N/3 - <titulo>"
---
# Playbook - DES-0003

**Ticket:** TCK-0003
**Objetivo:** Defaults inteligentes por cargo (EA20) e preservação de mensagens em categorizeError

## Pre-requisitos

- [x] Branch `fix/TCK-0003-auto-cargo-election` criada a partir de `main`.
- [x] Código-fonte em `lib/shared/tse-schemas.ts`, `lib/shared/errors.ts`, `lib/tools/tse-resultados.ts` e suíte `test/unit/` auditados.

## Modo dry-run

`/ops-execute DES-0003 --dry-run`

## Passos

1. **Passo 1 — Schemas por cargo & `errors.ts`:** atualizar `lib/shared/tse-schemas.ts`, `lib/tools/tse-resultados.ts` e `lib/shared/errors.ts`.
2. **Passo 2 — Testes unitários:** cobrir defaults por cargo, preservação de parâmetros explícitos, estrito e preservação de mensagens em `test/unit/tse-tools.test.ts` e `test/unit/core-resilience-observability.test.ts`.
3. **Passo 3 — Build, Typecheck, Testes unitários e Live `StdioClientTransport`:** executar `npm run build && npm run build:worker`, `npx tsc --noEmit && npx tsc -p tsconfig.worker.json --noEmit`, `npm test` e chamadas live reais em `build/lib/bin/mcp-tse.js`.

## Criterios de sucesso do playbook

- [x] Acceptance do ticket passa (5/5 em `criteria-check.py`).
- [x] Teste live via `StdioClientTransport` em `build/lib/bin/mcp-tse.js` executado com evidência real.

## Log de execucoes

- `2026-11-22T02:07:34Z` — `RUN-20261122-020300-tck-0003` (`completed`, `pass`) — commit `7a21dc1a27e3ee71559f2cfd7a30cec68e278c4c`, `63/63` Vitest, `5/5` criteria-check, live `StdioClientTransport` OK.
