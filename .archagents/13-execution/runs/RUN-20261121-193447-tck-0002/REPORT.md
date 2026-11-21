---
status: completed
run_id: RUN-20261121-193447-tck-0002
ticket: TCK-0002
design: DES-0002
start_time: 2026-11-21T19:34:47Z
end_time: 2026-11-21T19:40:20Z
environment: dev
mode: live
operator: ops
commits:
  - sha: 564de95f50f2a341f49b7b8656288ee65f291961
    message: "docs(TCK-0002): expand README.md to full Orqo/mcp-dadosbr standard and add CONTRIBUTING.md"
    files: [CONTRIBUTING.md, README.md]
  - sha: a57df805c38759f9d36f092d7151b0e1e460cf23
    message: "docs(TCK-0002): use bracketed placeholder in README .mcprc example for clean secret-scan"
    files: [README.md]
files_modified:
  - CONTRIBUTING.md
  - README.md
test_result:
  status: pass
  summary: "4/4 acceptance criteria pass (criteria-check.py); 13/13 Vitest suites (62/62 tests); tsc & tsc worker pass; transport smoke pass; 0 secret/scope violations"
  details: "README.md expanded to 378 lines (12 anchors, 53 verified relative links) and bilingual CONTRIBUTING.md (171 lines) created accurately reflecting lib/ modular architecture, Node 22.12+/24/26, Vitest/transport tests, and main PR + .archagents governance."
---
# RUN-20261121-193447-tck-0002 - TCK-0002

## Resumo executivo

Documentação pública de `@aredes.me/mcp-tse` expandida na branch `docs/TCK-0002-readme-orqo-standard` conforme `DES-0002`:
- **`README.md` (`378` linhas):** reescrito no padrão editorial Orqo / `@aredes.me/mcp-dadosbr` (badges, narrativa de problema vs solução, 5 exemplos de conversa incluindo cruzamento com `@aredes.me/mcp-dadosbr` e `@aredes.me/mcp-orcamento`, catálogo completo das 7 ferramentas com contrato textual sem `ui://`, sinergia no ecossistema `@aredes.me/*`, perímetro de execução, instalação e configuração completa com allowlists SSRF e todas as variáveis de ambiente reais, diagrama Mermaid e internos, 7 fronteiras na seção de honestidade, governança `.archagents/` (`SPC-0001`, `TCK-0001`, `DES-0001`, `VER-20261121-182723-tck-0001`), FAQ, GNU `AGPL-3.0-only`, desenvolvimento, LGPD e seção completa em inglês).
- **`CONTRIBUTING.md` (`171` linhas):** guia bilíngue PT-BR / English fiel à arquitetura modular em `lib/`, regras Worker-safe e `stdio`, suíte Vitest/transporte, fluxo `main` + PR e governança `.archagents/`.

## Evidence Gate

| Check | Esperado | Obtido | Status |
|---|---|---|---|
| `README_STRUCTURE_OK` (`criteria-check.py` #1) | `>= 320` lines + 9 required headings (`README_STRUCTURE_OK`) | `378` lines, all 9 headings (`README_STRUCTURE_OK`) | PASS |
| `LINKS_OK` (`criteria-check.py` #2) | All relative links exist (`LINKS_OK:`) | `LINKS_OK:53` (`README.md`: 12 anchors, 53 relLinks; `CONTRIBUTING.md`: 2 anchors, 7 relLinks; 0 broken) | PASS |
| `npm run build && npm run build:worker` (`criteria-check.py` #3) | exit `0` | exit `0` | PASS |
| `npx vitest run` (`criteria-check.py` #4) | exit `0` | `13/13` files, `62/62` tests passed | PASS |
| `npx tsc --noEmit && npx tsc -p tsconfig.worker.json --noEmit` | exit `0` | exit `0` | PASS |
| `npm run test:transport` | `stdio` + `HTTP/SSE` + `101` offline calls | Both transports passed (`7` tools, empty resources, `[metrics] requests=100`) | PASS |
| `gates/check-scope.py --ticket TCK-0002 --base main --json` | `out_of_scope: []` | `out_of_scope: []`, `scope_tampered: []` (`CONTRIBUTING.md`, `README.md`) | PASS |
| `secret-scan.sh README.md CONTRIBUTING.md` | `No secrets detected` | `No secrets detected` | PASS |
