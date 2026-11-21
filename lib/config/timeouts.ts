/**
 * Centralized timeout configuration.
 * All timeouts can be configured via environment variables.
 */

function getTimeoutMs(envVar: string, defaultValue: number): number {
  const value = typeof process !== "undefined" ? process.env?.[envVar] : undefined;
  if (!value) return defaultValue;

  const parsed = parseInt(value, 10);
  if (isNaN(parsed) || parsed <= 0) {
    console.warn(
      `[Config] Invalid timeout value for ${envVar}: ${value}, using default: ${defaultValue}ms`,
    );
    return defaultValue;
  }

  return parsed;
}

export const TIMEOUTS = {
  /**
   * HTTP request timeout for external TSE API calls
   * Default: 8000ms (8 seconds)
   * Env: MCP_API_TIMEOUT
   */
  get HTTP_REQUEST_MS(): number {
    return getTimeoutMs("MCP_API_TIMEOUT", 8000);
  },

  /**
   * Circuit breaker reset timeout
   * Default: 30000ms (30 seconds)
   * Env: MCP_CIRCUIT_BREAKER_TIMEOUT
   */
  get CIRCUIT_BREAKER_RESET_MS(): number {
    return getTimeoutMs("MCP_CIRCUIT_BREAKER_TIMEOUT", 30000);
  },

  /**
   * SSE connection timeout (Cloudflare Workers)
   * Default: 50000ms (50 seconds) - respects Workers CPU time limit
   * Env: MCP_SSE_TIMEOUT
   */
  get SSE_CONNECTION_MS(): number {
    return getTimeoutMs("MCP_SSE_TIMEOUT", 50000);
  },

  /**
   * Ping interval for worker keep-alive
   * Default: 30000ms (30 seconds)
   * Env: MCP_PING_INTERVAL
   */
  get PING_INTERVAL_MS(): number {
    return getTimeoutMs("MCP_PING_INTERVAL", 30000);
  },

  /**
   * Rate limiter cleanup interval
   * Default: 60000ms (1 minute)
   * Env: MCP_RATE_LIMIT_CLEANUP_INTERVAL
   */
  get RATE_LIMIT_CLEANUP_MS(): number {
    return getTimeoutMs("MCP_RATE_LIMIT_CLEANUP_INTERVAL", 60000);
  },

  /**
   * Rate limit window duration
   * Default: 60000ms (1 minute)
   * Env: MCP_RATE_LIMIT_WINDOW
   */
  get RATE_LIMIT_WINDOW_MS(): number {
    return getTimeoutMs("MCP_RATE_LIMIT_WINDOW", 60000);
  },
};
