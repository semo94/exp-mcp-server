import { ChatOpenAI } from "@langchain/openai";
import { ChatAnthropic } from "@langchain/anthropic";
import { BaseChatModel } from "@langchain/core/language_models/chat_models";
import { SystemMessage, HumanMessage } from "@langchain/core/messages";
import { logger } from '../utils/logger.js';

// LLM Service configuration
export interface LlmServiceConfig {
  provider: 'anthropic' | 'openai';
  apiKey: string;
  modelName: string;
  temperature: number;
  endpoint: string;
  maxTokens: number;
}

export class LlmService {
  private model: BaseChatModel;
  private provider: string;

  constructor(config: LlmServiceConfig) {
    this.provider = config.provider;

    // Initialize the appropriate LangChain model based on provider
    if (config.provider === 'anthropic') {
      this.model = new ChatAnthropic({
        anthropicApiKey: config.apiKey,
        modelName: config.modelName ,
        temperature: Number(config.temperature),
        maxTokens: Number(config.maxTokens),
      });
    } else {
      // Default to OpenAI
      this.model = new ChatOpenAI({
        openAIApiKey: config.apiKey,
        modelName: config.modelName,
        temperature: Number(config.temperature),
        maxTokens: Number(config.maxTokens),
      });
    }

    logger.debug('LLM Service initialized with LangChain', {
      provider: config.provider,
      modelName: config.modelName
    });
  }

  async quickAnalyze(
    text: string,
    options: {
      task: string,
      returnFormat: string
    }
  ) {
    logger.debug('Quick analyzing text with LangChain', { task: options.task, textLength: text.length });

    try {
      // Create messages for the LLM
      const systemPrompt = `
        You are an expert programming education analyzer.
        Your task is to: ${options.task}
        Provide output in ${options.returnFormat} format.
        Be decisive and accurate.
      `;

      const userPrompt = `
        Text to analyze:
        
        ${text}
        
        ${options.task === "determine-if-programming-related"
          ? "Is this text related to software development, programming, coding, or computer science concepts? Return a JSON with a single boolean property 'isProgrammingRelated'."
          : ""}
      `;

      // Use LangChain model to get a response
      const response = await this.model.call([
        new SystemMessage(systemPrompt),
        new HumanMessage(userPrompt)
      ]);

      const content = response.content.toString();

      // Extract JSON from the response
      const jsonMatch = content.match(/```json\n([\s\S]*?)\n```/) ||
        content.match(/\{[\s\S]*\}/);

      if (jsonMatch) {
        return JSON.parse(jsonMatch[1] || jsonMatch[0]);
      } else {
        if (options.task === "determine-if-programming-related") {
          return { isProgrammingRelated: false };
        }
        throw new Error("No JSON found in LLM response");
      }
    } catch (error) {
      logger.error('Error in quick analysis with LangChain', { error, task: options.task });

      // Default fallback
      if (options.task === "determine-if-programming-related") {
        return { isProgrammingRelated: false };
      }
      return { error: "Failed to analyze text" };
    }
  }

  async analyzeConversation(
    conversation: string,
    options: {
      extractConcepts: boolean,
      assessUnderstanding: boolean,
      detectMisconceptions: boolean,
      primaryTopic?: string
    }
  ) {
    logger.debug('Analyzing conversation with LangChain', {
      primaryTopic: options.primaryTopic || 'not specified',
      conversationLength: conversation.length
    });

    try {
      // Create messages for the LLM
      const systemPrompt = `
        You are an expert programming education analyzer.
        Analyze the following programming conversation and extract structured information.
        ${options.primaryTopic ? `The primary topic is: ${options.primaryTopic}` : ""}
      `;

      const userPrompt = `
        Conversation to analyze:
        
        ${conversation}
        
        Please provide a JSON response with the following structure:
        {
          "concepts": [
            {
              "name": "concept name",
              "proficiency": 0-5 scale of user understanding,
              "eventType": "learned" | "practiced" | "confused" | "mastered",
              "details": "brief explanation of evidence"
            }
          ],
          "overallUnderstanding": 0-5 scale,
          "misconceptions": ["list of specific misconceptions detected"],
          "detectedTopic": "main topic of conversation"
        }
      `;

      // Use LangChain model to get a response
      const response = await this.model.call([
        new SystemMessage(systemPrompt),
        new HumanMessage(userPrompt)
      ]);

      const content = response.content.toString();

      // Extract JSON from the response
      const jsonMatch = content.match(/```json\n([\s\S]*?)\n```/) ||
        content.match(/\{[\s\S]*\}/);

      if (jsonMatch) {
        return JSON.parse(jsonMatch[1] || jsonMatch[0]);
      } else {
        throw new Error("No JSON found in LLM response");
      }
    } catch (error) {
      logger.error('Error in conversation analysis with LangChain', { error, primaryTopic: options.primaryTopic });

      // Default fallback
      return {
        concepts: [],
        overallUnderstanding: 2.5,
        misconceptions: [],
        detectedTopic: options.primaryTopic || "programming"
      };
    }
  }

  /**
   * General purpose text analysis method for knowledge graph seeding
   * @param prompt The prompt to analyze
   * @returns The LLM's response text
   */
  async analyzeText(prompt: string): Promise<string> {
    logger.debug('Analyzing text for knowledge graph seeding', { promptLength: prompt.length });

    try {
      // Use LangChain model with a simple prompt structure
      const response = await this.model.call([
        new HumanMessage(prompt)
      ]);

      const content = response.content.toString();
      return content;
    } catch (error) {
      logger.error('Error in text analysis for knowledge graph seeding', { error });
      throw new Error(`LLM analysis failed: ${(error as Error).message}`);
    }
  }
}