# Política de Privacidade e Transparência LGPD — MCP TSE

Este documento descreve como o **MCP TSE** (`@aredes.me/mcp-tse`) trata dados durante consultas sob demanda a fontes públicas eleitorais do Tribunal Superior Eleitoral (TSE) e define diretrizes de conformidade com a **Lei Geral de Proteção de Dados Pessoais (Lei nº 13.709/2018 — LGPD)** para operadores, integradores e titulares de dados.

> **Importante:** O MCP TSE é um software open source (`AGPL-3.0-only`) executado localmente pelo usuário (CLI `stdio` / `HTTP/SSE`) ou auto-hospedado por um operador (ex.: Cloudflare Workers). Quem implanta e opera uma instância do servidor atua como agente de tratamento (controlador ou operador, conforme o contexto) e é responsável por observar as obrigações legais aplicáveis ao seu ambiente e finalidade.

---

## 1. Escopo de dados consultados sob demanda

O MCP TSE atua exclusivamente como camada de consulta sob demanda (*read-only*, sem API key) a APIs e arquivos estáticos oficiais do TSE:

- **Catálogo de eleições e municípios/zonas:** `tse_eleicoes_catalogo` (`resultados.tse.jus.br/oficial/comum/config/ele-c.json`) e `tse_municipios_zonas` (`mun-e*-cm.json`).
- **Apuração e candidaturas (EA20):** `tse_apuracao_cargo`, `tse_candidatos_busca` e `tse_partidos_federacoes` (`-u.json`), além de comparecimento/abstenção agregada em `tse_comparecimento_abstencao` (`-ab.json`).
- **Catálogo de Dados Abertos (CKAN):** `tse_dados_abertos_datasets` (`dadosabertos.tse.jus.br/api/3/action/`), retornando metadados e links oficiais de pacotes em `cdn.tse.jus.br`.
- **Respeito a barreiras WAF upstream:** o domínio `divulgacandcontas.tse.jus.br` encontra-se protegido por Akamai WAF (HTTP `403`) e **não é consultado nem contornado** por este servidor; a ferramenta `tse_dados_abertos_datasets` informa essa limitação via `upstream_waf_notice`.

---

## 2. Finalidade, adequação e bases legais (LGPD Art. 6º e Art. 7º)

Consultas envolvendo dados nominais de candidaturas (`nm`, `nmu`, suplentes/vices em `vs[]`, data de nascimento `dt`, situação eleitoral `st` e votação nominal em `tse_apuracao_cargo` e `tse_candidatos_busca`) referem-se a dados públicos eleitorais disponibilizados pelo TSE por dever legal de transparência eleitoral, permanecendo sujeitas aos princípios da **LGPD Art. 6º** e **Art. 7º, §§3º-4º**:

- **Finalidade, Adequação e Minimização (LGPD Art. 6º, I–III):** tratar apenas os campos necessários para análise eleitoral, pesquisa acadêmica, jornalismo de dados ou controle social.
- **Qualidade e Transparência (LGPD Art. 6º, V–VI):** conferir informações diretamente na fonte oficial do TSE antes de publicar ou tomar decisões baseadas em resultados intermediários.

---

## 3. Fluxo efêmero vs. cache local/KV e direitos do titular (LGPD Art. 18)

O MCP TSE **não mantém banco de dados permanente próprio**:

- **Repasse efêmero (pass-through):** em execuções sem cache ou após expiração, os dados retornados pelo TSE são apenas normalizados e serializados na resposta ao cliente MCP/HTTP, sem persistência em disco.
- **Cache em memória (CLI Node.js):** `MemoryCache` armazena respostas temporariamente em RAM com capacidade e TTL configuráveis (`MCP_CACHE_SIZE`, padrão `256` entradas; `MCP_CACHE_TTL`, padrão `3600000` ms / 1 hora), descartadas ao reiniciar o processo ou expirar o TTL.
- **Cache e rate limit em borda (Cloudflare Workers):** `KVCache` armazena respostas em `MCP_CACHE` com `expirationTtl >= 60s` (`MIN_KV_EXPIRATION_TTL_SECONDS`), e `MCP_KV` armazena contadores transitórios de rate limit (`rate_limit:<ip>:<bucket>`).
- **Logs e redação:** logs estruturados em `stderr` (`lib/infrastructure/logger.ts`) aplicam mascaramento via `lib/shared/log-redaction.ts` e correlação via `X-Request-Id`.

Nos termos da **LGPD Art. 18**, eventual retificação ou exclusão cadastral no registro primário deve ser solicitada ao TSE; operadores de instâncias auto-hospedadas com cache KV ativo devem invalidar chaves correspondentes caso recebam solicitação procedente antes da expiração do TTL.

---

## 4. Salvaguardas contra homônimos e decisões automatizadas (LGPD Art. 20)

Buscas nominais ou parciais em `tse_candidatos_busca` e listagens nominais de `tse_apuracao_cargo` apresentam risco de **homônimos** (candidatos distintos com nomes ou nomes de urna semelhantes) e eventuais atualizações de situação jurídica/totalização (*revisão de diplomas/anulações*):

1. As respostas de `tse_apuracao_cargo` e `tse_candidatos_busca` incluem obrigatoriamente o campo estruturado `lgpd_notice` (`HOMONYM_HUMAN_REVIEW_NOTICE`, **LGPD Art. 20**).
2. **É vedado** utilizar esses resultados como critério único para decisões automatizadas que afetem direitos de pessoas naturais sem **revisão humana prévia**, verificação de identificadores completos (`sq_candidato`, número, UF/município, pleito) e confirmação direta no portal oficial do TSE.

---

## 5. Canal do Encarregado / DPO (LGPD Art. 41) e incidentes (LGPD Art. 48)

- **Para operadores que auto-hospedam o MCP TSE:** configure a variável de ambiente **`MCP_DPO_CONTACT`** (e-mail institucional ou URL do canal do Encarregado/DPO). No Cloudflare Worker, `GET /` expõe esse valor em `privacy.dpo_contact` (com fallback para esta política) e `/openapi.json` referencia este documento em `info.contact` e `info["x-privacy-policy"]`.
- **Para reportes aos mantenedores do projeto:**
  - Questões gerais de privacidade e documentação: abra uma issue em [github.com/cristianoaredes/mcp-tse/issues](https://github.com/cristianoaredes/mcp-tse/issues) (sem expor dados pessoais sensíveis).
  - Vulnerabilidades ou incidentes de segurança: utilize [GitHub Security Advisories](https://github.com/cristianoaredes/mcp-tse/security/advisories/new).
- **Resposta a incidentes e notificação à ANPD (LGPD Art. 48):** documentada em [`.archagents/10-runbooks.md`](.archagents/10-runbooks.md) (Resolução CD/ANPD nº 15/2024).
