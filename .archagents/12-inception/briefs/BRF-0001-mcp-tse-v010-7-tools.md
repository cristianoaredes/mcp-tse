---
id: BRF-0001
slug: mcp-tse-v010-7-tools
title: "Servidor MCP @aredes.me/mcp-tse v0.1.0 (7 tools TSE EA20 + CKAN Worker-safe)"
created_at: "2026-11-21T14:28:00-03:00"
status: promoted
linked_discovery: DSC-0001
linked_spec: SPC-0001
external_refs: []
---

# BRF-0001 — Servidor MCP @aredes.me/mcp-tse v0.1.0 (7 tools TSE EA20 + CKAN Worker-safe)

## Problema / oportunidade

O ecossistema `@aredes.me/*` precisa de um servidor MCP dedicado para dados eleitorais do TSE sem depender de ETL pesado ou bancos locais, permitindo consultas em tempo real por IA e agentes sobre eleições, municípios/zonas, apuração por cargo, busca nominal de candidatos (com vices/suplentes), consolidação por partidos/federações, comparecimento/abstenção e catálogo de Dados Abertos (CKAN) com cruzamento para `cnpj_lookup` (`@aredes.me/mcp-dadosbr`).

## Opção aprovada

Construir `@aredes.me/mcp-tse` (`v0.1.0`, licença `AGPL-3.0-only`) clonando a arquitetura endurecida de `@aredes.me/mcp-dadosbr`:
- **7 tools sem API key:** `tse_eleicoes_catalogo`, `tse_municipios_zonas`, `tse_apuracao_cargo`, `tse_candidatos_busca`, `tse_partidos_federacoes`, `tse_comparecimento_abstencao`, `tse_dados_abertos_datasets`.
- **Dual runtime:** Node.js (`stdio` e `HTTP/SSE`) + Cloudflare Workers (`/`, `/health`, `/mcp`, `/sse`, `/openapi.json`, `POST /tools/{toolName}`).
- **Segurança & LGPD:** Zod `.strict()`, allowlist SSRF para hosts TSE, sanitização agêntica, `lgpd_notice` (Art. 20) e não contorno ao WAF Akamai de `divulgacandcontas.tse.jus.br`.

## Decisão

Promovido para `SPC-0001` após aprovação do operador em `2026-11-21T14:33:08-03:00`.
