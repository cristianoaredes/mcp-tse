---
id: DES-0003
slug: defaults-inteligentes-por-cargo-ea20-e-preservacao-de-mensagens-em-categorizeerr
title: "Defaults inteligentes por cargo (EA20) e preservação de mensagens em categorizeError"
created_at: 2026-11-22T02:02:28Z
status: approved
ticket: TCK-0003
type: design
scope_files_new: []
scope_files_modified:
  - lib/shared/tse-schemas.ts
  - lib/shared/errors.ts
  - lib/tools/tse-resultados.ts
  - test/unit/tse-tools.test.ts
  - test/unit/core-resilience-observability.test.ts
scope_files_deleted: []
blast_radius: low
playbook: .archagents/16-designs/playbooks/DES-0003-playbook.md
acceptance_delta: unchanged
---
# DES-0003 - Defaults inteligentes por cargo (EA20) e preservação de mensagens em categorizeError

## Problema

1. Em `lib/shared/tse-schemas.ts`, `TseApuracaoCargoSchema`, `TseCandidatosBuscaSchema` e `TsePartidosFederacoesSchema` aplicam `ciclo = "ele2026"` e `codigo_eleicao = "6257"` fixos via `.default(...)`, fazendo consultas de cargos municipais (`prefeito`, `vereador`) ou estaduais (`governador`, `senador`, `deputado_*`) resolverem ciclo/eleição incorretos quando omitidos (além de `scopePropertiesSchema` em `lib/tools/tse-resultados.ts` declarar `default: "ele2026"` e `default: "6257"`).
2. Em `lib/shared/errors.ts`, `categorizeError()` instancia `new TimeoutError("operation", 30000)` e `new ResourceNotFoundError("resource", "unknown")` sem repassar `error.message`, descartando a mensagem original de erros 404/not found e timeout propagados ao protocolo MCP.

## Solucao

1. **`lib/shared/tse-schemas.ts`:** tornar `ciclo` e `codigo_eleicao` opcionais em `TseApuracaoCargoSchema`, `TseCandidatosBuscaSchema` e `TsePartidosFederacoesSchema`, validando escopo e defaults em `superRefine` e materializando em `.transform()` (com helper compartilhado) preservando valores explícitos e os tipos inferidos `TseApuracaoCargoInput`, `TseCandidatosBuscaInput` e `TsePartidosFederacoesInput`:
   - `prefeito` / `vereador`: `ciclo` omitido -> `"ele2024"`; `codigo_eleicao` omitido com `ciclo === "ele2024"` -> `"619"`.
   - `governador`, `senador`, `deputado_federal`, `deputado_estadual`, `deputado_distrital`: `ciclo` omitido -> `"ele2026"`; `codigo_eleicao` omitido com `ciclo` resolvido `"ele2026"` -> `"6259"`.
   - `presidente`: `ciclo` omitido -> `"ele2026"`; `codigo_eleicao` omitido com `ciclo` resolvido `"ele2026"` -> `"6257"`.
   - Chaves extras continuam rejeitadas (`.strict()`); ciclo explícito não-padrão sem `codigo_eleicao` falha validação antes de qualquer fetch.
2. **`lib/tools/tse-resultados.ts`:** atualizar `scopePropertiesSchema` removendo `default` fixo enganoso e documentando a resolução automática por `cargo`.
3. **`lib/shared/errors.ts`:** adicionar parâmetro opcional `customMessage?: string` em `TimeoutError` e `ResourceNotFoundError` (preservando mensagens e códigos padrão quando omitido) e passar `error.message` em `categorizeError()`.
4. **Testes:** ampliar `test/unit/tse-tools.test.ts` e `test/unit/core-resilience-observability.test.ts` cobrindo defaults por cargo, preservação de parâmetros explícitos, rejeição de extra keys / ciclos não-padrão sem código e preservação de mensagens em `categorizeError`.

## Mudancas

- Modificados: `lib/shared/tse-schemas.ts`, `lib/shared/errors.ts`, `lib/tools/tse-resultados.ts`, `test/unit/tse-tools.test.ts`, `test/unit/core-resilience-observability.test.ts`.
- Governança: `.archagents/*` (`TCK-0003`, `DES-0003`, `DES-0003-playbook`, `RUN-*`).

## Criterios de sucesso

- [ ] `npm run build && npm run build:worker`, `npx tsc --noEmit && npx tsc -p tsconfig.worker.json --noEmit` e `npm test` passam sem erros.
- [ ] Defaults por `cargo` (`governador` -> `ele2026`/`6259`, `prefeito` -> `ele2024`/`619`, `presidente` -> `ele2026`/`6257`), valores explícitos e rejeição estrita validados em testes unitários e teste live via `StdioClientTransport` em `build/lib/bin/mcp-tse.js`.
- [ ] `TimeoutError`, `ResourceNotFoundError` e `categorizeError` preservam códigos, contrato sem `customMessage` e `error.message` quando categorizados.
