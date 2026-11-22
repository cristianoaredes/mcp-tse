---
id: TCK-0003
slug: defaults-inteligentes-por-cargo-e-preservacao-de-mensagens-em-categorizeerror
title: "Defaults inteligentes por cargo e preservação de mensagens em categorizeError"
source: bug
created_at: 2026-11-22T02:02:10Z
created_by: ops
updated_at: 2026-11-22T02:08:20Z
status: verifying
severity: medium
category: bug
effort: S
flow: normal
ceremony: full
business_impact: ""
linked_findings: []
linked_designs:
  - DES-0003
linked_runs:
  - RUN-20261122-020300-tck-0003
linked_verifications: []
linked_docs: []
external_refs: []
external_sync: []
blocks: []
blocked_by: []
related: []
acceptance:
  - check: "node -e \"import('./build/lib/shared/tse-schemas.js').then(m => { const g = m.TseApuracaoCargoSchema.parse({ cargo: 'governador', uf: 'SP' }); const p = m.TseApuracaoCargoSchema.parse({ cargo: 'prefeito', uf: 'SP', codigo_tse_municipio: '71072' }); const pr = m.TseApuracaoCargoSchema.parse({ cargo: 'presidente' }); if (g.ciclo !== 'ele2026' || g.codigo_eleicao !== '6259' || p.ciclo !== 'ele2024' || p.codigo_eleicao !== '619' || pr.ciclo !== 'ele2026' || pr.codigo_eleicao !== '6257') process.exit(1); console.log('CARGO_DEFAULTS_OK'); })\""
    expect: CARGO_DEFAULTS_OK
  - check: "node -e \"import('./build/lib/shared/errors.js').then(m => { const e1 = m.categorizeError(new Error('Municipality 71072 not found')); const e2 = m.categorizeError(new Error('Request timed out after 8000ms')); if (e1.message !== 'Municipality 71072 not found' || e2.message !== 'Request timed out after 8000ms') process.exit(1); console.log('ERROR_MESSAGES_OK'); })\""
    expect: ERROR_MESSAGES_OK
  - check: "npm run build && npm run build:worker"
  - check: "npx tsc --noEmit && npx tsc -p tsconfig.worker.json --noEmit"
  - check: "npm test"
depth_decision:
  workflow: inline
  design: skip
  verify: lightweight
  source: routing-classifier
  classified_at: 2026-11-22T02:02:19Z
---
# TCK-0003 - Defaults inteligentes por cargo e preservação de mensagens em categorizeError

## Contexto

Criado via scripts/ops/ticket/create.py a partir de source=bug.

## Falsificador

Antes do fix, em `lib/shared/tse-schemas.ts:41-53`, `cicloSchema` e `codigoEleicaoSchema` aplicam defaults fixos (`ele2026` / `6257`) para todos os cargos: `npx tsx -e "import { TseApuracaoCargoSchema } from './lib/shared/tse-schemas.ts'; console.log(TseApuracaoCargoSchema.parse({ cargo: 'governador', uf: 'SP' }), TseApuracaoCargoSchema.parse({ cargo: 'prefeito', uf: 'SP', codigo_tse_municipio: '71072' }))"` retorna `codigo_eleicao: '6257'` e `ciclo: 'ele2026'` em ambos (em vez de `ele2026`/`6259` e `ele2024`/`619`). Além disso, em `lib/shared/errors.ts:122-124,156-158`, `categorizeError(new Error('Municipality 99999 not found')).message` retorna `'resource not found: unknown'` e `categorizeError(new Error('Request timed out after 8000ms')).message` retorna `"Operation 'operation' timed out after 30000ms"`, descartando `error.message`.

## Log de transicoes

- 2026-11-22T02:02:10Z - **raw** - criado via scripts/ops/ticket/create.py.
- 2026-11-22T02:02:19Z - **noted** - body:falsifier (replace): Registrar evidencia reproduzida antes do fix (Stage 1B)
- 2026-11-22T02:02:19Z - **triaged** - Bug triaged: medium severity, S effort, 5 executable acceptance criteria validated [depth_decision do routing-classifier: workflow inline, design skip, verify lightweight]
- 2026-11-22T02:03:00Z - **designed** - DES-0003 approved with file scope for cargo defaults and errors.ts
- 2026-11-22T02:03:09Z - **executing** - Start executing DES-0003 on fix/TCK-0003-auto-cargo-election
- 2026-11-22T02:08:20Z - **verifying** - All 5 acceptance criteria pass, 13/13 Vitest suites (63/63 tests, 96.88% stmts), build+worker & tsc --noEmit (Node+Worker) pass, transport smoke & live StdioClientTransport pass; ready for P10 independent verify.
