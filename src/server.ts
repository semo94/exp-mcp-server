import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { Neo4jConnection } from './database/neo4j-connector.js';
import { LlmService } from './services/llm-service.js';
import { logger } from './utils/logger.js';
import { registerResources } from './features/resources.js';
import { registerTools } from './features/tools.js';
import { registerPrompts } from './features/prompts.js';
import { getServerConfig, getNeo4jConfig, getLlmConfig } from './utils/config.js';

/**
 * Singleton class for managing the MCP server instance
 */
export class McpServerInstance {
  private static instance: McpServerInstance;
  private server!: McpServer;
  public db!: Neo4jConnection;
  private llm!: LlmService;
  private initialized: boolean = false;

  /**
   * Private constructor to prevent direct instantiation
   */
  private constructor() {}

  /**
   * Get the singleton instance of McpServerInstance
   * @returns The McpServerInstance singleton
   */
  public static getInstance(): McpServerInstance {
    if (!McpServerInstance.instance) {
      McpServerInstance.instance = new McpServerInstance();
    }
    return McpServerInstance.instance;
  }

  /**
   * Initialize the MCP server and its services
   */
  public async initialize(): Promise<McpServer> {
    if (this.initialized) {
      logger.info('MCP server already initialized');
      return this.server;
    }

    // Create a new MCP server with configuration from config.ts
    const serverConfig = getServerConfig();
    this.server = new McpServer(serverConfig);

    // Log server initialization with config details
    logger.info('Creating MCP server', { 
      name: serverConfig.name, 
      version: serverConfig.version
    });

    // Initialize the Neo4j database connection
    const neo4jConfig = getNeo4jConfig();
    this.db = new Neo4jConnection(neo4jConfig);
    await this.db.initialize();

    // Initialize the LLM service
    const llmConfig = getLlmConfig();
    this.llm = new LlmService(llmConfig);

    // Register server features
    registerResources(this.server, this.db);
    registerTools(this.server, this.db, this.llm);
    registerPrompts(this.server, this.db);

    // Log server initialization
    logger.info('MCP server created and configured');

    this.initialized = true;
    return this.server;
  }

  /**
   * Terminate the server and close all connections gracefully
   */
  public async terminate(): Promise<void> {
    if (!this.initialized) {
      logger.info('MCP server not initialized, nothing to terminate');
      return;
    }

    logger.info('Shutting down MCP server gracefully');
    
    // Close the database connection
    if (this.db) {
      logger.info('Closing database connection');
      await this.db.close();
    }

    // Add any other cleanup logic here
    
    this.initialized = false;
    logger.info('MCP server terminated successfully');
  }

  /**
   * Get the McpServer instance
   * @returns The McpServer instance
   */
  public getServer(): McpServer {
    if (!this.initialized) {
      throw new Error('MCP server not initialized. Call initialize() first.');
    }
    return this.server;
  }
}
