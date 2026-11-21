---
id: DSC-0001
slug: tse-ea20-ckan-worker-safe
title: "Discovery de endpoints públicos do TSE (Resultados EA20 e Dados Abertos CKAN) para mcp-tse v0.1.0"
created_at: "2026-11-21T14:25:00-03:00"
status: decided
linked_brief: BRF-0001
linked_spec: SPC-0001
sources:
  - .archagents/00-overview.md
  - .archagents/02-architecture.md
  - .archagents/05-integrations.md
external_refs: []
external_sync: []
---

# DSC-0001 — Discovery de endpoints públicos do TSE (Resultados EA20 e Dados Abertos CKAN) para mcp-tse v0.1.0

## Contexto

Conforme decidido na Etapa 2 de `@aredes.me/mcp-dadosbr` (`DSC-0001` / `BRF-0001` do molde), o ecossistema `@aredes.me/*` necessita de um servidor MCP dedicado para dados eleitorais brasileiros (`@aredes.me/mcp-tse`, `v0.1.0`), construído a partir da arquitetura dual-runtime Node.js + Cloudflare Workers do `mcp-dadosbr`.

## Fontes consultadas

Medições HTTP reais executadas em `2026-11-21` (sem API key):

1. **TSE Resultados — Catálogo de Eleições (`https://resultados.tse.jus.br/oficial/comum/config/ele-c.json`)**
   - Medição: HTTP `200`, `application/json`, array raiz `pl[]` com pleitos (`cd`, `c`, `dt`, `e[]`), turnos e abrangências (`abr[]`).
   - Veredito: **APROVADA** (`tse_eleicoes_catalogo`).
2. **TSE Resultados — Municípios e Zonas (`https://resultados.tse.jus.br/oficial/ele2024/619/config/mun-e000619-cm.json` e `ele2026/6257/config/mun-e006257-cm.json`)**
   - Medição: HTTP `200`, `application/json`, `abr[]` por UF com `mu[]` (`cd` TSE 5 dígitos, `cdi` IBGE 7 dígitos, `nm`, `c === "s"` capital, `z[]` zonas).
   - Veredito: **APROVADA** (`tse_municipios_zonas`).
3. **TSE Resultados — EA20 Apuração/Candidatos/Partidos (`-u.json`)**
   - Medição: HTTP `200` em `ele2026/6257/dados/br/br-c0001-e006257-u.json`, `ele2026/6257/dados/sp/sp-c0001-e006257-u.json`, `ele2026/6259/dados/sp/sp-c0003-e006259-u.json` e `ele2024/619/dados/sp/sp71072-c0011-e000619-u.json` (`s`, `e`, `v`, `carg[0].agr[].par[].cand[]` + `carg[0].fed[]`).
   - Veredito: **APROVADA** (`tse_apuracao_cargo`, `tse_candidatos_busca`, `tse_partidos_federacoes`).
4. **TSE Resultados — EA20 Comparecimento e Abstenção (`-ab.json`)**
   - Medição: HTTP `200` em `ele2026/6257/dados/br/br-e006257-ab.json` (29 entradas UF/BR) e `ele2026/6257/dados/sp/sp-e006257-ab.json` (646 municípios, ~537 KB), contendo `abr[]` (`tpabr`, `cdabr`, `s`, `e.te`, `e.c`, `e.pc`, `e.a`, `e.pa`). Arquivos por município individual `sp71072-e006257-ab.json` retornam HTTP `404` — a filtragem municipal ocorre sobre `<uf>-e<ele6>-ab.json`.
   - Veredito: **APROVADA** (`tse_comparecimento_abstencao`, com agregação/cap para respeitar o teto de 100 KB).
5. **TSE Dados Abertos CKAN APIv3 (`https://dadosabertos.tse.jus.br/api/3/action/package_search` / `package_show`)**
   - Medição: HTTP `200`, `application/json`, retornando pacotes oficiais e links diretos de CSV/ZIP em `cdn.tse.jus.br`.
   - Veredito: **APROVADA** (`tse_dados_abertos_datasets`).
6. **DivulgaCandContas (`https://divulgacandcontas.tse.jus.br/`)**
   - Comportamento documentado: endpoints de detalhe/prestação de contas retornam HTTP `403` sob proteção Akamai WAF em tráfego automatizado.
   - Veredito: **NÃO CONSULTAR / NÃO CONTORNAR** — manter fora das ferramentas EA20/CKAN e expor `upstream_waf_notice` em `tse_dados_abertos_datasets` orientando o uso de pacotes abertos `cdn.tse.jus.br`.

## Hipóteses

- **H1 (Catálogo Worker-safe de 7 tools):** Todos os JSONs EA20 e respostas CKAN paginadas cabem com folga no orçamento de memória de 128 MB do Cloudflare Worker quando filtrados/paginados no servidor antes de serializar. -> *Como validar:* testes unitários cobrindo paginação, filtros e cap de `-ab.json` + build `tsconfig.worker.json` sem imports `node:*`.
- **H2 (Paridade de validação e governança `SC-9`):** Schemas Zod `.strict()` compartilhados em `lib/shared/tse-schemas.ts` garantem rejeição imediata offline sem disparar `fetch()`. -> *Como validar:* testes unitários + `test/integration/transports.mjs` com 101 chamadas offline em `stdio`.

## Decisão

Aprovada pelo operador em `2026-11-21T14:33:08-03:00`: seguir para `BRF-0001` -> `SPC-0001` entregando `@aredes.me/mcp-tse` `v0.1.0` com **7 ferramentas** Worker-safe e governança `codebase-ops`.
