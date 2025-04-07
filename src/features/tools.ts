import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { logger } from '../utils/logger.js';

/**
 * Registers tools with the MCP server
 * @param server - The MCP server instance
 */
export function registerTools(server: McpServer): void {
  logger.info('Registering tools');

  // Example: Simple addition calculator
  server.tool(
    "calculate",
    "Perform basic calculations",
    {
      operation: z.enum(["add", "subtract", "multiply", "divide"]).describe("Type of calculation to perform"),
      a: z.number().describe("First number"),
      b: z.number().describe("Second number")
    },
    async ({ operation, a, b }) => {
      logger.debug('Executing calculate tool', { operation, a, b });
      
      let result: number;
      
      try {
        switch (operation) {
          case "add":
            result = a + b;
            break;
          case "subtract":
            result = a - b;
            break;
          case "multiply":
            result = a * b;
            break;
          case "divide":
            if (b === 0) {
              throw new Error("Division by zero is not allowed");
            }
            result = a / b;
            break;
          default:
            throw new Error(`Unknown operation: ${operation}`);
        }
        
        return {
          content: [
            {
              type: "text",
              text: `${operation}(${a}, ${b}) = ${result}`
            }
          ]
        };
      } catch (error) {
        logger.error('Error in calculate tool', { error, operation, a, b });
        
        return {
          isError: true,
          content: [
            {
              type: "text",
              text: `Error: ${(error as Error).message}`
            }
          ]
        };
      }
    }
  );

  // Example: Get current time
  server.tool(
    "get-current-time",
    "Get the current server time in different formats",
    {
      format: z.enum(["iso", "utc", "local", "unix"]).default("iso").describe("Time format")
    },
    async ({ format }) => {
      logger.debug('Executing get-current-time tool', { format });
      
      const now = new Date();
      let formattedTime: string;
      
      switch (format) {
        case "iso":
          formattedTime = now.toISOString();
          break;
        case "utc":
          formattedTime = now.toUTCString();
          break;
        case "local":
          formattedTime = now.toString();
          break;
        case "unix":
          formattedTime = Math.floor(now.getTime() / 1000).toString();
          break;
        default:
          formattedTime = now.toISOString();
      }
      
      return {
        content: [
          {
            type: "text",
            text: `Current time (${format}): ${formattedTime}`
          }
        ]
      };
    }
  );

  // Example: Generate random data
  server.tool(
    "generate-random",
    "Generate random data of different types",
    {
      type: z.enum(["number", "string", "boolean", "uuid"]).describe("Type of random data to generate"),
      min: z.number().optional().describe("Minimum value for random number"),
      max: z.number().optional().describe("Maximum value for random number"),
      length: z.number().optional().describe("Length of random string")
    },
    async ({ type, min = 0, max = 100, length = 10 }) => {
      logger.debug('Executing generate-random tool', { type, min, max, length });
      
      let result: string | number | boolean;
      
      try {
        switch (type) {
          case "number":
            result = min + Math.random() * (max - min);
            break;
          case "string":
            result = Array(length)
              .fill(0)
              .map(() => String.fromCharCode(97 + Math.floor(Math.random() * 26)))
              .join('');
            break;
          case "boolean":
            result = Math.random() >= 0.5;
            break;
          case "uuid":
            result = 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
              const r = Math.random() * 16 | 0, v = c === 'x' ? r : (r & 0x3 | 0x8);
              return v.toString(16);
            });
            break;
          default:
            throw new Error(`Unknown random data type: ${type}`);
        }
        
        return {
          content: [
            {
              type: "text",
              text: `Random ${type}: ${result}`
            }
          ]
        };
      } catch (error) {
        logger.error('Error in generate-random tool', { error, type });
        
        return {
          isError: true,
          content: [
            {
              type: "text",
              text: `Error: ${(error as Error).message}`
            }
          ]
        };
      }
    }
  );

  logger.info('Tools registered successfully');
}
