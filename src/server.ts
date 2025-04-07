import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { logger } from './utils/logger.js';
import { registerResources } from './features/resources.js';
import { registerTools } from './features/tools.js';
import { registerPrompts } from './features/prompts.js';
import { getServerConfig } from './utils/config.js';

/**
 * Creates and configures an MCP server instance
 * @returns Configured MCP server
 */
export function createMcpServer(): McpServer {
  // Create a new MCP server with configuration from config.ts
  const serverConfig = getServerConfig();
  const server = new McpServer(serverConfig);

  // Log server initialization with config details
  logger.info('Creating MCP server', { 
    name: serverConfig.name, 
    version: serverConfig.version
  });

  // Register server features
  registerResources(server);
  registerTools(server);
  registerPrompts(server);

  // Log server initialization
  logger.info('MCP server created and configured');

  // Handle errors at the process level instead
  process.on('uncaughtException', (error) => {
    logger.error('MCP server uncaught exception', { error });
  });

  return server;
}
