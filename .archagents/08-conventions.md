# Convenções

Base inicial: `v0.1.0` (`SPC-0001`).

- Pacote ESM (`"type": "module"`), TypeScript strict (`tsconfig.json` e `tsconfig.worker.json`), Vitest com `@vitest/coverage-v8` (`85% lines / 85% functions / 80% branches / 85% statements`).
- As 7 ferramentas MCP usam nomes `snake_case` prefixados com `tse_`; zero imports `node:*` em `lib/shared/`, `lib/tools/`, `lib/core/`, `lib/infrastructure/` ou `lib/workers/`.
- No transporte `stdio`, `stdout` é exclusivo de JSON-RPC; todos os logs e métricas vão para `stderr`.
- O teste de integração `npm run test:transport` verifica `stdio` (incluindo 101 chamadas offline de `tse_municipios_zonas` com `{}` retornando `isError: true` e zero chamadas de rede) e `HTTP/SSE`.

## Fontes

- `package.json`
- `vitest.config.ts`
- `test/integration/transports.mjs`
