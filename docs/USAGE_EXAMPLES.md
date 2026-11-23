# Exemplos de Uso — MCP TSE

_Exemplos reais para todas as 7 ferramentas do `@aredes.me/mcp-tse` (`0.1.0`), obtidos via execução `stdio` contra as APIs oficiais do TSE em `2026-11-23`, além de fluxo cruzado com `@aredes.me/mcp-orcamento` e `@aredes.me/mcp-dadosbr`._

## Índice

- [1. `tse_eleicoes_catalogo` — Catálogo Oficial de Eleições (`ele-c.json`)](#1-tse_eleicoes_catalogo--catálogo-oficial-de-eleições-ele-cjson)
- [2. `tse_municipios_zonas` — Tradução IBGE ↔ TSE e Zonas Eleitorais](#2-tse_municipios_zonas--tradução-ibge--tse-e-zonas-eleitorais)
- [3. `tse_apuracao_cargo` — Totalização e Ranking por Cargo](#3-tse_apuracao_cargo--totalização-e-ranking-por-cargo)
- [4. `tse_candidatos_busca` — Busca Nominal de Candidatos e Vices](#4-tse_candidatos_busca--busca-nominal-de-candidatos-e-vices)
- [5. `tse_partidos_federacoes` — Desempenho de Partidos e Federações](#5-tse_partidos_federacoes--desempenho-de-partidos-e-federações)
- [6. `tse_comparecimento_abstencao` — Eleitorado, Comparecimento e Abstenção](#6-tse_comparecimento_abstencao--eleitorado-comparecimento-e-abstenção)
- [7. `tse_dados_abertos_datasets` — Catálogo CKAN e Pacotes `cdn.tse.jus.br`](#7-tse_dados_abertos_datasets--catálogo-ckan-e-pacotes-cdntsejusbr)
- [8. Fluxo Investigativo Cruzado (`tse` + `orcamento` + `dadosbr`)](#8-fluxo-investigativo-cruzado-tse--orcamento--dadosbr)

---

## 1. `tse_eleicoes_catalogo` — Catálogo Oficial de Eleições (`ele-c.json`)

**Prompt:** *"Liste os últimos registros de eleições publicados no catálogo oficial do TSE."*

```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "tools/call",
  "params": {
    "name": "tse_eleicoes_catalogo",
    "arguments": { "limit": 2 }
  }
}
```

**Trecho real observado (`total_matches: 62`, `returned: 2`):**
```json
{
  "total_matches": 62,
  "returned": 2,
  "filters": { "tipo": "todas", "limit": 2 },
  "eleicoes": [
    {
      "codigo_pleito": "3220",
      "ciclo": "ele2026",
      "data_eleicao": "04/10/2026",
      "ano": 2026,
      "codigo_eleicao": "6257",
      "codigo_segundo_turno": "6258",
      "nome": "Eleição Ordinária Federal - 2026 1º Turno",
      "turno": "1",
      "tipo": "ordinaria",
      "abrangencias": ["br"],
      "cargos": [{ "codigo": "1", "descricao": "Presidente" }]
    },
    {
      "codigo_pleito": "3220",
      "ciclo": "ele2026",
      "data_eleicao": "04/10/2026",
      "ano": 2026,
      "codigo_eleicao": "6259",
      "codigo_segundo_turno": "6260",
      "nome": "Eleição Ordinária Estadual - 2026 1º Turno",
      "turno": "1",
      "tipo": "ordinaria"
    }
  ]
}
```

---

## 2. `tse_municipios_zonas` — Tradução IBGE ↔ TSE e Zonas Eleitorais

**Prompt:** *"Qual o código TSE e quais as zonas eleitorais de Belo Horizonte (`uf: mg`)?"*

```json
{
  "jsonrpc": "2.0",
  "id": 2,
  "method": "tools/call",
  "params": {
    "name": "tse_municipios_zonas",
    "arguments": { "uf": "mg", "nome": "Belo Horizonte", "limit": 2 }
  }
}
```

**Trecho real observado:**
```json
{
  "ciclo": "ele2024",
  "codigo_eleicao": "619",
  "total_matches": 1,
  "returned": 1,
  "municipios": [
    {
      "codigo_tse": "41238",
      "codigo_ibge": "3106200",
      "nome": "BELO HORIZONTE",
      "uf": "MG",
      "capital": true,
      "zonas_eleitorais": ["0028", "0038", "0334", "0037", "0030", "0034"]
    }
  ],
  "source": "TSE Resultados — Municípios e Zonas Eleitorais (EA20)",
  "source_url": "https://resultados.tse.jus.br/oficial/ele2024/619/config/mun-e000619-cm.json",
  "fetchedAt": "2026-11-23T13:12:40.862Z"
}
```

---

## 3. `tse_apuracao_cargo` — Totalização e Ranking por Cargo

**Prompt:** *"Mostre o resultado da apuração para `cargo: presidente` com percentual de seções totalizadas e os 2 primeiros colocados."*

```json
{
  "jsonrpc": "2.0",
  "id": 3,
  "method": "tools/call",
  "params": {
    "name": "tse_apuracao_cargo",
    "arguments": { "cargo": "presidente", "limit": 2 }
  }
}
```

*Nota:* por `TCK-0003`, `cargo: "presidente"` usa automaticamente `ciclo: "ele2026"`, `codigo_eleicao: "6257"`. Para `governador`/`senador`/`deputado_*`, usa `ele2026/6259` (exigindo `uf`). Para `prefeito`/`vereador`, usa `ele2024/619` (exigindo `uf` e `codigo_tse_municipio`).

**Trecho real observado:**
```json
{
  "ciclo": "ele2026",
  "codigo_eleicao": "6257",
  "cargo": "presidente",
  "uf": "br",
  "cargo_nome": "Presidente",
  "secoes": {
    "total": 499248,
    "totalizadas": 499248,
    "pct_totalizadas": "100,00"
  },
  "eleitorado": {
    "aptos": 158745502,
    "comparecimento": 125275835,
    "pct_comparecimento": "78,92",
    "abstencao": 33469244,
    "pct_abstencao": "21,08"
  },
  "votos": {
    "total": 125275835,
    "validos": 119300788,
    "brancos": 2300798,
    "nulos": 3669003
  },
  "pagination": { "page": 1, "limit": 2, "total": 12, "total_pages": 6, "has_more": true },
  "candidatos": [
    {
      "numero": "22",
      "sq_candidato": "280002551544",
      "nome_urna": "FLAVIO BOLSONARO",
      "partido": "PL",
      "votos": 56104503,
      "pct_votos_validos": "47,03"
    },
    {
      "numero": "13",
      "sq_candidato": "280002542548",
      "nome_urna": "LULA",
      "partido": "PT",
      "votos": 53879538,
      "pct_votos_validos": "45,16"
    }
  ],
  "source_url": "https://resultados.tse.jus.br/oficial/ele2026/6257/dados/br/br-c0001-e006257-u.json",
  "fetchedAt": "2026-11-23T13:12:40.463Z"
}
```

---

## 4. `tse_candidatos_busca` — Busca Nominal de Candidatos e Vices

**Prompt:** *"Busque candidatos com nome `Nunes` ao cargo de prefeito em São Paulo (`uf: sp`, `codigo_tse_municipio: 71072`)."*

```json
{
  "jsonrpc": "2.0",
  "id": 4,
  "method": "tools/call",
  "params": {
    "name": "tse_candidatos_busca",
    "arguments": {
      "cargo": "prefeito",
      "uf": "sp",
      "codigo_tse_municipio": "71072",
      "nome": "Nunes",
      "limit": 2
    }
  }
}
```

**Trecho real observado (`ele2024/619` aplicado automaticamente para `prefeito`):**
```json
{
  "ciclo": "ele2024",
  "codigo_eleicao": "619",
  "cargo": "prefeito",
  "uf": "sp",
  "codigo_tse_municipio": "71072",
  "total_matches": 1,
  "returned": 1,
  "candidatos": [
    {
      "numero": "15",
      "sq_candidato": "250002098117",
      "nome": "RICARDO LUIS REIS NUNES",
      "nome_urna": "RICARDO NUNES",
      "partido": "MDB",
      "eleito": true,
      "situacao": "2º turno",
      "votos": 1801139,
      "pct_votos_validos": "29,48",
      "vices_suplentes": [
        {
          "tipo": "v",
          "sq_candidato": "250002098118",
          "nome_urna": "CORONEL MELLO ARAUJO",
          "partido": "PL"
        }
      ]
    }
  ],
  "source_url": "https://resultados.tse.jus.br/oficial/ele2024/619/dados/sp/sp71072-c0011-e000619-u.json",
  "lgpd_notice": "LGPD Art. 20 Notice (Revisão Humana Obrigatória): Name-based and partial-text electoral lookups carry risk of homonyms..."
}
```

---

## 5. `tse_partidos_federacoes` — Desempenho de Partidos e Federações

**Prompt:** *"Mostre as federações e os 2 partidos com mais votos na eleição presidencial (`cargo: presidente`)."*

```json
{
  "jsonrpc": "2.0",
  "id": 5,
  "method": "tools/call",
  "params": {
    "name": "tse_partidos_federacoes",
    "arguments": { "cargo": "presidente", "limit": 2 }
  }
}
```

**Trecho real observado:**
```json
{
  "ciclo": "ele2026",
  "codigo_eleicao": "6257",
  "cargo": "presidente",
  "uf": "br",
  "total_federacoes": 1,
  "federacoes": [
    {
      "codigo": "101",
      "sigla": "PT/PC do B/PV",
      "nome": "FEDERAÇÃO BRASIL DA ESPERANÇA - FE BRASIL",
      "composicao": "PT/PC do B/PV",
      "numeros_partidos": ["13", "43", "65"]
    }
  ],
  "total_partidos": 12,
  "returned_partidos": 2,
  "partidos": [
    {
      "numero": "22",
      "sigla": "PL",
      "tvtn": 56104503,
      "tvan": 56104503,
      "votos_legenda": 0,
      "total_candidatos": 1,
      "total_eleitos": 1
    },
    {
      "numero": "13",
      "sigla": "PT",
      "federacao_codigo": "101",
      "tvtn": 53879538,
      "tvan": 53879538,
      "votos_legenda": 0,
      "total_candidatos": 1,
      "total_eleitos": 1
    }
  ],
  "source_url": "https://resultados.tse.jus.br/oficial/ele2026/6257/dados/br/br-c0001-e006257-u.json"
}
```

---

## 6. `tse_comparecimento_abstencao` — Eleitorado, Comparecimento e Abstenção

**Prompt:** *"Consulte comparecimento e abstenção em São Paulo capital (`uf: sp`, `codigo_tse_municipio: 71072`)."*

```json
{
  "jsonrpc": "2.0",
  "id": 6,
  "method": "tools/call",
  "params": {
    "name": "tse_comparecimento_abstencao",
    "arguments": { "uf": "sp", "codigo_tse_municipio": "71072" }
  }
}
```

**Trecho real observado (`ele2026/6257` padrão fixo em `tse_comparecimento_abstencao`):**
```json
{
  "ciclo": "ele2026",
  "codigo_eleicao": "6257",
  "turno": "1",
  "uf": "sp",
  "codigo_tse_municipio": "71072",
  "total_abrangencias": 1,
  "returned": 1,
  "truncated": false,
  "abr": [
    {
      "tpabr": "mun",
      "cdabr": "71072",
      "andamento": "f",
      "dt": "04/10/2026",
      "s": { "ts": 26683, "st": 26683, "pst": "100,00" },
      "e": { "te": 9145124, "c": 7006411, "pc": "76,61", "a": 2138713, "pa": "23,39" }
    }
  ],
  "source_url": "https://resultados.tse.jus.br/oficial/ele2026/6257/dados/sp/sp-e006257-ab.json"
}
```

---

## 7. `tse_dados_abertos_datasets` — Catálogo CKAN e Pacotes `cdn.tse.jus.br`

**Prompt:** *"Busque pacotes de prestação de contas no portal Dados Abertos do TSE."*

```json
{
  "jsonrpc": "2.0",
  "id": 7,
  "method": "tools/call",
  "params": {
    "name": "tse_dados_abertos_datasets",
    "arguments": { "query": "prestacao de contas", "rows": 2 }
  }
}
```

**Trecho real observado (`total_count: 26`, `returned: 2`):**
```json
{
  "mode": "package_search",
  "query": "prestacao de contas",
  "total_count": 26,
  "returned": 2,
  "packages": [
    {
      "id": "0182d96d-932c-4690-b9e7-851b001950dd",
      "name": "prestacao-de-contas-partidarias-2026",
      "title": "Prestação de Contas Partidárias - 2026",
      "organization": "TSE/ASEPA",
      "num_resources": 2,
      "resources": [
        {
          "name": "Prestação de contas anual partidária",
          "format": "CSV",
          "url": "https://cdn.tse.jus.br/estatistica/sead/odsele/prestacao_contas_anual_partidaria/prestacao_contas_anual_partidaria_2026.zip"
        }
      ]
    }
  ]
}
```

---

## 8. Fluxo Investigativo Cruzado (`tse` + `orcamento` + `dadosbr`)

1. **Eleitoral (`mcp-tse`):** traduza o município em `tse_municipios_zonas` (`codigo_tse` + `codigo_ibge: "3106200"`), consulte o pleito desejado via `tse_eleicoes_catalogo` e obtenha candidaturas e URLs de prestação de contas via `tse_candidatos_busca` / `tse_dados_abertos_datasets`.
2. **Orçamentário (`mcp-orcamento`):** passe o mesmo `codigo_ibge` (`3106200`) para `siconfi_rreo`, `siconfi_rgf` e `siconfi_extrato_entregas` ou consulte Emendas Pix via `transferegov_emendas_especiais`.
3. **Empresarial & Sancionatório (`@aredes.me/mcp-dadosbr`):** audite CNPJs de fornecedores e doadores de campanha encontrados nos pacotes CSV (`cdn.tse.jus.br`) com `cnpj_lookup`, `tcu_certidoes`, `ceis_cnep_lookup`, `transparencia_lookup`, `pncp_licitacoes` e `querido_diario`.
