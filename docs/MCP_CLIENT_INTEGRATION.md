# Guia de Integração em Clientes MCP — MCP TSE

_Como configurar o `@aredes.me/mcp-tse` (`0.1.0`) no Claude Desktop, Claude Code, Cursor, Windsurf, VS Code (Cline), Continue.dev, MCP Inspector e clientes HTTP/REST._

> **Distribuição (`2026-11-23`):** O pacote [`@aredes.me/mcp-tse`](https://www.npmjs.com/package/@aredes.me/mcp-tse) (`0.1.0`) está publicado no **npm**. Utilize `npx -y @aredes.me/mcp-tse` nos clientes abaixo (ou compile localmente com `npm ci && npm run build` apontando para `build/lib/bin/mcp-tse.js`).

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

### Via npm (`npx`, recomendado)

```json
{
  "mcpServers": {
    "tse": {
      "command": "npx",
      "args": ["-y", "@aredes.me/mcp-tse"],
      "env": {
        "MCP_API_TIMEOUT": "12000",
        "LOG_LEVEL": "warn"
      }
    }
  }
}
```

### Usando build local (desenvolvimento/auditoria)

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

---

## Claude Code

```bash
claude mcp add tse -- npx -y @aredes.me/mcp-tse
```

Ou no `.mcp.json` do projeto (para execução local a partir do código-fonte, substitua `command`/`args` por `node /caminho/absoluto/mcp-tse/build/lib/bin/mcp-tse.js`):

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

## Cursor

Em `.cursor/mcp.json` ou nas configurações globais MCP do Cursor:

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

## Windsurf

Em `~/.codeium/windsurf/mcp_config.json`:

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

## VS Code (Cline / MCP nativo)

### VS Code (`.vscode/mcp.json`)

```json
{
  "servers": {
    "tse": {
      "type": "stdio",
      "command": "npx",
      "args": ["-y", "@aredes.me/mcp-tse"]
    }
  }
}
```

### Cline (`cline_mcp_settings.json`)

```json
{
  "mcpServers": {
    "tse": {
      "command": "npx",
      "args": ["-y", "@aredes.me/mcp-tse"],
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
          "command": "npx",
          "args": ["-y", "@aredes.me/mcp-tse"]
        }
      }
    ]
  }
}
```

---

## MCP Inspector

```bash
npx @modelcontextprotocol/inspector npx -y @aredes.me/mcp-tse
```

---

## Cliente HTTP/SSE e Cloudflare Worker (REST / JSON-RPC)

No Node.js HTTP/SSE (`GET /mcp` + `POST /messages?sessionId=<id>`):

```bash
MCP_TRANSPORT=http MCP_HTTP_PORT=3000 npx -y @aredes.me/mcp-tse
# Ou a partir do build local:
# MCP_TRANSPORT=http MCP_HTTP_PORT=3000 node build/lib/bin/mcp-tse.js
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
      "command": "npx",
      "args": ["-y", "@aredes.me/mcp-tse"]
    },
    "orcamento": {
      "command": "npx",
      "args": ["-y", "@aredes.me/mcp-orcamento"]
    },
    "dadosbr": {
      "command": "npx",
      "args": ["-y", "@aredes.me/mcp-dadosbr"]
    }
  }
}
```

> Todos os pacotes acima (`@aredes.me/mcp-tse@0.1.0`, `@aredes.me/mcp-orcamento@0.1.0` e `@aredes.me/mcp-dadosbr@0.7.0`) estão publicados no registro npm (ou use `node build/lib/bin/*.js` para execuções a partir do código-fonte).
