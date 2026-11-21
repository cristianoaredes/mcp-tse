---
id: TCK-0001
slug: spc-0001-implementacao-inicial-mcp-tse-v0-1-0-7-tools-worker-safe-ea20-ckan
title: "[SPC-0001] Implementação inicial mcp-tse v0.1.0 (7 tools Worker-safe EA20 + CKAN)"
source: spec
created_at: 2026-11-21T17:57:29Z
created_by: ops
updated_at: 2026-11-21T17:58:54Z
status: designed
severity: medium
category: feature
effort: M
flow: normal
ceremony: full
business_impact: ""
linked_findings: []
linked_designs:
  - DES-0001
linked_runs: []
linked_verifications: []
linked_docs:
  - .archagents/12-inception/specs/SPC-0001-mcp-tse-v010-catalog.md
external_refs: []
external_sync: []
blocks: []
blocked_by: []
related: []
acceptance:
  - check: "npm run build && npm run build:worker"
  - check: "node -e \"import('./build/lib/core/tools.js').then(m => { const names = m.TOOL_DEFINITIONS.map(t => t.name); if (names.length !== 7) process.exit(1); console.log('TOOLS_OK:' + names.length); })\""
    expect: TOOLS_OK:7
  - check: "node -e \"import('node:fs').then(fs => { const allow = JSON.parse(fs.readFileSync('.archagents/mcp-tool-allowlist.json','utf8')); const pkg = JSON.parse(fs.readFileSync('package.json','utf8')); if (pkg.version !== '0.1.0' || allow.entries.length !== 7) process.exit(1); console.log('ALLOWLIST_AND_VERSION_OK'); })\""
    expect: ALLOWLIST_AND_VERSION_OK
  - check: "npx vitest run --coverage"
  - check: "npm run test:transport"
linked_spec: SPC-0001
security_sensitive: true
---
# TCK-0001 - [SPC-0001] Implementação inicial mcp-tse v0.1.0 (7 tools Worker-safe EA20 + CKAN)

## Contexto

Implementação inicial do servidor MCP `@aredes.me/mcp-tse` (`v0.1.0`) a partir do molde endurecido `@aredes.me/mcp-dadosbr` (`SPC-0001`, `DSC-0001`, `BRF-0001`), expondo **7 ferramentas** read-only Worker-safe sobre `resultados.tse.jus.br` (EA20) e `dadosabertos.tse.jus.br` (CKAN), com paridade Node (`stdio` / `HTTP+SSE`) e Cloudflare Workers (`/`, `/health`, `/mcp`, `/sse`, `/openapi.json`, `POST /tools/{toolName}`).

## Falsificador

Antes desta implementação, o repositório contém apenas o scaffold de governança (`lib/`, `test/` e `build/` ainda inexistentes), fazendo `npm run build && npm run build:worker`, `npx vitest run --coverage` e `npm run test:transport` falharem.

## Log de transicoes

- 2026-11-21T17:57:29Z - **raw** - criado via scripts/ops/ticket/create.py.
- 2026-11-21T17:58:01Z - **triaged** - SPC-0001 DoR pass; security_sensitive full ceremony
- 2026-11-21T17:58:54Z - **designed** - DES-0001 approved with Threat Model and file scope
