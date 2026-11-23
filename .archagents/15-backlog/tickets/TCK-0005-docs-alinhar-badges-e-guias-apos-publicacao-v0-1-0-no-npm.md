---
id: TCK-0005
slug: docs-alinhar-badges-e-guias-apos-publicacao-v0-1-0-no-npm
title: "docs: alinhar badges e guias apos publicacao v0.1.0 no npm"
source: operator
created_at: 2026-11-23T16:50:53Z
created_by: ops
updated_at: 2026-11-23T17:10:13Z
status: done
severity: low
category: docs
effort: XS
flow: normal
ceremony: full
business_impact: ""
linked_findings: []
linked_designs:
  - DES-0005
linked_runs:
  - RUN-20261123-165235-npm-publish-alignment
linked_verifications:
  - VER-20261123-170927-tck-0005
linked_docs: []
external_refs: []
external_sync: []
blocks: []
blocked_by: []
related: []
acceptance:
  - check: "npm run build && npm run build:worker"
  - check: "npm test"
depth_decision:
  workflow: inline
  design: skip
  verify: lightweight
  source: routing-classifier
  classified_at: 2026-11-23T16:51:10Z
---
# TCK-0005 - docs: alinhar badges e guias apos publicacao v0.1.0 no npm

## Contexto

Criado via scripts/ops/ticket/create.py a partir de source=operator.

## Falsificador

Antes do fix (`main` @ `c81424b`): `README.md:6` exibia o badge cinza `npm-not published (v0.1.0)`, e `README.md:124-161`, `docs/README.md:17`, `docs/pt-br/README.md:20`, `docs/MCP_CLIENT_INTEGRATION.md:5`, `llms.txt:8` e `CHANGELOG.md:7` declaravam que `@aredes.me/mcp-tse` ainda não havia sido publicado no npm.

## Log de transicoes

- 2026-11-23T16:50:53Z - **raw** - criado via scripts/ops/ticket/create.py.
- 2026-11-23T16:51:10Z - **triaged** - Alinhamento pos-publicacao v0.1.0 no npm [depth_decision do routing-classifier: workflow inline, design skip, verify lightweight]
- 2026-11-23T16:52:35Z - **designed** - DES-0005 com scope_files declarado
- 2026-11-23T16:53:43Z - **executing** - Executando DES-0005 no branch chore/TCK-0005-...
- 2026-11-23T17:10:12Z - **verifying** - P10 Round 2 APROVADO (59c6de74)
- 2026-11-23T17:10:13Z - **done** - Documentacao alinhada ao npm v0.1.0, smokes e P10 verdes
