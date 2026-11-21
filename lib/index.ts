// Main library exports for @aredes.me/mcp-tse
export { createMCPServer, type MCPServerOptions } from "./core/mcp-server.js";
export {
  TOOL_DEFINITIONS,
  executeTool,
  getMetrics,
  getToolMetrics,
  resetMetrics,
} from "./core/tools.js";
export { TOOL_SCHEMAS } from "./core/tool-schemas.js";
export {
  DEFAULT_TSE_RESULTADOS_URL,
  DEFAULT_TSE_CKAN_URL,
  ALLOWED_TSE_RESULTADOS_HOSTS,
  ALLOWED_TSE_CKAN_HOSTS,
  SERVER_NAME,
  SERVER_VERSION,
  validateUrl,
  isAllowedTseResultadosUrl,
  isAllowedTseCkanUrl,
  loadServerConfiguration,
  resolveApiConfig,
} from "./config/index.js";
export { MemoryCache, KVCache } from "./core/cache.js";
export type {
  ApiConfig,
  ServerConfig,
  ConfigFile,
  HttpResponse,
  LookupResult,
  Cache,
  MCPRequest,
  MCPResponse,
} from "./types/index.js";
