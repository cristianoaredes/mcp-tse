# Integrações

Base inicial: `v0.1.0` (`SPC-0001`).

- **TSE Resultados (EA20 JSON estático):** base padrão `https://resultados.tse.jus.br/oficial/` (override via `TSE_RESULTADOS_BASE_URL`), restrita pela allowlist `ALLOWED_TSE_RESULTADOS_HOSTS` (`resultados.tse.jus.br`, `cdn.tse.jus.br`). Consome `comum/config/ele-c.json`, `<ciclo>/<ele>/config/mun-e<ele6>-cm.json`, `<ciclo>/<ele>/dados/<uf>/<prefix>-c<cargo>-e<ele6>-u.json` e `<ciclo>/<ele>/dados/<uf>/<uf>-e<ele6>-ab.json`.
- **TSE Dados Abertos (CKAN APIv3):** base padrão `https://dadosabertos.tse.jus.br/api/3/action/` (override via `TSE_CKAN_BASE_URL`), restrita pela allowlist `ALLOWED_TSE_CKAN_HOSTS` (`dadosabertos.tse.jus.br`, `cdn.tse.jus.br`). Consome `package_search` e `package_show`.
- **WAF upstream (`divulgacandcontas.tse.jus.br`):** retorna HTTP `403` (Akamai WAF) para clientes automatizados e **não é consultado nem contornado**. A ferramenta `tse_dados_abertos_datasets` documenta esse bloqueio em `upstream_waf_notice` e orienta o uso dos arquivos CSV/ZIP do CKAN/CDN e cruzamento com `cnpj_lookup` (`@aredes.me/mcp-dadosbr`).
- **Resiliência HTTP (`lib/core/http-client.ts`):** circuit breaker isolado por origem (`getUpstreamKey`), retry com equal jitter para status `429, 500, 502, 503, 504` e erros de rede, timeout controlado via `AbortController` e política estrita de **nunca cachear erros ou respostas malformadas**.

## Fontes

- `lib/config/index.ts`
- `lib/core/http-client.ts`
- `lib/tools/tse-resultados.ts`
- `lib/tools/tse-ckan.ts`
