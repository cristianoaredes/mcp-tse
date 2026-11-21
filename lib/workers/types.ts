/**
 * TypeScript types for Cloudflare Workers.
 */

declare global {
  interface ExecutionContext {
    waitUntil(promise: Promise<unknown>): void;
    passThroughOnException(): void;
  }
}

export type WorkerExportedHandler<Env = unknown> = {
  fetch: (request: Request, env: Env, ctx: ExecutionContext) => Promise<Response>;
};
