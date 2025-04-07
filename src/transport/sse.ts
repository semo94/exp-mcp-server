import express from 'express';
import type { Request, Response } from 'express';
import cors from 'cors';
import { v4 as uuidv4 } from 'uuid';
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { SSEServerTransport } from "@modelcontextprotocol/sdk/server/sse.js";
import { logger } from '../utils/logger.js';

/**
 * Sets up an Express server with SSE transport for the MCP server
 * @param server - The MCP server instance
 * @param port - The port to listen on (default: 3000)
 * @returns Promise that resolves when the server starts listening
 */
export async function setupSseServer(server: McpServer, port: number = 3000): Promise<void> {
  // Create the Express application
  const app = express();
  
  // Enable CORS
  app.use(cors());
  
  // Parse JSON request bodies
  app.use(express.json());
  
  // Store active transports by session ID
  const transports: Record<string, SSEServerTransport> = {};
  
  // Handler for SSE endpoint
  function handleSse(req: Request, res: Response): void {
    // Set SSE headers
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    
    // Create a new transport with a unique session ID
    const transport = new SSEServerTransport('/messages', res);
    const sessionId = transport.sessionId || uuidv4();
    
    // Store the transport
    transports[sessionId] = transport;
    
    logger.info('SSE connection established', { sessionId });
    
    // Handle client disconnect
    res.on('close', () => {
      logger.info('SSE connection closed', { sessionId });
      delete transports[sessionId];
    });
    
    // Connect the transport to the server
    server.connect(transport).catch(error => {
      logger.error('Failed to connect SSE transport', { error, sessionId });
    });
  }
  
  // Handler for messages endpoint
  async function handleMessages(req: Request, res: Response): Promise<void> {
    // Get the session ID from the query parameter
    const sessionId = req.query.sessionId as string;
    
    if (!sessionId || !transports[sessionId]) {
      logger.warn('Invalid session ID for message', { sessionId });
      res.status(400).send('Invalid session ID');
      return;
    }
    
    try {
      // Handle the message with the appropriate transport
      await transports[sessionId].handlePostMessage(req, res);
    } catch (error) {
      logger.error('Error handling message', { error, sessionId });
      res.status(500).send('Internal server error');
    }
  }
  
  // Handler for health check endpoint
  function handleHealthCheck(_req: Request, res: Response): void {
    res.status(200).send({
      status: 'ok',
      connections: Object.keys(transports).length
    });
  }
  
  // Register route handlers
  app.get('/sse', handleSse);
  app.post('/messages', handleMessages);
  app.get('/health', handleHealthCheck);
  
  // Start the server
  return new Promise<void>((resolve, reject) => {
    try {
      const server = app.listen(port, () => {
        logger.info(`MCP server with SSE transport is running on port ${port}`);
        resolve();
      });
      
      // Handle server errors
      server.on('error', (error) => {
        logger.error('Express server error', { error });
        reject(error);
      });
    } catch (error) {
      logger.error('Failed to start Express server', { error });
      reject(error);
    }
  });
}
