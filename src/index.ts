#!/usr/bin/env node

import { createMcpServer } from './server.js';
import { setupStdioTransport } from './transport/stdio.js';
import { setupSseServer } from './transport/sse.js';
import { logger } from './utils/logger.js';
import { TRANSPORT_TYPE, DEFAULT_PORT } from './utils/config.js';

/**
 * Main function to start the MCP server with the specified transport
 */
async function main() {
  // Parse command line arguments to override config if needed
  const args = process.argv.slice(2);
  const transportArg = args.find(arg => arg.startsWith('--transport='))?.split('=')[1];
  const transportType = transportArg || TRANSPORT_TYPE;
  
  // Create the MCP server
  const server = createMcpServer();
  
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
      process.exit(1);
    }
  } catch (error) {
    logger.error('Failed to start MCP server', { error });
    process.exit(1);
  }
}

// Run the application
main().catch(error => {
  logger.error('Unhandled error in main function', { error });
  process.exit(1);
});

// Handle process termination
process.on('SIGINT', () => {
  logger.info('Received SIGINT signal, shutting down gracefully');
  process.exit(0);
});

process.on('SIGTERM', () => {
  logger.info('Received SIGTERM signal, shutting down gracefully');
  process.exit(0);
});

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  logger.error('Uncaught exception', { error });
  process.exit(1);
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason) => {
  logger.error('Unhandled promise rejection', { reason });
  process.exit(1);
});
