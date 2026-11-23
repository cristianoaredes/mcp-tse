# Changelog

All notable changes to `@aredes.me/mcp-tse` are documented in this file.

The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

> **Distribuição (`2026-11-23`):** O pacote [`@aredes.me/mcp-tse`](https://www.npmjs.com/package/@aredes.me/mcp-tse) (`0.1.0`) está publicado no registro npm (`latest: 0.1.0`; criação da release/tag `v0.1.0` no GitHub pendente após o merge do PR de documentação).

## [Unreleased]

### Added

- (`TCK-0004`) Suite de documentação técnica e SEO/GEO no padrão Orqo / `mcp-dadosbr`:
  - `docs/README.md`, `docs/CONFIGURATION.md`, `docs/MCP_CLIENT_INTEGRATION.md`, `docs/USAGE_EXAMPLES.md` (com saídas reais via `stdio` das 7 ferramentas) e `docs/pt-br/README.md`.
  - `llms.txt` no formato `llmstxt.org` na raiz do repositório.
  - `CHANGELOG.md` montado a partir do histórico e tickets do repositório.

### Changed

- (`TCK-0004` & `TCK-0005`) Documentação completa alinhada ao código em `lib/` e à publicação `v0.1.0` no npm (badge, guias `npx -y @aredes.me/mcp-tse`, defaults por grupo de cargo em `TCK-0003`, `13` suítes / `63` testes e FAQ expandida).
- (`TCK-0004`) Atualizados `description` e `keywords` em `package.json` e topics no GitHub (`eleicoes-2026`, `resultados-eleitorais`, `ckan`).
- (`TCK-0003` / [PR #1](https://github.com/cristianoaredes/mcp-tse/pull/1)) Seleção automática de `ciclo`/`codigo_eleicao` por grupo de cargo em `tse_apuracao_cargo`, `tse_candidatos_busca` e `tse_partidos_federacoes` (`ele2024/619` para prefeito/vereador, `ele2026/6259` para governador/senador/deputados, `ele2026/6257` para presidente) e preservação de mensagens em `categorizeError`.

## [0.1.0] - 2026-11-21

### Added

- (`TCK-0001` / `SPC-0001` / `DES-0001`) Implementação inicial de **7 ferramentas somente leitura sem chave de API** (`zero-key`) com paridade Node.js CLI e Cloudflare Workers:
  - `tse_eleicoes_catalogo`, `tse_municipios_zonas`, `tse_apuracao_cargo`, `tse_candidatos_busca`, `tse_partidos_federacoes`, `tse_comparecimento_abstencao` e `tse_dados_abertos_datasets`.
  - Allowlist SSRF (`resultados.tse.jus.br`, `dadosabertos.tse.jus.br`, `cdn.tse.jus.br`), política anti-bypass do Akamai WAF (`divulgacandcontas.tse.jus.br`) com `upstream_waf_notice`, sanitização recursiva (`untrusted_data_notice`) e aviso LGPD Art. 20 (`lgpd_notice`) em consultas nominais.
  - Transportes `stdio`, `HTTP/SSE` (`GET /mcp`, `POST /messages`) e adaptador Cloudflare Worker (`POST /mcp`, `/sse`, `POST /tools/{toolName}`, `GET /openapi.json`, `GET /health`).
- (`TCK-0002`) Expansão do `README.md` no padrão editorial Orqo/`mcp-dadosbr` e criação de `CONTRIBUTING.md`, `PRIVACY.md`, `NOTICE.md` e `.mcprc.example.json` sob licença `AGPL-3.0-only`.
