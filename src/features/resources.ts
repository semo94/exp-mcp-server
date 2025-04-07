import { McpServer, ResourceTemplate } from "@modelcontextprotocol/sdk/server/mcp.js";
import { logger } from '../utils/logger.js';
import { SERVER_NAME, SERVER_VERSION } from '../utils/config.js';

/**
 * Registers resources with the MCP server
 * @param server - The MCP server instance
 */
export function registerResources(server: McpServer): void {
  logger.info('Registering resources');

  // Example: Static resource
  server.resource(
    "server-info",
    "server://info",
    async (uri) => {
      logger.debug('Reading server info resource', { uri: uri.href });
      
      // Access server info through imported configuration
      const serverInfo = {
        name: SERVER_NAME,
        version: SERVER_VERSION,
        uptime: process.uptime(),
        nodeVersion: process.version,
        platform: process.platform,
        memoryUsage: process.memoryUsage()
      };
      
      return {
        contents: [{
          uri: uri.href,
          mimeType: "application/json",
          text: JSON.stringify(serverInfo, null, 2)
        }]
      };
    }
  );

  // Example: Dynamic resource with parameter
  server.resource(
    "echo",
    new ResourceTemplate("echo://{message}", { list: undefined }),
    async (uri, { message }) => {
      logger.debug('Reading echo resource', { uri: uri.href, message });
      
      return {
        contents: [{
          uri: uri.href,
          text: `Echo: ${message}`
        }]
      };
    }
  );

  // Example: Resource template with timestamp
  server.resource(
    "timestamp",
    "timestamp://current",
    async (uri) => {
      logger.debug('Reading timestamp resource', { uri: uri.href });
      
      const now = new Date();
      
      return {
        contents: [{
          uri: uri.href,
          text: `Current timestamp: ${now.toISOString()}`
        }]
      };
    }
  );

  logger.info('Resources registered successfully');
}
