---
id: DES-0001
slug: spc-0001-implementacao-inicial-mcp-tse-v0-1-0-7-tools-worker-safe-ea20-ckan
title: "[SPC-0001] Implementação inicial mcp-tse v0.1.0 (7 tools Worker-safe EA20 + CKAN)"
created_at: "2026-11-21T17:58:01Z"
status: approved
ticket: TCK-0001
type: design
scope_files_new:
  - lib/bin/mcp-tse.ts
  - lib/index.ts
  - lib/types/index.ts
  - lib/config/index.ts
  - lib/config/timeouts.ts
  - lib/shared/utils/constants.ts
  - lib/shared/utils/timeout.ts
  - lib/shared/types/result.ts
  - lib/shared/errors.ts
  - lib/shared/log-redaction.ts
  - lib/shared/agentic-guard.ts
  - lib/shared/compliance-notices.ts
  - lib/shared/tse-schemas.ts
  - lib/infrastructure/logger.ts
  - lib/infrastructure/rate-limiter.ts
  - lib/infrastructure/tracing.ts
  - lib/infrastructure/http/circuit-breaker.ts
  - lib/core/cache.ts
  - lib/core/http-client.ts
  - lib/core/registry.ts
  - lib/core/tool-schemas.ts
  - lib/core/tools.ts
  - lib/core/mcp-server.ts
  - lib/tools/tse-resultados.ts
  - lib/tools/tse-ckan.ts
  - lib/tools/index.ts
  - lib/adapters/cli.ts
  - lib/adapters/cli-http.ts
  - lib/adapters/cloudflare.ts
  - lib/workers/types.ts
  - lib/workers/auth.ts
  - lib/workers/oauth.ts
  - lib/workers/rate-limit.ts
  - lib/workers/sse.ts
  - lib/workers/rest.ts
  - lib/workers/openapi.ts
  - lib/workers/worker.ts
  - test/unit/tse-tools.test.ts
  - test/unit/tse-ckan-and-schemas.test.ts
  - test/unit/config.test.ts
  - test/unit/tool-validation-allowlist.test.ts
  - test/unit/cli-http-security.test.ts
  - test/unit/cli-http-runtime-coverage.test.ts
  - test/unit/worker-rest-cloudflare.test.ts
  - test/unit/worker-auth-oauth-cors.test.ts
  - test/unit/worker-security-headers.test.ts
  - test/unit/worker-sse-kv-shutdown.test.ts
  - test/unit/mcp-server-handlers.test.ts
  - test/unit/core-resilience-observability.test.ts
  - test/unit/agentic-compliance.test.ts
  - test/integration/transports.mjs
scope_files_modified:
  - README.md
  - PRIVACY.md
  - NOTICE.md
  - AGENTS.md
  - CLAUDE.md
  - package.json
  - .archagents/_capabilities.json
  - .archagents/mcp-tool-allowlist.json
  - .archagents/00-overview.md
  - .archagents/01-business-domain.md
  - .archagents/02-architecture.md
  - .archagents/03-modules.md
  - .archagents/04-data-model.md
  - .archagents/05-integrations.md
  - .archagents/06-infra-devops.md
  - .archagents/07-security-compliance.md
  - .archagents/08-conventions.md
  - .archagents/10-runbooks.md
scope_files_deleted: []
blast_radius: medium
playbook: .archagents/16-designs/playbooks/DES-0001-playbook.md
acceptance_delta: unchanged
---
# DES-0001 - [SPC-0001] Implementação inicial mcp-tse v0.1.0 (7 tools Worker-safe EA20 + CKAN)

## Problema

Implementar do zero o servidor MCP `@aredes.me/mcp-tse` (`v0.1.0`) clonando a arquitetura dual-runtime endurecida de `@aredes.me/mcp-dadosbr` sem herdar dependências ou ferramentas legadas (`apps/`, `smithery.ts`, `SequentialThinkingProcessor`, CNPJ/CEP/Tavily), entregando **7 ferramentas TSE Worker-safe** com paridade Node (`stdio` / `HTTP+SSE`) e Cloudflare Workers (`/`, `/health`, `/mcp`, `/sse`, `/openapi.json`, `POST /tools/{toolName}`).

## Solucao

1. **Configuração SSRF & Núcleo Web-standard (`lib/config/`, `lib/core/`, `lib/shared/`, `lib/infrastructure/`):**
   - `lib/config/index.ts` define `DEFAULT_TSE_RESULTADOS_URL = "https://resultados.tse.jus.br/oficial/"`, `DEFAULT_TSE_CKAN_URL = "https://dadosabertos.tse.jus.br/api/3/action/"`, allowlists `ALLOWED_TSE_RESULTADOS_HOSTS` (`resultados.tse.jus.br`, `cdn.tse.jus.br`) e `ALLOWED_TSE_CKAN_HOSTS` (`dadosabertos.tse.jus.br`, `cdn.tse.jus.br`), rejeitando credenciais em URL e restringindo loopback a `development`/`test`.
   - `lib/core/registry.ts` (sem `SequentialThinkingProcessor`), `lib/core/mcp-server.ts` (`<=180` linhas, zero `node:fs`, `ListTools`, `ListResources` vazio, `ReadResource` com `Unknown resource URI`, rate limit por sessão e `serializeBoundedToolOutput`), `lib/core/tool-schemas.ts` (sem ciclo `core -> tools`).
2. **7 Ferramentas TSE (`lib/shared/tse-schemas.ts`, `lib/tools/tse-resultados.ts`, `lib/tools/tse-ckan.ts`, `lib/tools/index.ts`):**
   - Schemas Zod `.strict()`, zero `api_key`, zero imports `node:*`, sanitização via `sanitizeUntrustedText` + `UNTRUSTED_EXTERNAL_DATA_NOTICE`, nunca cacheando erros HTTP ou respostas malformadas.
   - `tse_eleicoes_catalogo`, `tse_municipios_zonas`, `tse_apuracao_cargo`, `tse_candidatos_busca`, `tse_partidos_federacoes`, `tse_comparecimento_abstencao` e `tse_dados_abertos_datasets`.
3. **Adapters Node CLI & Cloudflare Workers (`lib/adapters/`, `lib/workers/`):**
   - `cli.ts`, `cli-http.ts`, `cloudflare.ts`, `rest.ts` (`handleToolRestEndpoint` genérico para `POST /tools/{toolName}` com `404` para tool desconhecida e `400` para encoding/JSON inválido), `openapi.ts`, `worker.ts`, `auth.ts`, `oauth.ts`, `rate-limit.ts`, `sse.ts`.
4. **Testes Unitários, Cobertura & Transporte:**
   - Suíte Vitest visando `>= 88%` de cobertura (`lines/statements/functions/branches`) e `test/integration/transports.mjs` cobrindo `stdio` (incluindo 101 chamadas offline de `tse_municipios_zonas` com `{}`) e `HTTP/SSE`.

## Threat Model

- **T1 — SSRF via overrides de URL (`TSE_RESULTADOS_BASE_URL`, `TSE_CKAN_BASE_URL`, `.mcprc.json`, `resolveApiConfig(overrides)`):**
  - *Mitigação:* `validateUrl()` exige `https:` em produção, rejeita credenciais embutidas (`username`/`password`), restringe loopback (`localhost`/`127.0.0.1`) exclusivamente a `NODE_ENV` `development`/`test` e valida hosts contra `ALLOWED_TSE_RESULTADOS_HOSTS` / `ALLOWED_TSE_CKAN_HOSTS`.
- **T2 — Bypass de proteção anti-bot / WAF (`divulgacandcontas.tse.jus.br` HTTP `403` Akamai WAF):**
  - *Mitigação:* nenhuma ferramenta consulta ou tenta contornar `divulgacandcontas.tse.jus.br`; `tse_dados_abertos_datasets` devolve `upstream_waf_notice` explícito e direciona ao catálogo CKAN / `cdn.tse.jus.br` e cruzamento com `cnpj_lookup` (`@aredes.me/mcp-dadosbr`).
- **T3 — Decisões automatizadas e homônimos em buscas nominais (`LGPD Art. 20`):**
  - *Mitigação:* `tse_apuracao_cargo` e `tse_candidatos_busca` anexam obrigatoriamente `lgpd_notice: HOMONYM_HUMAN_REVIEW_NOTICE`, e `PRIVACY.md` documenta salvaguardas LGPD Arts. 6º, 7º, 18, 20, 41 e 48.
- **T4 — Prompt injection / payloads gigantes via dados externos do TSE (`AG-1` / `AG-2`):**
  - *Mitigação:* todos os textos externos passam por `sanitizeUntrustedText`, respostas incluem `untrusted_data_notice: UNTRUSTED_EXTERNAL_DATA_NOTICE`, paginação/cap server-side e `serializeBoundedToolOutput` respeitam `MCP_MAX_TOOL_OUTPUT_CHARS`.
- **T5 — Exposição indevida em HTTP/SSE e Cloudflare Worker (`DNS rebinding`, `CORS *`, `auth`, `OAuth`):**
  - *Mitigação:* CLI HTTP valida `Host` e `Origin`, faz bind padrão em `127.0.0.1` e exige `MCP_API_KEY` fail-closed fora de loopback; Worker exige `MCP_API_KEY` constant-time em rotas não públicas, mantém OAuth `501 oauth_not_supported`, aplica headers defensivos e sanitiza erros `500` em `rest.ts`.
- **T6 — Envenenamento de cache e violação de escopo `SC-9`:**
  - *Mitigação:* todas as 7 tools possuem schemas Zod `.strict()` sem `api_key` registrados em `TOOL_SCHEMAS` e `.archagents/mcp-tool-allowlist.json` (`MCP-TOOL-01`..`07`), e erros HTTP/JSON inválidos nunca são gravados no `cache`.

## Mudancas

- Código fonte: `lib/bin/mcp-tse.ts`, `lib/index.ts`, `lib/types/index.ts`, `lib/config/*`, `lib/shared/*`, `lib/infrastructure/*`, `lib/core/*`, `lib/tools/*`, `lib/adapters/*`, `lib/workers/*`.
- Testes: `test/unit/*.test.ts` e `test/integration/transports.mjs`.
- Documentação e governança: `README.md`, `PRIVACY.md`, `NOTICE.md`, `AGENTS.md`, `CLAUDE.md`, `.archagents/*`.

## Criterios de sucesso

- [ ] `npm run build && npm run build:worker` e `npx tsc --noEmit && npx tsc -p tsconfig.worker.json --noEmit` passam sem erros.
- [ ] `TOOL_DEFINITIONS` e `.archagents/mcp-tool-allowlist.json` expõem exatamente 7 ferramentas TSE (`MCP-TOOL-01`..`07`) e versão `0.1.0`.
- [ ] `npx vitest run --coverage` atinge >= 85% em lines/statements/functions e >= 80% branches (alvo >= 88%).
- [ ] `npm run test:transport` passa em `stdio` (incluindo 101 chamadas offline de `tse_municipios_zonas` com `{}`) e `HTTP/SSE`.
- [ ] `verify-tool-allowlist.py`, `criteria-check.py` (5/5) e `secret-scan.sh` passam sem violações.
