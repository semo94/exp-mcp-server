#!/usr/bin/env node

import { McpServerInstance } from './server.js';
import { setupStdioTransport } from './transport/stdio.js';
import { setupSseServer } from './transport/sse.js';
import { logger } from './utils/logger.js';
import { TRANSPORT_TYPE, DEFAULT_PORT, logConfigValues } from './utils/config.js';

/**
 * Main function to start the MCP server with the specified transport
 */
async function main() {
  // Log all configuration values
  logConfigValues(logger);

  // Parse command line arguments to override config if needed
  const args = process.argv.slice(2);
  const transportArg = args.find(arg => arg.startsWith('--transport='))?.split('=')[1];
  const transportType = transportArg || TRANSPORT_TYPE;
  
  // Get the MCP server instance
  const serverInstance = McpServerInstance.getInstance();
  const server = await serverInstance.initialize();
  
  try {
    // Set up the appropriate transport
    if (transportType === 'stdio') {
      logger.info('Starting MCP server with stdio transport');
      await setupStdioTransport(server);
    } else if (transportType === 'sse') {
      // For SSE transport, also parse port if provided
      const portArg = args.find(arg => arg.startsWith('--port='));
      const port = portArg ? parseInt(portArg.split('=')[1], 10) : DEFAULT_PORT;
      
      logger.info(`Starting MCP server with SSE transport on port ${port}`);
      await setupSseServer(server, port);
    } else {
      logger.error(`Unsupported transport type: ${transportType}`);
      await shutdown(1);
    }
  } catch (error) {
    logger.error('Failed to start MCP server', { error });
    await shutdown(1);
  }
}

/**
 * Gracefully shut down the server
 * @param exitCode Process exit code
 */
async function shutdown(exitCode: number = 0): Promise<never> {
  logger.info(`Shutting down with exit code ${exitCode}`);
  
  try {
    // Terminate the MCP server instance
    const serverInstance = McpServerInstance.getInstance();
    await serverInstance.terminate();
  } catch (error) {
    logger.error('Error during shutdown', { error });
    exitCode = 1;
  }
  
  process.exit(exitCode);
}

// Run the application
main().catch(async error => {
  logger.error('Unhandled error in main function', { error });
  await shutdown(1);
});

// Handle process termination
process.on('SIGINT', async () => {
  logger.info('Received SIGINT signal, shutting down gracefully');
  await shutdown(0);
});

process.on('SIGTERM', async () => {
  logger.info('Received SIGTERM signal, shutting down gracefully');
  await shutdown(0);
});

// Handle uncaught exceptions
process.on('uncaughtException', async (error) => {
  logger.error('Uncaught exception', { error });
  await shutdown(1);
});

// Handle unhandled promise rejections
process.on('unhandledRejection', async (reason) => {
  logger.error('Unhandled promise rejection', { reason });
  await shutdown(1);
});
