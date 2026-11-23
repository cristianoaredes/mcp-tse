# Contributing to MCP TSE

_Obrigado por seu interesse em contribuir! / Thank you for your interest in contributing!_

## Idiomas / Languages

- [Português](#português)
- [English](#english)

---

## Português

Damos as boas-vindas a contribuições de desenvolvedores, pesquisadores e jornalistas de dados! Este guia descreve a arquitetura real do repositório, os requisitos de qualidade e o fluxo de contribuição do **MCP TSE** (`@aredes.me/mcp-tse`).

### Início rápido

Use **Node.js 22.12+**, **24** ou **26** (`engines.node` em [`package.json`](package.json#L82-L84)).

1. **Faça um fork** do repositório no GitHub.
2. **Clone** o seu fork:
   ```bash
   git clone https://github.com/seu-usuario/mcp-tse.git
   cd mcp-tse
   ```
3. **Instale** as dependências:
   ```bash
   npm ci
   ```
4. **Compile** o CLI Node.js e o Cloudflare Worker:
   ```bash
   npm run build
   npm run build:worker
   ```
5. **Execute** a suíte completa de testes e o smoke de transporte:
   ```bash
   npm test
   npm run test:coverage
   npm run test:transport
   ```

### Arquitetura modular (`lib/`)

Diferente de protótipos em arquivo único, o **MCP TSE** separa núcleo Web-standard, ferramentas TSE, adapters Node.js e runtime Cloudflare Workers em módulos ESM TypeScript (`"type": "module"`):

- `lib/bin/mcp-tse.ts` — ponto de entrada do binário CLI (`mcp-tse`).
- `lib/config/` — hierarquia de configuração (`.mcprc.json` e variáveis de ambiente), allowlist SSRF (`resultados.tse.jus.br`, `dadosabertos.tse.jus.br`, `cdn.tse.jus.br`) e timeouts centralizados.
- `lib/core/` — servidor MCP (`mcp-server.ts`, mantido em até **180 linhas** no CI sem `node:fs`), registro idempotente (`registry.ts`), `TOOL_SCHEMAS` (`tool-schemas.ts`), orquestração e métricas RED (`tools.ts`), `MemoryCache`/`KVCache` (`cache.ts`) e cliente HTTP com *circuit breaker* e retry por origem (`http-client.ts`).
- `lib/infrastructure/` — logger JSON em `stderr` (`logger.ts`), `RateLimiter`, correlação `X-Request-Id` via Web Crypto (`tracing.ts`) e `CircuitBreaker`.
- `lib/shared/` — módulos Web-standard compartilhados: schemas Zod `.strict()` (`tse-schemas.ts`), sanitização agêntica e teto de saída (`agentic-guard.ts`), avisos LGPD Art. 20 (`compliance-notices.ts`), redação de segredos em logs (`log-redaction.ts`), erros tipados e constantes.
- `lib/tools/` — implementação das **7 ferramentas TSE**: EA20 (`tse-resultados.ts`), CKAN APIv3 (`tse-ckan.ts`) e registro (`index.ts`).
- `lib/adapters/` — transporte `stdio` / CLI (`cli.ts`), servidor Express `HTTP/SSE` com proteção de `Host`/`Origin`/`MCP_API_KEY` (`cli-http.ts`) e adaptador Cloudflare Workers (`cloudflare.ts`).
- `lib/workers/` — roteador do Worker (`worker.ts`), `/tools/{toolName}` REST (`rest.ts`), OpenAPI 3.0 (`openapi.ts`), SSE (`sse.ts`), auth *constant-time* (`auth.ts`), OAuth *fail-closed* (`oauth.ts`) e rate limit em `MCP_KV` (`rate-limit.ts`).

### Regras técnicas inegociáveis

- **Paridade Web-standard:** nunca importe módulos `node:*` em `lib/shared/`, `lib/tools/`, `lib/core/`, `lib/infrastructure/` ou `lib/workers/`. Valide sempre com `npx tsc -p tsconfig.worker.json --noEmit` e `npm run build:worker` (`worker.js <= 1 MB`).
- **Integridade do `stdio`:** `stdout` é exclusivo de mensagens JSON-RPC; todo log ou métrica deve ir para `stderr` (`console.error` / `Logger`).
- **Validação estrita & allowlist:** toda ferramenta deve usar schema Zod `.strict()` sem parâmetro `api_key`, manter entrada em `.archagents/mcp-tool-allowlist.json` e nunca cachear falhas HTTP ou payloads inválidos.
- **Política WAF e LGPD:** nunca contorne o Akamai WAF (HTTP `403`) de `divulgacandcontas.tse.jus.br` nem remova `lgpd_notice` (`HOMONYM_HUMAN_REVIEW_NOTICE`) de consultas nominais (`tse_apuracao_cargo` e `tse_candidatos_busca`).
- **Cobertura mínima:** o Vitest exige `>= 85%` em `lines`, `functions`, `statements` e `>= 80%` em `branches` ([`vitest.config.ts`](vitest.config.ts#L33-L38)).

### Fluxo de trabalho, branches e governança (`.archagents/`)

O repositório segue fluxo **trunk-based em `main`** com branches de trabalho e Pull Requests revisados pelo CI (`.github/workflows/ci.yml`):

1. Crie uma branch a partir de `main` atualizada (`feat/<escopo>`, `fix/<escopo>` ou `docs/<escopo>`):
   ```bash
   git checkout main
   git pull origin main
   git checkout -b feat/sua-melhoria
   ```
2. Para mudanças substanciais ou alterações em ferramentas/segurança, consulte a governança em [`.archagents/README.md`](.archagents/README.md) (ciclo `codebase-ops`: ticket → design → execução → verificação independente).
3. Antes de abrir o PR para `main`, execute todas as checagens locais:
   ```bash
   npm run build && npm run build:worker
   npx tsc --noEmit && npx tsc -p tsconfig.worker.json --noEmit
   npm run test:coverage
   npm run test:transport
   ```
4. Use **Conventional Commits** (`feat(tse): ...`, `fix(worker): ...`, `docs(readme): ...`, `test(schemas): ...`, `chore(ops): ...`).
5. Nunca comite segredos, tokens, arquivos `.mcprc.json` reais ou IDs reais de Cloudflare KV no `wrangler.toml`.

### Relato de bugs e segurança

- **Bugs e sugestões:** abra uma [issue no GitHub](https://github.com/cristianoaredes/mcp-tse/issues/new) informando versão do Node.js, modo de execução (`stdio`, `HTTP/SSE` ou Worker), comando/payload de entrada e logs relevantes (sem dados pessoais sensíveis).
- **Vulnerabilidades de segurança:** utilize [GitHub Security Advisories](https://github.com/cristianoaredes/mcp-tse/security/advisories/new) em vez de abrir issue pública.

---

## English

We welcome contributions from developers, researchers, and data journalists! This guide covers the actual repository architecture, quality gates, and pull request workflow for **MCP TSE** (`@aredes.me/mcp-tse`).

### Quick Start

Use **Node.js 22.12+**, **24**, or **26** (`engines.node` in [`package.json`](package.json#L82-L84)).

1. **Fork** the repository on GitHub.
2. **Clone** your fork:
   ```bash
   git clone https://github.com/your-username/mcp-tse.git
   cd mcp-tse
   ```
3. **Install** dependencies:
   ```bash
   npm ci
   ```
4. **Build** both the Node.js CLI and the Cloudflare Worker targets:
   ```bash
   npm run build
   npm run build:worker
   ```
5. **Run** unit tests, coverage, and transport integration checks:
   ```bash
   npm test
   npm run test:coverage
   npm run test:transport
   ```

### Modular Architecture (`lib/`)

Unlike single-file prototypes, **MCP TSE** separates its Web-standard core, TSE tools, Node.js adapters, and Cloudflare Worker runtime into ESM TypeScript modules (`"type": "module"`):

- `lib/bin/mcp-tse.ts` — CLI binary entrypoint (`mcp-tse`).
- `lib/config/` — configuration hierarchy (`.mcprc.json` + env vars), SSRF host allowlists (`resultados.tse.jus.br`, `dadosabertos.tse.jus.br`, `cdn.tse.jus.br`), and centralized timeouts.
- `lib/core/` — MCP server (`mcp-server.ts`, CI-guarded `<= 180` lines with zero `node:fs`), idempotent registry (`registry.ts`), `TOOL_SCHEMAS` (`tool-schemas.ts`), tool runner and RED metrics (`tools.ts`), `MemoryCache`/`KVCache` (`cache.ts`), and per-origin circuit breaker HTTP client (`http-client.ts`).
- `lib/infrastructure/` — structured JSON logger on `stderr` (`logger.ts`), `RateLimiter`, Web Crypto `X-Request-Id` tracing (`tracing.ts`), and `CircuitBreaker`.
- `lib/shared/` — Web-standard modules: Zod `.strict()` schemas (`tse-schemas.ts`), prompt-injection sanitization & bounded output serialization (`agentic-guard.ts`), LGPD Art. 20 notices (`compliance-notices.ts`), log redaction (`log-redaction.ts`), typed errors, and constants.
- `lib/tools/` — **7 TSE tools**: EA20 Resultados (`tse-resultados.ts`), CKAN APIv3 (`tse-ckan.ts`), and barrel registration (`index.ts`).
- `lib/adapters/` — `stdio` / `HTTP+SSE` CLI adapter (`cli.ts`), Express SSE server with `Host`/`Origin`/`MCP_API_KEY` guards (`cli-http.ts`), and Cloudflare adapter (`cloudflare.ts`).
- `lib/workers/` — Cloudflare Worker router (`worker.ts`), `POST /tools/{toolName}` REST handler (`rest.ts`), OpenAPI 3.0 schema (`openapi.ts`), SSE (`sse.ts`), constant-time API key auth (`auth.ts`), fail-closed OAuth (`oauth.ts`), and KV rate limiting (`rate-limit.ts`).

### Non-Negotiable Technical Rules

- **Web-standard parity:** never import `node:*` built-ins in `lib/shared/`, `lib/tools/`, `lib/core/`, `lib/infrastructure/`, or `lib/workers/`. Verify with `npx tsc -p tsconfig.worker.json --noEmit` and `npm run build:worker` (`worker.js <= 1 MB`).
- **`stdio` framing integrity:** keep `stdout` strictly for JSON-RPC messages; write all logs and metrics to `stderr`.
- **Strict validation & allowlist:** every tool must define a Zod `.strict()` schema without `api_key`, stay registered in `.archagents/mcp-tool-allowlist.json`, and never cache failed HTTP responses or malformed upstream payloads.
- **WAF & LGPD policy:** never attempt to bypass the Akamai WAF (`403`) on `divulgacandcontas.tse.jus.br`, and preserve `lgpd_notice` (`HOMONYM_HUMAN_REVIEW_NOTICE`) on nominal lookups (`tse_apuracao_cargo`, `tse_candidatos_busca`).
- **Coverage thresholds:** Vitest enforces `>= 85%` lines/functions/statements and `>= 80%` branches ([`vitest.config.ts`](vitest.config.ts#L33-L38)).

### Branch Workflow & Governance (`.archagents/`)

This repository uses a **`main` + feature-branch Pull Request** workflow verified by GitHub Actions (`.github/workflows/ci.yml`):

1. Branch directly off an up-to-date `main` (`feat/<scope>`, `fix/<scope>`, or `docs/<scope>`):
   ```bash
   git checkout main
   git pull origin main
   git checkout -b feat/your-change
   ```
2. For non-trivial changes or tool/security updates, follow the `codebase-ops` lifecycle documented in [`.archagents/README.md`](.archagents/README.md) (`ticket` → `design` → `execute` → `verify`).
3. Before opening a PR targeting `main`, run all local checks:
   ```bash
   npm run build && npm run build:worker
   npx tsc --noEmit && npx tsc -p tsconfig.worker.json --noEmit
   npm run test:coverage
   npm run test:transport
   ```
4. Follow **Conventional Commits** (`feat(tse): ...`, `fix(worker): ...`, `docs(readme): ...`, `test(schemas): ...`, `chore(ops): ...`).
5. Never commit secrets, `.mcprc.json` files with credentials, or live Cloudflare KV namespace IDs in `wrangler.toml`.

### Bug Reports & Security

- **Bugs & feature requests:** open a [GitHub issue](https://github.com/cristianoaredes/mcp-tse/issues/new) with your Node.js version, execution mode (`stdio`, `HTTP/SSE`, or Worker), tool parameters, and sanitized logs.
- **Security vulnerabilities:** report privately via [GitHub Security Advisories](https://github.com/cristianoaredes/mcp-tse/security/advisories/new).

---

**License / Licença:** [GNU AGPL-3.0-only](LICENSE) · **Maintained by / Mantido por:** [Orqo](https://orqo.pro/) / [Cristiano Arêdes](https://github.com/cristianoaredes) ([cristiano@aredes.me](mailto:cristiano@aredes.me))
