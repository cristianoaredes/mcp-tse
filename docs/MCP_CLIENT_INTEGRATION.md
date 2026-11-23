# Guia de Integração em Clientes MCP — MCP TSE

_Como configurar o `@aredes.me/mcp-tse` (`0.1.0`) no Claude Desktop, Claude Code, Cursor, Windsurf, VS Code (Cline), Continue.dev, MCP Inspector e clientes HTTP/REST._

> **Importante — Status no npm (`2026-11-23`):** O pacote `@aredes.me/mcp-tse` encontra-se na versão `0.1.0` na branch `main` e **ainda não foi publicado no npm**. Enquanto não houver a primeira release no npm, compile localmente (`git clone ... && npm ci && npm run build`) e aponte para `build/lib/bin/mcp-tse.js`. As configurações com `npx -y @aredes.me/mcp-tse` passam a funcionar após a publicação oficial no registro npm.

## Índice

- [Pré-requisito: Build a Partir do Código-Fonte](#pré-requisito-build-a-partir-do-código-fonte)
- [Claude Desktop](#claude-desktop)
- [Claude Code](#claude-code)
- [Cursor](#cursor)
- [Windsurf](#windsurf)
- [VS Code (Cline / MCP nativo)](#vs-code-cline--mcp-nativo)
- [Continue.dev](#continuedev)
- [MCP Inspector](#mcp-inspector)
- [Cliente HTTP/SSE e Cloudflare Worker (REST / JSON-RPC)](#cliente-httpsse-e-cloudflare-worker-rest--json-rpc)
- [Ecossistema `@aredes.me/*` (`tse` + `orcamento` + `dadosbr`)](#ecossistema-aredesme-tse--orcamento--dadosbr)

---

## Pré-requisito: Build a Partir do Código-Fonte

Requer **Node.js `>= 22.12`, `24` ou `26`**:

```bash
git clone https://github.com/cristianoaredes/mcp-tse.git
cd mcp-tse
npm ci
npm run build && npm run build:worker
```

O binário executável `stdio`/HTTP estará em `/caminho/absoluto/mcp-tse/build/lib/bin/mcp-tse.js` (equivalente ao entrypoint `build/lib/adapters/cli.js`).

---

## Claude Desktop

- **macOS:** `~/Library/Application Support/Claude/claude_desktop_config.json`
- **Windows:** `%APPDATA%\Claude\claude_desktop_config.json`
- **Linux:** `~/.config/Claude/claude_desktop_config.json`

### Usando build local (recomendado até publicação no npm)

```json
{
  "mcpServers": {
    "tse": {
      "command": "node",
      "args": ["/caminho/absoluto/mcp-tse/build/lib/bin/mcp-tse.js"],
      "env": {
        "MCP_API_TIMEOUT": "12000",
        "LOG_LEVEL": "warn"
      }
    }
  }
}
```

### Após publicação no npm

```json
{
  "mcpServers": {
    "tse": {
      "command": "npx",
      "args": ["-y", "@aredes.me/mcp-tse"]
    }
  }
}
```

---

## Claude Code

```bash
claude mcp add tse -- node /caminho/absoluto/mcp-tse/build/lib/bin/mcp-tse.js
```

Ou no `.mcp.json` do projeto:

```json
{
  "mcpServers": {
    "tse": {
      "command": "node",
      "args": ["/caminho/absoluto/mcp-tse/build/lib/bin/mcp-tse.js"]
    }
  }
}
```

---

## Cursor

Em `.cursor/mcp.json` ou nas configurações globais MCP do Cursor:

```json
{
  "mcpServers": {
    "tse": {
      "command": "node",
      "args": ["/caminho/absoluto/mcp-tse/build/lib/bin/mcp-tse.js"]
    }
  }
}
```

---

## Windsurf

Em `~/.codeium/windsurf/mcp_config.json`:

```json
{
  "mcpServers": {
    "tse": {
      "command": "node",
      "args": ["/caminho/absoluto/mcp-tse/build/lib/bin/mcp-tse.js"]
    }
  }
}
```

---

## VS Code (Cline / MCP nativo)

### VS Code (`.vscode/mcp.json`)

```json
{
  "servers": {
    "tse": {
      "type": "stdio",
      "command": "node",
      "args": ["/caminho/absoluto/mcp-tse/build/lib/bin/mcp-tse.js"]
    }
  }
}
```

### Cline (`cline_mcp_settings.json`)

```json
{
  "mcpServers": {
    "tse": {
      "command": "node",
      "args": ["/caminho/absoluto/mcp-tse/build/lib/bin/mcp-tse.js"],
      "disabled": false
    }
  }
}
```

---

## Continue.dev

Em `~/.continue/config.json`:

```json
{
  "experimental": {
    "modelContextProtocolServers": [
      {
        "transport": {
          "type": "stdio",
          "command": "node",
          "args": ["/caminho/absoluto/mcp-tse/build/lib/bin/mcp-tse.js"]
        }
      }
    ]
  }
}
```

---

## MCP Inspector

```bash
npx @modelcontextprotocol/inspector node build/lib/bin/mcp-tse.js
```

---

## Cliente HTTP/SSE e Cloudflare Worker (REST / JSON-RPC)

No Node.js HTTP/SSE (`GET /mcp` + `POST /messages?sessionId=<id>`):

```bash
MCP_TRANSPORT=http MCP_HTTP_PORT=3000 node build/lib/bin/mcp-tse.js
```

No Cloudflare Worker (JSON-RPC `POST /mcp` e REST `POST /tools/{toolName}`):

```bash
# Health check (GET / ou GET /health)
curl -s https://seu-worker.workers.dev/health | jq .

# Consulta REST direta
curl -s -X POST https://seu-worker.workers.dev/tools/tse_municipios_zonas \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer SEU_TOKEN" \
  -d '{ "uf": "mg", "nome": "Belo Horizonte" }'
```

---

## Ecossistema `@aredes.me/*` (`tse` + `orcamento` + `dadosbr`)

```json
{
  "mcpServers": {
    "tse": {
      "command": "node",
      "args": ["/caminho/absoluto/mcp-tse/build/lib/bin/mcp-tse.js"]
    },
    "orcamento": {
      "command": "node",
      "args": ["/caminho/absoluto/mcp-orcamento/build/lib/bin/mcp-orcamento.js"]
    },
    "dadosbr": {
      "command": "npx",
      "args": ["-y", "@aredes.me/mcp-dadosbr"]
    }
  }
}
```

> *Nota:* `@aredes.me/mcp-dadosbr` possui a versão `0.6.0` publicada no npm (`0.7.0` em `main`); `@aredes.me/mcp-tse` e `@aredes.me/mcp-orcamento` dependem de build local até a primeira release no npm.
