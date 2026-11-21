import { afterEach, describe, expect, it, vi } from "vitest";
import worker from "../../lib/workers/worker.js";
import {
  authenticateRequest,
  constantTimeEqual,
  isPublicPath,
} from "../../lib/workers/auth.js";
import {
  handleJWKS,
  handleOAuthAuthorize,
  handleOAuthDiscovery,
  handleOAuthRegister,
  handleOAuthToken,
  handleOAuthUserInfo,
} from "../../lib/workers/oauth.js";
import {
  getCorsHeaders,
  handleCORS,
  parseAllowedOrigins,
  withCorsHeaders,
} from "../../lib/adapters/cloudflare.js";

const MOCK_CTX = {
  waitUntil: vi.fn(),
  passThroughOnException: vi.fn(),
} as unknown as ExecutionContext;

describe("Worker auth, OAuth fail-closed, and CORS policy", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("constantTimeEqual handles equal, different-content, and different-length inputs", () => {
    expect(constantTimeEqual("abc-123", "abc-123")).toBe(true);
    expect(constantTimeEqual("abc-123", "abc-124")).toBe(false);
    expect(constantTimeEqual("abc", "abcd")).toBe(false);
    expect(constantTimeEqual("", "")).toBe(true);
  });

  it("isPublicPath skips auth only for documented public endpoints", () => {
    expect(isPublicPath("/health")).toBe(true);
    expect(isPublicPath("/")).toBe(true);
    expect(isPublicPath("/openapi.json")).toBe(true);
    expect(isPublicPath("/.well-known/oauth-authorization-server")).toBe(true);
    expect(isPublicPath("/mcp")).toBe(false);
    expect(isPublicPath("/tools/tse_eleicoes_catalogo")).toBe(false);
  });

  it("authenticateRequest enforces Bearer or X-API-Key when MCP_API_KEY is configured", async () => {
    const publicRes = await authenticateRequest(
      new Request("https://worker.test/health"),
      { MCP_API_KEY: "secret-key" },
    );
    expect(publicRes.authenticated).toBe(true);

    const missing = await authenticateRequest(
      new Request("https://worker.test/mcp", { method: "POST" }),
      { MCP_API_KEY: "secret-key" },
    );
    expect(missing.authenticated).toBe(false);
    expect(missing.error?.status).toBe(401);
    expect(missing.error?.headers.get("WWW-Authenticate")).toBe("Bearer");

    const invalid = await authenticateRequest(
      new Request("https://worker.test/mcp", {
        method: "POST",
        headers: { Authorization: "Bearer wrong" },
      }),
      { MCP_API_KEY: "secret-key" },
    );
    expect(invalid.authenticated).toBe(false);

    const validBearer = await authenticateRequest(
      new Request("https://worker.test/mcp", {
        method: "POST",
        headers: { Authorization: "Bearer secret-key" },
      }),
      { MCP_API_KEY: "secret-key" },
    );
    expect(validBearer.authenticated).toBe(true);

    const validApiKey = await authenticateRequest(
      new Request("https://worker.test/tools/tse_eleicoes_catalogo", {
        method: "POST",
        headers: { "X-API-Key": "secret-key" },
      }),
      { MCP_API_KEY: "secret-key" },
    );
    expect(validApiKey.authenticated).toBe(true);

    const openMode = await authenticateRequest(
      new Request("https://worker.test/mcp", { method: "POST" }),
      {},
    );
    expect(openMode.authenticated).toBe(true);
  });

  it("OAuth endpoints are fail-closed 501 with Cache-Control: no-store and no Location header", async () => {
    const req = new Request("https://worker.test/oauth/authorize?redirect_uri=https://evil.test");
    const env = { MCP_API_KEY: "k" };

    const responses = await Promise.all([
      handleOAuthAuthorize(),
      handleOAuthToken(req, env),
      handleOAuthUserInfo(req, env),
      handleJWKS(req, env),
      handleOAuthRegister(req, env),
      handleOAuthDiscovery(req, env),
      worker.fetch(
        new Request("https://worker.test/.well-known/oauth-authorization-server"),
        env,
        MOCK_CTX,
      ),
      worker.fetch(
        new Request("https://worker.test/oauth/token", {
          method: "POST",
          headers: { Authorization: "Bearer k" },
        }),
        env,
        MOCK_CTX,
      ),
      worker.fetch(
        new Request("https://worker.test/oauth/register", {
          method: "POST",
          headers: { Authorization: "Bearer k" },
        }),
        env,
        MOCK_CTX,
      ),
      worker.fetch(
        new Request("https://worker.test/oauth/userinfo", {
          headers: { Authorization: "Bearer k" },
        }),
        env,
        MOCK_CTX,
      ),
      worker.fetch(new Request("https://worker.test/.well-known/jwks.json"), env, MOCK_CTX),
    ]);

    for (const res of responses) {
      expect(res.status).toBe(501);
      expect(res.headers.get("Location")).toBeNull();
      expect(res.headers.get("Cache-Control")).toBe("no-store");
      expect(await res.json()).toMatchObject({ error: "oauth_not_supported" });
    }

    const unauthOauth = await worker.fetch(
      new Request("https://worker.test/oauth/token", { method: "POST" }),
      env,
      MOCK_CTX,
    );
    expect(unauthOauth.status).toBe(401);
  });

  it("CORS policy restricts origins when MCP_API_KEY or MCP_ALLOWED_ORIGINS are set", async () => {
    expect(
      parseAllowedOrigins("*, https://app.aredes.me/path, not-a-url, ftp://bad, http://localhost:3000"),
    ).toEqual(["https://app.aredes.me", "http://localhost:3000"]);

    const strictHeaders = getCorsHeaders(
      new Request("https://worker.test/mcp", { headers: { Origin: "https://app.aredes.me" } }),
      { MCP_ALLOWED_ORIGINS: "https://app.aredes.me" },
    );
    expect(strictHeaders["Access-Control-Allow-Origin"]).toBe("https://app.aredes.me");
    expect(strictHeaders.Vary).toBe("Origin");

    const rejectedPreflight = handleCORS(
      new Request("https://worker.test/mcp", {
        method: "OPTIONS",
        headers: { Origin: "https://evil.example" },
      }),
      { MCP_ALLOWED_ORIGINS: "https://app.aredes.me" },
    );
    expect(rejectedPreflight?.status).toBe(403);

    const apiKeyHeaders = getCorsHeaders(
      new Request("https://worker.test/mcp", { headers: { Origin: "https://evil.example" } }),
      { MCP_API_KEY: "secret" },
    );
    expect(apiKeyHeaders["Access-Control-Allow-Origin"]).toBeUndefined();

    const wrapped = withCorsHeaders(
      new Response("ok", { status: 200 }),
      new Request("https://worker.test/health", { headers: { Origin: "https://public.test" } }),
      { MCP_API_KEY: "secret" },
      { isPublic: true },
    );
    expect(wrapped.headers.get("Access-Control-Allow-Origin")).toBe("*");
  });
});
