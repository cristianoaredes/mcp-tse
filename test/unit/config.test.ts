import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  ALLOWED_TSE_CKAN_HOSTS,
  ALLOWED_TSE_RESULTADOS_HOSTS,
  DEFAULT_TSE_CKAN_URL,
  DEFAULT_TSE_RESULTADOS_URL,
  isAllowedTseCkanUrl,
  isAllowedTseResultadosUrl,
  loadServerConfiguration,
  resolveApiConfig,
  validateUrl,
} from "../../lib/config/index.js";
import { TIMEOUTS } from "../../lib/config/timeouts.js";

describe("Config SSRF Protection, .mcprc.json, & Timeouts", () => {
  const originalEnv = { ...process.env };
  const originalCwd = process.cwd();
  const tempDirs: string[] = [];

  afterEach(() => {
    process.chdir(originalCwd);
    for (const dir of tempDirs.splice(0)) {
      rmSync(dir, { recursive: true, force: true });
    }
    process.env = { ...originalEnv };
    vi.restoreAllMocks();
  });

  it("uses official TSE defaults and allowlisted subdomains", () => {
    delete process.env.TSE_RESULTADOS_BASE_URL;
    delete process.env.TSE_CKAN_BASE_URL;

    const cfg = resolveApiConfig();
    expect(cfg.resultadosBaseUrl).toBe(DEFAULT_TSE_RESULTADOS_URL);
    expect(cfg.ckanBaseUrl).toBe(DEFAULT_TSE_CKAN_URL);
    expect(isAllowedTseResultadosUrl("https://resultados.tse.jus.br/oficial/")).toBe(true);
    expect(isAllowedTseResultadosUrl("https://cdn.tse.jus.br/mirror/")).toBe(true);
    expect(isAllowedTseCkanUrl("https://dadosabertos.tse.jus.br/api/3/action/")).toBe(true);
    expect(isAllowedTseCkanUrl("https://sub.cdn.tse.jus.br/api/")).toBe(true);
  });

  it("loads .mcprc.json and overrides via env vars and API_KEY_HEADER/VALUE", () => {
    const dir = mkdtempSync(join(tmpdir(), "mcp-tse-cfg-"));
    tempDirs.push(dir);
    writeFileSync(
      join(dir, ".mcprc.json"),
      JSON.stringify({
        apiUrls: {
          resultados: "https://cdn.tse.jus.br/resultados",
          ckan: "https://cdn.tse.jus.br/ckan",
        },
        auth: { headers: { "X-Custom": "from-file" } },
      }),
    );
    process.chdir(dir);

    const fileCfg = resolveApiConfig();
    expect(fileCfg.resultadosBaseUrl).toBe("https://cdn.tse.jus.br/resultados/");
    expect(fileCfg.ckanBaseUrl).toBe("https://cdn.tse.jus.br/ckan/");
    expect(fileCfg.authHeaders).toEqual({ "X-Custom": "from-file" });

    process.env.TSE_RESULTADOS_BASE_URL = "https://resultados.tse.jus.br/oficial";
    process.env.TSE_CKAN_BASE_URL = "https://dadosabertos.tse.jus.br/api/3/action";
    process.env.API_KEY_HEADER = "X-TSE-Env";
    process.env.API_KEY_VALUE = "env-val";

    const envCfg = resolveApiConfig({ authHeaders: { "X-Override": "1" } });
    expect(envCfg.resultadosBaseUrl).toBe("https://resultados.tse.jus.br/oficial/");
    expect(envCfg.ckanBaseUrl).toBe("https://dadosabertos.tse.jus.br/api/3/action/");
    expect(envCfg.authHeaders).toEqual({
      "X-Custom": "from-file",
      "X-TSE-Env": "env-val",
      "X-Override": "1",
    });
  });

  it("rejects SSRF vectors (disallowed hosts, metadata IP, HTTP non-loopback, invalid formats, embedded credentials)", () => {
    expect(validateUrl("", ALLOWED_TSE_RESULTADOS_HOSTS)).toBe(false);
    expect(validateUrl("not a url", ALLOWED_TSE_CKAN_HOSTS)).toBe(false);
    expect(() =>
      resolveApiConfig({ resultadosBaseUrl: "https://evil.example/api/" }),
    ).toThrow(/Invalid or disallowed TSE Resultados API URL/);
    expect(() =>
      resolveApiConfig({ ckanBaseUrl: "https://169.254.169.254/latest/meta-data" }),
    ).toThrow(/Invalid or disallowed TSE CKAN API URL/);
    expect(() =>
      resolveApiConfig({ resultadosBaseUrl: "http://resultados.tse.jus.br/oficial/" }),
    ).toThrow(/Invalid or disallowed TSE Resultados API URL/);

    let caught = "";
    try {
      resolveApiConfig({
        ckanBaseUrl: `https://${"user"}:${"secretPass"}@dadosabertos.tse.jus.br/api/`,
      });
    } catch (err) {
      caught = err instanceof Error ? err.message : String(err);
    }
    expect(caught).toMatch(/Invalid or disallowed TSE CKAN API URL/);
    expect(caught).not.toContain("secretPass");
  });

  it("restricts loopback HTTP(S) exclusively to development/test environments", () => {
    process.env.NODE_ENV = "production";
    expect(() =>
      resolveApiConfig({ resultadosBaseUrl: "http://localhost:3000/" }),
    ).toThrow(/Invalid or disallowed TSE Resultados API URL/);

    delete process.env.NODE_ENV;
    expect(() =>
      resolveApiConfig({ ckanBaseUrl: "http://127.0.0.1:8080/" }),
    ).toThrow(/Invalid or disallowed TSE CKAN API URL/);

    process.env.NODE_ENV = "development";
    const devCfg = resolveApiConfig({
      resultadosBaseUrl: "http://localhost:3000",
      ckanBaseUrl: "http://127.0.0.1:8080",
    });
    expect(devCfg.resultadosBaseUrl).toBe("http://localhost:3000/");
    expect(devCfg.ckanBaseUrl).toBe("http://127.0.0.1:8080/");

    expect(() =>
      resolveApiConfig({ resultadosBaseUrl: "ftp://localhost/path" }),
    ).toThrow(/Invalid or disallowed TSE Resultados API URL/);
  });

  it("loads ServerConfig and TIMEOUTS with fallback warning on invalid env values", () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    process.env.MCP_TRANSPORT = "http";
    process.env.MCP_HTTP_PORT = "4567";
    process.env.MCP_HTTP_HOST = "  ::1  ";
    process.env.MCP_API_TIMEOUT = "invalid";
    process.env.MCP_CIRCUIT_BREAKER_TIMEOUT = "15000";

    const serverCfg = loadServerConfiguration();
    expect(serverCfg.transport).toBe("http");
    expect(serverCfg.httpPort).toBe(4567);
    expect(serverCfg.httpHost).toBe("::1");
    expect(serverCfg.apiTimeout).toBe(8000);
    expect(TIMEOUTS.CIRCUIT_BREAKER_RESET_MS).toBe(15000);

    process.env.MCP_HTTP_PORT = "-5";
    delete process.env.MCP_CIRCUIT_BREAKER_TIMEOUT;
    expect(loadServerConfiguration().httpPort).toBe(3000);
    expect(TIMEOUTS.CIRCUIT_BREAKER_RESET_MS).toBe(30000);
    expect(TIMEOUTS.SSE_CONNECTION_MS).toBe(50000);
    expect(TIMEOUTS.PING_INTERVAL_MS).toBe(30000);
    expect(TIMEOUTS.RATE_LIMIT_CLEANUP_MS).toBe(60000);
    expect(TIMEOUTS.RATE_LIMIT_WINDOW_MS).toBe(60000);
    expect(warnSpy).toHaveBeenCalled();
  });
});
