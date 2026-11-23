# Documentação — MCP TSE `by Orqo`

> **Documentação técnica completa para consultas eleitorais brasileiras (TSE Resultados EA20 e Dados Abertos CKAN) via Model Context Protocol (MCP).**

## Guias Disponíveis

- **[Guia Rápido PT-BR](pt-br/README.md)** — Compilação local, execução e comandos principais em português.
- **[Configuração e Segurança (`CONFIGURATION.md`)](CONFIGURATION.md)** — Variáveis de ambiente, `.mcprc.json`, timeouts, rate limits (`30`/`120` req/min), allowlists SSRF e Cloudflare Workers.
- **[Integração em Clientes MCP (`MCP_CLIENT_INTEGRATION.md`)](MCP_CLIENT_INTEGRATION.md)** — Passo a passo para Claude Desktop, Claude Code, Cursor, Windsurf, VS Code, Continue, MCP Inspector e REST/Worker.
- **[Exemplos de Uso (`USAGE_EXAMPLES.md`)](USAGE_EXAMPLES.md)** — Exemplos completos das 7 ferramentas com saídas reais obtidas via `stdio`, mais cruzamentos com `@aredes.me/mcp-dadosbr` e `@aredes.me/mcp-orcamento`.

### Raiz e Governança
- **[README principal](../README.md)** · **[CHANGELOG](../CHANGELOG.md)** · **[llms.txt](../llms.txt)** · **[PRIVACY](../PRIVACY.md)** · **[CONTRIBUTING](../CONTRIBUTING.md)** · **[`.archagents/`](../.archagents/README.md)**

## Início Rápido

> **Distribuição (`2026-11-23`):** O pacote [`@aredes.me/mcp-tse`](https://www.npmjs.com/package/@aredes.me/mcp-tse) (`0.1.0`) está publicado no registro **npm**. Execute diretamente via `npx -y @aredes.me/mcp-tse` ou compile a partir do código-fonte:

```bash
# Execução direta via npm
npx -y @aredes.me/mcp-tse

# Ou build local a partir do código-fonte
git clone https://github.com/cristianoaredes/mcp-tse.git
cd mcp-tse
npm ci
npm run build && npm run build:worker

# Primeira consulta stdio (catálogo oficial de eleições)
printf '%s\n%s\n%s\n' \
  '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2024-11-05","capabilities":{},"clientInfo":{"name":"cli","version":"1.0"}}}' \
  '{"jsonrpc":"2.0","method":"notifications/initialized"}' \
  '{"jsonrpc":"2.0","id":2,"method":"tools/call","params":{"name":"tse_eleicoes_catalogo","arguments":{"limit":2}}}' \
  | npx -y @aredes.me/mcp-tse
```

## Catálogo Resumido das 7 Ferramentas (`v0.1.0`)

| Ferramenta | Domínio | Defaults / Requisitos | Fonte Oficial |
|---|---|---|---|
| `tse_eleicoes_catalogo` | Eleições ordinárias e suplementares | `tipo: "todas"`, `limit: 20` | `ele-c.json` (`EA20`) |
| `tse_municipios_zonas` | Tradução IBGE ↔ TSE e zonas eleitorais | `ele2024/619`; exige `>= 1` filtro (`uf`, `codigo_ibge`, `codigo_tse` ou `nome`) | `mun-e*-cm.json` (`EA20`) |
| `tse_apuracao_cargo` | Totalização e ranking por cargo | Municipal `ele2024/619` · Estadual `ele2026/6259` · Presidente `ele2026/6257` | `-u.json` (`EA20`) |
| `tse_candidatos_busca` | Busca de candidatos e vices/suplentes | Mesmos defaults por cargo + `nome`, `numero`, `partido`, `apenas_eleitos` | `-u.json` (`EA20`) |
| `tse_partidos_federacoes` | Consolidação de partidos e federações | Mesmos defaults por cargo + filtro opcional `partido` | `-u.json` (`EA20`) |
| `tse_comparecimento_abstencao` | Aptos, comparecimento e abstenção | Padrão fixo `ele2026/6257`, `uf: "br"` (município exige `uf != br`) | `-ab.json` (`EA20`) |
| `tse_dados_abertos_datasets` | Pacotes de dados abertos (`cdn.tse.jus.br`) | `query` (`package_search`) ou `package_id` (`package_show`), `rows: 10` | `dadosabertos.tse.jus.br` (`CKAN`) |

## Suporte

- **Issues:** [github.com/cristianoaredes/mcp-tse/issues](https://github.com/cristianoaredes/mcp-tse/issues)
- **Licença:** `AGPL-3.0-only` ([`LICENSE`](../LICENSE) · [`NOTICE.md`](../NOTICE.md))
