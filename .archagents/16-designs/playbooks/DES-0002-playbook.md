---
id: DES-0002-playbook
created_at: 2026-11-21T19:34:17Z
status: approved
design: DES-0002
ticket: TCK-0002
approved_at: 2026-11-21T19:34:17Z
approved_by: codex
executed_at: null
executed_runs: []
dry_run_supported: true
total_steps: 2
destructive_steps: 0
environments:
  - dev
estimated_duration: 30min-2h
branch_prefix: docs/
branch_name: docs/TCK-0002-readme-orqo-standard
commit_per_step: false
commit_message_format: "docs(TCK-0002): passo N/2 - <titulo>"
---
# Playbook - DES-0002

**Ticket:** TCK-0002
**Objetivo:** README.md padrão Orqo/mcp-dadosbr e CONTRIBUTING.md (mcp-tse)

## Pre-requisitos

- [x] Branch `docs/TCK-0002-readme-orqo-standard` criada a partir de `main`.
- [x] Código-fonte, configs, schemas, Workers e artefatos `.archagents/` auditados para zero suposições.

## Modo dry-run

`/ops-execute DES-0002 --dry-run`

## Passos

1. **Passo 1 — Autorar `CONTRIBUTING.md`:** criar guia bilíngue (PT-BR / English) alinhado ao tom de `@aredes.me/mcp-dadosbr` e fiel à arquitetura modular `lib/`, runtime Node `22.12+ | 24 | 26`, comandos de build/test/worker, fluxo `main` + PR e governança `.archagents/`.
2. **Passo 2 — Expandir `README.md` e validar gates:** reescrever `README.md` no padrão editorial Orqo/`mcp-dadosbr` (~360–430 linhas), validar âncoras/links locais, executar os 4 critérios de aceite (`criteria-check.py`), `check-scope.py` e `secret-scan.sh`.

## Criterios de sucesso do playbook

- [ ] Acceptance do ticket passa (4/4 em `criteria-check.py`).
- [ ] `check-scope.py` e `secret-scan.sh` passam sem violações.

## Log de execucoes

- *(sem execucoes ainda)*
