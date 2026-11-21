---
id: SPC-0001
slug: mcp-tse-v010-catalog
title: "Implementação inicial @aredes.me/mcp-tse v0.1.0 (7 tools Worker-safe EA20 + CKAN)"
created_at: "2026-11-21T14:33:08-03:00"
status: compiled
linked_brief: BRF-0001
linked_discovery: DSC-0001
module_of: null
approved_by: "cristiano 2026-11-21T14:33:08-03:00"
linked_tickets:
  - TCK-0001
external_refs: []
external_sync: []
effort: M
security_sensitive: true
acceptance:
  - check: "npm run build && npm run build:worker"
  - check: "node -e \"import('./build/lib/core/tools.js').then(m => { const names = m.TOOL_DEFINITIONS.map(t => t.name); if (names.length !== 7) process.exit(1); console.log('TOOLS_OK:' + names.length); })\""
    expect: "TOOLS_OK:7"
  - check: "node -e \"import('node:fs').then(fs => { const allow = JSON.parse(fs.readFileSync('.archagents/mcp-tool-allowlist.json','utf8')); const pkg = JSON.parse(fs.readFileSync('package.json','utf8')); if (pkg.version !== '0.1.0' || allow.entries.length !== 7) process.exit(1); console.log('ALLOWLIST_AND_VERSION_OK'); })\""
    expect: "ALLOWLIST_AND_VERSION_OK"
  - check: "npx vitest run --coverage"
  - check: "npm run test:transport"
---

# SPC-0001 — Implementação inicial @aredes.me/mcp-tse v0.1.0 (7 tools Worker-safe EA20 + CKAN)

## Problema

Não existe ainda no portfólio `@aredes.me/*` um servidor MCP dedicado aos dados eleitorais do TSE que opere com paridade em Node.js (`stdio` / `HTTP+SSE`) e Cloudflare Workers (`<128 MB` RAM) sem exigir API keys ou ingestão pesada.

## Usuários e jornadas

- **Agentes de IA em hosts MCP e consumidores HTTP/Worker:** listam e executam as 7 ferramentas `tse_*` em `stdio`, `HTTP/SSE`, `/mcp`, `/sse` e `POST /tools/{toolName}`.
- **Pesquisadores, jornalistas e analistas de integridade pública:** consultam pleitos (`tse_eleicoes_catalogo`), traduzem códigos TSE ↔ IBGE e zonas (`tse_municipios_zonas`), acompanham totalização/ranking por cargo (`tse_apuracao_cargo`), buscam candidatos/vices/suplentes (`tse_candidatos_busca`), consolidam votos por partido/federação (`tse_partidos_federacoes`), verificam comparecimento/abstenção (`tse_comparecimento_abstencao`) e localizam datasets CSV/ZIP abertos em `cdn.tse.jus.br` (`tse_dados_abertos_datasets`) com orientação de cruzamento via `cnpj_lookup` (`@aredes.me/mcp-dadosbr`).

## Solução proposta

1. **Núcleo & Adapters Dual-Runtime:**
   - Reutilizar e adaptar a camada core endurecida do `mcp-dadosbr` (`lib/config/`, `lib/core/`, `lib/infrastructure/`, `lib/shared/`, `lib/adapters/`, `lib/workers/`) sem `apps/`, `build-apps.mjs`, `smithery.ts` ou código morto.
   - `lib/config/index.ts` restringe bases URL do TSE via SSRF allowlist (`resultados.tse.jus.br`, `dadosabertos.tse.jus.br`, `cdn.tse.jus.br`), rejeita credenciais na URL e bloqueia loopback em produção.
   - `lib/core/mcp-server.ts` (<= 180 linhas, sem `node:fs`) expõe `ListTools` (7 tools), `ListResources` vazio, rejeição `Unknown resource URI` em `ReadResource`, rate limiting por sessão e `serializeBoundedToolOutput`.
   - `lib/workers/rest.ts`, `openapi.ts` e `worker.ts` expõem `/health`, `/mcp`, `/sse`, `/openapi.json`, `/` e `POST /tools/{toolName}` genérico para todas as 7 ferramentas.
2. **Catálogo de 7 Ferramentas TSE Worker-safe (`lib/shared/tse-schemas.ts`, `lib/tools/tse-resultados.ts`, `lib/tools/tse-ckan.ts`):**
   - Todas as entradas validadas com Zod `.strict()`, sem parâmetro `api_key`, sanitização via `sanitizeUntrustedText` + `UNTRUSTED_EXTERNAL_DATA_NOTICE`, nunca cacheando erros HTTP ou respostas malformadas, e anexando `lgpd_notice: HOMONYM_HUMAN_REVIEW_NOTICE` em `tse_apuracao_cargo` e `tse_candidatos_busca`.
   - `tse_dados_abertos_datasets` expõe links `cdn.tse.jus.br`, dica cross-MCP (`cnpj_lookup` em `@aredes.me/mcp-dadosbr`) e `upstream_waf_notice` sobre `divulgacandcontas.tse.jus.br` (HTTP `403` Akamai WAF, nunca contornado).
3. **Qualidade, Cobertura e Governança:**
   - Suíte Vitest cobrindo todas as 7 ferramentas, SSRF, `SC-9`, CLI HTTP security, Worker `/`/`/health`/`/mcp`/`/sse`/`/openapi.json`/`POST /tools/{toolName}`, OAuth, rate limiter, circuit breaker, cache, logger/tracing e guardrails agênticos com >= 85% em lines/statements/functions e >= 80% branches.
   - Teste de transporte `test/integration/transports.mjs` validando `stdio` (incluindo 101 chamadas offline de `tse_municipios_zonas` com `{}`) e `HTTP/SSE`.

## Discovery e fontes

- `DSC-0001` (`.archagents/12-inception/discoveries/DSC-0001-tse-ea20-ckan-worker-safe.md`)
- `BRF-0001` (`.archagents/12-inception/briefs/BRF-0001-mcp-tse-v010-7-tools.md`)

## Não-escopo

- Contorno ou automação contra o WAF Akamai de `divulgacandcontas.tse.jus.br`.
- Download/ingestão em memória de arquivos ZIP/CSV completos do `cdn.tse.jus.br` (mantidos como links CKAN para processamento externo ou Worker-safe).
- Publicação automática no npm, criação remota de repositório GitHub ou deploy `wrangler` nesta etapa.

## Riscos

- Mudança de layout ou indisponibilidade pontual nos arquivos EA20 do TSE ou CKAN APIv3 → mitigação: validação defensiva do payload JSON, circuit breaker por origem, retry com jitter apenas em erros transientes e política estrita de nunca cachear falhas HTTP ou payloads inválidos.
- Payloads municipais grandes (ex.: `-ab.json` estadual com 646 municípios ou listagens extensas de candidatos) estourarem a janela de saída MCP → mitigação: paginação obrigatória (`page`/`limit`), agregação resumida e cap seguro antes da serialização bounded (`serializeBoundedToolOutput`).
- Risco de homônimos em buscas nominais (`tse_candidatos_busca`) e listagens de apuração (`tse_apuracao_cargo`) → mitigação: `lgpd_notice: HOMONYM_HUMAN_REVIEW_NOTICE` (LGPD Art. 20) e orientação explícita de revisão humana em `PRIVACY.md`.
- Deriva entre runtime Node CLI e Cloudflare Worker (imports `node:*` ou versão/catálogo divergente) → mitigação: zero `node:*` em `lib/shared/`, `lib/tools/`, `lib/core/` e `lib/workers/`, verificado por `tsc -p tsconfig.worker.json --noEmit` e testes de paridade.

## Decomposição

- **Unit 1 — Núcleo compartilhado, SSRF e adapters Node/Worker (`lib/config/`, `lib/core/`, `lib/infrastructure/`, `lib/shared/`, `lib/adapters/`, `lib/workers/`).**
- **Unit 2 — 7 Ferramentas TSE EA20 & CKAN, suíte Vitest (>=85% cobertura), transporte `stdio`+`HTTP/SSE` e documentação canônica.**

## Spec self-review

- Placeholder scan: ok — zero placeholders angulares ou campos pendentes na especificação.
- Consistência interna: ok — as 7 ferramentas, endpoints REST/Worker, versão `0.1.0` e 5 checks de aceite são idênticos entre frontmatter, solução e governança `SC-9`.
- Escopo focado: ok — `effort: M` com fronteira clara excluindo bypass de WAF, ETL de ZIPs e publicação remota.
- Ambiguidades restantes: nenhuma — contratos de entrada Zod, rotas EA20/CKAN e comportamento de erro estão fechados.
