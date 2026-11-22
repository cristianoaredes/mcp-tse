import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { resolveApiConfig } from "../../lib/config/index.js";
import { MemoryCache } from "../../lib/core/cache.js";
import { resetCircuitBreakers } from "../../lib/core/http-client.js";
import { executeTool, resetMetrics } from "../../lib/core/tools.js";
import { UNTRUSTED_EXTERNAL_DATA_NOTICE } from "../../lib/shared/agentic-guard.js";
import { HOMONYM_HUMAN_REVIEW_NOTICE } from "../../lib/shared/compliance-notices.js";
import {
  TseApuracaoCargoSchema,
  TseCandidatosBuscaSchema,
  TsePartidosFederacoesSchema,
} from "../../lib/shared/tse-schemas.js";

const ROOT = resolve(import.meta.dirname, "../..");

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

const SAMPLE_ELE_C = {
  dg: "21/11/2026",
  hg: "10:00:00",
  pl: [
    {
      cd: "3220",
      c: "ele2026",
      dt: "04/10/2026",
      e: [
        {
          cd: "6257",
          cdt2: "6258",
          nm: "Eleição Ordinária Federal - 2026 1º Turno",
          t: "1",
          tp: "8",
          abr: [{ cd: "br", cp: [{ cd: "1", ds: "Presidente" }] }],
        },
        {
          cd: "6259",
          cdt2: "6260",
          nm: "Eleição Ordinária Estadual - 2026 1º Turno",
          t: "1",
          tp: "1",
          abr: [
            {
              cd: "br",
              cp: [
                { cd: "3", ds: "Governador" },
                { cd: "5", ds: "Senador" },
              ],
            },
          ],
        },
      ],
    },
    {
      cd: "452",
      c: "ele2024",
      dt: "06/10/2024",
      e: [
        {
          cd: "619",
          cdt2: "620",
          nm: "Eleição Ordinária Municipal - 2024",
          t: "1",
          tp: "3",
          abr: [{ cd: "br", cp: [{ cd: "11", ds: "Prefeito" }, { cd: "13", ds: "Vereador" }] }],
        },
        {
          cd: "635",
          cdt2: "",
          nm: "Consulta Popular - São Luís",
          t: "1",
          tp: "7",
          abr: [{ cd: "ma", cp: [{ cd: "51", ds: "Passe livre" }] }],
        },
      ],
    },
    {
      cd: "900",
      c: "ele2024",
      dt: "06/04/2025",
      e: [
        {
          cd: "6120",
          cdt2: "",
          nm: "Eleição Suplementar - Paranhos",
          t: "1",
          tp: "4",
          abr: [{ cd: "ms", cp: [{ cd: "11", ds: "Prefeito" }] }],
        },
      ],
    },
  ],
};

const SAMPLE_MUN_CM = {
  dg: "06/10/2024",
  hg: "18:00:00",
  abr: [
    {
      cd: "sp",
      mu: [
        { cd: "71072", cdi: "3550308", nm: "SÃO PAULO", c: "s", z: ["0001", "0002"] },
        { cd: "64718", cdi: "3509502", nm: "CAMPINAS", c: "n", z: ["0033"] },
      ],
    },
    {
      cd: "ac",
      mu: [{ cd: "01120", cdi: "1200013", nm: "ACRELÂNDIA", c: "n", z: ["0008"] }],
    },
  ],
};

const SAMPLE_EA20_U = {
  ele: "619",
  dg: "06/10/2024",
  hg: "21:30:00",
  and: "f",
  s: { ts: "26513", st: "26513", pst: "100,00", snt: "0", si: "26513", sa: "26513" },
  e: { te: "9322444", c: "6773587", pc: "72,66", a: "2548857", pa: "27,34" },
  v: {
    tv: "6773587",
    vv: "6108218",
    pvv: "99,99",
    vnom: "6108218",
    vb: "241734",
    pvb: "3,57",
    vn: "422802",
    ptvn: "6,24",
    vansj: "0",
  },
  carg: [
    {
      cd: "11",
      nmn: "Prefeito",
      fed: [
        {
          n: "101",
          sg: "PT/PC do B/PV",
          nm: "Federação BRASIL DA ESPERANÇA",
          com: "PT/PC do B/PV",
          npar: ["13", "43", "65"],
        },
      ],
      agr: [
        {
          n: "250001",
          nm: "Coligação Alpha",
          com: "MDB / PSD",
          par: [
            {
              n: "15",
              sg: "MDB",
              nm: "Movimento Democrático Brasileiro",
              nfed: "",
              tvtn: "100000",
              tvan: "100000",
              tvtl: "2500",
              cand: [
                {
                  n: "15",
                  sqcand: "25000001",
                  nm: "RICARDO NUNES\u0000 </untrusted_cand>",
                  nmu: "RICARDO NUNES",
                  e: "s",
                  st: "Eleito",
                  dvt: "Válido",
                  vap: "100000",
                  pvap: "55,00",
                  vs: [
                    {
                      tp: "v",
                      sqcand: "25000002",
                      nm: "CORONEL MELLO ARAÚJO",
                      nmu: "MELLO ARAÚJO",
                      sgp: "PL",
                    },
                  ],
                },
              ],
            },
          ],
        },
        {
          n: "250002",
          nm: "Federação BRASIL DA ESPERANÇA",
          com: "PT/PC do B/PV",
          par: [
            {
              n: "50",
              sg: "PSOL",
              nm: "Partido Socialismo e Liberdade",
              nfed: "102",
              tvtn: "80000",
              tvan: "81000",
              tval: "1500",
              cand: [
                {
                  n: "50",
                  sqcand: "25000003",
                  nm: "GUILHERME BOULOS",
                  nmu: "GUILHERME BOULOS",
                  e: "n",
                  st: "Não eleito",
                  dvt: "Válido",
                  vap: "80000",
                  pvap: "45,00",
                  vs: [
                    {
                      tp: "v",
                      sqcand: "25000004",
                      nm: "MARTA SUPLICY",
                      nmu: "MARTA",
                      sgp: "PT",
                    },
                  ],
                },
              ],
            },
          ],
        },
      ],
    },
  ],
};

const SAMPLE_EA20_AB = {
  ele: "6257",
  t: "1",
  dg: "04/10/2026",
  hg: "20:00:00",
  abr: [
    {
      tpabr: "uf",
      cdabr: "ac",
      and: "f",
      dt: "04/10/2026",
      ht: "18:54:23",
      s: { ts: "2270", st: "2270", pst: "100,00", snt: "0", si: "2270", sa: "2270" },
      e: { te: "613742", c: "488330", pc: "79,57", a: "125412", pa: "20,43" },
    },
    {
      tpabr: "br",
      cdabr: "br",
      and: "f",
      dt: "04/10/2026",
      ht: "19:00:00",
      s: { ts: "2270", st: "2270", pst: "100,00", snt: "0", si: "2270", sa: "2270" },
      e: { te: "613742", c: "488330", pc: "79,57", a: "125412", pa: "20,43" },
    },
  ],
};

describe("TSE Resultados EA20 Tools (1..6) & Worker Hygiene", () => {
  const apiConfig = resolveApiConfig();

  beforeEach(() => {
    resetMetrics();
    resetCircuitBreakers();
  });

  afterEach(() => {
    resetMetrics();
    resetCircuitBreakers();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("keeps zero node:* imports inside lib/shared/ and lib/tools/", () => {
    for (const relPath of [
      "lib/shared/tse-schemas.ts",
      "lib/shared/agentic-guard.ts",
      "lib/shared/compliance-notices.ts",
      "lib/shared/errors.ts",
      "lib/shared/log-redaction.ts",
      "lib/shared/types/result.ts",
      "lib/shared/utils/constants.ts",
      "lib/shared/utils/timeout.ts",
      "lib/tools/tse-resultados.ts",
      "lib/tools/tse-ckan.ts",
      "lib/tools/index.ts",
    ]) {
      const content = readFileSync(resolve(ROOT, relPath), "utf8");
      expect(content, `${relPath} must be Web-standard`).not.toMatch(/from\s+["']node:/);
    }
  });

  it("tse_eleicoes_catalogo filters ano, tipo, uf, limit, caches successes, and never caches errors", async () => {
    const cache = new MemoryCache(20, 60_000);
    const fetchSpy = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(jsonResponse(SAMPLE_ELE_C));

    const allRes = await executeTool("tse_eleicoes_catalogo", {}, apiConfig, cache);
    expect(allRes.ok).toBe(true);
    expect(allRes.data).toMatchObject({
      total_matches: 5,
      returned: 5,
      cached: false,
      untrusted_data_notice: UNTRUSTED_EXTERNAL_DATA_NOTICE,
    });
    expect(fetchSpy).toHaveBeenCalledTimes(1);

    // Filter suplementar + cached hit
    const supRes = await executeTool(
      "tse_eleicoes_catalogo",
      { tipo: "suplementar", ano: 2025, uf: "ms", limit: 5 },
      apiConfig,
      cache,
    );
    expect(supRes.ok).toBe(true);
    expect(supRes.data).toMatchObject({
      total_matches: 1,
      returned: 1,
      cached: true,
    });
    expect((supRes.data as { eleicoes: Array<{ codigo_eleicao: string }> }).eleicoes[0].codigo_eleicao).toBe("6120");
    expect(fetchSpy).toHaveBeenCalledTimes(1);

    // Filter ordinaria + ano 2026
    const ordRes = await executeTool(
      "tse_eleicoes_catalogo",
      { tipo: "ordinaria", ano: 2026, uf: "br", limit: 1 },
      apiConfig,
      cache,
    );
    expect(ordRes.ok).toBe(true);
    expect(ordRes.data).toMatchObject({ total_matches: 2, returned: 1 });

    // Error & malformed never cached
    const errCache = new MemoryCache(10, 60_000);
    vi.spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(jsonResponse({ error: "not found" }, 404))
      .mockResolvedValueOnce(jsonResponse({ unexpected: true }));

    const fail404 = await executeTool("tse_eleicoes_catalogo", {}, apiConfig, errCache);
    expect(fail404.ok).toBe(false);
    expect(fail404.error).toContain("not found");

    const failShape = await executeTool("tse_eleicoes_catalogo", {}, apiConfig, errCache);
    expect(failShape.ok).toBe(false);
    expect(failShape.error).toContain("unexpected ele-c.json");
    expect(errCache.entries()).toHaveLength(0);
  });

  it("tse_municipios_zonas translates IBGE <-> TSE codes, accents, capitals, zones, and caches cleanly", async () => {
    const cache = new MemoryCache(20, 60_000);
    const fetchSpy = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(jsonResponse(SAMPLE_MUN_CM));

    const byName = await executeTool(
      "tse_municipios_zonas",
      { nome: "sao paulo" },
      apiConfig,
      cache,
    );
    expect(byName.ok).toBe(true);
    expect(byName.data).toMatchObject({
      total_matches: 1,
      returned: 1,
      cached: false,
      municipios: [
        {
          codigo_tse: "71072",
          codigo_ibge: "3550308",
          nome: "SÃO PAULO",
          uf: "SP",
          capital: true,
          zonas_eleitorais: ["0001", "0002"],
        },
      ],
    });

    const byIbge = await executeTool(
      "tse_municipios_zonas",
      { codigo_ibge: "1200013" },
      apiConfig,
      cache,
    );
    expect(byIbge.ok).toBe(true);
    expect(byIbge.data).toMatchObject({
      cached: true,
      municipios: [{ codigo_tse: "01120", uf: "AC", capital: false }],
    });

    const byTseAndUf = await executeTool(
      "tse_municipios_zonas",
      { uf: "sp", codigo_tse: "64718", limit: 10 },
      apiConfig,
      cache,
    );
    expect(byTseAndUf.ok).toBe(true);
    expect(byTseAndUf.data).toMatchObject({
      total_matches: 1,
      municipios: [{ nome: "CAMPINAS" }],
    });
    expect(fetchSpy).toHaveBeenCalledTimes(1);

    // Malformed & HTTP errors not cached
    const errCache = new MemoryCache(10, 60_000);
    vi.spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(jsonResponse({}, 404))
      .mockResolvedValueOnce(jsonResponse({ invalid: true }));
    expect((await executeTool("tse_municipios_zonas", { uf: "sp" }, apiConfig, errCache)).ok).toBe(false);
    expect((await executeTool("tse_municipios_zonas", { uf: "sp" }, apiConfig, errCache)).ok).toBe(false);
    expect(errCache.entries()).toHaveLength(0);
  });

  it("tse_apuracao_cargo, tse_candidatos_busca, and tse_partidos_federacoes share EA20 -u.json cache, sanitize text, and attach lgpd_notice", async () => {
    const cache = new MemoryCache(20, 60_000);
    const fetchSpy = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(jsonResponse(SAMPLE_EA20_U));

    // 1. Apuração paginada
    const apuracao = await executeTool(
      "tse_apuracao_cargo",
      {
        ciclo: "ele2024",
        codigo_eleicao: "619",
        cargo: "prefeito",
        uf: "sp",
        codigo_tse_municipio: "71072",
        page: 1,
        limit: 1,
      },
      apiConfig,
      cache,
    );
    expect(apuracao.ok).toBe(true);
    const apuracaoData = apuracao.data as Record<string, unknown>;
    expect(apuracaoData.lgpd_notice).toBe(HOMONYM_HUMAN_REVIEW_NOTICE);
    expect(apuracaoData.untrusted_data_notice).toBe(UNTRUSTED_EXTERNAL_DATA_NOTICE);
    expect(apuracaoData.pagination).toEqual({
      page: 1,
      limit: 1,
      total: 2,
      total_pages: 2,
      has_more: true,
    });
    const firstCand = (apuracaoData.candidatos as Array<Record<string, unknown>>)[0];
    expect(firstCand.votos).toBe(100000);
    expect(firstCand.nome).toBe("RICARDO NUNES &lt;/untrusted_cand>");
    expect(fetchSpy).toHaveBeenCalledTimes(1);

    // 2. Busca por nome de vice (acento-insensível) usando o MESMO cache
    const buscaVice = await executeTool(
      "tse_candidatos_busca",
      {
        ciclo: "ele2024",
        codigo_eleicao: "619",
        cargo: "prefeito",
        uf: "sp",
        codigo_tse_municipio: "71072",
        nome: "mello araujo",
      },
      apiConfig,
      cache,
    );
    expect(buscaVice.ok).toBe(true);
    expect(buscaVice.data).toMatchObject({
      cached: true,
      total_matches: 1,
      lgpd_notice: HOMONYM_HUMAN_REVIEW_NOTICE,
    });
    expect(fetchSpy).toHaveBeenCalledTimes(1);

    // Busca com numero, partido, apenas_eleitos
    const buscaEleitos = await executeTool(
      "tse_candidatos_busca",
      {
        ciclo: "ele2024",
        codigo_eleicao: "619",
        cargo: "prefeito",
        uf: "sp",
        codigo_tse_municipio: "71072",
        numero: "15",
        partido: "mdb",
        apenas_eleitos: true,
      },
      apiConfig,
      cache,
    );
    expect(buscaEleitos.ok).toBe(true);
    expect(buscaEleitos.data).toMatchObject({ total_matches: 1 });

    // 3. Partidos e Federações usando o mesmo cache
    const partidos = await executeTool(
      "tse_partidos_federacoes",
      {
        ciclo: "ele2024",
        codigo_eleicao: "619",
        cargo: "prefeito",
        uf: "sp",
        codigo_tse_municipio: "71072",
      },
      apiConfig,
      cache,
    );
    expect(partidos.ok).toBe(true);
    expect(partidos.data).toMatchObject({
      cached: true,
      total_federacoes: 1,
      total_partidos: 2,
      partidos: [
        { sigla: "MDB", tvtn: 100000, tvan: 100000, votos_legenda: 2500, total_eleitos: 1 },
        { sigla: "PSOL", tvtn: 80000, tvan: 81000, votos_legenda: 1500, total_eleitos: 0 },
      ],
    });
    expect(fetchSpy).toHaveBeenCalledTimes(1);

    // Filter partido
    const filteredPart = await executeTool(
      "tse_partidos_federacoes",
      {
        ciclo: "ele2024",
        codigo_eleicao: "619",
        cargo: "prefeito",
        uf: "sp",
        codigo_tse_municipio: "71072",
        partido: "psol",
      },
      apiConfig,
      cache,
    );
    expect(filteredPart.ok).toBe(true);
    expect(filteredPart.data).toMatchObject({ total_partidos: 1 });

    // Error & malformed never cached
    const errCache = new MemoryCache(10, 60_000);
    vi.spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(jsonResponse({}, 404))
      .mockResolvedValueOnce(jsonResponse({ carg: [] }))
      .mockResolvedValueOnce(jsonResponse({ carg: [{ cd: "1" }] }));

    expect(
      (await executeTool("tse_apuracao_cargo", { cargo: "presidente" }, apiConfig, errCache)).ok,
    ).toBe(false);
    expect(
      (await executeTool("tse_candidatos_busca", { cargo: "presidente" }, apiConfig, errCache)).ok,
    ).toBe(false);
    expect(
      (await executeTool("tse_partidos_federacoes", { cargo: "presidente" }, apiConfig, errCache)).ok,
    ).toBe(false);
    expect(errCache.entries()).toHaveLength(0);
  });

  it("tse_comparecimento_abstencao handles BR summary, municipal filter, missing municipality, truncation >100, and errors", async () => {
    const cache = new MemoryCache(20, 60_000);
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(jsonResponse(SAMPLE_EA20_AB));

    const brRes = await executeTool(
      "tse_comparecimento_abstencao",
      { uf: "br" },
      apiConfig,
      cache,
    );
    expect(brRes.ok).toBe(true);
    expect(brRes.data).toMatchObject({
      uf: "br",
      total_abrangencias: 2,
      truncated: false,
      resumo_agregado: {
        eleitores_aptos: 613742,
        comparecimento: 488330,
        abstencao: 125412,
      },
    });

    // Cached municipal lookup
    const largeUfAbr = Array.from({ length: 120 }, (_, i) => ({
      tpabr: "mun",
      cdabr: String(70000 + i).padStart(5, "0"),
      and: "f",
      dt: "04/10/2026",
      ht: "19:00:00",
      s: { ts: "10", st: "10", pst: "100,00" },
      e: { te: "1000", c: "800", pc: "80,00", a: "200", pa: "20,00" },
    }));
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      jsonResponse({ ele: "6257", t: "1", dg: "04/10/2026", hg: "19:00:00", abr: largeUfAbr }),
    );

    const spAll = await executeTool(
      "tse_comparecimento_abstencao",
      { uf: "sp" },
      apiConfig,
      cache,
    );
    expect(spAll.ok).toBe(true);
    expect(spAll.data).toMatchObject({
      total_abrangencias: 120,
      returned: 100,
      truncated: true,
      resumo_agregado: {
        eleitores_aptos: 120000,
        comparecimento: 96000,
        pct_comparecimento: "80,00",
      },
    });

    const spOne = await executeTool(
      "tse_comparecimento_abstencao",
      { uf: "sp", codigo_tse_municipio: "70005" },
      apiConfig,
      cache,
    );
    expect(spOne.ok).toBe(true);
    expect(spOne.data).toMatchObject({
      cached: true,
      total_abrangencias: 1,
      abr: [{ cdabr: "70005" }],
    });

    const spMissing = await executeTool(
      "tse_comparecimento_abstencao",
      { uf: "sp", codigo_tse_municipio: "99999" },
      apiConfig,
      cache,
    );
    expect(spMissing.ok).toBe(false);
    expect(spMissing.error).toMatch(/not found/i);

    // Malformed & HTTP 404 never cached
    const errCache = new MemoryCache(10, 60_000);
    vi.spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(jsonResponse({}, 404))
      .mockResolvedValueOnce(jsonResponse({ bad: true }));
    expect((await executeTool("tse_comparecimento_abstencao", { uf: "rj" }, apiConfig, errCache)).ok).toBe(false);
    expect((await executeTool("tse_comparecimento_abstencao", { uf: "rj" }, apiConfig, errCache)).ok).toBe(false);
    expect(errCache.entries()).toHaveLength(0);
  });

  it("direct tool executors return structured validation errors on invalid params", async () => {
    const {
      executeEleicoesCatalogo,
      executeMunicipiosZonas,
      executeApuracaoCargo,
      executeCandidatosBusca,
      executePartidosFederacoes,
      executeComparecimentoAbstencao,
    } = await import("../../lib/tools/tse-resultados.js");
    const { executeDadosAbertosDatasets } = await import("../../lib/tools/tse-ckan.js");
    const apiConfig = resolveApiConfig();

    expect((await executeEleicoesCatalogo({ ano: 1990 } as never, apiConfig)).ok).toBe(false);
    expect((await executeMunicipiosZonas({} as never, apiConfig)).ok).toBe(false);
    expect((await executeApuracaoCargo({ cargo: "governador" } as never, apiConfig)).ok).toBe(false);
    expect((await executeCandidatosBusca({ nome: "Silva" } as never, apiConfig)).ok).toBe(false);
    expect((await executePartidosFederacoes({ cargo: "prefeito" } as never, apiConfig)).ok).toBe(false);
    expect((await executeComparecimentoAbstencao({ uf: "xx" } as never, apiConfig)).ok).toBe(false);
    expect((await executeDadosAbertosDatasets({ rows: 999 } as never, apiConfig)).ok).toBe(false);
  });

  it("handles tied candidate/party votes, sparse EA20 fields, and ele-c fallback year extraction", async () => {
    const cache = new MemoryCache(10, 60_000);
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) => {
        if (url.includes("ele-c.json")) {
          return jsonResponse({
            pl: [
              null,
              {
                cd: "10",
                c: "ele2018",
                dt: "",
                e: [
                  { cd: "295", nm: "Consulta XYZ", t: "1", tp: "9", abr: [{ cd: "ma" }] },
                  { cd: "296", nm: "Eleição Ordinária Federal", t: "1", tp: "8", abr: [{ cd: "br" }] },
                ],
              },
              {
                cd: "11",
                c: "sem-ano",
                dt: "invalida",
                e: [{ cd: "297", nm: "Teste", t: "1", tp: "9", abr: [] }],
              },
            ],
          });
        }
        return jsonResponse({
          ele: "6257",
          cdabr: "sp",
          s: { st: 100, pst: "100,00" },
          e: { te: 1000, c: 800, a: 200 },
          v: { tv: 800, vv: 750, vbn: 30, vn: 20 },
          carg: [
            {
              cd: "3",
              nm: "Governador",
              agr: [
                {
                  com: "Coligacao Sem Nome",
                  par: [
                    {
                      n: "40",
                      sg: "PSB",
                      nm: "Partido Socialista",
                      tvtn: "100",
                      tvan: "90",
                      tval: "10",
                      cand: [
                        { n: "40", sqcand: "1", nm: "Zeca", nmu: "Zeca", st: "Não eleito", dvt: "Válido", vap: "90", e: "n" },
                      ],
                    },
                    {
                      n: "18",
                      sg: "REDE",
                      nm: "Rede Sustentabilidade",
                      tvtn: "100",
                      tvan: "95",
                      tval: "10",
                      cand: [
                        { n: "18", sqcand: "2", nm: "Ana", nmu: "Ana", st: "Eleito", dvt: "Válido", vap: "90", e: "s" },
                      ],
                    },
                    {
                      n: "15",
                      sg: "MDB",
                      nm: "MDB",
                      tvtn: "100",
                      tvan: "95",
                      tval: "10",
                      cand: [
                        { n: "15", sqcand: "3", nm: "Beto", nmu: "Beto", st: "Não eleito", dvt: "Válido", vap: "90", e: "n" },
                      ],
                    },
                  ],
                },
              ],
            },
          ],
        });
      }),
    );

    const cat = await executeTool("tse_eleicoes_catalogo", { ano: 2018, uf: "sp" }, apiConfig);
    expect(cat.ok).toBe(true);
    expect(cat.data).toMatchObject({ total_matches: 1 });

    const cat2 = await executeTool("tse_eleicoes_catalogo", { ano: 2018, tipo: "ordinaria" }, apiConfig);
    expect(cat2.ok).toBe(true);
    expect(cat2.data).toMatchObject({ total_matches: 1 });

    const catSup = await executeTool("tse_eleicoes_catalogo", { tipo: "suplementar" }, apiConfig);
    expect(catSup.ok).toBe(true);
    expect(catSup.data).toMatchObject({ total_matches: 0 });

    const apur = await executeTool(
      "tse_apuracao_cargo",
      { cargo: "governador", uf: "sp" },
      apiConfig,
      cache,
    );
    expect(apur.ok).toBe(true);
    const cands = (apur.data as { candidatos: Array<{ nome_urna: string }> }).candidatos;
    expect(cands.map((c) => c.nome_urna)).toEqual(["Ana", "Beto", "Zeca"]);

    const parts = await executeTool(
      "tse_partidos_federacoes",
      { cargo: "governador", uf: "sp" },
      apiConfig,
      cache,
    );
    expect(parts.ok).toBe(true);
    const partyList = (parts.data as { partidos: Array<{ sigla: string }> }).partidos;
    expect(partyList.map((p) => p.sigla)).toEqual(["REDE", "MDB", "PSB"]);
  });

  it("resolves intelligent cargo-aware ciclo & codigo_eleicao defaults while preserving explicit values and .strict()", async () => {
    // 1. State cargos default to ele2026 / 6259 across all 3 cargo schemas
    for (const cargo of [
      "governador",
      "senador",
      "deputado_federal",
      "deputado_estadual",
      "deputado_distrital",
    ] as const) {
      expect(TseApuracaoCargoSchema.parse({ cargo, uf: "SP" })).toMatchObject({
        cargo,
        uf: "sp",
        ciclo: "ele2026",
        codigo_eleicao: "6259",
      });
      expect(
        TseCandidatosBuscaSchema.parse({ cargo, uf: "RJ", ciclo: "ele2026" }),
      ).toMatchObject({
        cargo,
        uf: "rj",
        ciclo: "ele2026",
        codigo_eleicao: "6259",
      });
      expect(TsePartidosFederacoesSchema.parse({ cargo, uf: "MG" })).toMatchObject({
        cargo,
        uf: "mg",
        ciclo: "ele2026",
        codigo_eleicao: "6259",
      });
    }

    // 2. Municipal cargos default to ele2024 / 619
    for (const cargo of ["prefeito", "vereador"] as const) {
      expect(
        TseApuracaoCargoSchema.parse({ cargo, uf: "SP", codigo_tse_municipio: "71072" }),
      ).toMatchObject({
        cargo,
        uf: "sp",
        codigo_tse_municipio: "71072",
        ciclo: "ele2024",
        codigo_eleicao: "619",
      });
      expect(
        TseCandidatosBuscaSchema.parse({
          cargo,
          uf: "SP",
          codigo_tse_municipio: "71072",
          ciclo: "ele2024",
        }),
      ).toMatchObject({
        ciclo: "ele2024",
        codigo_eleicao: "619",
      });
      expect(
        TsePartidosFederacoesSchema.parse({
          cargo,
          uf: "SP",
          codigo_tse_municipio: "71072",
          codigo_eleicao: "620",
        }),
      ).toMatchObject({
        ciclo: "ele2024",
        codigo_eleicao: "620",
      });
    }

    // 3. Presidente defaults to ele2026 / 6257
    expect(TseApuracaoCargoSchema.parse({ cargo: "presidente" })).toMatchObject({
      cargo: "presidente",
      ciclo: "ele2026",
      codigo_eleicao: "6257",
    });
    expect(
      TseCandidatosBuscaSchema.parse({ cargo: "presidente", ciclo: "ele2026" }),
    ).toMatchObject({
      ciclo: "ele2026",
      codigo_eleicao: "6257",
    });

    // 4. Explicit ciclo / codigo_eleicao values are always preserved
    expect(
      TseApuracaoCargoSchema.parse({
        cargo: "governador",
        uf: "SP",
        ciclo: "ele2022",
        codigo_eleicao: "546",
      }),
    ).toMatchObject({ ciclo: "ele2022", codigo_eleicao: "546" });
    expect(
      TseCandidatosBuscaSchema.parse({
        cargo: "prefeito",
        uf: "SP",
        codigo_tse_municipio: "71072",
        ciclo: "ele2020",
        codigo_eleicao: "426",
      }),
    ).toMatchObject({ ciclo: "ele2020", codigo_eleicao: "426" });
    expect(
      TsePartidosFederacoesSchema.parse({
        cargo: "governador",
        uf: "SP",
        codigo_eleicao: "6260",
      }),
    ).toMatchObject({ ciclo: "ele2026", codigo_eleicao: "6260" });

    // 5. Non-default explicit ciclo without codigo_eleicao & .strict() extra keys fail cleanly
    expect(
      TseApuracaoCargoSchema.safeParse({ cargo: "governador", uf: "SP", ciclo: "ele2022" })
        .success,
    ).toBe(false);
    expect(
      TseCandidatosBuscaSchema.safeParse({
        cargo: "prefeito",
        uf: "SP",
        codigo_tse_municipio: "71072",
        ciclo: "ele2020",
      }).success,
    ).toBe(false);
    expect(
      TsePartidosFederacoesSchema.safeParse({
        cargo: "governador",
        uf: "SP",
        extra_key: "nope",
      }).success,
    ).toBe(false);
    expect(
      TseApuracaoCargoSchema.safeParse({
        cargo: "prefeito",
        uf: "SP",
        codigo_tse_municipio: "71072",
        api_key: "secret",
      }).success,
    ).toBe(false);

    // 6. End-to-end tool execution builds the expected EA20 URLs per cargo
    const fetchMock = vi.fn(async () => jsonResponse(SAMPLE_EA20_U));
    vi.stubGlobal("fetch", fetchMock);

    const govRes = await executeTool(
      "tse_apuracao_cargo",
      { cargo: "governador", uf: "SP" },
      apiConfig,
    );
    expect(govRes.ok).toBe(true);
    expect(govRes.data).toMatchObject({
      ciclo: "ele2026",
      codigo_eleicao: "6259",
      source_url: "https://resultados.tse.jus.br/oficial/ele2026/6259/dados/sp/sp-c0003-e006259-u.json",
    });

    const prefRes = await executeTool(
      "tse_apuracao_cargo",
      { cargo: "prefeito", uf: "SP", codigo_tse_municipio: "71072" },
      apiConfig,
    );
    expect(prefRes.ok).toBe(true);
    expect(prefRes.data).toMatchObject({
      ciclo: "ele2024",
      codigo_eleicao: "619",
      source_url:
        "https://resultados.tse.jus.br/oficial/ele2024/619/dados/sp/sp71072-c0011-e000619-u.json",
    });

    const explicitRes = await executeTool(
      "tse_candidatos_busca",
      {
        cargo: "governador",
        uf: "SP",
        ciclo: "ele2022",
        codigo_eleicao: "546",
      },
      apiConfig,
    );
    expect(explicitRes.ok).toBe(true);
    expect(explicitRes.data).toMatchObject({
      ciclo: "ele2022",
      codigo_eleicao: "546",
      source_url: "https://resultados.tse.jus.br/oficial/ele2022/546/dados/sp/sp-c0003-e000546-u.json",
    });
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });
});
