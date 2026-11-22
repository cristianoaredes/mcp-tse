---
status: completed
run_id: RUN-20261122-020300-tck-0003
ticket: TCK-0003
design: DES-0003
start_time: 2026-11-22T02:03:01Z
end_time: 2026-11-22T02:07:34Z
environment: dev
mode: live
operator: ops
commits:
  - sha: 7a21dc1a27e3ee71559f2cfd7a30cec68e278c4c
    message: "fix(TCK-0003): add cargo-aware ciclo/codigo_eleicao defaults and preserve categorizeError messages"
    files: [lib/shared/errors.ts, lib/shared/tse-schemas.ts, lib/tools/tse-resultados.ts, test/unit/core-resilience-observability.test.ts, test/unit/tse-tools.test.ts]
files_modified:
  - lib/shared/errors.ts
  - lib/shared/tse-schemas.ts
  - lib/tools/tse-resultados.ts
  - test/unit/core-resilience-observability.test.ts
  - test/unit/tse-tools.test.ts
test_result:
  status: pass
  summary: "5/5 acceptance criteria pass (criteria-check.py); 13/13 Vitest suites (63/63 tests, 96.88% stmts / 88.36% branch / 98.43% funcs / 97.78% lines); build+worker & tsc --noEmit (Node+Worker) pass; transport smoke pass; live StdioClientTransport calls to build/lib/bin/mcp-tse.js pass for governador SP (ele2026/6259) and prefeito SP 71072 (ele2024/619)"
  details: "Cargo-aware defaults implemented in lib/shared/tse-schemas.ts (municipal -> ele2024/619, state -> ele2026/6259, presidente -> ele2026/6257, preserving explicit values and .strict()), scopePropertiesSchema updated in lib/tools/tse-resultados.ts, and optional customMessage added to TimeoutError and ResourceNotFoundError with error.message forwarded in categorizeError()."
---
# RUN-20261122-020300-tck-0003 - TCK-0003

## Resumo executivo

Correção implementada na branch `fix/TCK-0003-auto-cargo-election` conforme `DES-0003`:
- **`lib/shared/tse-schemas.ts`:** `TseApuracaoCargoSchema`, `TseCandidatosBuscaSchema` e `TsePartidosFederacoesSchema` agora tornam `ciclo` e `codigo_eleicao` opcionais antes de `superRefine` + `.transform()` via helper compartilhado (`getCargoElectionDefaults` / `resolveCargoElection` / `applyCargoElectionDefaults`), resolvendo `prefeito`/`vereador` -> `ele2024`/`619`, estaduais (`governador`, `senador`, `deputado_federal`, `deputado_estadual`, `deputado_distrital`) -> `ele2026`/`6259` e `presidente` -> `ele2026`/`6257`, preservando valores explícitos e mantendo rejeição `.strict()` de chaves extras e tipos inferidos compatíveis (`TseApuracaoCargoInput`, `TseCandidatosBuscaInput`, `TsePartidosFederacoesInput`).
- **`lib/tools/tse-resultados.ts`:** atualizado `scopePropertiesSchema` removendo `default` fixo enganoso (`ele2026`/`6257`) e documentando a resolução automática por `cargo`.
- **`lib/shared/errors.ts`:** adicionado parâmetro opcional `customMessage?: string` em `TimeoutError` e `ResourceNotFoundError`, preservando os contratos/códigos padrão quando omitido e repassando `error.message` em `categorizeError()`.
- **Testes & Verificação Live:** adicionados testes unitários em `test/unit/tse-tools.test.ts` e `test/unit/core-resilience-observability.test.ts`; verificados build, `build:worker`, `tsc --noEmit` (Node e Worker), Vitest (`13/13` arquivos, `63/63` testes), `test:transport` e chamadas live via `StdioClientTransport` em `build/lib/bin/mcp-tse.js` contra `resultados.tse.jus.br`.

## Evidence Gate

| Check | Esperado | Obtido | Status |
|---|---|---|---|
| `CARGO_DEFAULTS_OK` (`criteria-check.py` #1) | `CARGO_DEFAULTS_OK` | `CARGO_DEFAULTS_OK` (`governador`->`ele2026`/`6259`, `prefeito`->`ele2024`/`619`, `presidente`->`ele2026`/`6257`) | PASS |
| `ERROR_MESSAGES_OK` (`criteria-check.py` #2) | `ERROR_MESSAGES_OK` | `ERROR_MESSAGES_OK` (`categorizeError` preserva `error.message`) | PASS |
| `npm run build && npm run build:worker` (`criteria-check.py` #3) | exit `0` | exit `0` | PASS |
| `npx tsc --noEmit && npx tsc -p tsconfig.worker.json --noEmit` (`criteria-check.py` #4) | exit `0` | exit `0` (`0` erros) | PASS |
| `npm test` (`criteria-check.py` #5) | exit `0` | `13/13` suites, `63/63` tests passed | PASS |
| `npx vitest run --coverage` | >= 85% / 80% | `96.88%` stmts, `88.36%` branch, `98.43%` funcs, `97.78%` lines (`errors.ts` 100%, `tse-schemas.ts` 100% lines) | PASS |
| `npm run test:transport` | `stdio` + `HTTP/SSE` | Both transports passed (`7` tools, empty resources, `[metrics] requests=100`) | PASS |
| Live `StdioClientTransport` (`build/lib/bin/mcp-tse.js`) `governador` SP | `ele2026` / `6259` | `ciclo: "ele2026"`, `codigo_eleicao: "6259"`, `sp-c0003-e006259-u.json` (`5` candidatos, `103656` seções) | PASS |
| Live `StdioClientTransport` (`build/lib/bin/mcp-tse.js`) `prefeito` SP `71072` | `ele2024` / `619` | `ciclo: "ele2024"`, `codigo_eleicao: "619"`, `sp71072-c0011-e000619-u.json` (`26513` seções) | PASS |
| `gates/check-scope.py --ticket TCK-0003 --base main --json` | `out_of_scope: []` | `out_of_scope: []`, `scope_tampered: []` | PASS |
| `secret-scan.sh` | `No secrets detected` | `No secrets detected` | PASS |
