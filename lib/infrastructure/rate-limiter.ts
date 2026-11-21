/**
 * In-memory rate limiter for local and session-scoped throttling.
 */

import { TIMEOUTS } from "../config/timeouts.js";

export interface RateLimiterConfig {
  windowMs: number;
  maxRequests: number;
  enableCleanupTimer?: boolean;
}

interface ClientRecord {
  count: number;
  resetTime: number;
}

export class RateLimiter {
  private clients = new Map<string, ClientRecord>();
  private config: RateLimiterConfig;
  private cleanupTimer?: ReturnType<typeof setInterval>;

  constructor(config: RateLimiterConfig) {
    this.config = config;

    if (config.enableCleanupTimer !== false) {
      this.cleanupTimer = setInterval(() => this.cleanup(), TIMEOUTS.RATE_LIMIT_CLEANUP_MS);
      (this.cleanupTimer as { unref?: () => void }).unref?.();
    }
  }

  checkLimit(clientId: string): boolean {
    const now = Date.now();
    const record = this.clients.get(clientId);

    if (!record || now >= record.resetTime) {
      this.clients.set(clientId, {
        count: 1,
        resetTime: now + this.config.windowMs,
      });
      return true;
    }

    if (record.count < this.config.maxRequests) {
      record.count++;
      return true;
    }

    return false;
  }

  getRemaining(clientId: string): number {
    const now = Date.now();
    const record = this.clients.get(clientId);

    if (!record || now >= record.resetTime) {
      return this.config.maxRequests;
    }

    return Math.max(0, this.config.maxRequests - record.count);
  }

  getResetTime(clientId: string): number {
    const now = Date.now();
    const record = this.clients.get(clientId);

    if (!record || now >= record.resetTime) {
      return 0;
    }

    return record.resetTime - now;
  }

  private cleanup(): void {
    const now = Date.now();
    let cleanedCount = 0;

    for (const [clientId, record] of this.clients.entries()) {
      if (now >= record.resetTime) {
        this.clients.delete(clientId);
        cleanedCount++;
      }
    }

    if (
      cleanedCount > 0 &&
      typeof process !== "undefined" &&
      process.env?.NODE_ENV !== "production"
    ) {
      console.error(`[RateLimiter] Cleaned up ${cleanedCount} expired entries`);
    }
  }

  getStats() {
    return {
      activeClients: this.clients.size,
      windowMs: this.config.windowMs,
      maxRequests: this.config.maxRequests,
    };
  }

  destroy(): void {
    if (this.cleanupTimer !== undefined) {
      clearInterval(this.cleanupTimer);
      this.cleanupTimer = undefined;
    }
    this.clients.clear();
  }

  dispose(): void {
    this.destroy();
  }
}
