# Mapa de módulos

Base inicial: `v0.1.0` (`SPC-0001`).

- `lib/bin/mcp-tse.ts` & `lib/index.ts`: binário CLI e exportações públicas da biblioteca.
- `lib/config/`: configuração de APIs TSE (`index.ts`) com proteção SSRF e timeouts centralizados (`timeouts.ts`).
- `lib/core/`: servidor MCP enxuto (`mcp-server.ts`, <=180 linhas), registro Zod (`registry.ts`), orquestração e métricas RED (`tools.ts`), schemas de validação (`tool-schemas.ts`), cliente HTTP com retry/circuit-breaker (`http-client.ts`) e cache (`cache.ts`).
- `lib/tools/`: implementação das 7 ferramentas TSE (`tse-resultados.ts`, `tse-ckan.ts`) e barrel de registro (`index.ts`).
- `lib/shared/`: schemas Zod `.strict()` (`tse-schemas.ts`), sanitização agêntica (`agentic-guard.ts`), avisos LGPD (`compliance-notices.ts`), redação de logs (`log-redaction.ts`), erros (`errors.ts`), `Result` (`types/result.ts`), utilitários (`utils/constants.ts`, `utils/timeout.ts`) — zero imports `node:*`.
- `lib/infrastructure/`: logger JSON em `stderr` (`logger.ts`), rate limiter em memória (`rate-limiter.ts`), correlação Web Crypto (`tracing.ts`) e circuit breaker (`http/circuit-breaker.ts`).
- `lib/adapters/` & `lib/workers/`: adapters Node (`cli.ts`, `cli-http.ts`) e Cloudflare Workers (`cloudflare.ts`, `worker.ts`, `rest.ts`, `sse.ts`, `openapi.ts`, `auth.ts`, `oauth.ts`, `rate-limit.ts`, `types.ts`).

## Fontes

- `lib/tools/index.ts`
- `lib/core/registry.ts`
- `lib/core/mcp-server.ts`
- `lib/shared/tse-schemas.ts`
- `lib/workers/worker.ts`
