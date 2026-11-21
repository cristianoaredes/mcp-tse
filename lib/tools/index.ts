/**
 * Tool barrel — registers all 7 TSE MCP tools idempotently.
 */

import { registerTseResultadosTools } from "./tse-resultados.js";
import { registerTseCkanTool } from "./tse-ckan.js";

registerTseResultadosTools();
registerTseCkanTool();

export {
  getToolDefinitions,
  executeRegisteredTool,
  hasTool,
  hasToolSchema,
  getToolCount,
} from "../core/registry.js";
