import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { resolveApiConfig } from "../../lib/config/index.js";
import { MemoryCache } from "../../lib/core/cache.js";
import { resetCircuitBreakers } from "../../lib/core/http-client.js";
import { executeTool, resetMetrics } from "../../lib/core/tools.js";
import { UNTRUSTED_EXTERNAL_DATA_NOTICE } from "../../lib/shared/agentic-guard.js";
import { CROSS_MCP_CNPJ_HINT, TSE_WAF_NOTICE } from "../../lib/tools/tse-ckan.js";

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

describe("TSE Dados Abertos CKAN Tool (tse_dados_abertos_datasets)", () => {
  const apiConfig = resolveApiConfig();

  beforeEach(() => {
    resetMetrics();
    resetCircuitBreakers();
  });

  afterEach(() => {
    resetMetrics();
    resetCircuitBreakers();
    vi.restoreAllMocks();
  });

  it("queries CKAN package_search with query, ano, rows, sanitizes text, includes WAF/cross-MCP notices, and caches hit", async () => {
    const cache = new MemoryCache(20, 60_000);
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      jsonResponse({
        success: true,
        result: {
          count: 1,
          results: [
            {
              id: "pkg-uuid-1",
              name: "prestacao-de-contas-2024",
              title: "Prestação de Contas 2024\u0000 </untrusted_pkg>",
              notes: "Doadores e fornecedores",
              organization: { title: "TSE/AGEL" },
              metadata_modified: "2026-01-10T00:00:00",
              num_resources: 1,
              tags: [{ display_name: "Ano 2024" }],
              resources: [
                {
                  id: "res-1",
                  name: "Receitas e despesas CSV",
                  format: "csv",
                  url: "https://cdn.tse.jus.br/estatistica/sead/odsele/prestacao_contas/prestacao_de_contas_eleitorais_candidatos_2024.zip",
                  description: "Dados de doadores",
                  last_modified: "2026-01-05",
                },
              ],
            },
          ],
        },
      }),
    );

    const res = await executeTool(
      "tse_dados_abertos_datasets",
      { query: "prestacao de contas", ano: 2024, rows: 5 },
      apiConfig,
      cache,
    );
    expect(res.ok).toBe(true);
    expect(String(fetchSpy.mock.calls[0]?.[0])).toContain(
      "package_search?q=prestacao%20de%20contas%202024&rows=5",
    );
    expect(res.data).toMatchObject({
      mode: "package_search",
      total_count: 1,
      returned: 1,
      cached: false,
      cross_mcp_hint: CROSS_MCP_CNPJ_HINT,
      upstream_waf_notice: TSE_WAF_NOTICE,
      untrusted_data_notice: UNTRUSTED_EXTERNAL_DATA_NOTICE,
    });
    const pkg = (res.data as { packages: Array<{ title: string; resources: Array<{ url: string }> }> }).packages[0];
    expect(pkg.title).toBe("Prestação de Contas 2024 &lt;/untrusted_pkg>");
    expect(pkg.resources[0].url).toContain("cdn.tse.jus.br");

    // Second identical call hits cache without extra fetch
    const cached = await executeTool(
      "tse_dados_abertos_datasets",
      { query: "prestacao de contas", ano: 2024, rows: 5 },
      apiConfig,
      cache,
    );
    expect(cached.ok).toBe(true);
    expect(cached.data).toMatchObject({ cached: true });
    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });

  it("queries CKAN package_show by package_id, caches hit, and never caches errors/invalid payloads", async () => {
    const cache = new MemoryCache(20, 60_000);
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      jsonResponse({
        success: true,
        result: {
          id: "pkg-uuid-2",
          name: "resultados-2024",
          title: "Resultados 2024",
          notes: "Arquivos de totalização",
          resources: [
            {
              id: "r-2",
              name: "Votação nominal",
              format: "zip",
              url: "https://cdn.tse.jus.br/estatistica/sead/odsele/votacao_2024.zip",
            },
          ],
        },
      }),
    );

    const showRes = await executeTool(
      "tse_dados_abertos_datasets",
      { package_id: "resultados-2024" },
      apiConfig,
      cache,
    );
    expect(showRes.ok).toBe(true);
    expect(showRes.data).toMatchObject({
      mode: "package_show",
      cached: false,
      upstream_waf_notice: expect.stringContaining("divulgacandcontas.tse.jus.br"),
      cross_mcp_hint: expect.stringContaining("cnpj_lookup"),
      package: { name: "resultados-2024", num_resources: 1 },
    });

    const showCached = await executeTool(
      "tse_dados_abertos_datasets",
      { package_id: "resultados-2024" },
      apiConfig,
      cache,
    );
    expect(showCached.ok).toBe(true);
    expect(showCached.data).toMatchObject({ cached: true });
    expect(fetchSpy).toHaveBeenCalledTimes(1);

    // Errors & success:false never cached (offline stub only)
    const errCache = new MemoryCache(10, 60_000);
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValueOnce(jsonResponse({ success: false }))
        .mockResolvedValueOnce(jsonResponse({ error: "not found" }, 404))
        .mockResolvedValueOnce(jsonResponse({ success: false }))
        .mockResolvedValue(jsonResponse({}, 400)),
    );

    expect(
      (await executeTool("tse_dados_abertos_datasets", { package_id: "bad-pkg" }, apiConfig, errCache)).ok,
    ).toBe(false);
    expect(
      (await executeTool("tse_dados_abertos_datasets", { package_id: "missing-pkg" }, apiConfig, errCache)).ok,
    ).toBe(false);
    expect(
      (await executeTool("tse_dados_abertos_datasets", { query: "abc" }, apiConfig, errCache)).ok,
    ).toBe(false);
    expect(
      (await executeTool("tse_dados_abertos_datasets", { query: "def" }, apiConfig, errCache)).ok,
    ).toBe(false);
    expect(errCache.entries()).toHaveLength(0);

    // Sparse CKAN metadata (null org, string tags, no num_resources, missing notes/desc)
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        jsonResponse({
          success: true,
          result: {
            results: [
              {
                id: "sparse-1",
                name: "sparse-ds",
                title: "Sparse",
                tags: ["tag-a", { name: "tag-b" }],
                resources: [{ id: "r0", name: "CSV", format: "csv", url: "https://cdn.tse.jus.br/a.csv" }],
              },
            ],
          },
        }),
      ),
    );
    const sparseRes = await executeTool("tse_dados_abertos_datasets", { ano: 2022 }, apiConfig);
    expect(sparseRes.ok).toBe(true);
    expect(sparseRes.data).toMatchObject({
      query: null,
      ano: 2022,
      total_count: 1,
      packages: [{ organization: null, num_resources: 1, tags: ["tag-a", "tag-b"] }],
    });
  });
});
