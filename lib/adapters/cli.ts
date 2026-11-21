#!/usr/bin/env node
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import type http from "node:http";
import { createMCPServer } from "../core/mcp-server.js";
import { MemoryCache } from "../core/cache.js";
import {
  loadServerConfiguration,
  resolveApiConfig,
  SERVER_NAME,
  SERVER_VERSION,
} from "../config/index.js";
import {
  createCliHttpApp,
  createGracefulShutdown,
  type CliHttpContext,
  DEFAULT_CLI_HTTP_HOST,
  DEFAULT_MAX_SSE_SESSIONS,
  isLoopbackHost,
  parseCommaSeparatedList,
} from "./cli-http.js";

const DEBUG = process.env.NODE_ENV !== "production";
function debug(...args: unknown[]) {
  if (DEBUG) {
    console.error("[DEBUG]", ...args);
  }
}

const runtimeState: {
  httpServer?: http.Server;
  httpContext?: CliHttpContext;
  mcpServer?: ReturnType<typeof createMCPServer>;
  cache?: MemoryCache;
} = {};

let shutdownRunner: ((signal?: string) => Promise<void>) | undefined;
const handleShutdownSignal = (signal: string) => {
  if (!shutdownRunner) {
    shutdownRunner = createGracefulShutdown({
      server: runtimeState.httpServer,
      httpContext: runtimeState.httpContext,
      mcpServer: runtimeState.mcpServer,
      cache: runtimeState.cache,
      logger: debug,
      onExit: (code) => process.exit(code),
    });
  }
  void shutdownRunner(signal);
};

process.on("SIGINT", () => handleShutdownSignal("SIGINT"));
process.on("SIGTERM", () => handleShutdownSignal("SIGTERM"));

async function main() {
  const args = process.argv.slice(2);
  if (args.includes("--version") || args.includes("-v")) {
    console.log(`${SERVER_NAME} v${SERVER_VERSION}`);
    process.exit(0);
  }
  if (args.includes("--help") || args.includes("-h")) {
    console.log(`${SERVER_NAME} v${SERVER_VERSION} - Model Context Protocol server for Brazilian TSE electoral data

Usage:
  mcp-tse [options]
  npx @aredes.me/mcp-tse [options]

Options:
  -h, --help     Show this help message
  -v, --version  Show version number

Environment Variables:
  MCP_TRANSPORT            Transport mode: stdio (default) or http
  MCP_HTTP_PORT            HTTP server port (default: 3000)
  MCP_HTTP_HOST            HTTP bind host (default: 127.0.0.1)
  MCP_API_KEY              API key for HTTP/SSE auth (required outside loopback)
  MCP_ALLOWED_ORIGINS      Comma-separated allowed Origin URLs for CORS
  MCP_ALLOWED_HOSTS        Comma-separated allowed Host headers
  MCP_MAX_SSE_SESSIONS     Maximum concurrent SSE sessions (default: 100)
  TSE_RESULTADOS_BASE_URL  Custom TSE Resultados EA20 base URL (allowlisted)
  TSE_CKAN_BASE_URL        Custom TSE Dados Abertos CKAN base URL (allowlisted)
  API_KEY_HEADER           Optional upstream authentication header name
  API_KEY_VALUE            Optional upstream authentication header value

Examples:
  mcp-tse                                    # Start with stdio transport
  MCP_TRANSPORT=http mcp-tse                 # Start with HTTP transport (127.0.0.1:3000)

For more information, visit: https://github.com/cristianoaredes/mcp-tse`);
    process.exit(0);
  }

  const serverConfig = loadServerConfiguration();
  const apiConfig = resolveApiConfig();

  console.error(`${SERVER_NAME} v${SERVER_VERSION} configuration:`);
  console.error(`  TSE Resultados API: ${apiConfig.resultadosBaseUrl}`);
  console.error(`  TSE CKAN API: ${apiConfig.ckanBaseUrl}`);
  if (apiConfig.authHeaders) {
    console.error(`  Auth headers: ${Object.keys(apiConfig.authHeaders).join(", ")}`);
  }

  const cache = new MemoryCache(serverConfig.cacheSize, serverConfig.cacheTTL);
  runtimeState.cache = cache;

  const mcpServer = createMCPServer({ apiConfig, cache });
  runtimeState.mcpServer = mcpServer;

  const transportMode = serverConfig.transport;
  if (transportMode === "http") {
    const host = serverConfig.httpHost || DEFAULT_CLI_HTTP_HOST;
    const apiKey = process.env.MCP_API_KEY?.trim() || undefined;
    if (!isLoopbackHost(host) && !apiKey) {
      console.error(
        `[Security] Refusing to bind HTTP/SSE transport on non-loopback host "${host}" without MCP_API_KEY configured.`,
      );
      process.exit(1);
    }
    if (host === "0.0.0.0" || host === "::") {
      console.error(
        `[Security] WARNING: HTTP+SSE transport bound to wildcard interface (${host}). ` +
          "Prefer 127.0.0.1 and configure MCP_ALLOWED_HOSTS / MCP_ALLOWED_ORIGINS when exposing externally.",
      );
    }

    const parsedMaxSessions = Number.parseInt(process.env.MCP_MAX_SSE_SESSIONS || "", 10);
    const maxSessions =
      Number.isFinite(parsedMaxSessions) && parsedMaxSessions > 0
        ? parsedMaxSessions
        : DEFAULT_MAX_SSE_SESSIONS;

    const httpContext = createCliHttpApp({
      apiConfig,
      cache,
      host,
      apiKey,
      allowedOrigins: parseCommaSeparatedList(process.env.MCP_ALLOWED_ORIGINS),
      allowedHosts: parseCommaSeparatedList(process.env.MCP_ALLOWED_HOSTS),
      maxSessions,
      debug,
    });
    runtimeState.httpContext = httpContext;

    const port = serverConfig.httpPort;
    runtimeState.httpServer = httpContext.app.listen(port, host, () => {
      console.error(
        `${SERVER_NAME} v${SERVER_VERSION} started on HTTP+SSE transport (port ${port}) [${host}]`,
      );
      console.error(
        `  HTTP+SSE auth: ${apiKey ? "enabled (MCP_API_KEY)" : "disabled (loopback-only)"}`,
      );
    });
  } else {
    const transport = new StdioServerTransport();
    await mcpServer.connect(transport);
    console.error(`${SERVER_NAME} v${SERVER_VERSION} started on stdio transport`);
  }
}

main().catch((error) => {
  console.error("Server failed to start:", error);
  process.exit(1);
});
