# MCP TSE `by Orqo` — Guia Rápido em Português

Bem-vindo à documentação em português brasileiro do **MCP TSE** (`@aredes.me/mcp-tse`), servidor open source (`AGPL-3.0-only`) mantido pela [Orqo](https://orqo.pro/) para consultar dados eleitorais oficiais do Tribunal Superior Eleitoral em assistentes de IA.

## O que entrega (`v0.1.0`)

- **7 ferramentas somente leitura sem chave de API:** catálogo de eleições (`tse_eleicoes_catalogo`), tradução IBGE ↔ TSE e zonas eleitorais (`tse_municipios_zonas`), apuração por cargo (`tse_apuracao_cargo`), busca de candidatos (`tse_candidatos_busca`), partidos e federações (`tse_partidos_federacoes`), comparecimento/abstenção (`tse_comparecimento_abstencao`) e datasets CKAN (`tse_dados_abertos_datasets`).
- **Defaults inteligentes por cargo (`TCK-0003`):** cargos municipais (`prefeito`, `vereador`) resolvem automaticamente para `ele2024/619`; estaduais/distritais para `ele2026/6259`; `presidente` para `ele2026/6257`.
- **Proveniência e proteção:** URL oficial (`source_url`), `fetchedAt`, `untrusted_data_notice`, `upstream_waf_notice` e aviso LGPD Art. 20 (`lgpd_notice`) em consultas nominais.

## Guias da Documentação

1. **[Configuração (`CONFIGURATION.md`)](../CONFIGURATION.md)** — Variáveis de ambiente, `.mcprc.json`, timeouts, rate limits e Cloudflare Workers.
2. **[Integração com Clientes (`MCP_CLIENT_INTEGRATION.md`)](../MCP_CLIENT_INTEGRATION.md)** — Claude Desktop, Claude Code, Cursor, Windsurf, VS Code, Continue e HTTP/REST.
3. **[Exemplos de Uso (`USAGE_EXAMPLES.md`)](../USAGE_EXAMPLES.md)** — Chamadas e saídas reais das 7 ferramentas + cruzamentos com `mcp-dadosbr` e `mcp-orcamento`.
4. **[Índice geral (`docs/README.md`)](../README.md)** e **[README principal](../../README.md)**.

## Compilação Local e Testes

> **Aviso de distribuição (`2026-11-23`):** `@aredes.me/mcp-tse` ainda não foi publicado no npm (`0.1.0` na branch `main`). Clone e compile localmente até a primeira release.

```bash
git clone https://github.com/cristianoaredes/mcp-tse.git
cd mcp-tse
npm ci
npm run build && npm run build:worker

# Verificação completa (63 testes em 13 suítes + transportes + Worker)
npm test
npm run test:transport
npx tsc --noEmit && npx tsc -p tsconfig.worker.json --noEmit
```

Para contribuir, leia [`CONTRIBUTING.md`](../../CONTRIBUTING.md).
