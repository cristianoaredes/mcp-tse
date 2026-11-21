# Operação local

Base inicial: `v0.1.0` (`SPC-0001`).

Execute `npm install`, `npm run build`, `npm run build:worker`, `npm run test:coverage` e `npm run test:transport`. O smoke exige handshake, ping, catálogo de 7 ferramentas, `listResources` vazio e 101 chamadas offline em `stdio` sem erro de protocolo. O deploy em Cloudflare Workers (`wrangler deploy`) deve ocorrer somente após provisionamento de namespaces KV reais e autorização do operador.

## Fontes

- `package.json`
- `test/integration/transports.mjs`
- `lib/infrastructure/logger.ts`
- `lib/infrastructure/tracing.ts`
- `lib/core/tools.ts`
- `lib/adapters/cloudflare.ts`
- `lib/workers/auth.ts`

## Observabilidade, Logs Estruturados e Métricas RED

- **Logs JSON em `stderr` (`lib/infrastructure/logger.ts`):** todos os níveis escrevem em `console.error` preservando `stdout` exclusivo para JSON-RPC no transporte `stdio`.
- **Correlação `X-Request-Id` (`lib/infrastructure/tracing.ts`):** IDs gerados via Web Crypto (`globalThis.crypto.randomUUID()` / `getRandomValues()`), propagados no Worker e via `AsyncLocalStorage` no CLI `HTTP/SSE`.
- **Métricas RED (`lib/core/tools.ts`):** `executeTool` contabiliza `requests`, `cacheHits`, `errors` e tempos por ferramenta, emitindo resumo `[metrics]` em `stderr` a cada 100 requisições.
- **Health Check KV (`lib/adapters/cloudflare.ts`):** `/health` sonda KV com timeout limitado (`1000ms`), retornando `200` (`healthy`) ou `503` (`degraded`).

## Resposta a Incidentes de Segurança e Notificação à ANPD (LGPD Art. 48)

Este runbook define o fluxo operacional para incidentes envolvendo o **MCP TSE** em conformidade com a **LGPD Art. 48** e a **Resolução CD/ANPD nº 15/2024**:

1. **Triagem (T0 — até 2h):** registrar o alerta (`auth.unauthorized`, exposição de `MCP_API_KEY`, falha SSRF/CORS), mapear componente afetado, SHA em produção e notificar o responsável técnico e o DPO (`MCP_DPO_CONTACT`).
2. **Contenção imediata:** rotacionar `MCP_API_KEY` via `wrangler secret put` ou host, invalidar chaves afetadas em `MCP_CACHE`/`MCP_KV` e restringir `MCP_ALLOWED_ORIGINS`.
3. **Preservação de evidências:** capturar logs estruturados (`stderr`, `wrangler tail`) preservando `X-Request-Id` e aplicando redação de PII/credenciais.
4. **Avaliação de risco aos titulares:** documentar matriz objetiva sobre eventual risco ou dano relevante aos titulares (dados nominais eleitorais ou metadados de acesso).
5. **Notificação à ANPD e aos titulares (Art. 48 / Resolução CD/ANPD nº 15/2024):** se houver risco ou dano relevante, comunicar à ANPD e aos titulares em até **3 (três) dias úteis** com descrição dos dados, titulares afetados, medidas técnicas de proteção, riscos, providências de mitigação e contato do DPO (`MCP_DPO_CONTACT`).
6. **Pós-incidente:** conduzir post-mortem sem culpabilização em até 5 dias úteis, abrir ticket corretivo no fluxo `codebase-ops` e registrar aprendizados em `.archagents/99-memory/`.
