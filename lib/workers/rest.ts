/**
 * Generic REST API endpoint for invoking registered TSE MCP tools over HTTP POST /tools/{toolName}.
 */

import { corsHeaders, Env, handleMCPRequest } from "../adapters/cloudflare.js";
import { hasTool } from "../core/registry.js";
import { createLogger } from "../infrastructure/logger.js";
import type { RequestContext } from "../infrastructure/tracing.js";
import { maskSensitiveText } from "../shared/log-redaction.js";
import { MCPRequest } from "../types/index.js";

const restLogger = createLogger("worker-rest");

function invalidJsonResponse(): { ok: false; response: Response } {
  return {
    ok: false,
    response: new Response(
      JSON.stringify({
        error: "Bad Request",
        message: "Invalid JSON payload",
      }),
      {
        status: 400,
        headers: {
          "Content-Type": "application/json",
          ...corsHeaders,
        },
      },
    ),
  };
}

async function parseJsonBody(
  request: Request,
): Promise<{ ok: true; data: Record<string, unknown> } | { ok: false; response: Response }> {
  let parsed: unknown;
  try {
    parsed = await request.json();
  } catch (error: unknown) {
    if (error instanceof SyntaxError || (error instanceof Error && error.name === "SyntaxError")) {
      return invalidJsonResponse();
    }
    throw error;
  }

  if (parsed === null || typeof parsed !== "object" || Array.isArray(parsed)) {
    return invalidJsonResponse();
  }

  return { ok: true, data: parsed as Record<string, unknown> };
}

function internalServerErrorResponse(endpoint: string, error: unknown): Response {
  restLogger.error("rest.handler_error", {
    endpoint,
    error: maskSensitiveText(error instanceof Error ? error.message : String(error)),
  });
  return new Response(
    JSON.stringify({
      error: "Internal server error",
    }),
    {
      status: 500,
      headers: {
        "Content-Type": "application/json",
        ...corsHeaders,
      },
    },
  );
}

/**
 * Handle POST /tools/{toolName} REST endpoint.
 */
export async function handleToolRestEndpoint(
  toolName: string,
  request: Request,
  env: Env,
  requestContext?: RequestContext,
): Promise<Response> {
  if (!hasTool(toolName)) {
    return new Response(
      JSON.stringify({
        error: "Not Found",
        message: `Unknown tool: ${toolName}`,
      }),
      {
        status: 404,
        headers: {
          "Content-Type": "application/json",
          ...corsHeaders,
        },
      },
    );
  }

  try {
    const parsedBody = await parseJsonBody(request);
    if (!parsedBody.ok) {
      return parsedBody.response;
    }

    const mcpRequest: MCPRequest = {
      jsonrpc: "2.0",
      id: Date.now(),
      method: "tools/call",
      params: {
        name: toolName,
        arguments: parsedBody.data,
      },
    };

    const mcpResponse = await handleMCPRequest(mcpRequest, env, requestContext);

    if (mcpResponse.error) {
      const isNotFound =
        mcpResponse.error.code === -32603 &&
        typeof mcpResponse.error.data === "string" &&
        /not found/i.test(mcpResponse.error.data);
      return new Response(
        JSON.stringify({
          error: mcpResponse.error.message,
          code: mcpResponse.error.code,
          data: mcpResponse.error.data,
        }),
        {
          status: isNotFound ? 404 : 400,
          headers: {
            "Content-Type": "application/json",
            ...corsHeaders,
          },
        },
      );
    }

    return new Response(JSON.stringify(mcpResponse.result), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        ...corsHeaders,
      },
    });
  } catch (error: unknown) {
    return internalServerErrorResponse(`/tools/${toolName}`, error);
  }
}
