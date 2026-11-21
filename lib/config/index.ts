import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { ApiConfig, ServerConfig, ConfigFile } from "../types/index.js";
import { TIMEOUTS } from "./timeouts.js";
import { API_URLS, CACHE, SERVER } from "../shared/utils/constants.js";

// Default API URLs
export const DEFAULT_TSE_RESULTADOS_URL = API_URLS.DEFAULT_TSE_RESULTADOS;
export const DEFAULT_TSE_CKAN_URL = API_URLS.DEFAULT_TSE_CKAN;

// Constants
export const SERVER_NAME = SERVER.NAME;
export const SERVER_VERSION = SERVER.VERSION;

// Allowed API hosts (SSRF protection)
export const ALLOWED_TSE_RESULTADOS_HOSTS: readonly string[] = [
  "resultados.tse.jus.br",
  "cdn.tse.jus.br",
];

export const ALLOWED_TSE_CKAN_HOSTS: readonly string[] = [
  "dadosabertos.tse.jus.br",
  "cdn.tse.jus.br",
];

const DEV_LOCALHOST_HOSTS = new Set(["localhost", "127.0.0.1"]);

function isLocalhostAllowed(): boolean {
  const nodeEnv = typeof process !== "undefined" ? process.env?.NODE_ENV : undefined;
  return nodeEnv === "development" || nodeEnv === "test";
}

function sanitizeUrlForLog(url: string): string {
  try {
    const parsed = new URL(url);
    return `${parsed.protocol}//${parsed.host}${parsed.pathname}`;
  } catch {
    return "[invalid-url]";
  }
}

/**
 * Validates URL for SSRF protection.
 * @param url - URL to validate
 * @param allowedHosts - List of allowed hostnames
 * @returns true if URL is valid and host is allowed
 */
export function validateUrl(url: string, allowedHosts: readonly string[]): boolean {
  if (typeof url !== "string" || !url.trim()) {
    console.error("[Security] Rejected empty or non-string URL");
    return false;
  }

  try {
    const parsed = new URL(url);

    // Reject URLs with embedded credentials to avoid credential confusion and secret leakage
    if (parsed.username || parsed.password) {
      console.error(
        `[Security] Rejected URL with embedded credentials: ${parsed.protocol}//${parsed.host}`,
      );
      return false;
    }

    // Loopback is only permitted in explicit development/test environments over HTTP(S)
    if (DEV_LOCALHOST_HOSTS.has(parsed.hostname)) {
      if (!isLocalhostAllowed()) {
        console.error(
          `[Security] Rejected loopback URL outside development/test: ${parsed.hostname}`,
        );
        return false;
      }
      if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
        console.error(
          `[Security] Rejected non-HTTP(S) loopback URL: ${parsed.protocol}//${parsed.host}`,
        );
        return false;
      }
      return true;
    }

    // Only HTTPS allowed for non-loopback hosts
    if (parsed.protocol !== "https:") {
      console.error(`[Security] Rejected non-HTTPS URL: ${sanitizeUrlForLog(url)}`);
      return false;
    }

    // Check if host is in allowlist (exact match or subdomain of allowlisted host)
    const isAllowed = allowedHosts.some((allowed) => {
      return parsed.hostname === allowed || parsed.hostname.endsWith(`.${allowed}`);
    });

    if (!isAllowed) {
      console.error(`[Security] Rejected URL with non-allowed host: ${parsed.hostname}`);
      console.error(`[Security] Allowed hosts: ${allowedHosts.join(", ")}`);
      return false;
    }

    return true;
  } catch {
    console.error(`[Security] Invalid URL format: ${sanitizeUrlForLog(url)}`);
    return false;
  }
}

export function isAllowedTseResultadosUrl(url: string): boolean {
  return validateUrl(url, ALLOWED_TSE_RESULTADOS_HOSTS);
}

export function isAllowedTseCkanUrl(url: string): boolean {
  return validateUrl(url, ALLOWED_TSE_CKAN_HOSTS);
}

function normalizeBaseUrl(url: string): string {
  return url.endsWith("/") ? url : url + "/";
}

function validateAndNormalizeApiConfig(config: ApiConfig): ApiConfig {
  if (!validateUrl(config.resultadosBaseUrl, ALLOWED_TSE_RESULTADOS_HOSTS)) {
    throw new Error(
      `Invalid or disallowed TSE Resultados API URL: ${sanitizeUrlForLog(config.resultadosBaseUrl)}. ` +
        `Allowed hosts: ${ALLOWED_TSE_RESULTADOS_HOSTS.join(", ")}`,
    );
  }
  if (!validateUrl(config.ckanBaseUrl, ALLOWED_TSE_CKAN_HOSTS)) {
    throw new Error(
      `Invalid or disallowed TSE CKAN API URL: ${sanitizeUrlForLog(config.ckanBaseUrl)}. ` +
        `Allowed hosts: ${ALLOWED_TSE_CKAN_HOSTS.join(", ")}`,
    );
  }

  return {
    ...config,
    resultadosBaseUrl: normalizeBaseUrl(config.resultadosBaseUrl),
    ckanBaseUrl: normalizeBaseUrl(config.ckanBaseUrl),
  };
}

// Configuration loading with hierarchy: env vars > config file > defaults
function loadApiConfiguration(): ApiConfig {
  const config: ApiConfig = {
    resultadosBaseUrl: DEFAULT_TSE_RESULTADOS_URL,
    ckanBaseUrl: DEFAULT_TSE_CKAN_URL,
  };

  // Try to load from config file first (available in Node.js CLI)
  try {
    const cwd = typeof process !== "undefined" && typeof process.cwd === "function"
      ? process.cwd()
      : ".";
    const configPath = resolve(cwd, ".mcprc.json");
    const configFile = JSON.parse(readFileSync(configPath, "utf-8")) as ConfigFile;

    if (typeof configFile?.apiUrls?.resultados === "string") {
      config.resultadosBaseUrl = configFile.apiUrls.resultados;
    }
    if (typeof configFile?.apiUrls?.ckan === "string") {
      config.ckanBaseUrl = configFile.apiUrls.ckan;
    }
    if (configFile?.auth?.headers && typeof configFile.auth.headers === "object") {
      config.authHeaders = configFile.auth.headers;
    }
  } catch {
    // Config file doesn't exist or is invalid, continue with defaults
  }

  // Environment variables override config file
  const env = typeof process !== "undefined" ? process.env : undefined;
  if (env?.TSE_RESULTADOS_BASE_URL) {
    config.resultadosBaseUrl = env.TSE_RESULTADOS_BASE_URL;
  }
  if (env?.TSE_CKAN_BASE_URL) {
    config.ckanBaseUrl = env.TSE_CKAN_BASE_URL;
  }

  // Handle authentication headers from environment variables if explicitly configured
  if (env?.API_KEY_HEADER && env?.API_KEY_VALUE) {
    config.authHeaders = {
      ...config.authHeaders,
      [env.API_KEY_HEADER]: env.API_KEY_VALUE,
    };
  }

  return validateAndNormalizeApiConfig(config);
}

function parsePositiveIntConfig(raw: string | undefined, fallback: number): number {
  if (!raw) return fallback;
  const parsed = parseInt(raw, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return fallback;
  }
  return parsed;
}

export function loadServerConfiguration(): ServerConfig {
  const env = typeof process !== "undefined" ? process.env : undefined;
  return {
    transport: env?.MCP_TRANSPORT || SERVER.DEFAULT_TRANSPORT,
    httpPort: parsePositiveIntConfig(env?.MCP_HTTP_PORT, SERVER.DEFAULT_HTTP_PORT),
    httpHost: env?.MCP_HTTP_HOST?.trim() || "127.0.0.1",
    cacheSize: parsePositiveIntConfig(env?.MCP_CACHE_SIZE, CACHE.DEFAULT_SIZE),
    cacheTTL: parsePositiveIntConfig(env?.MCP_CACHE_TTL, CACHE.DEFAULT_TTL_MS),
    apiTimeout: TIMEOUTS.HTTP_REQUEST_MS,
  };
}

export function resolveApiConfig(overrides?: Partial<ApiConfig>): ApiConfig {
  const base = loadApiConfiguration();
  if (!overrides) return base;
  const merged: ApiConfig = {
    ...base,
    ...(overrides.resultadosBaseUrl !== undefined
      ? { resultadosBaseUrl: overrides.resultadosBaseUrl }
      : {}),
    ...(overrides.ckanBaseUrl !== undefined ? { ckanBaseUrl: overrides.ckanBaseUrl } : {}),
  };
  if (base.authHeaders || overrides.authHeaders) {
    merged.authHeaders = {
      ...(base.authHeaders ?? {}),
      ...(overrides.authHeaders ?? {}),
    };
  }
  return validateAndNormalizeApiConfig(merged);
}
