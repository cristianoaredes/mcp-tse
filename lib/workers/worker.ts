/**
 * Cloudflare Worker entry point for MCP TSE (@aredes.me/mcp-tse).
 */

import {
  handleMCPEndpoint,
  handleCORS,
  handleHealthCheck,
  withCorsHeaders,
  syncWorkerEnv,
  corsHeaders,
  Env,
} from "../adapters/cloudflare.js";
import { SERVER_VERSION } from "../config/index.js";
import { TOOL_DEFINITIONS } from "../core/tools.js";
import {
  extractRequestId,
  REQUEST_ID_HEADER,
  RequestContext,
} from "../infrastructure/tracing.js";
import { authenticateRequest, isPublicPath } from "./auth.js";
import { checkRateLimit } from "./rate-limit.js";
import { handleSSEEndpoint } from "./sse.js";
import {
  handleOAuthAuthorize,
  handleOAuthToken,
  handleOAuthUserInfo,
  handleOAuthRegister,
  handleJWKS,
  handleOAuthDiscovery,
} from "./oauth.js";
import { handleOpenAPIEndpoint } from "./openapi.js";
import { handleToolRestEndpoint } from "./rest.js";
import { WorkerExportedHandler } from "./types.js";

async function routeRequest(
  request: Request,
  env: Env,
  url: URL,
  ctx?: ExecutionContext,
  requestContext?: RequestContext,
): Promise<Response> {
  switch (url.pathname) {
    case "/health":
      return await handleHealthCheck(request, env, { requestContext });

    case "/mcp":
      if (request.method !== "POST") {
        return new Response("Method not allowed", {
          status: 405,
          headers: corsHeaders,
        });
      }
      return await handleMCPEndpoint(request, env, requestContext);

    case "/sse":
      if (request.method !== "GET" && request.method !== "POST") {
        return new Response("Method not allowed", {
          status: 405,
          headers: corsHeaders,
        });
      }
      return await handleSSEEndpoint(request, env, ctx, requestContext);

    case "/.well-known/oauth-authorization-server":
    case "/.well-known/openid_configuration":
      return handleOAuthDiscovery(request, env);

    case "/oauth/authorize":
      return handleOAuthAuthorize(request, env);

    case "/oauth/token":
      return await handleOAuthToken(request, env);

    case "/oauth/register":
      return await handleOAuthRegister(request, env);

    case "/oauth/userinfo":
      return handleOAuthUserInfo(request, env);

    case "/.well-known/jwks.json":
      return handleJWKS(request, env);

    case "/openapi.json":
      return handleOpenAPIEndpoint(request, env);

    case "/": {
      const rawDpoContact = env?.MCP_DPO_CONTACT;
      const dpoContact =
        typeof rawDpoContact === "string" && rawDpoContact.trim().length > 0
          ? rawDpoContact.trim()
          : "See PRIVACY.md (LGPD Art. 41)";
      const info = {
        service: "MCP TSE",
        description:
          "Model Context Protocol server for Brazilian electoral data (TSE Resultados EA20 & Dados Abertos CKAN)",
        version: SERVER_VERSION,
        runtime: "cloudflare-workers",
        endpoints: {
          mcp: "/mcp (HTTP JSON-RPC)",
          sse: "/sse (Server-Sent Events)",
          tools: "/tools/{toolName} (REST POST)",
          health: "/health",
          openapi: "/openapi.json",
        },
        tools: TOOL_DEFINITIONS.map((tool) => tool.name),
        documentation: "https://github.com/cristianoaredes/mcp-tse",
        privacy: {
          policy: "https://github.com/cristianoaredes/mcp-tse/blob/main/PRIVACY.md",
          dpo_contact: dpoContact,
        },
      };

      return new Response(JSON.stringify(info), {
        status: 200,
        headers: {
          "Content-Type": "application/json",
          ...corsHeaders,
        },
      });
    }

    default: {
      const toolMatch = url.pathname.match(/^\/tools\/(.+)$/);
      if (toolMatch) {
        if (request.method !== "POST") {
          return new Response("Method not allowed", {
            status: 405,
            headers: corsHeaders,
          });
        }
        let decodedTool: string;
        try {
          decodedTool = decodeURIComponent(toolMatch[1]);
        } catch {
          return new Response(
            JSON.stringify({
              error: "Bad Request",
              message: "Invalid URL encoding in path parameter",
            }),
            {
              status: 400,
              headers: {
                "Content-Type": "application/json",
                ...corsHeaders,
              },
            },
          );
        }
        return await handleToolRestEndpoint(decodedTool, request, env, requestContext);
      }

      return new Response("Not found", {
        status: 404,
        headers: corsHeaders,
      });
    }
  }
}

function withRequestId(response: Response, requestId: string): Response {
  const headers = new Headers(response.headers);
  headers.set(REQUEST_ID_HEADER, requestId);
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

export default {
  async fetch(
    request: Request,
    env: Env,
    ctx: ExecutionContext,
  ): Promise<Response> {
    syncWorkerEnv(env);
    const requestContext = new RequestContext(extractRequestId(request.headers));

    const url = new URL(request.url);
    const isPublic = isPublicPath(url.pathname);

    const corsResponse = handleCORS(request, env, { isPublic });
    if (corsResponse) {
      return withRequestId(corsResponse, requestContext.requestId);
    }

    const rateLimitResult = await checkRateLimit(request, env, requestContext);
    if (!rateLimitResult.allowed) {
      return withRequestId(
        withCorsHeaders(rateLimitResult.error!, request, env, { isPublic }),
        requestContext.requestId,
      );
    }

    const authResult = await authenticateRequest(request, env, requestContext);
    if (!authResult.authenticated) {
      return withRequestId(
        withCorsHeaders(authResult.error!, request, env, { isPublic }),
        requestContext.requestId,
      );
    }

    const response = await routeRequest(request, env, url, ctx, requestContext);
    return withRequestId(
      withCorsHeaders(response, request, env, { isPublic }),
      requestContext.requestId,
    );
  },
} satisfies WorkerExportedHandler<Env>;
