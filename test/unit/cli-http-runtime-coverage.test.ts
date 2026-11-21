import { afterEach, describe, expect, it, vi } from "vitest";
import http from "node:http";
import type { AddressInfo } from "node:net";
import { MemoryCache } from "../../lib/core/cache.js";
import {
  createCliHttpApp,
  createGracefulShutdown,
  type CliHttpContext,
  type CliHttpOptions,
} from "../../lib/adapters/cli-http.js";
import type { ApiConfig } from "../../lib/types/index.js";

const API_CONFIG: ApiConfig = {
  resultadosBaseUrl: "https://resultados.tse.jus.br/oficial/",
  ckanBaseUrl: "https://dadosabertos.tse.jus.br/api/3/action/",
};

async function startLiveHttpApp(options: Partial<CliHttpOptions> = {}): Promise<{
  baseUrl: string;
  port: number;
  ctx: CliHttpContext;
  close: () => Promise<void>;
}> {
  const ctx = createCliHttpApp({
    apiConfig: API_CONFIG,
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

describe("CLI HTTP+SSE runtime paths & graceful shutdown", () => {
  const closers: Array<() => Promise<void>> = [];

  afterEach(async () => {
    vi.useRealTimers();
    while (closers.length > 0) {
      const close = closers.pop()!;
      await close();
    }
  });

  it("establishes live SSE session on GET /mcp and routes POST /messages", async () => {
    const debugLogs: unknown[][] = [];
    const srv = await startLiveHttpApp({
      debug: (...args) => debugLogs.push(args),
    });
    closers.push(srv.close);

    const abortController = new AbortController();
    const sseRes = await fetch(`${srv.baseUrl}/mcp`, {
      signal: abortController.signal,
      headers: {
        "X-Request-Id": "req-live-sse-1",
      },
    });
    expect(sseRes.status).toBe(200);
    expect(sseRes.headers.get("content-type")).toContain("text/event-stream");
    expect(sseRes.headers.get("x-request-id")).toBe("req-live-sse-1");

    const reader = sseRes.body!.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    let sessionId = "";

    for (let i = 0; i < 10; i++) {
      const { value, done } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const match = /sessionId=([A-Za-z0-9_-]+)/.exec(buffer);
      if (match) {
        sessionId = match[1];
        break;
      }
    }

    expect(sessionId).toMatch(/^[A-Za-z0-9_-]+$/);
    expect(srv.ctx.transports.size).toBe(1);

    const initMsg = await fetch(`${srv.baseUrl}/messages?sessionId=${sessionId}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Request-Id": "req-post-msg-1",
      },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        method: "initialize",
        params: {
          protocolVersion: "2024-11-05",
          capabilities: {},
          clientInfo: { name: "unit-test", version: "0.1.0" },
        },
      }),
    });
    expect(initMsg.status).toBe(202);
    expect(initMsg.headers.get("x-request-id")).toBe("req-post-msg-1");

    abortController.abort();
    await reader.cancel().catch(() => {});
    expect(debugLogs.length).toBeGreaterThan(0);
  });

  it("reaps stale SSE connections during periodic connectionMonitor ticks", () => {
    vi.useFakeTimers();
    const debugMessages: unknown[][] = [];
    const ctx = createCliHttpApp({
      apiConfig: API_CONFIG,
      cache: new MemoryCache(10, 1000),
      debug: (...args) => debugMessages.push(args),
    });

    const closeMock = vi.fn();
    ctx.transports.set("stale-session", {
      transport: { close: closeMock } as never,
      createdAt: new Date(Date.now() - 400_000),
      lastActivity: new Date(Date.now() - 400_000),
    });
    ctx.transports.set("fresh-session", {
      transport: { close: vi.fn() } as never,
      createdAt: new Date(),
      lastActivity: new Date(),
    });

    vi.advanceTimersByTime(35_000);
    expect(closeMock).toHaveBeenCalledTimes(1);
    expect(ctx.transports.has("stale-session")).toBe(false);
    expect(ctx.transports.has("fresh-session")).toBe(true);
    expect(debugMessages.length).toBeGreaterThanOrEqual(2);

    ctx.closeAll();
    ctx.closeAll();
  });

  it("createGracefulShutdown drains server, httpContext, mcpServer, cache idempotently (exit 0)", async () => {
    const httpCloseAll = vi.fn();
    const serverCloseIdle = vi.fn();
    const serverClose = vi.fn((cb: () => void) => cb());
    const mcpClose = vi.fn().mockResolvedValue(undefined);
    const cacheClear = vi.fn().mockResolvedValue(undefined);
    const onExit = vi.fn();
    const logs: unknown[][] = [];

    const shutdown = createGracefulShutdown({
      server: {
        listening: true,
        close: serverClose as never,
        closeIdleConnections: serverCloseIdle,
      },
      httpContext: { closeAll: httpCloseAll },
      mcpServer: { close: mcpClose },
      cache: { clear: cacheClear },
      timeoutMs: 2000,
      logger: (...args) => logs.push(args),
      onExit,
    });

    const p1 = shutdown("SIGTERM");
    const p2 = shutdown("SIGINT");
    await Promise.all([p1, p2]);

    expect(httpCloseAll).toHaveBeenCalledTimes(1);
    expect(serverClose).toHaveBeenCalledTimes(1);
    expect(serverCloseIdle).toHaveBeenCalledTimes(1);
    expect(mcpClose).toHaveBeenCalledTimes(1);
    expect(cacheClear).toHaveBeenCalledTimes(1);
    expect(onExit).toHaveBeenCalledWith(0);
    expect(logs[0]?.[0]).toContain("SIGTERM");
  });

  it("createGracefulShutdown exits with code 1 when drain hangs past timeoutMs", async () => {
    vi.useFakeTimers();
    const onExit = vi.fn();
    const shutdown = createGracefulShutdown({
      httpContext: {
        closeAll: () => {
          throw new Error("close failure");
        },
      },
      server: {
        listening: true,
        close: () => undefined as never,
      },
      mcpServer: {
        close: () => new Promise<void>(() => {}),
      },
      timeoutMs: 150,
      onExit,
    });

    const p = shutdown();
    await vi.advanceTimersByTimeAsync(200);
    await p;

    expect(onExit).toHaveBeenCalledWith(1);
  });
});
