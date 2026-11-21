# Visão geral

Base inicial: `v0.1.0` (`SPC-0001`, clonado de `@aredes.me/mcp-dadosbr`).

Servidor MCP em TypeScript (`@aredes.me/mcp-tse`, licença `AGPL-3.0-only`, atribuições em `NOTICE.md`) para consulta de dados eleitorais públicos brasileiros do Tribunal Superior Eleitoral (TSE). Propaga a versão `0.1.0` entre `package.json`, `lib/shared/utils/constants.ts`, CLI `stdio`/`HTTP+SSE` e Cloudflare Worker (`/`, `/health`, `/openapi.json`, `/mcp`, `/sse`, `POST /tools/{toolName}`), expondo **7 ferramentas MCP** em Node.js (`^22.12.0 || ^24.0.0 || ^26.0.0`) e Cloudflare Workers.

## Fontes

- `package.json`
- `lib/shared/utils/constants.ts`
- `lib/core/mcp-server.ts`
- `lib/core/tools.ts`
- `lib/workers/worker.ts`
