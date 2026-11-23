---
id: DES-0004-playbook
created_at: 2026-11-23T13:16:00Z
status: approved
design: DES-0004
ticket: TCK-0004
approved_at: 2026-11-23T13:16:00Z
approved_by: antigravity
executed_at: null
executed_runs: []
dry_run_supported: true
total_steps: 5
destructive_steps: 0
environments:
  - dev
estimated_duration: 15min-45min
branch_prefix: docs/
branch_name: docs/TCK-0004-seo-geo-docs
commit_per_step: false
commit_message_format: "docs(TCK-0004): passo N/5 - <titulo>"
---
# Playbook - DES-0004

**Ticket:** TCK-0004
**Objetivo:** docs: documentação SEO/GEO padrão DadosBR (mcp-tse)

## Pre-requisitos

- [x] Branch `docs/TCK-0004-seo-geo-docs` criada a partir de `main`.
- [x] Escopo `DES-0004` declarado (`README.md`, `package.json`, `CHANGELOG.md`, `llms.txt`, `docs/*`).

## Passos

1. **Passo 1 — Auditoria e atualização de `README.md`:** incluir aviso explícito de npm ainda não publicado, documentar os defaults por cargo introduzidos em `TCK-0003` (`ele2024/619` municipais, `ele2026/6259` estaduais, `ele2026/6257` federais vs `ele2026/6257` fixo em `tse_comparecimento_abstencao`), atualizar contagem de testes (`13/13`, `63/63`), reforçar definição de entidade + FAQ SEO/GEO e links para `docs/`, `CHANGELOG.md`, `llms.txt`.
2. **Passo 2 — Criação de `docs/`:** criar `docs/README.md`, `docs/CONFIGURATION.md`, `docs/MCP_CLIENT_INTEGRATION.md`, `docs/USAGE_EXAMPLES.md` (com saídas reais observadas via stdio) e `docs/pt-br/README.md`.
3. **Passo 3 — Criação de `CHANGELOG.md` e `llms.txt`:** documentar `[Unreleased]` (`TCK-0003`, `TCK-0004`) e `[0.1.0]` (`TCK-0001`, `TCK-0002`) e criar `llms.txt` (7 ferramentas).
4. **Passo 4 — Metadados `package.json` & GitHub:** revisar `description` e `keywords` em `package.json` (`mcp-server`, `claude`, `cursor`, `ai-agents`, `dados-abertos` etc.).
5. **Passo 5 — Verificação & P10:** executar `tsc --noEmit && tsc -p tsconfig.worker.json --noEmit`, `npm run build && npm run build:worker`, `npm test`, `npm run test:transport`, validar links/âncoras/contagens, rodar P10 verifier e registrar RUN/VER.
