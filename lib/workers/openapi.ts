/**
 * OpenAPI 3.0 schema generation for Cloudflare Workers and REST clients.
 */

import { Env, getCorsHeaders } from "../adapters/cloudflare.js";
import { SERVER_VERSION } from "../config/index.js";
import { TOOL_DEFINITIONS } from "../core/tools.js";

export function generateOpenAPISchema(requestUrl: string): unknown {
  const origin = new URL(requestUrl).origin;
  const toolNames = TOOL_DEFINITIONS.map((tool) => tool.name);

  return {
    openapi: "3.0.0",
    info: {
      title: "MCP TSE API",
      description:
        "Brazilian electoral public data API (TSE Resultados EA20 & Dados Abertos CKAN) with MCP JSON-RPC, SSE, and REST tool endpoints",
      version: SERVER_VERSION,
      contact: {
        name: "MCP TSE Maintainers / DPO",
        url: "https://github.com/cristianoaredes/mcp-tse/blob/main/PRIVACY.md",
      },
      "x-privacy-policy":
        "https://github.com/cristianoaredes/mcp-tse/blob/main/PRIVACY.md",
    },
    servers: [{ url: origin }],
    security: [{ ApiKeyAuth: [] }, { BearerAuth: [] }],
    components: {
      securitySchemes: {
        ApiKeyAuth: {
          type: "apiKey",
          in: "header",
          name: "X-API-Key",
          description: "API key for authentication via X-API-Key header.",
        },
        BearerAuth: {
          type: "http",
          scheme: "bearer",
          description:
            "API key for authentication via 'Authorization: Bearer <key>' header.",
        },
      },
    },
    paths: {
      "/health": {
        get: {
          summary: "Worker health check",
          security: [],
          responses: {
            "200": { description: "Service healthy" },
            "503": { description: "Service degraded (KV unavailable)" },
          },
        },
      },
      "/mcp": {
        post: {
          summary: "MCP JSON-RPC endpoint",
          description: "Model Context Protocol JSON-RPC endpoint for AI assistants",
          security: [{ ApiKeyAuth: [] }, { BearerAuth: [] }],
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    jsonrpc: { type: "string", enum: ["2.0"] },
                    id: { type: ["string", "number", "null"] },
                    method: { type: "string" },
                    params: { type: "object" },
                  },
                  required: ["jsonrpc", "method"],
                },
              },
            },
          },
          responses: {
            "200": { description: "MCP JSON-RPC response" },
            "400": { description: "Invalid JSON payload" },
            "401": { description: "Unauthorized - API key required" },
          },
        },
      },
      "/sse": {
        get: {
          summary: "MCP Server-Sent Events endpoint",
          description: "Model Context Protocol streaming endpoint for real-time communication",
          security: [{ ApiKeyAuth: [] }, { BearerAuth: [] }],
          responses: {
            "200": { description: "SSE stream established" },
            "400": { description: "Invalid Accept header" },
            "401": { description: "Unauthorized - API key required" },
          },
        },
      },
      "/tools/{toolName}": {
        post: {
          summary: "Invoke a registered TSE MCP tool via REST",
          security: [{ ApiKeyAuth: [] }, { BearerAuth: [] }],
          parameters: [
            {
              name: "toolName",
              in: "path",
              required: true,
              schema: {
                type: "string",
                enum: toolNames,
              },
              description: "Registered TSE MCP tool name",
            },
          ],
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  additionalProperties: true,
                },
              },
            },
          },
          responses: {
            "200": { description: "Tool execution result" },
            "400": { description: "Invalid parameters or JSON payload" },
            "401": { description: "Unauthorized - API key required" },
            "404": { description: "Unknown tool or upstream resource not found" },
            "429": { description: "Rate limit exceeded" },
          },
        },
      },
    },
  };
}

export function handleOpenAPIEndpoint(request: Request, env?: Env): Response {
  const schema = generateOpenAPISchema(request.url);

  return new Response(JSON.stringify(schema), {
    status: 200,
    headers: {
      "Content-Type": "application/json",
      ...getCorsHeaders(request, env, { isPublic: true }),
    },
  });
}
