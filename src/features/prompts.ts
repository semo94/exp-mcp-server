import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { logger } from '../utils/logger.js';
import { SERVER_NAME, SERVER_VERSION } from '../utils/config.js';

/**
 * Registers prompts with the MCP server
 * @param server - The MCP server instance
 */
export function registerPrompts(server: McpServer): void {
  // Access server name and version from centralized configuration
  logger.info(`Registering prompts for ${SERVER_NAME} v${SERVER_VERSION}`);

  // Example: Simple greeting prompt
  server.prompt(
    "greeting",
    "Generate a friendly greeting",
    {
      name: z.string().describe("Name to greet"),
      formal: z.string().optional().describe("Whether to use formal language")
    },
    ({ name, formal }) => {
      const isFormal = formal === "true";
      logger.debug('Executing greeting prompt', { name, formal });
      
      return {
        description: `${isFormal ? 'Formal' : 'Casual'} greeting for ${name}`,
        messages: [
          {
            role: "user",
            content: {
              type: "text",
              text: `Please generate a ${isFormal ? 'formal' : 'friendly and casual'} greeting for ${name}.`
            }
          }
        ]
      };
    }
  );

  // Example: Code review prompt
  server.prompt(
    "code-review",
    "Review code for improvements",
    {
      code: z.string().describe("Code to review"),
      language: z.string().describe("Programming language"),
      focus: z.string().optional().describe("Review focus")
    },
    ({ code, language, focus = "all" }) => {
      logger.debug('Executing code-review prompt', { language, focus, codeLength: code.length });
      
      return {
        description: `Code review for ${language} code focusing on ${focus}`,
        messages: [
          {
            role: "user",
            content: {
              type: "text",
              text: `Please review this ${language} code${focus !== "all" ? ` focusing on ${focus}` : ""}:\n\n\`\`\`${language}\n${code}\n\`\`\``
            }
          }
        ]
      };
    }
  );

  // Example: Data analysis prompt
  server.prompt(
    "analyze-data",
    "Analyze structured data",
    {
      data: z.string().describe("JSON or CSV data to analyze"),
      format: z.enum(["json", "csv"]).describe("Data format"),
      question: z.string().describe("Question to answer about the data")
    },
    ({ data, format, question }) => {
      logger.debug('Executing analyze-data prompt', { format, question, dataLength: data.length });
      
      return {
        description: `Data analysis for ${format} data`,
        messages: [
          {
            role: "user",
            content: {
              type: "text",
              text: `I have the following ${format.toUpperCase()} data:\n\n\`\`\`\n${data}\n\`\`\`\n\nPlease analyze this data to answer the following question: ${question}`
            }
          }
        ]
      };
    }
  );

  logger.info('Prompts registered successfully');
}
