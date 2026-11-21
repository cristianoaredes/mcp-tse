---
id: DES-0001-playbook
created_at: 2026-11-21T17:58:01Z
status: approved
design: DES-0001
ticket: TCK-0001
approved_at: 2026-11-21T17:58:01Z
approved_by: cristiano
executed_at: null
executed_runs: []
dry_run_supported: true
total_steps: 4
destructive_steps: 0
environments:
  - dev
estimated_duration: 30min-2h
branch_prefix: feat/
branch_name: feat/TCK-0001-v0.1.0-catalog
commit_per_step: false
commit_message_format: "feat(TCK-0001): passo N/4 - <titulo>"
---
# Playbook - DES-0001

**Ticket:** TCK-0001
**Objetivo:** [SPC-0001] Implementação inicial mcp-tse v0.1.0 (7 tools Worker-safe EA20 + CKAN)

## Pre-requisitos

- [x] Scaffold bootstrap e governança na branch `main` (`SPC-0001` DoR pass, `npm install`, `secret-scan.sh`).
- [ ] Checkout da branch `feat/TCK-0001-v0.1.0-catalog`.

## Passos

1. **Passo 1 — Core, Config SSRF e Adapters Dual-Runtime:** implementar `lib/bin/`, `lib/index.ts`, `lib/types/`, `lib/config/`, `lib/shared/`, `lib/infrastructure/`, `lib/core/`, `lib/adapters/` e `lib/workers/`.
2. **Passo 2 — 7 Ferramentas TSE EA20 & CKAN:** implementar `lib/shared/tse-schemas.ts`, `lib/tools/tse-resultados.ts`, `lib/tools/tse-ckan.ts` e `lib/tools/index.ts`.
3. **Passo 3 — Testes Unitários, Cobertura & Transportes:** implementar suíte `test/unit/*.test.ts` (>=88% cobertura) e `test/integration/transports.mjs`.
4. **Passo 4 — Documentação, Gates & Transição:** atualizar docs/governança, executar build/tsc/coverage/transports/gates/secret-scan e transicionar `TCK-0001` para `verifying`.

## Criterios de sucesso do playbook

- [ ] Acceptance do ticket passa (5/5 em `criteria-check.py`).
- [ ] `verify-tool-allowlist.py` retorna `violations_count: 0`.
- [ ] `secret-scan.sh` passa limpo.
