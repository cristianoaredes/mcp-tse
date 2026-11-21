/**
 * Tool Registry — Auto-registration pattern for MCP tools.
 */

import type { ZodType } from "zod";
import type { RequestContext } from "../infrastructure/tracing.js";
import { Cache, LookupResult, ApiConfig } from "../types/index.js";

export interface ToolExecutionContext {
  sessionId?: string;
  requestId?: string;
  requestContext?: RequestContext;
}

export interface ToolHandler {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
  zodSchema: ZodType;
  execute: (
    args: unknown,
    apiConfig: ApiConfig,
    cache?: Cache,
    context?: ToolExecutionContext,
  ) => Promise<LookupResult>;
}

const registry = new Map<string, ToolHandler>();

export function registerTool(tool: ToolHandler): void {
  if (registry.has(tool.name)) {
    console.warn(`[registry] Tool "${tool.name}" already registered, overwriting.`);
  }
  registry.set(tool.name, tool);
}

export function getToolDefinitions(): Array<{
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
}> {
  return Array.from(registry.values()).map(({ name, description, inputSchema }) => ({
    name,
    description,
    inputSchema,
  }));
}

export async function executeRegisteredTool(
  name: string,
  args: unknown,
  apiConfig: ApiConfig,
  cache?: Cache,
  context?: ToolExecutionContext,
): Promise<LookupResult> {
  const tool = registry.get(name);
  if (!tool) {
    throw new Error(`Unknown tool: ${name}. Available: ${Array.from(registry.keys()).join(", ")}`);
  }

  const input = args === undefined ? {} : args;
  const parsed = tool.zodSchema.safeParse(input);
  if (!parsed.success) {
    const details = parsed.error.issues
      .map((issue) => {
        const path = issue.path.length > 0 ? `${issue.path.join(".")}: ` : "";
        return `${path}${issue.message}`;
      })
      .join("; ");
    return {
      ok: false,
      error: `Invalid parameters for ${name}: ${details}`,
    };
  }

  return tool.execute(parsed.data, apiConfig, cache, context);
}

export function hasTool(name: string): boolean {
  return registry.has(name);
}

export function hasToolSchema(name: string): boolean {
  return Boolean(registry.get(name)?.zodSchema);
}

export function getToolCount(): number {
  return registry.size;
}
