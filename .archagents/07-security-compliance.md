# Segurança e limites

Base inicial: `v0.1.0` (`SPC-0001`).

- **Validação Zod `.strict()` e Allowlist `SC-9`:** todas as 7 ferramentas MCP possuem schemas Zod `.strict()` em `lib/shared/tse-schemas.ts` e `lib/core/tool-schemas.ts`, sem parâmetro `api_key`, validados antes de qualquer chamada externa em `executeRegisteredTool` (`lib/core/registry.ts`). Allowlist e capacidades versionadas em `.archagents/_capabilities.json` e `.archagents/mcp-tool-allowlist.json` (`MCP-TOOL-01`..`MCP-TOOL-07`).
- **Proteção SSRF (`lib/config/index.ts`):** `validateUrl` exige HTTPS e host na allowlist (`resultados.tse.jus.br`, `dadosabertos.tse.jus.br`, `cdn.tse.jus.br`), rejeita credenciais embutidas na URL e só libera loopback (`localhost`, `127.0.0.1`) em `NODE_ENV` `development` ou `test`.
- **Transporte HTTP/SSE & Worker (`cli-http.ts`, `worker.ts`, `auth.ts`, `oauth.ts`, `rest.ts`):** headers defensivos (`X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, `Referrer-Policy: no-referrer`, `Cache-Control: no-store`), validação anti-DNS-rebinding (`Host`/`Origin`), `MCP_API_KEY` fail-closed fora de loopback e constant-time no Worker, OAuth `501 oauth_not_supported` fail-closed, `400 Invalid JSON payload` e `500 Internal server error` sanitizado em `POST /tools/{toolName}`.
- **Guardrails agênticos & LGPD:** sanitização via `sanitizeUntrustedText`, `UNTRUSTED_EXTERNAL_DATA_NOTICE`, `serializeBoundedToolOutput` (`MCP_MAX_TOOL_OUTPUT_CHARS`), `HOMONYM_HUMAN_REVIEW_NOTICE` (`lgpd_notice`, Art. 20) em `tse_apuracao_cargo` e `tse_candidatos_busca`, e não contorno ao WAF de `divulgacandcontas.tse.jus.br`.

## Fontes

- `lib/config/index.ts`
- `lib/core/registry.ts`
- `lib/shared/tse-schemas.ts`
- `lib/shared/agentic-guard.ts`
- `lib/shared/compliance-notices.ts`
- `lib/adapters/cli-http.ts`
- `lib/workers/auth.ts`
- `lib/workers/oauth.ts`
- `lib/workers/rest.ts`
- `.archagents/_capabilities.json`
- `.archagents/mcp-tool-allowlist.json`
