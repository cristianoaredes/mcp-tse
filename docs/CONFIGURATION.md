# Guia de Configuração — MCP TSE

_Referência técnica das variáveis de ambiente, `.mcprc.json`, timeouts, rate limits, allowlists SSRF e deploy em Cloudflare Workers para `@aredes.me/mcp-tse` (`0.1.0`)._

## Índice

- [Padrões de Inicialização](#padrões-de-inicialização)
- [Hierarquia de Configuração](#hierarquia-de-configuração)
- [Variáveis de Ambiente (Referência Completa)](#variáveis-de-ambiente-referência-completa)
- [Arquivo `.mcprc.json` e Allowlists SSRF](#arquivo-mcprcjson-e-allowlists-ssrf)
- [Modos de Transporte (Node.js)](#modos-de-transporte-nodejs)
- [Cloudflare Workers](#cloudflare-workers)
- [Diagnóstico Rápido](#diagnóstico-rápido)

---

## Padrões de Inicialização

Sem configuração adicional, o MCP TSE inicializa com ([`lib/shared/utils/constants.ts`](../lib/shared/utils/constants.ts), [`lib/config/timeouts.ts`](../lib/config/timeouts.ts)):

```text
APIs padrão:
  TSE Resultados (EA20):       https://resultados.tse.jus.br/oficial/
  TSE Dados Abertos (CKAN):    https://dadosabertos.tse.jus.br/api/3/action/

Transporte CLI padrão: stdio (bind HTTP padrão: 127.0.0.1:3000)
Cache LRU em memória: 256 entradas, TTL de 3.600.000 ms (1 hora) no Node.js (60.000 ms padrão no wrangler.toml; KVCache aplica mínimo de 60s)
Timeout HTTP padrão: 8.000 ms (MCP_API_TIMEOUT)
Retry HTTP: até 3 retentativas com backoff exponencial + equal jitter (base 1.000 ms) para 429/5xx/rede
Circuit Breaker por origem: 5 falhas consecutivas, recuperação em 30.000 ms (MCP_CIRCUIT_BREAKER_TIMEOUT), até 100 origens em LRU
Rate limits:
  - Sessão MCP (createMCPServer): 120 req/min (MCP_TOOL_RATE_LIMIT_MAX)
  - CLI HTTP/SSE por IP:          30 req/min (cli-http.ts)
  - Cloudflare Worker por IP:     30 req/min (workers/rate-limit.ts)
Teto de saída: 100.000 caracteres por ferramenta (MCP_MAX_TOOL_OUTPUT_CHARS, mínimo 1.024)
```

---

## Hierarquia de Configuração

No runtime Node.js ([`lib/config/index.ts`](../lib/config/index.ts)):

1. **Parâmetros explícitos (`overrides`)**
2. **Variáveis de ambiente (`TSE_RESULTADOS_BASE_URL`, `TSE_CKAN_BASE_URL`, `API_KEY_HEADER`/`API_KEY_VALUE`)**
3. **Arquivo `.mcprc.json` no diretório atual**
4. **Padrões oficiais** (`resultados.tse.jus.br` e `dadosabertos.tse.jus.br`)

---

## Variáveis de Ambiente (Referência Completa)

### Endpoints, Auth e Transporte HTTP (`lib/config/index.ts`, `lib/adapters/cli.ts`, `lib/adapters/cli-http.ts`)

| Variável | Padrão | Escopo | Descrição |
|---|---|---|---|
| `TSE_RESULTADOS_BASE_URL` | `https://resultados.tse.jus.br/oficial/` | Node / Worker | Base URL HTTPS para arquivos estáticos EA20 (validada pela allowlist SSRF). |
| `TSE_CKAN_BASE_URL` | `https://dadosabertos.tse.jus.br/api/3/action/` | Node / Worker | Base URL HTTPS para CKAN APIv3 do TSE (validada pela allowlist SSRF). |
| `API_KEY_HEADER` / `API_KEY_VALUE` | *(nenhum)* | CLI Node | Cabeçalho extra opcional enviado em requisições HTTP de saída a um proxy na allowlist. |
| `MCP_TRANSPORT` | `stdio` | CLI Node | Define o transporte local: `stdio` ou `http` (`HTTP/SSE`). |
| `MCP_HTTP_HOST` | `127.0.0.1` | CLI HTTP | Endereço de bind do servidor HTTP/SSE. Hosts não-loopback recusam iniciar sem `MCP_API_KEY` (fail-closed). |
| `MCP_HTTP_PORT` | `3000` (`8787` Worker) | CLI / Worker | Porta TCP no modo HTTP/SSE. |
| `MCP_API_KEY` | *(nenhum)* | CLI HTTP / Worker | Chave obrigatória fora de loopback (`Authorization: Bearer <chave>` ou `X-API-Key: <chave>`). |
| `MCP_ALLOWED_ORIGINS` | *(loopback CLI / `*` público no Worker)* | CLI HTTP / Worker | Origens CORS permitidas separadas por vírgula (no Worker sem essa variável, rotas públicas enviam `Access-Control-Allow-Origin: *` e rotas protegidas por `MCP_API_KEY` omitem o cabeçalho). |
| `MCP_ALLOWED_HOSTS` | *(loopback implícito)* | CLI HTTP | Cabeçalhos `Host` adicionais aceitos (proteção contra DNS rebinding). |
| `MCP_MAX_SSE_SESSIONS` | `100` | CLI HTTP | Teto de sessões SSE simultâneas em `cli-http.ts`. |
| `MCP_TRUST_X_FORWARDED_FOR` | `false` | Worker | Quando `"true"`, aceita `X-Forwarded-For` como fallback caso `CF-Connecting-IP` esteja ausente no rate limit. |

### Timeouts, Circuit Breaker, Cache, Rate Limit e Logging (`lib/config/timeouts.ts`, `lib/core/*`)

| Variável | Padrão | Escopo | Descrição |
|---|---|---|---|
| `MCP_API_TIMEOUT` | `8000` ms | CLI Node (`process.env`) | Timeout por tentativa nas chamadas HTTP às APIs do TSE. |
| `MCP_CIRCUIT_BREAKER_TIMEOUT` | `30000` ms | CLI Node (`process.env`) | Cooldown antes de transicionar o disjuntor de `OPEN` para `HALF_OPEN`. |
| `MCP_SSE_TIMEOUT` | `50000` ms | CLI HTTP / Worker (`process.env`) | Tempo máximo configurado para stream SSE (`TIMEOUTS.SSE_CONNECTION_MS`). |
| `MCP_PING_INTERVAL` | `30000` ms | SSE (`process.env`) | Intervalo de keep-alive SSE (`TIMEOUTS.PING_INTERVAL_MS`). |
| `MCP_RATE_LIMIT_WINDOW` | `60000` ms | Node / Worker (`process.env`) | Janela do rate limiter (`TIMEOUTS.RATE_LIMIT_WINDOW_MS`). |
| `MCP_RATE_LIMIT_CLEANUP_INTERVAL` | `60000` ms | Node (`process.env`) | Intervalo de limpeza de buckets expirados em memória. |
| `MCP_TOOL_RATE_LIMIT_MAX` | `120` | Node (`process.env`) | Limite de chamadas de ferramenta por janela na sessão MCP (`createMCPServer()`). |
| `MCP_DISABLE_RATE_LIMIT` | `false` | Node / Worker | Quando `"true"`, desabilita rate limit da sessão MCP (`createMCPServer`) e do Cloudflare Worker (`workers/rate-limit.ts`). |
| `MCP_CACHE_SIZE` / `MCP_CACHE_TTL` | `256` / `3600000` ms (`60000` Worker) | Node / Worker | Capacidade LRU e TTL do cache (mínimo `60s` no `KVCache`). Falhas HTTP nunca vão para cache. |
| `MCP_CACHE_BACKGROUND_CLEANUP` | `false` | CLI Node | Quando `"true"`, ativa timer de limpeza periódica do `MemoryCache` a cada 5 minutos. |
| `MCP_MAX_TOOL_OUTPUT_CHARS` | `100000` chars | Node / Worker | Teto do JSON serializado por resposta de ferramenta (mínimo `1024`). |
| `MCP_DPO_CONTACT` | `See PRIVACY.md (LGPD Art. 41)` | Worker | Exposto em `GET /` no campo `privacy.dpo_contact` do Worker. |
| `LOG_LEVEL` / `NODE_ENV` | `info` / *(não definido)* | CLI Node | `LOG_LEVEL` (`debug`/`info`/`warn`/`error`; padrão `debug` apenas quando `NODE_ENV === "development"`, senão `info` em `Logger`); `NODE_ENV=production` mascara IPs, bloqueia loopback URLs SSRF e desativa `[DEBUG]` em `cli.ts`. |

---

## Arquivo `.mcprc.json` e Allowlists SSRF

Copie [`.mcprc.example.json`](../.mcprc.example.json) para `.mcprc.json` na raiz de execução:

```json
{
  "apiUrls": {
    "resultados": "https://resultados.tse.jus.br/oficial/",
    "ckan": "https://dadosabertos.tse.jus.br/api/3/action/"
  },
  "auth": {
    "headers": {
      "X-API-Key": "<sua-chave-opcional>"
    }
  }
}
```

**Hosts permitidos na allowlist SSRF ([`lib/config/index.ts`](../lib/config/index.ts)):**
- **Resultados EA20:** `resultados.tse.jus.br`, `cdn.tse.jus.br` (e subdomínios)
- **Dados Abertos CKAN:** `dadosabertos.tse.jus.br`, `cdn.tse.jus.br` (e subdomínios)
- HTTPS obrigatório em produção; URLs com credenciais embutidas, IPs privados/link-local (`169.254.169.254`) ou hosts fora da lista são rejeitados. `localhost` / `127.0.0.1` só são liberados quando `NODE_ENV=development` ou `test`.

---

## Modos de Transporte (Node.js)

### `stdio` (Padrão)
JSON-RPC exclusivo em `stdout`; logs estruturados com `X-Request-Id` e `[metrics]` em `stderr`:

```bash
node build/lib/bin/mcp-tse.js
```

### `http` (HTTP/SSE Local ou em Rede)

```bash
# Loopback local
MCP_TRANSPORT=http MCP_HTTP_PORT=3000 node build/lib/bin/mcp-tse.js

# Exposição externa (MCP_API_KEY obrigatória)
MCP_TRANSPORT=http \
MCP_HTTP_HOST=0.0.0.0 \
MCP_HTTP_PORT=3000 \
MCP_API_KEY="<segredo-forte>" \
MCP_ALLOWED_HOSTS="tse.suaempresa.com.br" \
MCP_ALLOWED_ORIGINS="https://app.suaempresa.com.br" \
node build/lib/bin/mcp-tse.js
```

---

## Cloudflare Workers

Em [`wrangler.toml`](../wrangler.toml), substitua os IDs KV placeholder de `MCP_CACHE` e `MCP_KV`, configure `MCP_API_KEY` via `wrangler secret put MCP_API_KEY`, valide com `npm run build:worker` e publique via `npm run deploy:staging` ou `npm run deploy`.

Rotas do Worker: `GET /`, `GET /health`, `GET /openapi.json`, `POST /mcp`, `GET|POST /sse`, `POST /tools/{toolName}` e endpoints `/oauth/*` fail-closed (`501 oauth_not_supported`).

---

## Diagnóstico Rápido

1. **Erro `codigo_eleicao is required when ciclo is '...'`:** ocorre ao consultar um `ciclo` diferente do padrão sem informar `codigo_eleicao`. Chame `tse_eleicoes_catalogo` primeiro para obter o `codigo_eleicao` exato.
2. **Erro de WAF `HTTP 403` citado ao buscar candidaturas detalhadas:** `divulgacandcontas.tse.jus.br` bloqueia clientes automatizados com Akamai WAF e o servidor nunca contorna WAF; use `tse_dados_abertos_datasets` para baixar os pacotes ZIP/CSV oficiais em `cdn.tse.jus.br`.
3. **Host não-loopback recusando iniciar:** comportamento `fail-closed` — defina `MCP_API_KEY`.
