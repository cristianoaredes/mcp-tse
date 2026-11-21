import { afterEach, describe, expect, it, vi } from "vitest";
import worker from "../../lib/workers/worker.js";
import {
  handleHealthCheck,
  handleMCPEndpoint,
  handleMCPRequest,
  syncWorkerEnv,
  type Env,
} from "../../lib/adapters/cloudflare.js";
import { handleToolRestEndpoint } from "../../lib/workers/rest.js";
import { generateOpenAPISchema, handleOpenAPIEndpoint } from "../../lib/workers/openapi.js";

const MOCK_CTX = {
  waitUntil: vi.fn(),
  passThroughOnException: vi.fn(),
} as unknown as ExecutionContext;

function createMockKv(initial: Record<string, string> = {}) {
  const store = new Map<string, string>(Object.entries(initial));
  return {
    get: vi.fn(async (key: string) => store.get(key) ?? null),
    put: vi.fn(async (key: string, value: string) => {
      store.set(key, value);
    }),
    delete: vi.fn(async (key: string) => {
      store.delete(key);
    }),
    store,
  };
}

const SAMPLE_CATALOG = {
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
          abr: [{ cd: "sp", ds: "SAO PAULO", mu: [] }],
        },
      ],
    },
  ],
};

describe("Worker REST, Cloudflare MCP endpoint, Health & OpenAPI", () => {
  const origResultados = process.env.TSE_RESULTADOS_BASE_URL;
  const origCkan = process.env.TSE_CKAN_BASE_URL;

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    if (origResultados === undefined) {
      delete process.env.TSE_RESULTADOS_BASE_URL;
    } else {
      process.env.TSE_RESULTADOS_BASE_URL = origResultados;
    }
    if (origCkan === undefined) {
      delete process.env.TSE_CKAN_BASE_URL;
    } else {
      process.env.TSE_CKAN_BASE_URL = origCkan;
    }
  });

  it("syncWorkerEnv propagates TSE override keys when non-empty", () => {
    syncWorkerEnv({
      TSE_RESULTADOS_BASE_URL: "https://cdn.tse.jus.br/oficial/",
      TSE_CKAN_BASE_URL: "https://cdn.tse.jus.br/api/3/action/",
    });
    expect(process.env.TSE_RESULTADOS_BASE_URL).toBe("https://cdn.tse.jus.br/oficial/");
    expect(process.env.TSE_CKAN_BASE_URL).toBe("https://cdn.tse.jus.br/api/3/action/");
  });

  it("handleHealthCheck reports healthy/unconfigured, healthy/ok with KV, and 503 degraded on KV error/timeout", async () => {
    const unconfigured = await handleHealthCheck(undefined, {});
    expect(unconfigured.status).toBe(200);
    expect(await unconfigured.json()).toMatchObject({
      status: "healthy",
      service: "mcp-tse",
      version: "0.1.0",
      runtime: "cloudflare-workers",
      checks: { kv: { status: "unconfigured" } },
    });

    const healthyKv = createMockKv();
    const okRes = await handleHealthCheck(new Request("https://worker.test/health"), {
      MCP_CACHE: healthyKv as unknown as KVNamespace,
    });
    expect(okRes.status).toBe(200);
    expect(await okRes.json()).toMatchObject({
      status: "healthy",
      checks: { kv: { status: "ok" } },
    });

    const failingKv = {
      get: vi.fn().mockRejectedValue(new Error("KV connection refused secret=abc")),
      put: vi.fn(),
      delete: vi.fn(),
    };
    const degradedRes = await handleHealthCheck(new Request("https://worker.test/health"), {
      MCP_KV: failingKv as unknown as KVNamespace,
    });
    expect(degradedRes.status).toBe(503);
    expect(await degradedRes.json()).toMatchObject({
      status: "degraded",
      checks: { kv: { status: "degraded", error: "kv_unavailable" } },
    });

    const slowKv = {
      get: vi.fn(() => new Promise<string | null>(() => {})),
      put: vi.fn(),
      delete: vi.fn(),
    };
    const timeoutRes = await handleHealthCheck(
      new Request("https://worker.test/health"),
      { MCP_CACHE: slowKv as unknown as KVNamespace },
      { kvTimeoutMs: 15 },
    );
    expect(timeoutRes.status).toBe(503);
  });

  it("handleMCPRequest handles tools/list, tools/call (with KV cache + bounded output), invalid args, and unknown methods", async () => {
    const fetchMock = vi.fn(async () => {
      return new Response(JSON.stringify(SAMPLE_CATALOG), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    });
    vi.stubGlobal("fetch", fetchMock);
    const kv = createMockKv();
    const env: Env = {
      MCP_CACHE: kv as unknown as KVNamespace,
    };

    const listRes = await handleMCPRequest(
      { jsonrpc: "2.0", id: 1, method: "tools/list" },
      env,
    );
    expect((listRes.result as { tools: unknown[] }).tools).toHaveLength(7);

    const callRes = await handleMCPRequest(
      {
        jsonrpc: "2.0",
        id: 2,
        method: "tools/call",
        params: {
          name: "tse_eleicoes_catalogo",
          arguments: { ano: 2024 },
        },
      },
      env,
    );
    expect(callRes.error).toBeUndefined();
    expect(kv.put).toHaveBeenCalledTimes(1);

    const invalidArgsRes = await handleMCPRequest(
      {
        jsonrpc: "2.0",
        id: 3,
        method: "tools/call",
        params: {
          name: "tse_municipios_zonas",
          arguments: {},
        },
      },
      env,
    );
    expect(invalidArgsRes.error?.code).toBe(-32603);

    const bigCatalog = {
      pl: [
        {
          c: "2024",
          dt: "06/10/2024",
          e: Array.from({ length: 10 }, (_, idx) => ({
            cd: String(600 + idx),
            cdt2: "",
            nm: `Eleicao Teste ${idx} ${"X".repeat(60)}`,
            t: "1",
            tp: "3",
            abr: [{ cd: "sp", ds: "SAO PAULO", mu: [] }],
          })),
        },
      ],
    };
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        new Response(JSON.stringify(bigCatalog), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }),
      ),
    );
    const truncatedRes = await handleMCPRequest(
      {
        jsonrpc: "2.0",
        id: 4,
        method: "tools/call",
        params: {
          name: "tse_eleicoes_catalogo",
          arguments: { ano: 2024, limit: 10 },
        },
      },
      { MCP_MAX_TOOL_OUTPUT_CHARS: "1024" },
    );
    const text = (truncatedRes.result as { content: Array<{ text: string }> }).content[0].text;
    expect(text).toContain('"truncated": true');

    const unknownMethod = await handleMCPRequest(
      { jsonrpc: "2.0", id: 5, method: "resources/unknown" },
      env,
    );
    expect(unknownMethod.error?.code).toBe(-32601);
  });

  it("handleMCPEndpoint handles valid POST, malformed JSON (-32700), and unexpected errors (-32603)", async () => {
    const okRes = await handleMCPEndpoint(
      new Request("https://worker.test/mcp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jsonrpc: "2.0", id: 10, method: "tools/list" }),
      }),
      {},
    );
    expect(okRes.status).toBe(200);

    const badJson = await handleMCPEndpoint(
      new Request("https://worker.test/mcp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "{invalid",
      }),
      {},
    );
    expect(badJson.status).toBe(400);
    expect((await badJson.json()).error.code).toBe(-32700);

    const invalidUrlEnv = await handleMCPEndpoint(
      new Request("https://worker.test/mcp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jsonrpc: "2.0", id: 11, method: "tools/list" }),
      }),
      { TSE_RESULTADOS_BASE_URL: "https://evil.example/" },
    );
    expect(invalidUrlEnv.status).toBe(500);
  });

  it("REST POST /tools/{toolName} covers valid calls, 404 unknown tool, 400 invalid JSON/array/null, 405, %ZZ 400, and sanitized 500", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        new Response(JSON.stringify(SAMPLE_CATALOG), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }),
      ),
    );

    const okRest = await worker.fetch(
      new Request("https://worker.test/tools/tse_eleicoes_catalogo", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ano: 2024 }),
      }),
      {},
      MOCK_CTX,
    );
    expect(okRest.status).toBe(200);
    const body = (await okRest.json()) as { content: Array<{ text: string }> };
    const parsedPayload = JSON.parse(body.content[0].text) as { eleicoes: unknown[] };
    expect(parsedPayload.eleicoes).toHaveLength(1);

    const unknownTool = await worker.fetch(
      new Request("https://worker.test/tools/does_not_exist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "{}",
      }),
      {},
      MOCK_CTX,
    );
    expect(unknownTool.status).toBe(404);

    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response("not found", { status: 404 })),
    );
    const upstream404 = await handleToolRestEndpoint(
      "tse_eleicoes_catalogo",
      new Request("https://worker.test/tools/tse_eleicoes_catalogo", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      }),
      {},
    );
    expect(upstream404.status).toBe(404);

    const validation400 = await handleToolRestEndpoint(
      "tse_municipios_zonas",
      new Request("https://worker.test/tools/tse_municipios_zonas", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      }),
      {},
    );
    expect(validation400.status).toBe(400);

    const malformedJson = await worker.fetch(
      new Request("https://worker.test/tools/tse_eleicoes_catalogo", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "{oops",
      }),
      {},
      MOCK_CTX,
    );
    expect(malformedJson.status).toBe(400);

    const arrayBody = await worker.fetch(
      new Request("https://worker.test/tools/tse_eleicoes_catalogo", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "[]",
      }),
      {},
      MOCK_CTX,
    );
    expect(arrayBody.status).toBe(400);

    const getDisallowed = await worker.fetch(
      new Request("https://worker.test/tools/tse_eleicoes_catalogo", { method: "GET" }),
      {},
      MOCK_CTX,
    );
    expect(getDisallowed.status).toBe(405);

    const badEncoding = await worker.fetch(
      new Request("https://worker.test/tools/%ZZ", { method: "POST" }),
      {},
      MOCK_CTX,
    );
    expect(badEncoding.status).toBe(400);

    const error500 = await handleToolRestEndpoint(
      "tse_eleicoes_catalogo",
      new Request("https://worker.test/tools/tse_eleicoes_catalogo", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "{}",
      }),
      { TSE_RESULTADOS_BASE_URL: "https://attacker.invalid/" },
    );
    expect(error500.status).toBe(500);
    expect(await error500.json()).toEqual({ error: "Internal server error" });
  });

  it("OpenAPI schema lists all 7 tools in /tools/{toolName} enum and root / returns metadata", async () => {
    const schema = generateOpenAPISchema("https://mcp-tse.aredes.me") as {
      openapi: string;
      paths: Record<string, { post?: { parameters?: Array<{ schema?: { enum?: string[] } }> } }>;
    };
    expect(schema.openapi).toBe("3.0.0");
    const toolEnum = schema.paths["/tools/{toolName}"]?.post?.parameters?.[0]?.schema?.enum ?? [];
    expect(toolEnum).toHaveLength(7);
    expect(toolEnum).toContain("tse_apuracao_cargo");
    expect(toolEnum).toContain("tse_dados_abertos_datasets");

    const oaRes = handleOpenAPIEndpoint(new Request("https://worker.test/openapi.json"));
    expect(oaRes.status).toBe(200);

    const rootRes = await worker.fetch(
      new Request("https://worker.test/"),
      { MCP_DPO_CONTACT: "dpo@aredes.me" },
      MOCK_CTX,
    );
    expect(rootRes.status).toBe(200);
    const rootJson = await rootRes.json();
    expect(rootJson.service).toBe("MCP TSE");
    expect(rootJson.tools).toHaveLength(7);
    expect(rootJson.privacy.dpo_contact).toBe("dpo@aredes.me");
  });
});
