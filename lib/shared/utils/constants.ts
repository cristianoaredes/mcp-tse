/**
 * Application Constants
 * Centralized configuration values to avoid magic numbers.
 */

export const CIRCUIT_BREAKER = {
  /** Number of failures before opening circuit */
  FAILURE_THRESHOLD: 5,

  /** Max attempts in HALF_OPEN state */
  HALF_OPEN_MAX_ATTEMPTS: 3,
} as const;

export const API_URLS = {
  /** Default TSE Resultados EA20 base URL */
  DEFAULT_TSE_RESULTADOS: "https://resultados.tse.jus.br/oficial/",

  /** Default TSE Dados Abertos CKAN APIv3 base URL */
  DEFAULT_TSE_CKAN: "https://dadosabertos.tse.jus.br/api/3/action/",
} as const;

export const SERVER = {
  /** Server name */
  NAME: "mcp-tse",

  /** Server version (aligned with package.json) */
  VERSION: "0.1.0",

  /** Default transport mode */
  DEFAULT_TRANSPORT: "stdio",

  /** Default HTTP port */
  DEFAULT_HTTP_PORT: 3000,
} as const;

export const CACHE = {
  /** Default cache size (number of entries) */
  DEFAULT_SIZE: 256,

  /** Default cache TTL in milliseconds (1 hour) */
  DEFAULT_TTL_MS: 60 * 60 * 1000,

  /** Background cleanup interval in milliseconds (5 minutes) */
  CLEANUP_INTERVAL_MS: 5 * 60 * 1000,
} as const;

export const LOGGING = {
  /** Default log level */
  DEFAULT_LEVEL: "info" as const,

  /** Whether to sanitize PII by default */
  DEFAULT_SANITIZE: true,

  /** Whether to pretty print logs by default */
  DEFAULT_PRETTY_PRINT: false,
} as const;
