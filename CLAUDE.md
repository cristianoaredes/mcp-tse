# Governança codebase-ops

Leia [AGENTS.md](AGENTS.md) e o [índice do projeto](.archagents/README.md) antes de executar ações.

# CLAUDE.md

Guidance for AI agents and developers working in `@aredes.me/mcp-tse`.

## Project Overview

`@aredes.me/mcp-tse` (`v0.1.0`) is a Model Context Protocol (MCP) server for Brazilian electoral data from the Tribunal Superior Eleitoral (TSE):
- **TSE Resultados (EA20 static JSON):** election catalog (`ele-c.json`), municipality/zone lookup (`mun-e*-cm.json`), office vote tallies (`-u.json`), candidate search (`-u.json`), party/federation summaries (`-u.json`), and turnout/abstention (`-ab.json`).
- **TSE Dados Abertos (CKAN APIv3):** dataset search and package inspection (`package_search` / `package_show`) pointing to CSV/ZIP downloads on `cdn.tse.jus.br`.

Supports **Node.js** (`stdio` and `HTTP/SSE`) and **Cloudflare Workers** (`/`, `/health`, `/mcp`, `/sse`, `/openapi.json`, `POST /tools/{toolName}`) from a single Web-standard codebase.

## Common Commands

```bash
npm install
npm run build             # Compile Node.js build/
npm run build:worker      # Compile Cloudflare Worker build/
npx tsc --noEmit          # Type-check Node.js target
npx tsc -p tsconfig.worker.json --noEmit
npm test                  # Run Vitest unit suite
npm run test:coverage     # Run Vitest with v8 coverage (85/85/80/85 thresholds)
npm run test:transport    # Run stdio (101 offline calls) + HTTP/SSE integration test
```

## Architecture & Security Boundaries

- **7 Read-Only Tools (No API Key Required):**
  1. `tse_eleicoes_catalogo`
  2. `tse_municipios_zonas`
  3. `tse_apuracao_cargo`
  4. `tse_candidatos_busca`
  5. `tse_partidos_federacoes`
  6. `tse_comparecimento_abstencao`
  7. `tse_dados_abertos_datasets`
- **Web-Standard Core (`lib/shared/`, `lib/tools/`):** Zero `node:*` imports so `tsconfig.worker.json` builds cleanly.
- **SSRF Allowlists (`lib/config/index.ts`):** Only allowlisted TSE HTTPS hosts (`resultados.tse.jus.br`, `dadosabertos.tse.jus.br`, `cdn.tse.jus.br`); loopback HTTP(S) allowed only in `development`/`test`; embedded URL credentials rejected.
- **Upstream WAF Policy:** `divulgacandcontas.tse.jus.br` returns HTTP `403` (Akamai WAF) and is **never** queried or bypassed; `tse_dados_abertos_datasets` exposes `upstream_waf_notice` directing users to open CKAN/CDN packages and `@aredes.me/mcp-dadosbr` (`cnpj_lookup`) for cross-referencing corporate donors/suppliers.
- **LGPD Art. 20 Notice:** Nominal candidate/result payloads include `lgpd_notice: HOMONYM_HUMAN_REVIEW_NOTICE` and untrusted strings are sanitized via `sanitizeUntrustedText` (`UNTRUSTED_EXTERNAL_DATA_NOTICE`).
- **Stdio Framing:** All logging writes strictly to `stderr` (`console.error`) so `stdout` carries only MCP JSON-RPC frames.
