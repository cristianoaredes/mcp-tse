import { afterEach, describe, expect, it, vi } from "vitest";
import { KVCache, MemoryCache } from "../../lib/core/cache.js";
import {
  calculateBackoffDelayMs,
  formatTimeoutMessage,
  getCircuitBreaker,
  getCircuitBreakerMetrics,
  getUpstreamKey,
  httpJson,
  resetCircuitBreakers,
} from "../../lib/core/http-client.js";
import {
  executeTool,
  getMetrics,
  getToolMetrics,
  resetMetrics,
} from "../../lib/core/tools.js";
import { TIMEOUTS } from "../../lib/config/timeouts.js";
import { CircuitBreaker, CircuitBreakerOpenError } from "../../lib/infrastructure/http/circuit-breaker.js";
import { Logger, LogLevel } from "../../lib/infrastructure/logger.js";
import { RateLimiter } from "../../lib/infrastructure/rate-limiter.js";
import {
  extractRequestId,
  generateRequestId,
  RequestContext,
} from "../../lib/infrastructure/tracing.js";
import {
  AuthenticationError,
  ConfigurationError,
  ErrorCode,
  ExternalAPIError,
  MCPError,
  NetworkError,
  RateLimitError as McpRateLimitError,
  ResourceNotFoundError,
  TimeoutError as McpTimeoutError,
  ValidationError as McpValidationError,
  categorizeError,
  formatErrorResponse,
} from "../../lib/shared/errors.js";
import {
  NetworkError as ResultNetworkError,
  NotFoundError,
  RateLimitError as ResultRateLimitError,
  Result,
  TimeoutError as ResultTimeoutError,
  ValidationError as ResultValidationError,
} from "../../lib/shared/types/result.js";
import {
  createTimeoutController,
  isAbortOrTimeoutError,
  raceWithTimeoutAndSignal,
} from "../../lib/shared/utils/timeout.js";

const API_CONFIG = {
  resultadosBaseUrl: "https://resultados.tse.jus.br/oficial/",
  ckanBaseUrl: "https://dadosabertos.tse.jus.br/api/3/action/",
};

describe("Core resilience, cache, HTTP client, rate limiter, tracing, logger, errors & metrics", () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    resetCircuitBreakers();
    resetMetrics();
    delete process.env.MCP_CACHE_BACKGROUND_CLEANUP;
    delete process.env.MCP_API_TIMEOUT;
    delete process.env.LOG_LEVEL;
  });

  it("MemoryCache & KVCache cover LRU eviction, TTL expiry, background cleanup, and invalid JSON recovery", async () => {
    vi.useFakeTimers();
    process.env.MCP_CACHE_BACKGROUND_CLEANUP = "true";
    const mem = new MemoryCache(2, 100);
    mem.set("a", 1);
    mem.set("b", 2);
    expect(mem.get("a")).toBe(1); // touch 'a' so 'b' is LRU
    mem.set("c", 3);
    expect(mem.get("b")).toBeNull();
    expect(mem.get("a")).toBe(1);
    expect(mem.get("c")).toBe(3);

    vi.advanceTimersByTime(150);
    expect(mem.get("a")).toBeNull();

    mem.set("d", 4);
    expect(mem.entries()).toEqual([["d", 4]]);
    vi.advanceTimersByTime(300_000); // trigger background cleanup interval
    mem.clear();

    const store = new Map<string, string>();
    const kv = new KVCache(
      {
        get: vi.fn(async (k: string) => store.get(k) ?? null),
        put: vi.fn(async (k: string, v: string) => {
          store.set(k, v);
        }),
        delete: vi.fn(async (k: string) => {
          store.delete(k);
        }),
      },
      100,
    );
    await kv.set("k1", { ok: true });
    expect(await kv.get("k1")).toEqual({ ok: true });
    store.set("bad", "{broken");
    expect(await kv.get("bad")).toBeNull();
    store.set("bad-obj", JSON.stringify({ nope: true }));
    expect(await kv.get("bad-obj")).toBeNull();
    vi.advanceTimersByTime(150);
    expect(await kv.get("k1")).toBeNull();
    await kv.clear();
  });

  it("CircuitBreaker handles CLOSED -> OPEN -> HALF_OPEN -> CLOSED and failure during HALF_OPEN", async () => {
    vi.useFakeTimers();
    const cb = new CircuitBreaker({ failureThreshold: 2, resetTimeoutMs: 1000, halfOpenMaxAttempts: 1 });
    expect(cb.getState()).toBe("CLOSED");

    await expect(cb.execute(async () => Promise.reject(new Error("fail-1")))).rejects.toThrow();
    await expect(cb.execute(async () => Promise.reject(new Error("fail-2")))).rejects.toThrow();
    expect(cb.getState()).toBe("OPEN");

    await expect(cb.execute(async () => "ok")).rejects.toBeInstanceOf(CircuitBreakerOpenError);

    vi.advanceTimersByTime(1000);
    // Fail in HALF_OPEN -> re-opens immediately
    await expect(cb.execute(async () => Promise.reject(new Error("half-fail")))).rejects.toThrow();
    expect(cb.getState()).toBe("OPEN");

    vi.advanceTimersByTime(1000);
    await expect(cb.execute(async () => "recovered")).resolves.toBe("recovered");
    expect(cb.getState()).toBe("CLOSED");
    expect(cb.getMetrics().failures).toBe(0);
    cb.reset();
  });

  it("httpJson handles origin isolation, retries, 204 noContent, invalid URL, invalid JSON, timeout, and circuit-breaker open", async () => {
    expect(getUpstreamKey("https://RESULTS.TSE.JUS.BR/a")).toBe("https://results.tse.jus.br");
    expect(() => getUpstreamKey("ftp://tse.jus.br/a")).toThrow(TypeError);
    expect(formatTimeoutMessage(1000)).toBe("request timeout after 1 second");
    expect(formatTimeoutMessage(8000)).toBe("request timeout after 8 seconds");
    expect(calculateBackoffDelayMs(1, 100, () => 0.5)).toBe(150);

    const badUrl = await httpJson("not-a-url");
    expect(badUrl).toEqual({ ok: false, error: "invalid url", source: "not-a-url" });

    // 503 then 200 retry succeeds
    const fetchRetry = vi
      .fn()
      .mockResolvedValueOnce(new Response("err", { status: 503 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ ok: 1 }), { status: 200 }));
    vi.stubGlobal("fetch", fetchRetry);
    const retryOk = await httpJson("https://resultados.tse.jus.br/test-retry", undefined, 2000, {
      maxRetries: 2,
      initialRetryDelayMs: 1,
      random: () => 0,
    });
    expect(retryOk).toEqual({
      ok: true,
      data: { ok: 1 },
      source: "https://resultados.tse.jus.br/test-retry",
    });

    // 204 No Content with noContent option
    vi.stubGlobal("fetch", vi.fn(async () => new Response(null, { status: 204 })));
    const res204 = await httpJson("https://resultados.tse.jus.br/empty", undefined, 2000, {
      noContent: [],
    });
    expect(res204).toEqual({ ok: true, data: [], source: "https://resultados.tse.jus.br/empty" });

    // 404 is non-retryable and returns error
    vi.stubGlobal("fetch", vi.fn(async () => new Response("nope", { status: 404 })));
    const res404 = await httpJson("https://resultados.tse.jus.br/missing", undefined, 2000, {
      maxRetries: 1,
    });
    expect(res404.ok).toBe(false);
    expect(res404.error).toBe("not found");

    // 5 consecutive 500s open breaker for dadosabertos origin without affecting resultados origin
    vi.stubGlobal("fetch", vi.fn(async () => new Response("down", { status: 500 })));
    for (let i = 0; i < 5; i++) {
      await httpJson("https://dadosabertos.tse.jus.br/fail", undefined, 2000, { maxRetries: 0 });
    }
    expect(getCircuitBreaker("https://dadosabertos.tse.jus.br").getState()).toBe("OPEN");
    expect(getCircuitBreaker("https://resultados.tse.jus.br").getState()).toBe("CLOSED");
    expect(Object.keys(getCircuitBreakerMetrics()).length).toBeGreaterThanOrEqual(2);

    const openBlocked = await httpJson("https://dadosabertos.tse.jus.br/blocked", undefined, 2000, {
      maxRetries: 0,
    });
    expect(openBlocked.ok).toBe(false);
    expect(openBlocked.error).toContain("Circuit breaker is OPEN");

    // Invalid JSON response & AbortError timeout
    vi.stubGlobal("fetch", vi.fn(async () => new Response("{bad", { status: 200 })));
    const badJson = await httpJson("https://resultados.tse.jus.br/badjson", undefined, 2000, {
      maxRetries: 0,
    });
    expect(badJson.error).toBe("invalid JSON response");

    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        const err = new Error("aborted");
        err.name = "AbortError";
        throw err;
      }),
    );
    const timedOut = await httpJson("https://resultados.tse.jus.br/timeout", undefined, 1000, {
      maxRetries: 0,
    });
    expect(timedOut.error).toBe("request timeout after 1 second");

    // Network rejection branch (non-abort error -> "network error")
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new TypeError("socket hang up");
      }),
    );
    const netErr = await httpJson("https://resultados.tse.jus.br/netfail", undefined, 1000, {
      maxRetries: 0,
    });
    expect(netErr.error).toBe("network error");

    // LRU cap eviction (>= 100 origins)
    for (let i = 0; i < 105; i++) {
      getCircuitBreaker(`https://origin-${i}.example.test`);
    }
    expect(Object.keys(getCircuitBreakerMetrics()).length).toBeLessThanOrEqual(100);
  });

  it("RateLimiter, Logger (stderr-only & circular context), RequestContext & TIMEOUTS", () => {
    vi.useFakeTimers();
    const stderrSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    const limiter = new RateLimiter({ windowMs: 1000, maxRequests: 2 });
    expect(limiter.getRemaining("unseen")).toBe(2);
    expect(limiter.getResetTime("unseen")).toBe(0);
    expect(limiter.checkLimit("c1")).toBe(true);
    expect(limiter.getRemaining("c1")).toBe(1);
    expect(limiter.checkLimit("c1")).toBe(true);
    expect(limiter.checkLimit("c1")).toBe(false);
    expect(limiter.getResetTime("c1")).toBeGreaterThan(0);
    expect(limiter.getStats().activeClients).toBe(1);
    vi.advanceTimersByTime(60_001); // cleanup expired client
    expect(limiter.getRemaining("c1")).toBe(2);
    limiter.dispose();

    stderrSpy.mockClear();
    const logger = new Logger("test-mod", LogLevel.DEBUG);
    logger.setLevel(LogLevel.INFO);
    logger.debug("ignored");
    expect(stderrSpy).not.toHaveBeenCalled();

    const circular: Record<string, unknown> = {};
    circular.self = circular;
    logger.warn("warn-msg", circular, "req_1");
    expect(stderrSpy).toHaveBeenCalledTimes(1);
    expect(JSON.parse(stderrSpy.mock.calls[0][0] as string)).toMatchObject({
      level: "warn",
      module: "test-mod",
      contextUnserializable: true,
    });

    process.env.LOG_LEVEL = "error";
    const envLogger = new Logger("env-mod");
    expect(envLogger.getLevel()).toBe(LogLevel.ERROR);
    envLogger.error("boom");
    envLogger.legacyLog("legacy-stderr-line");

    process.env.LOG_LEVEL = "debug";
    expect(new Logger("d").getLevel()).toBe(LogLevel.DEBUG);
    envLogger.debug("dbg");
    envLogger.info("inf");
    process.env.LOG_LEVEL = "info";
    expect(new Logger("i").getLevel()).toBe(LogLevel.INFO);
    process.env.LOG_LEVEL = "warn";
    expect(new Logger("w").getLevel()).toBe(LogLevel.WARN);
    delete process.env.LOG_LEVEL;
    const origNodeEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = "development";
    expect(new Logger("dev").getLevel()).toBe(LogLevel.DEBUG);
    process.env.NODE_ENV = origNodeEnv;

    const id = generateRequestId();
    expect(id).toMatch(/^req_/);

    // Fallback path when randomUUID is absent on globalThis.crypto
    const origCrypto = globalThis.crypto;
    vi.stubGlobal("crypto", {
      getRandomValues: (arr: Uint8Array) => {
        arr.fill(0xab);
        return arr;
      },
    });
    expect(generateRequestId()).toBe(`req_${"ab".repeat(16)}`);
    vi.stubGlobal("crypto", origCrypto);

    const reqCtx = new RequestContext(id);
    reqCtx.addMetadata("step", "unit");
    expect(reqCtx.getMetadata("step")).toBe("unit");
    expect(reqCtx.getAllMetadata()).toEqual({ step: "unit" });
    reqCtx.debug("d-test");
    reqCtx.info("trace-test");
    reqCtx.warn("w-test");
    reqCtx.error("e-test");

    expect(extractRequestId(new Headers({ "X-Request-Id": "valid_id-1" }))).toBe("valid_id-1");
    expect(extractRequestId({ "x-request-id": ["good-id-2", "ignored"] })).toBe("good-id-2");
    expect(extractRequestId({ "x-Request-Id": "mixed-case-id" })).toBe("mixed-case-id");
    expect(extractRequestId({ "X-Request-Id": ["bad id", "good"] })).toBeUndefined();
    expect(extractRequestId({ "x-request-id": "invalid\nchars" })).toBeUndefined();

    process.env.MCP_API_TIMEOUT = "invalid";
    expect(TIMEOUTS.HTTP_REQUEST_MS).toBe(8000);
  });

  it("executeTool records RED metrics and emits [metrics] on 100th request", async () => {
    const stderrSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    resetMetrics();
    const cache = new MemoryCache(50, 60_000);

    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        new Response(
          JSON.stringify({
            pl: [{ c: "2024", dt: "06/10/2024", e: [{ cd: "619", nm: "M", t: "1", tp: "3", abr: [] }] }],
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        ),
      ),
    );

    // 1 miss + 1 hit + 98 invalid-arg calls = 100 requests -> triggers [metrics] log
    await executeTool("tse_eleicoes_catalogo", { ano: 2024 }, API_CONFIG, cache);
    await executeTool("tse_eleicoes_catalogo", { ano: 2024 }, API_CONFIG, cache);

    for (let i = 0; i < 98; i++) {
      await executeTool("tse_municipios_zonas", {}, API_CONFIG, cache);
    }

    const summary = getMetrics();
    expect(summary.requests).toBe(100);
    expect(summary.cacheHits).toBe(1);
    expect(summary.errors).toBe(98);

    const perTool = getToolMetrics();
    expect(perTool.tse_eleicoes_catalogo.cacheHits).toBe(1);
    expect(perTool.tse_municipios_zonas.errors).toBe(98);

    const metricLine = stderrSpy.mock.calls.find((call) =>
      String(call[0]).includes("[metrics] requests=100"),
    );
    expect(metricLine).toBeTruthy();

    await expect(executeTool("missing_tool", {}, API_CONFIG)).rejects.toThrow(/Unknown tool/);
  });

  it("Errors, Result helpers, and Timeout utilities behave deterministically", async () => {
    expect(new MCPError(ErrorCode.PARSE_ERROR, "bad").toJSON().code).toBe(-32700);
    expect(categorizeError(new AuthenticationError("unauthorized")).code).toBe(
      ErrorCode.AUTHENTICATION_ERROR,
    );
    const categorizedTimeout = categorizeError(new Error("Operation timed out after 8000ms"));
    expect(categorizedTimeout.code).toBe(ErrorCode.TIMEOUT_ERROR);
    expect(categorizedTimeout.message).toBe("Operation timed out after 8000ms");
    expect(categorizeError(new Error("Too many requests")).code).toBe(ErrorCode.RATE_LIMIT_ERROR);
    expect(categorizeError(new Error("ECONNREFUSED")).code).toBe(ErrorCode.NETWORK_ERROR);
    expect(categorizeError(new Error("Invalid parameter")).code).toBe(ErrorCode.VALIDATION_ERROR);
    const categorizedNotFound = categorizeError(
      new Error("Municipality 99999 not found in TSE turnout data"),
    );
    expect(categorizedNotFound.code).toBe(ErrorCode.RESOURCE_NOT_FOUND);
    expect(categorizedNotFound.message).toBe("Municipality 99999 not found in TSE turnout data");
    expect(categorizeError(new Error("TSE Resultados API error: HTTP 404")).message).toBe(
      "TSE Resultados API error: HTTP 404",
    );
    expect(categorizeError(new Error("API key missing")).code).toBe(ErrorCode.AUTHENTICATION_ERROR);
    expect(categorizeError(new ConfigurationError("cfg")).code).toBe(ErrorCode.CONFIGURATION_ERROR);
    const directNotFound = new ResourceNotFoundError("eleicao", "999");
    expect(categorizeError(directNotFound).code).toBe(ErrorCode.RESOURCE_NOT_FOUND);
    expect(directNotFound.message).toBe("eleicao not found: 999");
    expect(directNotFound.data).toEqual({ resource: "eleicao", identifier: "999" });
    const customNotFound = new ResourceNotFoundError("eleicao", "999", "Custom not found message");
    expect(customNotFound.code).toBe(ErrorCode.RESOURCE_NOT_FOUND);
    expect(customNotFound.message).toBe("Custom not found message");
    expect(customNotFound.data).toEqual({ resource: "eleicao", identifier: "999" });
    expect(categorizeError("raw").code).toBe(ErrorCode.INTERNAL_ERROR);
    expect(formatErrorResponse(new ExternalAPIError("err", "tse", 502)).code).toBe(
      ErrorCode.EXTERNAL_API_ERROR,
    );

    const okR = Result.ok(10);
    const errR = Result.err(new ResultValidationError("bad", "uf"));
    expect(Result.isOk(okR)).toBe(true);
    expect(Result.isErr(errR)).toBe(true);
    expect(Result.unwrap(Result.map(okR, (x) => x * 2))).toBe(20);
    expect(() => Result.unwrap(errR)).toThrow(/Called unwrap on an error/);
    expect(Result.unwrapOr(okR, 42)).toBe(10);
    expect(Result.unwrapOr(errR, 42)).toBe(42);
    expect(Result.match(okR, { ok: (v) => String(v), err: () => "err" })).toBe("10");
    expect(
      Result.match(errR, { ok: () => "ok", err: (e) => e.message }),
    ).toBe("bad");
    expect(Result.flatMap(okR, (x) => Result.ok(x + 1))).toEqual({ ok: true, value: 11 });
    expect(Result.flatMap(errR, () => okR).ok).toBe(false);
    expect(Result.map(errR, () => 1).ok).toBe(false);
    expect(Result.mapErr(okR, () => "x")).toEqual({ ok: true, value: 10 });
    expect(Result.mapErr(errR, (e) => e.message)).toEqual({ ok: false, error: "bad" });
    expect(Result.all([Result.ok(1), Result.ok(2)])).toEqual({ ok: true, value: [1, 2] });
    expect(Result.all([Result.ok(1), errR]).ok).toBe(false);
    expect(await Result.fromPromise(Promise.resolve("hi"))).toEqual({ ok: true, value: "hi" });
    expect((await Result.fromPromise(Promise.reject(new NotFoundError("x")))).ok).toBe(false);
    expect(new ResultRateLimitError("rl", 10).retryAfter).toBe(10);
    expect(new ResultNetworkError("net", 502).statusCode).toBe(502);
    const directTimeout = new McpTimeoutError("op", 100);
    expect(directTimeout.code).toBe(ErrorCode.TIMEOUT_ERROR);
    expect(directTimeout.message).toBe("Operation 'op' timed out after 100ms");
    const customTimeout = new McpTimeoutError("op", 100, "Custom timeout message");
    expect(customTimeout.code).toBe(ErrorCode.TIMEOUT_ERROR);
    expect(customTimeout.message).toBe("Custom timeout message");
    expect(new McpRateLimitError(5).code).toBe(ErrorCode.RATE_LIMIT_ERROR);
    expect(new McpValidationError("v").code).toBe(ErrorCode.VALIDATION_ERROR);
    expect(new NetworkError("n").code).toBe(ErrorCode.NETWORK_ERROR);

    expect(isAbortOrTimeoutError(Object.assign(new Error(), { name: "AbortError" }))).toBe(true);
    expect(isAbortOrTimeoutError(Object.assign(new Error(), { name: "TimeoutError" }))).toBe(true);
    expect(isAbortOrTimeoutError(new Error("normal"))).toBe(false);
    expect(isAbortOrTimeoutError(null)).toBe(false);

    const parent = new AbortController();
    const linked = createTimeoutController(5000, parent.signal);
    parent.abort();
    expect(linked.wasAbortedByParent()).toBe(true);
    expect(linked.didTimeout()).toBe(false);
    linked.cleanup();

    const preAborted = new AbortController();
    preAborted.abort();
    const preLinked = createTimeoutController(5000, preAborted.signal);
    expect(preLinked.wasAbortedByParent()).toBe(true);
    preLinked.cleanup();

    vi.useFakeTimers();
    const timedController = createTimeoutController(25);
    vi.advanceTimersByTime(30);
    expect(timedController.didTimeout()).toBe(true);
    timedController.cleanup();
    vi.useRealTimers();

    await expect(
      raceWithTimeoutAndSignal(Promise.resolve("fast"), 100, undefined, "fast"),
    ).resolves.toBe("fast");

    const racePreAbort = new AbortController();
    racePreAbort.abort();
    await expect(
      raceWithTimeoutAndSignal(new Promise(() => {}), 100, racePreAbort.signal, "pre"),
    ).rejects.toBeInstanceOf(ResultTimeoutError);

    const raceLiveAbort = new AbortController();
    const racing = raceWithTimeoutAndSignal(
      new Promise(() => {}),
      5000,
      raceLiveAbort.signal,
      "live-abort",
    );
    raceLiveAbort.abort();
    await expect(racing).rejects.toBeInstanceOf(ResultTimeoutError);

    await expect(
      raceWithTimeoutAndSignal(new Promise(() => {}), 20, undefined, "slow"),
    ).rejects.toBeInstanceOf(ResultTimeoutError);
  });
});
