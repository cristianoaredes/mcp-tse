import { CacheEntry, Cache } from "../types/index.js";
import { CACHE } from "../shared/utils/constants.js";

export const MIN_KV_EXPIRATION_TTL_SECONDS = 60;

export interface KVPutOptions {
  expiration?: number;
  expirationTtl?: number;
  metadata?: unknown;
}

interface KVNamespace {
  get(key: string): Promise<string | null>;
  put(key: string, value: string, options?: KVPutOptions): Promise<void>;
  delete(key: string): Promise<void>;
}

export class MemoryCache implements Cache {
  private cache = new Map<string, CacheEntry>();
  private accessOrder = new Map<string, number>();
  private accessCounter = 0;
  private maxSize: number;
  private ttl: number;
  private cleanupInterval?: ReturnType<typeof setInterval>;

  constructor(
    maxSize: number = CACHE.DEFAULT_SIZE,
    ttl: number = CACHE.DEFAULT_TTL_MS,
  ) {
    this.maxSize = maxSize;
    this.ttl = ttl;

    if (
      typeof process !== "undefined" &&
      process.env?.MCP_CACHE_BACKGROUND_CLEANUP === "true"
    ) {
      this.startBackgroundCleanup();
    }
  }

  get<T = unknown>(key: string): T | null {
    const entry = this.cache.get(key);
    if (!entry) return null;

    if (Date.now() > entry.expires) {
      this.cache.delete(key);
      this.accessOrder.delete(key);
      return null;
    }

    this.accessOrder.set(key, ++this.accessCounter);
    return entry.data as T;
  }

  set<T = unknown>(key: string, data: T): void {
    if (this.cache.size >= this.maxSize && !this.cache.has(key)) {
      this.evictLRU();
    }

    this.cache.set(key, {
      data,
      expires: Date.now() + this.ttl,
    });

    this.accessOrder.set(key, ++this.accessCounter);
  }

  private startBackgroundCleanup(): void {
    this.cleanupInterval = setInterval(() => {
      this.cleanup();
    }, CACHE.CLEANUP_INTERVAL_MS);

    (this.cleanupInterval as { unref?: () => void }).unref?.();
  }

  private cleanup(): void {
    const now = Date.now();
    for (const [key, entry] of this.cache.entries()) {
      if (now > entry.expires) {
        this.cache.delete(key);
        this.accessOrder.delete(key);
      }
    }
  }

  private evictLRU(): void {
    let oldestKey = "";
    let oldestAccess = Infinity;
    for (const [key, accessTime] of this.accessOrder.entries()) {
      if (accessTime < oldestAccess) {
        oldestAccess = accessTime;
        oldestKey = key;
      }
    }
    if (oldestKey) {
      this.cache.delete(oldestKey);
      this.accessOrder.delete(oldestKey);
    }
  }

  clear(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = undefined;
    }

    this.cache.clear();
    this.accessOrder.clear();
    this.accessCounter = 0;
  }

  entries(): [string, unknown][] {
    this.cleanup();
    return Array.from(this.cache.entries()).map(([key, entry]) => [
      key,
      entry.data,
    ]);
  }
}

export class KVCache implements Cache {
  constructor(private kv: KVNamespace, private ttl: number = CACHE.DEFAULT_TTL_MS) {}

  async get<T = unknown>(key: string): Promise<T | null> {
    const cached = await this.kv.get(key);
    if (!cached) {
      return null;
    }

    try {
      const parsed = JSON.parse(cached) as { expires?: unknown; data?: T } | null;
      if (!parsed || typeof parsed !== "object" || typeof parsed.expires !== "number") {
        return null;
      }
      if (Date.now() < parsed.expires) {
        return parsed.data ?? null;
      }
    } catch {
      return null;
    }

    return null;
  }

  async set<T = unknown>(key: string, data: T): Promise<void> {
    const effectiveTtlMs =
      Number.isFinite(this.ttl) && this.ttl > 0
        ? this.ttl
        : MIN_KV_EXPIRATION_TTL_SECONDS * 1000;
    const expirationTtl = Math.max(
      MIN_KV_EXPIRATION_TTL_SECONDS,
      Math.ceil(effectiveTtlMs / 1000),
    );

    await this.kv.put(
      key,
      JSON.stringify({
        data,
        expires: Date.now() + effectiveTtlMs,
      }),
      { expirationTtl },
    );
  }

  async clear(): Promise<void> {
    // KV namespaces do not expose a global clear operation.
  }
}
