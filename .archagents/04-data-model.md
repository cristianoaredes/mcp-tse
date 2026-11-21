# Contratos de dados

Base inicial: `v0.1.0` (`SPC-0001`).

- Cada ferramenta registrada implementa `ToolHandler` (`name`, `description`, `inputSchema`, `zodSchema`, `execute`) e retorna `LookupResult` (`{ ok, data?, error?, source? }`).
- O servidor MCP (`lib/core/mcp-server.ts`) serializa saídas via `serializeBoundedToolOutput` (`MCP_MAX_TOOL_OUTPUT_CHARS`, padrão `100_000`), expõe `ListTools` com 7 ferramentas e `ListResources` vazio, rejeitando `ReadResource` com `ErrorCode.InvalidParams` (`Unknown resource URI`).
- Payloads externos incluem `untrusted_data_notice: UNTRUSTED_EXTERNAL_DATA_NOTICE` e campos textuais normalizados por `sanitizeUntrustedText`.
- `tse_apuracao_cargo` e `tse_candidatos_busca` incluem `lgpd_notice: HOMONYM_HUMAN_REVIEW_NOTICE` (LGPD Art. 20).

## Fontes

- `lib/types/index.ts`
- `lib/core/registry.ts`
- `lib/core/mcp-server.ts`
- `lib/shared/agentic-guard.ts`
- `lib/shared/compliance-notices.ts`
