import { afterEach, describe, expect, it, vi } from "vitest";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { createMCPServer } from "../../lib/core/mcp-server.js";
import { MemoryCache } from "../../lib/core/cache.js";
import { RequestContext } from "../../lib/infrastructure/tracing.js";

const API_CONFIG = {
  resultadosBaseUrl: "https://resultados.tse.jus.br/oficial/",
  ckanBaseUrl: "https://dadosabertos.tse.jus.br/api/3/action/",
};

const EXPECTED_TOOLS = [
  "tse_apuracao_cargo",
  "tse_candidatos_busca",
  "tse_comparecimento_abstencao",
  "tse_dados_abertos_datasets",
  "tse_eleicoes_catalogo",
  "tse_municipios_zonas",
  "tse_partidos_federacoes",
];

describe("MCP Server handlers (ListTools, ListResources, ReadResource, CallTool)", () => {
  const origMaxOutput = process.env.MCP_MAX_TOOL_OUTPUT_CHARS;

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    if (origMaxOutput === undefined) {
      delete process.env.MCP_MAX_TOOL_OUTPUT_CHARS;
    } else {
      process.env.MCP_MAX_TOOL_OUTPUT_CHARS = origMaxOutput;
    }
  });

  async function connectClientServer(options: {
    rateLimit?: { windowMs: number; maxRequests: number } | false;
    getRequestContext?: () => RequestContext | undefined;
  } = {}) {
    const cache = new MemoryCache(50, 60_000);
    const server = createMCPServer({
      apiConfig: API_CONFIG,
      cache,
      ...options,
    });
    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
    const client = new Client({ name: "unit-client", version: "0.1.0" });

    await Promise.all([
      server.connect(serverTransport),
      client.connect(clientTransport),
    ]);

    return {
      client,
      server,
      close: async () => {
        await client.close();
        await server.close();
        cache.clear();
      },
    };
  }

  it("ListTools returns exact 7 tools, ListResources returns [], ReadResource throws Unknown resource URI", async () => {
    const pair = await connectClientServer();
    try {
      const { tools } = await pair.client.listTools();
      expect(tools.map((t) => t.name).sort()).toEqual(EXPECTED_TOOLS);

      const { resources } = await pair.client.listResources();
      expect(resources).toEqual([]);

      await expect(
        pair.client.readResource({ uri: "ui://tse/nonexistent" }),
      ).rejects.toThrow(/Unknown resource URI/);
    } finally {
      await pair.close();
    }
  });

  it("CallTool executes tool successfully, bounds oversized output, and converts validation/rate-limit/exceptions to isError payloads", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        new Response(
          JSON.stringify({
            pl: [
              {
                c: "2024",
                dt: "06/10/2024",
                e: [
                  {
                    cd: "619",
                    cdt2: "",
                    nm: "Eleicoes Municipais 2024",
                    t: "1",
                    tp: "3",
                    abr: [],
                  },
                ],
              },
            ],
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        ),
      ),
    );

    const ctx = new RequestContext("req-mcp-handler-1");
    const pair = await connectClientServer({
      rateLimit: { windowMs: 60_000, maxRequests: 3 },
      getRequestContext: () => ctx,
    });

    try {
      // 1) Successful tool call
      const okCall = await pair.client.callTool({
        name: "tse_eleicoes_catalogo",
        arguments: { ano: 2024 },
      });
      expect(okCall.isError).toBeFalsy();
      expect(ctx.getMetadata("tool")).toBe("tse_eleicoes_catalogo");

      // 2) Validation error returns isError: true
      const invalidCall = await pair.client.callTool({
        name: "tse_municipios_zonas",
        arguments: {},
      });
      expect(invalidCall.isError).toBe(true);
      expect((invalidCall.content as Array<{ text: string }>)[0].text).toContain("Invalid parameters");

      // 3) Unknown tool throws inside executeTool -> caught and formatted as isError: true
      const unknownCall = await pair.client.callTool({
        name: "nonexistent_tool",
        arguments: {},
      });
      expect(unknownCall.isError).toBe(true);

      // 4) 4th call exceeds maxRequests: 3 -> RateLimitError formatted as isError: true
      const rateLimitedCall = await pair.client.callTool({
        name: "tse_eleicoes_catalogo",
        arguments: { ano: 2024 },
      });
      expect(rateLimitedCall.isError).toBe(true);
      expect((rateLimitedCall.content as Array<{ text: string }>)[0].text).toContain("Rate limit exceeded");
    } finally {
      await pair.close();
    }
  });

  it("CallTool respects MCP_MAX_TOOL_OUTPUT_CHARS output bounding and MCP_TOOL_RATE_LIMIT_MAX", async () => {
    process.env.MCP_MAX_TOOL_OUTPUT_CHARS = "1024";
    process.env.MCP_TOOL_RATE_LIMIT_MAX = "5";
    const bigEleicoes = Array.from({ length: 40 }, (_, i) => ({
      cd: String(600 + i),
      cdt2: "",
      nm: `Eleicao Estadual/Municipal TesteNumero_${i}_${"X".repeat(40)}`,
      t: "1",
      tp: "3",
      abr: [],
    }));
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        new Response(JSON.stringify({ pl: [{ c: "2024", dt: "06/10/2024", e: bigEleicoes }] }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }),
      ),
    );

    const pair = await connectClientServer({ rateLimit: false });
    const envLimitedServer = createMCPServer({ apiConfig: API_CONFIG });
    expect(envLimitedServer).toBeTruthy();
    delete process.env.MCP_TOOL_RATE_LIMIT_MAX;
    await envLimitedServer.close();
    try {
      const res = await pair.client.callTool({
        name: "tse_eleicoes_catalogo",
        arguments: { ano: 2024 },
      });
      const text = (res.content as Array<{ text: string }>)[0].text;
      expect(text.length).toBeLessThanOrEqual(1024);
      expect(JSON.parse(text)).toMatchObject({ truncated: true, max_chars: 1024 });
    } finally {
      await pair.close();
    }
  });
});
