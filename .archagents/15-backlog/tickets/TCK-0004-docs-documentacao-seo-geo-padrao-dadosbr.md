---
id: TCK-0004
slug: docs-documentacao-seo-geo-padrao-dadosbr
title: "docs: documentação SEO/GEO padrão DadosBR"
source: operator
created_at: 2026-11-23T13:15:10Z
created_by: ops
updated_at: 2026-11-23T13:36:41Z
status: done
severity: low
category: docs
effort: M
flow: normal
ceremony: full
business_impact: ""
linked_findings: []
linked_designs:
  - DES-0004
linked_runs:
  - RUN-20261123-131628-seo-geo-docs
linked_verifications:
  - VER-20261123-133548-tck-0004
linked_docs: []
external_refs: []
external_sync: []
blocks: []
blocked_by: []
related: []
acceptance:
  - check: "npm test"
  - check: "npm run build && npm run build:worker"
depth_decision:
  workflow: lightweight
  design: lightweight
  verify: completo
  source: routing-classifier
  classified_at: 2026-11-23T13:15:48Z
---
# TCK-0004 - docs: documentação SEO/GEO padrão DadosBR

## Contexto

Criado via scripts/ops/ticket/create.py a partir de source=operator.

## Falsificador

Antes do fix na `main` (`58b4c37`): `npm view @aredes.me/mcp-tse version` retorna `404 Not Found` enquanto o `README.md` anterior instruía instalação via `npx -y @aredes.me/mcp-tse`; `README.md:70-72` listava `ele2026/6257` fixo para todos os cargos em vez dos padrões por cargo entregues no `TCK-0003` (`ele2024/619` municipal, `ele2026/6259` estadual, `ele2026/6257` presidencial); e `docs/`, `CHANGELOG.md` e `llms.txt` inexistiam no repositório.

## Log de transicoes

- 2026-11-23T13:15:10Z - **raw** - criado via scripts/ops/ticket/create.py.
- 2026-11-23T13:15:48Z - **triaged** - Auditoria README vs codigo (defaults por cargo TCK-0003, npm ainda nao publicado), criacao docs/, CHANGELOG.md, llms.txt, FAQ SEO/GEO e package.json. [triagem: severity low→low, category docs→docs, effort M→M] [depth_decision do routing-classifier: workflow lightweight, design lightweight, verify completo]
- 2026-11-23T13:15:49Z - **linked** - links updated
- 2026-11-23T13:16:28Z - **designed** - DES-0004 com scope_files completo para docs SEO/GEO.
- 2026-11-23T13:16:28Z - **executing** - DES-0004-playbook criado; branch docs/TCK-0004-seo-geo-docs exigida pelo plano aprovado.
- 2026-11-23T13:36:40Z - **verifying** - Independent P10 Round 2 verification 81e99096 PASS/APPROVED + VER-20261123-133548-tck-0004
- 2026-11-23T13:36:41Z - **done** - Docs SEO/GEO, CHANGELOG, llms.txt, README audit, cargo defaults TCK-0003 e npm-unpublished verified
