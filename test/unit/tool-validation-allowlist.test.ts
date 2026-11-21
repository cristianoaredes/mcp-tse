import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import "../../lib/tools/index.js";
import { resolveApiConfig } from "../../lib/config/index.js";
import {
  executeRegisteredTool,
  getToolCount,
  hasTool,
  hasToolSchema,
  registerTool,
} from "../../lib/core/registry.js";
import { TOOL_SCHEMAS } from "../../lib/core/tool-schemas.js";
import { TOOL_DEFINITIONS } from "../../lib/core/tools.js";

describe("Runtime Zod Validation (.strict()) & SC-9 Allowlist Across All 7 TSE Tools", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("registers all 7 tools with Zod schemas and zero api_key parameters", () => {
    expect(getToolCount()).toBe(7);
    expect(TOOL_DEFINITIONS).toHaveLength(7);

    for (const def of TOOL_DEFINITIONS) {
      expect(hasTool(def.name)).toBe(true);
      expect(hasToolSchema(def.name)).toBe(true);
      expect(TOOL_SCHEMAS[def.name]).toBeDefined();
      const props = (def.inputSchema as { properties?: Record<string, unknown> }).properties;
      expect(props).not.toHaveProperty("api_key");
    }
  });

  it("rejects invalid types, .strict() extra fields, and scope violations without calling fetch", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    const apiConfig = resolveApiConfig();

    const invalidCases: Array<{ tool: string; args: unknown; label: string }> = [
      { tool: "tse_eleicoes_catalogo", args: { tipo: "invalido" }, label: "invalid tipo" },
      { tool: "tse_eleicoes_catalogo", args: { ano: 2000 }, label: "ano out of range" },
      { tool: "tse_eleicoes_catalogo", args: { limit: 100 }, label: "limit > 50" },
      { tool: "tse_eleicoes_catalogo", args: { api_key: "secret" }, label: "strict unknown api_key" },

      { tool: "tse_municipios_zonas", args: {}, label: "missing all filters" },
      { tool: "tse_municipios_zonas", args: { uf: "br" }, label: "uf cannot be br" },
      { tool: "tse_municipios_zonas", args: { uf: "xx" }, label: "invalid uf" },
      { tool: "tse_municipios_zonas", args: { codigo_ibge: "123" }, label: "short codigo_ibge" },
      { tool: "tse_municipios_zonas", args: { codigo_tse: "123" }, label: "short codigo_tse" },
      { tool: "tse_municipios_zonas", args: { nome: "A" }, label: "short nome" },

      { tool: "tse_apuracao_cargo", args: { cargo: "prefeito", uf: "sp" }, label: "prefeito missing municipio" },
      { tool: "tse_apuracao_cargo", args: { cargo: "vereador", uf: "br", codigo_tse_municipio: "71072" }, label: "vereador uf=br" },
      { tool: "tse_apuracao_cargo", args: { cargo: "governador", uf: "br" }, label: "governador uf=br" },
      { tool: "tse_apuracao_cargo", args: { cargo: "senador" }, label: "senador missing uf" },
      { tool: "tse_apuracao_cargo", args: { cargo: "presidente", codigo_tse_municipio: "71072" }, label: "municipio without state uf" },
      { tool: "tse_apuracao_cargo", args: { cargo: "presidente", uf: "xx" }, label: "invalid uf" },
      { tool: "tse_apuracao_cargo", args: { cargo: "presidente", page: 0 }, label: "page < 1" },

      { tool: "tse_candidatos_busca", args: { cargo: "prefeito" }, label: "missing uf and municipio" },
      { tool: "tse_candidatos_busca", args: { cargo: "deputado_federal" }, label: "missing state uf" },
      { tool: "tse_candidatos_busca", args: { cargo: "presidente", numero: "1" }, label: "short numero" },
      { tool: "tse_candidatos_busca", args: { cargo: "presidente", nome: "X" }, label: "short nome" },

      { tool: "tse_partidos_federacoes", args: { cargo: "deputado_estadual", uf: "br" }, label: "state cargo uf=br" },
      { tool: "tse_partidos_federacoes", args: { cargo: "presidente", limit: 51 }, label: "limit > 50" },

      { tool: "tse_comparecimento_abstencao", args: { codigo_tse_municipio: "71072" }, label: "municipio with default br" },
      { tool: "tse_comparecimento_abstencao", args: { uf: "zz", codigo_tse_municipio: "abcde" }, label: "invalid codigo_tse_municipio" },
      { tool: "tse_comparecimento_abstencao", args: { uf: "qq" }, label: "invalid uf" },

      { tool: "tse_dados_abertos_datasets", args: { package_id: "BAD SLUG!" }, label: "invalid package_id" },
      { tool: "tse_dados_abertos_datasets", args: { ano: 2010 }, label: "ano < 2014" },
      { tool: "tse_dados_abertos_datasets", args: { rows: 26 }, label: "rows > 25" },
      { tool: "tse_dados_abertos_datasets", args: { api_key: "x" }, label: "strict unknown api_key" },
    ];

    const testedTools = new Set(invalidCases.map((c) => c.tool));
    expect(testedTools.size).toBe(7);

    for (const { tool, args, label } of invalidCases) {
      const res = await executeRegisteredTool(tool, args, apiConfig);
      expect(res.ok, `Expected ${tool} (${label}) to fail`).toBe(false);
      expect(res.error).toMatch(/^Invalid parameters for /);
    }

    await expect(executeRegisteredTool("unknown_tool", {}, apiConfig)).rejects.toThrow(
      /Unknown tool: unknown_tool/,
    );
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("warns on duplicate tool registration while keeping registry count intact", () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    const existing = TOOL_DEFINITIONS[0];
    registerTool({
      ...existing,
      zodSchema: TOOL_SCHEMAS[existing.name],
      execute: async () => ({ ok: true, data: {} }),
    });
    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining("already registered"));
    expect(getToolCount()).toBe(7);
  });

  it("keeps .archagents/_capabilities.json and .archagents/mcp-tool-allowlist.json aligned with all 7 tools", () => {
    const cap = JSON.parse(
      readFileSync(resolve(process.cwd(), ".archagents/_capabilities.json"), "utf8"),
    ) as { enabled: boolean; agentic?: { mcp?: boolean; server_name?: string; tool_count?: number } };

    expect(cap.enabled).toBe(false);
    expect(cap.agentic?.mcp).toBe(true);
    expect(cap.agentic?.server_name).toBe("mcp-tse");
    expect(cap.agentic?.tool_count).toBe(7);

    const allowlist = JSON.parse(
      readFileSync(resolve(process.cwd(), ".archagents/mcp-tool-allowlist.json"), "utf8"),
    ) as {
      server: string;
      mcp_servers?: { allowed?: Array<{ server?: string }> };
      entries: Array<Record<string, unknown>>;
    };

    expect(allowlist.server).toBe("mcp-tse");
    expect(allowlist.mcp_servers?.allowed?.some((s) => s.server === "mcp-tse")).toBe(true);
    expect(allowlist.entries).toHaveLength(7);

    const ids = new Set<string>();
    const names: string[] = [];
    for (const entry of allowlist.entries) {
      expect(entry.id).toBeTypeOf("string");
      expect(entry.name).toBeTypeOf("string");
      expect(entry.risk_level).toBeTypeOf("string");
      expect(entry.destructive).toBe(false);
      expect(typeof entry.requires_approval).toBe("boolean");
      ids.add(String(entry.id));
      names.push(String(entry.name));
    }
    expect(ids.size).toBe(7);

    const registeredNames = TOOL_DEFINITIONS.map((t) => t.name).sort();
    expect(names.sort()).toEqual(registeredNames);
  });
});
