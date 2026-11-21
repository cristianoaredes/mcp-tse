# CI, ambientes e publicação

Base inicial: `v0.1.0` (`SPC-0001`).

- **CI (`.github/workflows/ci.yml`):** matriz Node `22.x`, `24.x`, `26.x` executando `npm ci`, `npm run build`, `npm run test:coverage` e `npm run test:transport`; job `lint` com `npm audit --omit=dev --audit-level=high`, `tsc --noEmit`, `tsc -p tsconfig.worker.json --noEmit` e guarda de tamanho de `lib/core/mcp-server.ts` (`<= 180` linhas); job `cloudflare` validando `npm run build:worker` e teto de `1 MB` em `build/lib/workers/worker.js`.
- **Cloudflare Workers (`wrangler.toml`):** usa namespaces placeholder `00000000000000000000000000000001` (prod/default) e `00000000000000000000000000000002` (staging/preview) até provisionamento explícito no Cloudflare Dashboard.

## Fontes

- `.github/workflows/ci.yml`
- `wrangler.toml`
- `package.json`
