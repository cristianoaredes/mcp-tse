/**
 * Request tracing and correlation ID management.
 * Uses Web Crypto APIs so tracing is portable across Node.js and Cloudflare Workers.
 */

import { createLogger } from "./logger.js";

const logger = createLogger("tracing");

export const REQUEST_ID_HEADER = "X-Request-Id";

const VALID_REQUEST_ID_REGEX = /^[A-Za-z0-9._:-]{1,128}$/;

export function generateRequestId(): string {
  const webCrypto = globalThis.crypto;
  if (webCrypto && typeof webCrypto.randomUUID === "function") {
    return `req_${webCrypto.randomUUID()}`;
  }
  if (webCrypto && typeof webCrypto.getRandomValues === "function") {
    const bytes = new Uint8Array(16);
    webCrypto.getRandomValues(bytes);
    const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
    return `req_${hex}`;
  }
  throw new Error("Web Crypto API is required to generate request IDs");
}

export class RequestContext {
  public readonly requestId: string;
  public readonly startTime: number;
  private metadata: Record<string, unknown>;

  constructor(requestId?: string) {
    this.requestId = requestId || generateRequestId();
    this.startTime = Date.now();
    this.metadata = {};
  }

  addMetadata(key: string, value: unknown): void {
    this.metadata[key] = value;
  }

  getMetadata(key: string): unknown {
    return this.metadata[key];
  }

  getAllMetadata(): Record<string, unknown> {
    return { ...this.metadata };
  }

  getElapsedMs(): number {
    return Date.now() - this.startTime;
  }

  log(
    level: "debug" | "info" | "warn" | "error",
    message: string,
    context?: Record<string, unknown>,
  ): void {
    const fullContext = {
      ...this.metadata,
      ...context,
      elapsedMs: this.getElapsedMs(),
    };
    logger[level](message, fullContext, this.requestId);
  }

  debug(message: string, context?: Record<string, unknown>): void {
    this.log("debug", message, context);
  }

  info(message: string, context?: Record<string, unknown>): void {
    this.log("info", message, context);
  }

  warn(message: string, context?: Record<string, unknown>): void {
    this.log("warn", message, context);
  }

  error(message: string, context?: Record<string, unknown>): void {
    this.log("error", message, context);
  }
}

function sanitizeRequestId(raw: string | undefined): string | undefined {
  if (typeof raw !== "string") return undefined;
  const trimmed = raw.trim();
  if (!trimmed || !VALID_REQUEST_ID_REGEX.test(trimmed)) {
    return undefined;
  }
  return trimmed;
}

export function extractRequestId(
  headers: Headers | Record<string, string | string[] | undefined>,
): string | undefined {
  if (typeof (headers as Headers).get === "function") {
    const val = (headers as Headers).get(REQUEST_ID_HEADER);
    return sanitizeRequestId(val ?? undefined);
  }

  const record = headers as Record<string, string | string[] | undefined>;
  let raw: string | string[] | undefined =
    record["x-request-id"] ?? record["X-Request-Id"];
  if (raw === undefined) {
    for (const [key, value] of Object.entries(record)) {
      if (key.toLowerCase() === "x-request-id") {
        raw = value;
        break;
      }
    }
  }

  const candidate = Array.isArray(raw) ? raw[0] : raw;
  return sanitizeRequestId(candidate);
}
