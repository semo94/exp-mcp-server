import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { logger } from '../utils/logger.js';

/**
 * Sets up STDIO transport for the MCP server
 * @param server - The MCP server instance
 * @returns Promise that resolves when the transport is connected
 */
export async function setupStdioTransport(server: McpServer): Promise<void> {
  try {
    // Create a new STDIO server transport
    const transport = new StdioServerTransport();
    
    // Connect the transport to the server
    await server.connect(transport);
    
    logger.info('STDIO transport connected');
    
    // Log to stderr for debugging
    logger.debug('MCP server is running with STDIO transport');
    
    // Return a promise that never resolves to keep the process running
    return new Promise<void>(() => {
      // This promise intentionally never resolves to keep the process alive
      // until the transport is closed or an error occurs
    });
  } catch (error) {
    logger.error('Failed to set up STDIO transport', { error });
    throw error;
  }
}
