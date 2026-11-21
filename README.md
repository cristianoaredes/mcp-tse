# MCP TSE (`@aredes.me/mcp-tse`)

Servidor Model Context Protocol (MCP) em TypeScript (`v0.1.0`, licença `AGPL-3.0-only`) para consulta de dados eleitorais públicos brasileiros do **Tribunal Superior Eleitoral (TSE)**, com paridade entre **Node.js** (`stdio` e `HTTP/SSE`) e **Cloudflare Workers** (`HTTP JSON-RPC`, `SSE`, `OpenAPI 3.0` e `POST /tools/{toolName}`).

> **Sem API key obrigatória:** todas as 7 ferramentas consomem diretamente endpoints públicos oficiais do TSE (`resultados.tse.jus.br` EA20 e `dadosabertos.tse.jus.br` CKAN APIv3) com proteção SSRF, cache em memória/KV e sanitização agêntica.

## Ferramentas disponíveis (7 tools)

| # | Ferramenta | Fonte oficial | Descrição |
|---|---|---|---|
| 1 | `tse_eleicoes_catalogo` | `resultados.tse.jus.br` (`ele-c.json`) | Lista pleitos, ciclos, datas, turnos, UFs e cargos configurados no TSE |
| 2 | `tse_municipios_zonas` | `resultados.tse.jus.br` (`mun-e*-cm.json`) | Traduz código TSE (5 dígitos) ↔ código IBGE (7 dígitos), nome, capital e zonas eleitorais |
| 3 | `tse_apuracao_cargo` | `resultados.tse.jus.br` (EA20 `-u.json`) | Consulta totalização de seções, comparecimento/votos e ranking paginado de candidatos por cargo |
| 4 | `tse_candidatos_busca` | `resultados.tse.jus.br` (EA20 `-u.json`) | Busca candidatos (incluindo vices/suplentes `vs[]`) por nome, número, partido ou eleitos |
| 5 | `tse_partidos_federacoes` | `resultados.tse.jus.br` (EA20 `-u.json`) | Consolida votação nominal e de legenda por partido e federação partidária |
| 6 | `tse_comparecimento_abstencao` | `resultados.tse.jus.br` (EA20 `-ab.json`) | Consulta comparecimento, abstenção, eleitorado apto e seções por Brasil, UF ou município |
| 7 | `tse_dados_abertos_datasets` | `dadosabertos.tse.jus.br` (CKAN) | Pesquisa pacotes e recursos CSV/ZIP em `cdn.tse.jus.br` e orienta cruzamento com `cnpj_lookup` (`@aredes.me/mcp-dadosbr`) |

## Instalação e uso rápido

### CLI (`stdio` — padrão para Claude Desktop, Cursor, Windsurf, Codex)

```bash
npx @aredes.me/mcp-tse
```

### Servidor HTTP/SSE local (Node.js)

```bash
npm install
npm run build
MCP_TRANSPORT=http MCP_HTTP_PORT=3000 node build/lib/adapters/cli.js
```

Para exposição fora de loopback (`MCP_HTTP_HOST` diferente de `127.0.0.1`/`localhost`/`::1`), `MCP_API_KEY` é obrigatória (*fail-closed*).

### Cloudflare Workers

Endpoints disponíveis em `lib/workers/worker.ts`:
- `GET /` — metadados do serviço, catálogo de 7 tools e política LGPD/DPO
- `GET /health` — status do Worker e sonda limitada de KV (`200 healthy` / `503 degraded`)
- `GET /openapi.json` — especificação OpenAPI 3.0
- `POST /mcp` — endpoint JSON-RPC MCP (`tools/list`, `tools/call`)
- `GET|POST /sse` — endpoint streaming Server-Sent Events
- `POST /tools/{toolName}` — endpoint REST direto para qualquer uma das 7 ferramentas (`404` para tool desconhecida, `400` para JSON inválido)

## Variáveis de ambiente

| Variável | Padrão | Descrição |
|---|---|---|
| `MCP_TRANSPORT` | `stdio` | Modo de transporte (`stdio` ou `http`) |
| `MCP_HTTP_HOST` | `127.0.0.1` | Host de bind do servidor HTTP/SSE |
| `MCP_HTTP_PORT` | `3000` (Node) / `8787` (Worker) | Porta HTTP/SSE |
| `MCP_API_KEY` | — | Chave de autenticação `Bearer` / `X-API-Key` |
| `MCP_ALLOWED_ORIGINS` | — | Lista de origens CORS permitidas (separadas por vírgula) |
| `MCP_ALLOWED_HOSTS` | — | Lista adicional de cabeçalhos `Host` permitidos no CLI HTTP |
| `MCP_MAX_SSE_SESSIONS` | `100` | Limite de sessões SSE simultâneas no CLI |
| `MCP_CACHE_SIZE` | `256` | Capacidade do `MemoryCache` |
| `MCP_CACHE_TTL` | `3600000` | TTL do cache em ms (mínimo efetivo de `60s` em Cloudflare KV) |
| `MCP_API_TIMEOUT` | `8000` | Timeout padrão (ms) para requisições HTTP upstream |
| `MCP_MAX_TOOL_OUTPUT_CHARS` | `100000` | Limite máximo de caracteres do JSON serializado de saída |
| `MCP_DPO_CONTACT` | `See PRIVACY.md (LGPD Art. 41)` | Contato do DPO exposto em `GET /` |
| `TSE_RESULTADOS_BASE_URL` | `https://resultados.tse.jus.br/oficial/` | Override SSRF-allowlisted da base EA20 |
| `TSE_CKAN_BASE_URL` | `https://dadosabertos.tse.jus.br/api/3/action/` | Override SSRF-allowlisted da API CKAN |
| `LOG_LEVEL` | `info` (`debug` em `development`) | Nível dos logs JSON emitidos exclusivamente em `stderr` |

## Privacidade e LGPD

Consulte [`PRIVACY.md`](PRIVACY.md) e [`.archagents/10-runbooks.md`](.archagents/10-runbooks.md):
- **Sem persistência permanente:** apenas repasse efêmero e cache temporário em RAM/KV.
- **Revisão humana obrigatória (LGPD Art. 20):** respostas nominais (`tse_apuracao_cargo` e `tse_candidatos_busca`) incluem `lgpd_notice` alertando contra decisões automatizadas e risco de homônimos.
- **Política WAF upstream:** `divulgacandcontas.tse.jus.br` retorna HTTP `403` (Akamai WAF) e nunca é contornado; utilize `tse_dados_abertos_datasets` (`cdn.tse.jus.br`) como alternativa oficial aberta.
- **Canal do DPO (LGPD Art. 41):** configure `MCP_DPO_CONTACT` no ambiente auto-hospedado.

## Desenvolvimento e testes

```bash
npm run build
npm run build:worker
npx tsc --noEmit
npx tsc -p tsconfig.worker.json --noEmit
npm run test:coverage
npm run test:transport
```

## Licença

Distribuído sob **GNU Affero General Public License v3.0 (`AGPL-3.0-only`)** — veja [`LICENSE`](LICENSE) e [`NOTICE.md`](NOTICE.md).
