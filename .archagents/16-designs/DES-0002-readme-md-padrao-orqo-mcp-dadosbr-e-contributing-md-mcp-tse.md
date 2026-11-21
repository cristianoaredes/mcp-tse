---
id: DES-0002
slug: readme-md-padrao-orqo-mcp-dadosbr-e-contributing-md-mcp-tse
title: "README.md padrão Orqo/mcp-dadosbr e CONTRIBUTING.md (mcp-tse)"
created_at: 2026-11-21T19:34:17Z
status: approved
ticket: TCK-0002
type: design
scope_files_new:
  - CONTRIBUTING.md
scope_files_modified:
  - README.md
scope_files_deleted: []
blast_radius: low
playbook: .archagents/16-designs/playbooks/DES-0002-playbook.md
acceptance_delta: unchanged
---
# DES-0002 - README.md padrão Orqo/mcp-dadosbr e CONTRIBUTING.md (mcp-tse)

## Problema

O `README.md` atual de `@aredes.me/mcp-tse` possui apenas 88 linhas de resumo técnico e não existe `CONTRIBUTING.md`, ficando abaixo do padrão editorial público Orqo / `@aredes.me/mcp-dadosbr` (~360–430 linhas, badges, narrativa de problema vs solução, catálogo completo com contratos/limites, perímetro de execução, diagrama Mermaid, seção de honestidade, governança `.archagents/`, LGPD e resumo em inglês).

## Solucao

1. **Criar `CONTRIBUTING.md` bilíngue (PT-BR / English):** espelhar o tom de `@aredes.me/mcp-dadosbr`, porém descrevendo com precisão a arquitetura modular em `lib/` (`lib/bin/`, `lib/config/`, `lib/core/`, `lib/infrastructure/`, `lib/shared/`, `lib/tools/`, `lib/adapters/`, `lib/workers/`), Node `22.12+ | 24 | 26`, comandos `npm test`, `npm run test:coverage`, `npm run test:transport`, `npm run build:worker`, fluxo de branches (`main` + feature-branch PR) e governança `.archagents/` (`codebase-ops`).
2. **Expandir `README.md` (~360–430 linhas) no padrão editorial Orqo/`mcp-dadosbr`:**
   - Cabeçalho `# MCP TSE \`by Orqo\``, tagline, 5 badges Shields.io e barra de navegação com âncoras verificadas.
   - Seções `## O problema`, `## Experimente em uma conversa` (5 prompts práticos incluindo cruzamento com `@aredes.me/mcp-dadosbr` e `@aredes.me/mcp-orcamento`), `## Catálogo completo das 7 ferramentas` (parâmetros, paginação/caps, fontes e contrato textual JSON sem painéis `ui://`), `## Sinergia no ecossistema @aredes.me/*` e `## Perímetro de execução` (`stdio`, `HTTP/SSE`, Cloudflare Worker e `MCP_API_KEY` *fail-closed*).
   - `## Instalação e configuração` (Node `22.12+ | 24 | 26`, início rápido npm e multi-server, código-fonte, HTTP/SSE local, `.mcprc.json` + allowlist SSRF de `lib/config/index.ts`, tabela completa de variáveis de ambiente lidas no código e deploy Cloudflare Worker conforme `wrangler.toml`).
   - `## Como funciona por dentro` (diagrama Mermaid + citações exatas a `lib/core/mcp-server.ts`, `lib/core/tools.ts`, `lib/core/http-client.ts`, `lib/shared/agentic-guard.ts`, `lib/workers/worker.ts`, `test/integration/transports.mjs`).
   - `## Honestidade: o que o MCP TSE não faz` (7 limites explícitos), `## Governança: construído com Codebase OPS by Orqo` (links para `.archagents/README.md`, `SPC-0001`, `TCK-0001`, `DES-0001`, `VER-20261121-182723-tck-0001` e métricas `62/62` / `96.85%` stmts), `## Perguntas diretas`, `## Licença: GNU AGPL-3.0`, `## Desenvolvimento e contribuição`, `## Privacidade e LGPD` e `## English`.

## Mudancas

- Criado: `CONTRIBUTING.md`
- Modificado: `README.md`
- Governança: `.archagents/*` (isento de código; `TCK-0002`, `DES-0002`, `RUN-*`)

## Criterios de sucesso

- [ ] `README.md` atinge ~360–430 linhas (>= 320), contém todos os cabeçalhos obrigatórios e todos os links relativos e âncoras resolvem sem falha.
- [ ] `CONTRIBUTING.md` documenta fielmente a arquitetura modular `lib/`, suíte de testes e fluxo `main` + PR.
- [ ] `npm run build && npm run build:worker` e `npx vitest run` passam sem regressão.
- [ ] `criteria-check.py` (4/4), `check-scope.py` (`out_of_scope: []`) e `secret-scan.sh` passam limpos.
