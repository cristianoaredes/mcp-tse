---
id: TCK-0002
slug: documentar-readme-md-completo-no-padrao-orqo-mcp-dadosbr-e-contributing-md-para
title: "Documentar README.md completo no padrão Orqo/mcp-dadosbr e CONTRIBUTING.md para publicação pública"
source: operator
created_at: 2026-11-21T19:34:16Z
created_by: ops
updated_at: 2026-11-21T19:50:21Z
status: done
severity: low
category: docs
effort: S
flow: normal
ceremony: full
business_impact: ""
linked_findings: []
linked_designs:
  - DES-0002
linked_runs:
  - RUN-20261121-193447-tck-0002
linked_verifications:
  - VER-20261121-194719-tck-0002
linked_docs: []
external_refs: []
external_sync: []
blocks: []
blocked_by: []
related: []
acceptance:
  - check: "node -e \"import('node:fs').then(fs => { const md = fs.readFileSync('README.md','utf8'); const req = ['by Orqo','## O problema','## Perímetro de execução','## Instalação e configuração','## Como funciona por dentro','## Governança: construído com Codebase OPS by Orqo','## Licença: GNU AGPL-3.0','## Privacidade e LGPD','## English']; if (md.split('\\n').length < 320 || !req.every(h => md.includes(h))) process.exit(1); console.log('README_STRUCTURE_OK'); })\""
    expect: README_STRUCTURE_OK
  - check: "node -e \"import('node:fs').then(fs => { const md = fs.readFileSync('README.md','utf8'); const links = [...md.matchAll(/\\]\\((?!https?:\\/\\/|#|mailto:)([^)#\\s]+)(?:#[^)]*)?\\)/g)].map(m => m[1]); const missing = links.filter(p => !fs.existsSync(p)); if (missing.length) { console.error(missing); process.exit(1); } console.log('LINKS_OK:' + links.length); })\""
    expect: LINKS_OK:
  - check: "npm run build && npm run build:worker"
  - check: "npx vitest run"
depth_decision:
  workflow: inline
  design: skip
  verify: lightweight
  source: routing-classifier
  classified_at: 2026-11-21T19:34:17Z
---
# TCK-0002 - Documentar README.md completo no padrão Orqo/mcp-dadosbr e CONTRIBUTING.md para publicação pública

## Contexto

Criado via scripts/ops/ticket/create.py a partir de source=operator.

## Falsificador

Antes da execução, `README.md:1-88` possui apenas `88` linhas sem as seções obrigatórias do padrão Orqo/`mcp-dadosbr` (reprovando com exit `1` o comando ``node -e "import('node:fs').then(fs => { const md = fs.readFileSync('README.md','utf8'); if (md.split('\n').length < 320 || !md.includes('by Orqo')) process.exit(1); })"``) e `CONTRIBUTING.md` não existia (`test -f CONTRIBUTING.md` falhava antes de `TCK-0002`).

## Log de transicoes

- 2026-11-21T19:34:16Z - **raw** - criado via scripts/ops/ticket/create.py.
- 2026-11-21T19:34:17Z - **triaged** - Documentation ticket triaged: low severity, docs category, S effort, 4 executable acceptance checks defined [depth_decision do routing-classifier: workflow inline, design skip, verify lightweight]
- 2026-11-21T19:34:47Z - **designed** - DES-0002 approved with file scope CONTRIBUTING.md (new) and README.md (modified)
- 2026-11-21T19:34:56Z - **executing** - Start executing DES-0002 on docs/TCK-0002-readme-orqo-standard
- 2026-11-21T19:41:28Z - **verifying** - All 4 acceptance checks pass (README_STRUCTURE_OK, LINKS_OK:53, build+worker, vitest 62/62), tsc, transport smoke, check-scope, verify-run, and secret-scan clean; ready for P10 verification
- 2026-11-21T19:50:21Z - **done** - P10 verified and judged for Orqo-standard README.md and CONTRIBUTING.md
