import { describe, expect, it, vi } from "vitest";
import worker from "../../lib/workers/worker.js";
import { REQUEST_ID_HEADER } from "../../lib/infrastructure/tracing.js";

const MOCK_CTX = {
  waitUntil: vi.fn(),
  passThroughOnException: vi.fn(),
} as unknown as ExecutionContext;

function assertDefensiveHeaders(res: Response) {
  expect(res.headers.get("X-Content-Type-Options")).toBe("nosniff");
  expect(res.headers.get("X-Frame-Options")).toBe("DENY");
  expect(res.headers.get("Referrer-Policy")).toBe("no-referrer");
  expect(res.headers.get("Cache-Control")).toBe("no-store");
  expect(res.headers.get(REQUEST_ID_HEADER)).toBeTruthy();
}

describe("Worker defensive security headers & HTTP method enforcement", () => {
  it("applies defensive headers and request-id across public, error, and 405 routes", async () => {
    const routes = [
      new Request("https://worker.test/health"),
      new Request("https://worker.test/"),
      new Request("https://worker.test/openapi.json"),
      new Request("https://worker.test/mcp", { method: "GET" }),
      new Request("https://worker.test/sse", { method: "DELETE" }),
      new Request("https://worker.test/unknown-route"),
      new Request("https://worker.test/mcp", {
        method: "OPTIONS",
        headers: { Origin: "http://localhost:3000" },
      }),
    ];

    for (const req of routes) {
      const res = await worker.fetch(req, {}, MOCK_CTX);
      assertDefensiveHeaders(res);
    }

    const mcpGet = await worker.fetch(new Request("https://worker.test/mcp"), {}, MOCK_CTX);
    expect(mcpGet.status).toBe(405);

    const sseDelete = await worker.fetch(
      new Request("https://worker.test/sse", { method: "DELETE" }),
      {},
      MOCK_CTX,
    );
    expect(sseDelete.status).toBe(405);

    const sseGet = await worker.fetch(
      new Request("https://worker.test/sse", {
        method: "GET",
        headers: { Accept: "text/event-stream" },
      }),
      {},
      MOCK_CTX,
    );
    expect(sseGet.status).toBe(200);
    await sseGet.body?.cancel();

    const notFound = await worker.fetch(
      new Request("https://worker.test/nonexistent"),
      {},
      MOCK_CTX,
    );
    expect(notFound.status).toBe(404);
  });

  it("propagates inbound X-Request-Id or rejects unsafe IDs", async () => {
    const validRes = await worker.fetch(
      new Request("https://worker.test/health", {
        headers: { "X-Request-Id": "trace-worker_01" },
      }),
      {},
      MOCK_CTX,
    );
    expect(validRes.headers.get(REQUEST_ID_HEADER)).toBe("trace-worker_01");

    const unsafeRes = await worker.fetch(
      new Request("https://worker.test/health", {
        headers: { "X-Request-Id": "bad id with spaces\r\n" },
      }),
      {},
      MOCK_CTX,
    );
    expect(unsafeRes.headers.get(REQUEST_ID_HEADER)).not.toContain("bad id");
  });
});
