---
id: ADR-0001
title: "Paridade dual-runtime Node.js (stdio/HTTP+SSE) e Cloudflare Worker sem imports node:* no núcleo compartilhado"
status: accepted
date: 2026-11-21
deciders: cristiano
tickets:
  - TCK-0001
supersedes: []
---
# ADR-0001 — Paridade dual-runtime Node.js (stdio/HTTP+SSE) e Cloudflare Worker sem imports node:* no núcleo compartilhado

## Contexto

O `@aredes.me/mcp-tse` (`v0.1.0`) nasce clonando a arquitetura endurecida de `@aredes.me/mcp-dadosbr` (`v0.7.0`). Precisa executar identicamente:
1. Em **Node.js CLI** (`stdio` e `HTTP/SSE` via `express` + `@modelcontextprotocol/sdk`).
2. Em **Cloudflare Workers** (`HTTP JSON-RPC`, `SSE`, `OpenAPI 3.0` e `POST /tools/{toolName}`), respeitando o limite de 128 MB de RAM e compilando via `tsconfig.worker.json` sem APIs exclusivas de Node.js nos módulos de ferramentas e servidor MCP.

## Decisão

1. **Núcleo Web-standard acíclico:** `lib/shared/`, `lib/tools/`, `lib/core/` (`mcp-server.ts`, `registry.ts`, `tools.ts`, `tool-schemas.ts`, `http-client.ts`, `cache.ts`) e `lib/infrastructure/` (`logger.ts`, `rate-limiter.ts`, `tracing.ts`, `http/circuit-breaker.ts`) utilizam exclusivamente APIs Web-standard (`fetch`, `URL`, `AbortController`, `globalThis.crypto`), sem qualquer import `node:*`.
2. **Separação de entrada Node vs. Worker:**
   - `lib/config/index.ts` lê `.mcprc.json` somente no runtime Node (usando `readFileSync`), enquanto `tsconfig.worker.json` usa `nodejs_compat` com fallback seguro quando o arquivo não existe no Worker.
   - `lib/adapters/cli.ts` e `lib/adapters/cli-http.ts` isolam Node `http`, `node:crypto` e `AsyncLocalStorage`.
   - `lib/adapters/cloudflare.ts` e `lib/workers/*` expõem o catálogo completo de **7 tools** e roteamento genérico `POST /tools/{toolName}` com `KVCache` (`expirationTtl >= 60s`).
3. **Fonte única de versão e schemas:** `SERVER.VERSION = "0.1.0"` em `lib/shared/utils/constants.ts` e schemas `.strict()` em `lib/shared/tse-schemas.ts` alimentam simultaneamente `TOOL_SCHEMAS`, `TOOL_DEFINITIONS`, OpenAPI e eventos SSE.

## Alternativas descartadas

- **Implementar dois conjuntos separados de tools (Node vs. Worker):** descartada por duplicação e risco de deriva de validação/sanitização.
- **Usar dumps volumosos do TSE em disco/SQLite no servidor MCP:** descartada para o `v0.1.0` porque excederia a memória do Cloudflare Worker; `tse_dados_abertos_datasets` expõe os metadados CKAN e links `cdn.tse.jus.br` sob demanda.

## Consequências

- **Positivas:** paridade verificada por `tsc --noEmit`, `tsc -p tsconfig.worker.json --noEmit`, Vitest e `test:transport` em `stdio` + `HTTP/SSE`.
- **Trade-offs:** execução em produção no edge Cloudflare Workers permanece *a confirmar* após provisionamento de KV namespaces reais.

## Evidências

- `lib/core/mcp-server.ts`
- `lib/core/tool-schemas.ts`
- `lib/shared/tse-schemas.ts`
- `lib/tools/tse-resultados.ts`
- `lib/tools/tse-ckan.ts`
- `lib/adapters/cloudflare.ts`
- `lib/workers/rest.ts`
- `lib/workers/worker.ts`
