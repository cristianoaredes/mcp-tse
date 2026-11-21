/**
 * TSE Dados Abertos (CKAN APIv3) tool — Worker-safe (zero `node:*` imports).
 * Queries package_search / package_show, returns cdn.tse.jus.br download links,
 * cross-MCP hint for @aredes.me/mcp-dadosbr (cnpj_lookup), and explicit WAF non-bypass notice.
 */

import { httpJson } from "../core/http-client.js";
import { hasTool, registerTool, type ToolHandler } from "../core/registry.js";
import {
  sanitizeUntrustedText,
  UNTRUSTED_EXTERNAL_DATA_NOTICE,
} from "../shared/agentic-guard.js";
import {
  TseDadosAbertosDatasetsInput,
  TseDadosAbertosDatasetsSchema,
} from "../shared/tse-schemas.js";
import { ApiConfig, Cache, LookupResult } from "../types/index.js";

export const TSE_WAF_NOTICE =
  "Upstream WAF notice: divulgacandcontas.tse.jus.br returns HTTP 403 (Akamai WAF) for automated clients and is never queried or bypassed by mcp-tse. Use the open CKAN packages and cdn.tse.jus.br CSV/ZIP resources returned by this tool instead.";

export const CROSS_MCP_CNPJ_HINT =
  "Cross-MCP hint: For corporate campaign donors, party suppliers, or candidate companies (CNPJ), use cnpj_lookup in @aredes.me/mcp-dadosbr.";

interface CkanResourceItem {
  id: string;
  name: string;
  format: string;
  url: string;
  description: string | null;
  last_modified: string | null;
}

interface CkanPackageItem {
  id: string;
  name: string;
  title: string;
  notes: string;
  organization: string | null;
  metadata_modified: string | null;
  num_resources: number;
  tags: string[];
  resources: CkanResourceItem[];
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function safeText(value: unknown, maxChars: number = 300): string {
  if (value === null || value === undefined) return "";
  return sanitizeUntrustedText(typeof value === "string" ? value : String(value), maxChars);
}

function normalizeResource(raw: unknown): CkanResourceItem | null {
  const r = asRecord(raw);
  if (!r) return null;
  const desc = safeText(r.description, 300);
  const lastMod = safeText(r.last_modified, 40);
  return {
    id: safeText(r.id, 64),
    name: safeText(r.name, 200),
    format: safeText(r.format, 20).toUpperCase(),
    url: safeText(r.url, 500),
    description: desc.length > 0 ? desc : null,
    last_modified: lastMod.length > 0 ? lastMod : null,
  };
}

function normalizePackage(raw: unknown, maxResources: number): CkanPackageItem | null {
  const pkg = asRecord(raw);
  if (!pkg) return null;

  const org = asRecord(pkg.organization);
  const orgTitle = org ? safeText(org.title ?? org.name, 120) : "";
  const mod = safeText(pkg.metadata_modified, 40);

  const rawTags = Array.isArray(pkg.tags) ? pkg.tags : [];
  const tags: string[] = [];
  for (const t of rawTags) {
    const tRec = asRecord(t);
    const label = tRec ? safeText(tRec.display_name ?? tRec.name, 60) : safeText(t, 60);
    if (label) tags.push(label);
  }

  const rawResources = Array.isArray(pkg.resources) ? pkg.resources : [];
  const resources: CkanResourceItem[] = [];
  for (const item of rawResources.slice(0, maxResources)) {
    const normalized = normalizeResource(item);
    if (normalized) resources.push(normalized);
  }

  return {
    id: safeText(pkg.id, 64),
    name: safeText(pkg.name, 140),
    title: safeText(pkg.title, 200),
    notes: safeText(pkg.notes, 500),
    organization: orgTitle.length > 0 ? orgTitle : null,
    metadata_modified: mod.length > 0 ? mod : null,
    num_resources:
      typeof pkg.num_resources === "number" && Number.isFinite(pkg.num_resources)
        ? pkg.num_resources
        : rawResources.length,
    tags,
    resources,
  };
}

export async function executeDadosAbertosDatasets(
  args: TseDadosAbertosDatasetsInput,
  apiConfig: ApiConfig,
  cache?: Cache,
): Promise<LookupResult> {
  const parsed = TseDadosAbertosDatasetsSchema.safeParse(args ?? {});
  if (!parsed.success) {
    return {
      ok: false,
      error: `Invalid parameters for tse_dados_abertos_datasets: ${parsed.error.issues.map((i) => i.message).join("; ")}`,
    };
  }

  const { query, package_id, ano, rows } = parsed.data;

  if (package_id) {
    const url = `${apiConfig.ckanBaseUrl}package_show?id=${encodeURIComponent(package_id)}`;
    const cacheKey = `tse:ckan:show:${apiConfig.ckanBaseUrl}:${package_id}`;

    if (cache) {
      const cached = await cache.get<Record<string, unknown>>(cacheKey);
      if (cached && typeof cached === "object" && !Array.isArray(cached)) {
        return {
          ok: true,
          data: {
            ...cached,
            cached: true,
            fetchedAt: new Date().toISOString(),
          },
          source: { url, fetchedAt: new Date().toISOString() },
        };
      }
    }

    const res = await httpJson(url, apiConfig.authHeaders);
    if (!res.ok) {
      return { ok: false, error: `TSE CKAN API error: ${res.error || "request failed"}` };
    }

    const root = asRecord(res.data);
    if (!root || root.success !== true || !asRecord(root.result)) {
      return {
        ok: false,
        error: "TSE CKAN API error: unexpected package_show response format",
      };
    }

    const pkg = normalizePackage(root.result, 50);
    if (!pkg) {
      return {
        ok: false,
        error: "TSE CKAN API error: invalid package payload",
      };
    }

    const fetchedAt = new Date().toISOString();
    const payload = {
      mode: "package_show" as const,
      package: pkg,
      cached: false,
      source: "TSE Dados Abertos — CKAN APIv3 (package_show)",
      source_url: url,
      fetchedAt,
      cross_mcp_hint: CROSS_MCP_CNPJ_HINT,
      upstream_waf_notice: TSE_WAF_NOTICE,
      untrusted_data_notice: UNTRUSTED_EXTERNAL_DATA_NOTICE,
    };

    if (cache) {
      await cache.set(cacheKey, payload);
    }

    return { ok: true, data: payload, source: { url, fetchedAt } };
  }

  const searchTerms = [query, ano !== undefined ? String(ano) : undefined]
    .filter((term): term is string => Boolean(term && term.length > 0))
    .join(" ");
  const url = `${apiConfig.ckanBaseUrl}package_search?q=${encodeURIComponent(searchTerms)}&rows=${rows}`;
  const cacheKey = `tse:ckan:search:${apiConfig.ckanBaseUrl}:${searchTerms}:${rows}`;

  if (cache) {
    const cached = await cache.get<Record<string, unknown>>(cacheKey);
    if (cached && typeof cached === "object" && !Array.isArray(cached)) {
      return {
        ok: true,
        data: {
          ...cached,
          cached: true,
          fetchedAt: new Date().toISOString(),
        },
        source: { url, fetchedAt: new Date().toISOString() },
      };
    }
  }

  const res = await httpJson(url, apiConfig.authHeaders);
  if (!res.ok) {
    return { ok: false, error: `TSE CKAN API error: ${res.error || "request failed"}` };
  }

  const root = asRecord(res.data);
  const resultObj = root ? asRecord(root.result) : null;
  if (!root || root.success !== true || !resultObj || !Array.isArray(resultObj.results)) {
    return {
      ok: false,
      error: "TSE CKAN API error: unexpected package_search response format",
    };
  }

  const packages: CkanPackageItem[] = [];
  for (const item of resultObj.results) {
    const normalized = normalizePackage(item, 10);
    if (normalized) packages.push(normalized);
  }

  const count =
    typeof resultObj.count === "number" && Number.isFinite(resultObj.count)
      ? resultObj.count
      : packages.length;
  const fetchedAt = new Date().toISOString();
  const payload = {
    mode: "package_search" as const,
    query: query ?? null,
    ano: ano ?? null,
    total_count: count,
    returned: packages.length,
    packages,
    cached: false,
    source: "TSE Dados Abertos — CKAN APIv3 (package_search)",
    source_url: url,
    fetchedAt,
    cross_mcp_hint: CROSS_MCP_CNPJ_HINT,
    upstream_waf_notice: TSE_WAF_NOTICE,
    untrusted_data_notice: UNTRUSTED_EXTERNAL_DATA_NOTICE,
  };

  if (cache) {
    await cache.set(cacheKey, payload);
  }

  return { ok: true, data: payload, source: { url, fetchedAt } };
}

export const TSE_DADOS_ABERTOS_DATASETS_TOOL: ToolHandler = {
  name: "tse_dados_abertos_datasets",
  description:
    "Search TSE Dados Abertos (CKAN APIv3) packages and inspect cdn.tse.jus.br CSV/ZIP dataset resources. Includes cross-MCP hint for cnpj_lookup (@aredes.me/mcp-dadosbr) and upstream WAF notice for divulgacandcontas.tse.jus.br.",
  inputSchema: {
    type: "object",
    properties: {
      query: { type: "string", minLength: 1, maxLength: 200, description: "Search keywords" },
      package_id: {
        type: "string",
        description: "Exact CKAN package slug/id to inspect via package_show",
      },
      ano: { type: "integer", minimum: 2014, maximum: 2034, description: "Filter by election year" },
      rows: { type: "integer", minimum: 1, maximum: 25, default: 10 },
    },
    additionalProperties: false,
  },
  zodSchema: TseDadosAbertosDatasetsSchema,
  execute: (args, apiConfig, cache) =>
    executeDadosAbertosDatasets(args as TseDadosAbertosDatasetsInput, apiConfig, cache),
};

export function registerTseCkanTool(): void {
  if (!hasTool(TSE_DADOS_ABERTOS_DATASETS_TOOL.name)) {
    registerTool(TSE_DADOS_ABERTOS_DATASETS_TOOL);
  }
}
