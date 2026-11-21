import { afterEach, describe, expect, it, vi } from "vitest";
import worker from "../../lib/workers/worker.js";
import { checkRateLimit, extractClientIdentifier } from "../../lib/workers/rate-limit.js";
import { handleSSEEndpoint } from "../../lib/workers/sse.js";
import { TIMEOUTS } from "../../lib/config/timeouts.js";

function createRateLimitKv(initial: Record<string, string> = {}, failMode = false) {
  const store = new Map<string, string>(Object.entries(initial));
  return {
    get: vi.fn(async (key: string) => {
      if (failMode) throw new Error("KV unreachable secret=xyz");
      return store.get(key) ?? null;
    }),
    put: vi.fn(async (key: string, value: string) => {
      if (failMode) throw new Error("KV write failed");
      store.set(key, value);
    }),
    delete: vi.fn(async () => {}),
    store,
  };
}

describe("Worker KV rate limiting & SSE lifecycle", () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("extracts client identifier honoring CF-Connecting-IP and MCP_TRUST_X_FORWARDED_FOR", () => {
    expect(
      extractClientIdentifier(
        new Request("https://worker.test/mcp", {
          headers: { "CF-Connecting-IP": "198.51.100.10", "X-Forwarded-For": "203.0.113.1" },
        }),
        { MCP_TRUST_X_FORWARDED_FOR: "true" },
      ),
    ).toBe("198.51.100.10");

    expect(
      extractClientIdentifier(
        new Request("https://worker.test/mcp", {
          headers: { "X-Forwarded-For": "203.0.113.5, 10.0.0.1" },
        }),
        {},
      ),
    ).toBe("unknown");

    expect(
      extractClientIdentifier(
        new Request("https://worker.test/mcp", {
          headers: { "X-Forwarded-For": "203.0.113.5, 10.0.0.1" },
        }),
        { MCP_TRUST_X_FORWARDED_FOR: "true" },
      ),
    ).toBe("203.0.113.5");
  });

  it("checkRateLimit enforces KV quota (429), tolerates corrupt JSON, and fails open on KV error", async () => {
    expect(
      (await checkRateLimit(new Request("https://worker.test/health"), {})).allowed,
    ).toBe(true);
    expect(
      (
        await checkRateLimit(new Request("https://worker.test/mcp"), {
          MCP_DISABLE_RATE_LIMIT: "true",
        })
      ).allowed,
    ).toBe(true);
    expect(
      (await checkRateLimit(new Request("https://worker.test/mcp"), {})).allowed,
    ).toBe(true);

    const kv = createRateLimitKv();
    const env = { MCP_KV: kv as unknown as KVNamespace };
    const req = () =>
      new Request("https://worker.test/mcp", {
        method: "POST",
        headers: { "CF-Connecting-IP": "203.0.113.9" },
      });

    for (let i = 0; i < 30; i++) {
      const res = await checkRateLimit(req(), env);
      expect(res.allowed).toBe(true);
    }

    const blocked = await checkRateLimit(req(), env);
    expect(blocked.allowed).toBe(false);
    expect(blocked.error?.status).toBe(429);
    expect(blocked.error?.headers.get("Retry-After")).toBeTruthy();

    // Corrupt KV entry resets cleanly to count = 1
    const windowBucket = Math.floor(Date.now() / TIMEOUTS.RATE_LIMIT_WINDOW_MS);
    kv.store.set(`rate_limit:203.0.113.9:${windowBucket}`, "{not-json");
    const recovered = await checkRateLimit(req(), env);
    expect(recovered.allowed).toBe(true);

    // KV errors fail open instead of dropping traffic
    const failingEnv = {
      MCP_KV: createRateLimitKv({}, true) as unknown as KVNamespace,
    };
    const failOpen = await checkRateLimit(req(), failingEnv);
    expect(failOpen.allowed).toBe(true);

    // Integration via worker.fetch when rate limited
    const maxedKv = createRateLimitKv({
      [`rate_limit:203.0.113.77:${windowBucket}`]: JSON.stringify({ count: 30 }),
    });
    const workerRes = await worker.fetch(
      new Request("https://worker.test/mcp", {
        method: "POST",
        headers: { "CF-Connecting-IP": "203.0.113.77" },
      }),
      { MCP_KV: maxedKv as unknown as KVNamespace },
      { waitUntil: vi.fn(), passThroughOnException: vi.fn() } as unknown as ExecutionContext,
    );
    expect(workerRes.status).toBe(429);
  });

  it("handleSSEEndpoint validates Accept, streams connection + init, handles POST RPC & parse error, and cleans up on cancel/timeout/abort", async () => {
    const badAccept = await handleSSEEndpoint(
      new Request("https://worker.test/sse", { headers: { Accept: "application/json" } }),
      {},
    );
    expect(badAccept.status).toBe(400);

    const waitPromises: Promise<unknown>[] = [];
    const ctx = {
      waitUntil: vi.fn((p: Promise<unknown>) => waitPromises.push(p)),
      passThroughOnException: vi.fn(),
    } as unknown as ExecutionContext;

    const sseRes = await handleSSEEndpoint(
      new Request("https://worker.test/sse", {
        method: "POST",
        headers: { Accept: "text/event-stream" },
        body: JSON.stringify({ jsonrpc: "2.0", id: 99, method: "tools/list" }),
      }),
      {},
      ctx,
    );
    expect(sseRes.status).toBe(200);
    expect(sseRes.headers.get("Content-Type")).toBe("text/event-stream");

    const reader = sseRes.body!.getReader();
    const decoder = new TextDecoder();
    let collected = "";
    for (let i = 0; i < 6; i++) {
      const { value, done } = await reader.read();
      if (done) break;
      collected += decoder.decode(value, { stream: true });
      if (collected.includes('"id":99')) break;
    }
    expect(collected).toContain("event: connection");
    expect(collected).toContain('"server":"mcp-tse"');
    expect(collected).toContain('"id":"init"');
    expect(collected).toContain('"id":99');
    await reader.cancel();
    await Promise.all(waitPromises);

    // Invalid JSON on POST /sse yields JSON-RPC parse error event
    const badPostRes = await handleSSEEndpoint(
      new Request("https://worker.test/sse", {
        method: "POST",
        headers: { Accept: "*/*" },
        body: "{invalid-json",
      }),
      {},
    );
    const r2 = badPostRes.body!.getReader();
    let badOut = "";
    for (let i = 0; i < 6; i++) {
      const { value, done } = await r2.read();
      if (done) break;
      badOut += decoder.decode(value, { stream: true });
      if (badOut.includes("-32700")) break;
    }
    expect(badOut).toContain("-32700");
    await r2.cancel();

    // Fake-timer check: heartbeat ping + timeout cleanup
    vi.useFakeTimers();
    const pingRes = await handleSSEEndpoint(
      new Request("https://worker.test/sse", { headers: { Accept: "text/event-stream" } }),
      {},
    );
    const r3 = pingRes.body!.getReader();
    await vi.advanceTimersByTimeAsync(TIMEOUTS.PING_INTERVAL_MS);
    await vi.advanceTimersByTimeAsync(TIMEOUTS.SSE_CONNECTION_MS + 100);
    let timedOutText = "";
    while (true) {
      const { value, done } = await r3.read();
      if (done) break;
      timedOutText += decoder.decode(value, { stream: true });
    }
    expect(timedOutText).toContain("event: ping");

    // Pre-aborted request signal triggers immediate abort cleanup
    const preAbort = new AbortController();
    preAbort.abort();
    const abortedRes = await handleSSEEndpoint(
      new Request("https://worker.test/sse", {
        headers: { Accept: "text/event-stream" },
        signal: preAbort.signal,
      }),
      {},
    );
    expect(abortedRes.status).toBe(200);

    // Live abort fires abortListener mid-stream -> closes with abort error
    const liveAbort = new AbortController();
    const liveAbortRes = await handleSSEEndpoint(
      new Request("https://worker.test/sse", {
        headers: { Accept: "text/event-stream" },
        signal: liveAbort.signal,
      }),
      {},
    );
    const liveReader = liveAbortRes.body!.getReader();
    await liveReader.read();
    liveAbort.abort();
    await liveReader.read().catch(() => {});
  });
});
