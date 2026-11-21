import { afterEach, describe, expect, it } from "vitest";
import http from "node:http";
import type { AddressInfo } from "node:net";
import { MemoryCache } from "../../lib/core/cache.js";
import {
  createCliHttpApp,
  isAllowedCliHost,
  isAllowedCliOrigin,
  isLoopbackHost,
  isValidApiKey,
  isValidSessionId,
  normalizeHostHeader,
  parseCommaSeparatedList,
  type CliHttpContext,
  type CliHttpOptions,
} from "../../lib/adapters/cli-http.js";
import type { ApiConfig } from "../../lib/types/index.js";

const DEFAULT_API_CONFIG: ApiConfig = {
  resultadosBaseUrl: "https://resultados.tse.jus.br/oficial/",
  ckanBaseUrl: "https://dadosabertos.tse.jus.br/api/3/action/",
};

interface HttpResponseResult {
  status: number;
  headers: http.IncomingHttpHeaders;
  body: string;
}

async function startTestApp(
  options: Partial<CliHttpOptions> = {},
): Promise<{
  baseUrl: string;
  port: number;
  ctx: CliHttpContext;
  close: () => Promise<void>;
}> {
  const ctx = createCliHttpApp({
    apiConfig: DEFAULT_API_CONFIG,
    cache: new MemoryCache(50, 60_000),
    ...options,
  });

  const server = http.createServer(ctx.app);
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const { port } = server.address() as AddressInfo;

  return {
    baseUrl: `http://127.0.0.1:${port}`,
    port,
    ctx,
    close: async () => {
      ctx.closeAll();
      await new Promise<void>((resolve) => server.close(() => resolve()));
    },
  };
}

function sendRawHttpRequest(options: {
  port: number;
  method: string;
  path: string;
  headers?: Record<string, string>;
  body?: string;
}): Promise<HttpResponseResult> {
  return new Promise((resolve, reject) => {
    const req = http.request(
      {
        host: "127.0.0.1",
        port: options.port,
        method: options.method,
        path: options.path,
        headers: options.headers,
      },
      (res) => {
        const chunks: Buffer[] = [];
        res.on("data", (chunk: Buffer) => chunks.push(chunk));
        res.on("end", () => {
          resolve({
            status: res.statusCode ?? 0,
            headers: res.headers,
            body: Buffer.concat(chunks).toString("utf8"),
          });
        });
      },
    );
    req.on("error", reject);
    if (options.body !== undefined) {
      req.write(options.body);
    }
    req.end();
  });
}

describe("CLI HTTP+SSE security helpers", () => {
  it("parses comma-separated allowlist env vars safely", () => {
    expect(parseCommaSeparatedList(undefined)).toEqual([]);
    expect(parseCommaSeparatedList("  ")).toEqual([]);
    expect(parseCommaSeparatedList(" https://a.example , , https://b.example ")).toEqual([
      "https://a.example",
      "https://b.example",
    ]);
  });

  it("normalizes Host headers and rejects spoofed or malformed values", () => {
    expect(normalizeHostHeader("localhost:3000")).toBe("localhost");
    expect(normalizeHostHeader("127.0.0.1:8787")).toBe("127.0.0.1");
    expect(normalizeHostHeader("[::1]:3000")).toBe("::1");
    expect(normalizeHostHeader("API.EXAMPLE.COM:443")).toBe("api.example.com");

    expect(normalizeHostHeader(undefined)).toBeNull();
    expect(normalizeHostHeader("")).toBeNull();
    expect(normalizeHostHeader("localhost:99999")).toBeNull();
    expect(normalizeHostHeader("localhost:0")).toBeNull();
    expect(normalizeHostHeader("evil.com@localhost")).toBeNull();
    expect(normalizeHostHeader("localhost/evil")).toBeNull();
    expect(normalizeHostHeader("localhost:abc")).toBeNull();
    expect(normalizeHostHeader("a:b:c")).toBeNull();
    expect(normalizeHostHeader("[::1")).toBeNull();
    expect(normalizeHostHeader("[::1]:99999")).toBeNull();
  });

  it("validates Host headers against loopback, bind host, and allowlist", () => {
    expect(isAllowedCliHost("localhost:3000")).toBe(true);
    expect(isAllowedCliHost("127.0.0.1:3000")).toBe(true);
    expect(isAllowedCliHost("[::1]:3000")).toBe(true);

    expect(isAllowedCliHost("evil.com")).toBe(false);
    expect(isAllowedCliHost("localhost.evil.com")).toBe(false);
    expect(isAllowedCliHost(undefined)).toBe(false);

    expect(isAllowedCliHost("mcp.internal:3000", "mcp.internal")).toBe(true);
    expect(isAllowedCliHost("evil.com:3000", "0.0.0.0")).toBe(false);
    expect(isAllowedCliHost("evil.com:3000", "::")).toBe(false);
    expect(isAllowedCliHost("api.example.com", undefined, ["*", "api.example.com"])).toBe(true);
    expect(isAllowedCliHost("other.example.com", undefined, ["api.example.com"])).toBe(false);
  });

  it("validates Origin headers strictly against exact origins", () => {
    expect(isAllowedCliOrigin(undefined)).toEqual({ allowed: true });
    expect(isAllowedCliOrigin("http://localhost:3000")).toEqual({
      allowed: true,
      allowOriginHeader: "http://localhost:3000",
    });
    expect(isAllowedCliOrigin("http://127.0.0.1:5173")).toEqual({
      allowed: true,
      allowOriginHeader: "http://127.0.0.1:5173",
    });

    expect(isAllowedCliOrigin("null").allowed).toBe(false);
    expect(isAllowedCliOrigin("*").allowed).toBe(false);
    expect(isAllowedCliOrigin("https://evil.com").allowed).toBe(false);
    expect(isAllowedCliOrigin("https://localhost.evil.com").allowed).toBe(false);
    expect(isAllowedCliOrigin("ftp://localhost:3000").allowed).toBe(false);
    expect(isAllowedCliOrigin("http://localhost:3000/").allowed).toBe(false);
    expect(isAllowedCliOrigin(`${"http://user"}:${"pass@localhost:3000"}`).allowed).toBe(false);
    expect(isAllowedCliOrigin("not a url").allowed).toBe(false);

    expect(isAllowedCliOrigin("https://app.example.com", ["https://app.example.com"])).toEqual({
      allowed: true,
      allowOriginHeader: "https://app.example.com",
    });
    expect(isAllowedCliOrigin("https://app.example.com", ["*"]).allowed).toBe(false);
  });

  it("validates session IDs, loopback hosts, and API keys", () => {
    expect(isValidSessionId("abc-123_DEF")).toBe(true);
    expect(isValidSessionId("")).toBe(false);
    expect(isValidSessionId(["a"])).toBe(false);
    expect(isValidSessionId("bad/session")).toBe(false);

    expect(isLoopbackHost("127.0.0.1")).toBe(true);
    expect(isLoopbackHost("localhost")).toBe(true);
    expect(isLoopbackHost("::1")).toBe(true);
    expect(isLoopbackHost("[::1]")).toBe(true);
    expect(isLoopbackHost("0.0.0.0")).toBe(false);

    expect(isValidApiKey("secret-123", "secret-123")).toBe(true);
    expect(isValidApiKey("secret-124", "secret-123")).toBe(false);
    expect(isValidApiKey("", "secret-123")).toBe(false);
  });
});

describe("CLI HTTP+SSE middleware hardening", () => {
  const closers: Array<() => Promise<void>> = [];

  afterEach(async () => {
    while (closers.length > 0) {
      const close = closers.pop()!;
      await close();
    }
  });

  it("refuses non-loopback binding without MCP_API_KEY", () => {
    expect(() =>
      createCliHttpApp({
        apiConfig: DEFAULT_API_CONFIG,
        cache: new MemoryCache(10, 1000),
        host: "0.0.0.0",
      }),
    ).toThrow(/Refusing to start HTTP\/SSE server on non-loopback host/);
  });

  it("rejects spoofed Host and disallowed Origin headers with 403", async () => {
    const server = await startTestApp({ host: "127.0.0.1" });
    closers.push(server.close);

    const badHost = await sendRawHttpRequest({
      port: server.port,
      method: "POST",
      path: "/messages?sessionId=test",
      headers: { Host: "evil.example.com" },
    });
    expect(badHost.status).toBe(403);
    expect(badHost.headers["x-content-type-options"]).toBe("nosniff");
    expect(badHost.headers["x-frame-options"]).toBe("DENY");
    expect(badHost.headers["x-request-id"]).toBeTruthy();

    const badOrigin = await sendRawHttpRequest({
      port: server.port,
      method: "POST",
      path: "/messages?sessionId=test",
      headers: {
        Host: `127.0.0.1:${server.port}`,
        Origin: "https://attacker.example",
      },
    });
    expect(badOrigin.status).toBe(403);

    const allowedPreflight = await sendRawHttpRequest({
      port: server.port,
      method: "OPTIONS",
      path: "/messages",
      headers: {
        Host: `127.0.0.1:${server.port}`,
        Origin: "http://localhost:5173",
      },
    });
    expect(allowedPreflight.status).toBe(204);
    expect(allowedPreflight.headers["access-control-allow-origin"]).toBe("http://localhost:5173");
    expect(allowedPreflight.headers["vary"]).toBe("Origin");
  });

  it("enforces Bearer and X-API-Key auth when MCP_API_KEY is configured", async () => {
    const server = await startTestApp({
      host: "0.0.0.0",
      apiKey: "super-secret-token",
      allowedHosts: ["localhost", "127.0.0.1"],
    });
    closers.push(server.close);

    const missingAuth = await fetch(`${server.baseUrl}/messages?sessionId=abc`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "{}",
    });
    expect(missingAuth.status).toBe(401);
    expect(missingAuth.headers.get("www-authenticate")).toBe("Bearer");

    const wrongAuth = await fetch(`${server.baseUrl}/messages?sessionId=abc`, {
      method: "POST",
      headers: {
        Authorization: "Bearer wrong-token",
        "Content-Type": "application/json",
      },
      body: "{}",
    });
    expect(wrongAuth.status).toBe(401);

    const bearerOk = await fetch(`${server.baseUrl}/messages?sessionId=abc`, {
      method: "POST",
      headers: {
        Authorization: "Bearer super-secret-token",
        "Content-Type": "application/json",
      },
      body: "{}",
    });
    expect(bearerOk.status).toBe(404);

    const apiKeyOk = await fetch(`${server.baseUrl}/messages?sessionId=abc`, {
      method: "POST",
      headers: {
        "X-API-Key": "super-secret-token",
        "Content-Type": "application/json",
      },
      body: "{}",
    });
    expect(apiKeyOk.status).toBe(404);
  });

  it("validates sessionId, malformed JSON (400), oversized bodies (413), and rate limit (429)", async () => {
    const server = await startTestApp({
      rateLimitMaxRequests: 2,
      rateLimitWindowMs: 60_000,
    });
    closers.push(server.close);

    const missingSession = await fetch(`${server.baseUrl}/messages`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "{}",
    });
    expect(missingSession.status).toBe(400);

    const malformedJson = await fetch(`${server.baseUrl}/messages?sessionId=abc`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "{bad-json",
    });
    expect(malformedJson.status).toBe(400);

    const largeBody = JSON.stringify({ data: "a".repeat(1_050_000) });
    const tooLarge = await fetch(`${server.baseUrl}/messages?sessionId=abc`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: largeBody,
    });
    expect(tooLarge.status).toBe(413);

    await fetch(`${server.baseUrl}/messages?sessionId=abc`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "{}",
    });
    const rateLimited = await fetch(`${server.baseUrl}/messages?sessionId=abc`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "{}",
    });
    expect(rateLimited.status).toBe(429);
    expect(rateLimited.headers.get("x-request-id")).toBeTruthy();
  });

  it("enforces maxSessions=503 on SSE connections", async () => {
    const server = await startTestApp({ maxSessions: 1 });
    closers.push(server.close);

    server.ctx.transports.set("pre-existing", {
      transport: { close: () => Promise.resolve() } as never,
      createdAt: new Date(),
      lastActivity: new Date(),
    });

    const res = await fetch(`${server.baseUrl}/mcp`);
    expect(res.status).toBe(503);
    expect(await res.json()).toMatchObject({
      error: "Service Unavailable",
    });
  });
});
