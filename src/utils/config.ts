/**
 * Server configuration values
 * These can be overridden by environment variables
 */

// Basic server information
export const SERVER_NAME = process.env.SERVER_NAME || "salim-mcp-server";
export const SERVER_VERSION = process.env.SERVER_VERSION || "0.0.1";

// Server capabilities flags
export const ENABLE_RESOURCES = process.env.ENABLE_RESOURCES !== "false";
export const ENABLE_TOOLS = process.env.ENABLE_TOOLS !== "false";
export const ENABLE_PROMPTS = process.env.ENABLE_PROMPTS !== "false";

// Transport configuration
export const DEFAULT_PORT = parseInt(process.env.PORT || "3000", 10);
export const TRANSPORT_TYPE = process.env.TRANSPORT_TYPE || "stdio";

// Logger configuration
export const LOG_LEVEL = process.env.LOG_LEVEL || "info";
export const LOG_DIR = process.env.LOG_DIR || "logs";
export const LOG_FILE = process.env.LOG_FILE || "combined.log";
export const ERROR_LOG_FILE = process.env.ERROR_LOG_FILE || "error.log";
export const ENABLE_FILE_LOGGING = process.env.ENABLE_FILE_LOGGING === "true" || process.env.NODE_ENV !== "development";

/**
 * Get server configuration object
 * @returns Server configuration object for McpServer constructor
 */
export function getServerConfig() {
  return {
    name: SERVER_NAME,
    version: SERVER_VERSION,
    capabilities: {
      resources: ENABLE_RESOURCES ? {} : undefined,
      tools: ENABLE_TOOLS ? {} : undefined,
      prompts: ENABLE_PROMPTS ? {} : undefined
    }
  };
} 