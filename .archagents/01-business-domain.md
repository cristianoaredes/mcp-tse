# Domínio e regras

Base inicial: `v0.1.0` (`SPC-0001`).

O domínio cobre consultas eleitorais oficiais do TSE sem chave de API:

- `tse_eleicoes_catalogo`: consulta `comum/config/ele-c.json` (`pl[].e[]`), filtrando por `ano`, `tipo` (`ordinaria`, `suplementar`, `todas`), `uf` e `limit` (1..50).
- `tse_municipios_zonas`: consulta `mun-e<ele6>-cm.json`, exigindo ao menos um filtro (`uf`, `codigo_ibge`, `codigo_tse` ou `nome`) para traduzir código TSE (5 dígitos) ↔ IBGE (7 dígitos), flag de capital e zonas eleitorais.
- `tse_apuracao_cargo`, `tse_candidatos_busca` e `tse_partidos_federacoes`: consultam EA20 `-u.json` (`carg[0].agr[].par[].cand[]` e `carg[0].fed[]`) aplicando validação de escopo por cargo (`prefeito`/`vereador` exigem UF 2 letras != `br` + `codigo_tse_municipio`; cargos estaduais/distritais exigem UF 2 letras != `br`; `presidente` aceita `br` ou UF 2 letras).
- `tse_comparecimento_abstencao`: consulta EA20 `-ab.json` (`abr[]`: seções, eleitores aptos, comparecimento e abstenção), exigindo UF 2 letras != `br` quando `codigo_tse_municipio` é informado.
- `tse_dados_abertos_datasets`: consulta CKAN APIv3 (`package_search` / `package_show`), retornando recursos em `cdn.tse.jus.br`, orientação de cruzamento com `cnpj_lookup` (`@aredes.me/mcp-dadosbr`) e `upstream_waf_notice` sobre `divulgacandcontas.tse.jus.br` (HTTP `403` Akamai WAF, nunca contornado).

## Fontes

- `lib/shared/tse-schemas.ts`
- `lib/tools/tse-resultados.ts`
- `lib/tools/tse-ckan.ts`
- `lib/shared/compliance-notices.ts`
