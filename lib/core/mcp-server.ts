import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import {
  CallToolRequestSchema,
  ErrorCode,
  ListResourcesRequestSchema,
  ListToolsRequestSchema,
  McpError,
  ReadResourceRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { SERVER_NAME, SERVER_VERSION } from "../config/index.js";
import { TIMEOUTS } from "../config/timeouts.js";
import { RateLimiter } from "../infrastructure/rate-limiter.js";
import { createLogger } from "../infrastructure/logger.js";
import { RequestContext } from "../infrastructure/tracing.js";
import { serializeBoundedToolOutput } from "../shared/agentic-guard.js";
import { formatErrorResponse, RateLimitError } from "../shared/errors.js";
import { ApiConfig, Cache } from "../types/index.js";
import { TOOL_DEFINITIONS, executeTool } from "./tools.js";

const mcpLogger = createLogger("mcp-server");
const DEFAULT_MCP_TOOL_RATE_LIMIT_MAX = 120;

function parsePositiveIntEnv(name: string): number | undefined {
  const raw = typeof process !== "undefined" ? process.env?.[name] : undefined;
  if (!raw) return undefined;
  const parsed = parseInt(raw, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : undefined;
}

export interface MCPServerOptions {
  apiConfig: ApiConfig;
  cache?: Cache;
  rateLimit?: { windowMs: number; maxRequests: number } | false;
  getRequestContext?: () => RequestContext | undefined;
}

function formatErrorPayload(error: unknown) {
  const details = formatErrorResponse(error);
  return {
    content: [
      {
        type: "text" as const,
        text: JSON.stringify(
          {
            error: details.message,
            code: details.code,
            ...(details.data ? { details: details.data } : {}),
          },
          null,
          2,
        ),
      },
    ],
    isError: true,
  };
}

export function createMCPServer(options: MCPServerOptions): Server {
  const { apiConfig, cache, rateLimit, getRequestContext } = options;

  const disableRateLimit =
    rateLimit === false ||
    (typeof process !== "undefined" && process.env?.MCP_DISABLE_RATE_LIMIT === "true");
  const toolRateLimiter = disableRateLimit
    ? null
    : new RateLimiter({
        windowMs:
          typeof rateLimit === "object" ? rateLimit.windowMs : TIMEOUTS.RATE_LIMIT_WINDOW_MS,
        maxRequests:
          typeof rateLimit === "object"
            ? rateLimit.maxRequests
            : (parsePositiveIntEnv("MCP_TOOL_RATE_LIMIT_MAX") ?? DEFAULT_MCP_TOOL_RATE_LIMIT_MAX),
        enableCleanupTimer: false,
      });

  const server = new Server(
    { name: SERVER_NAME, version: SERVER_VERSION },
    { capabilities: { tools: {}, resources: {} } },
  );

  server.setRequestHandler(ListToolsRequestSchema, async () => ({
    tools: TOOL_DEFINITIONS,
  }));

  server.setRequestHandler(ListResourcesRequestSchema, async () => ({
    resources: [],
  }));

  server.setRequestHandler(ReadResourceRequestSchema, async () => {
    throw new McpError(ErrorCode.InvalidParams, "Unknown resource URI");
  });

  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;
    const requestContext = getRequestContext?.() ?? new RequestContext();
    requestContext.addMetadata("tool", name);

    if (toolRateLimiter && !toolRateLimiter.checkLimit("mcp-session")) {
      const retryAfter = Math.max(
        1,
        Math.ceil(toolRateLimiter.getResetTime("mcp-session") / 1000),
      );
      mcpLogger.warn("mcp.rate_limited", { tool: name, retryAfter }, requestContext.requestId);
      return formatErrorPayload(new RateLimitError(retryAfter));
    }

    try {
      const result = await executeTool(name, args, apiConfig, cache, {
        requestId: requestContext.requestId,
        requestContext,
      });

      if (result.ok) {
        return {
          content: [
            {
              type: "text",
              text: serializeBoundedToolOutput(result.data),
            },
          ],
        };
      }

      return formatErrorPayload(new Error(result.error));
    } catch (error: unknown) {
      return formatErrorPayload(error);
    }
  });

  return server;
}
