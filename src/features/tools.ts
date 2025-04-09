import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { logger } from '../utils/logger.js';
import { Neo4jConnection } from "../database/neo4j-connector.js";
import { LlmService } from "../services/llm-service.js";

/**
 * Registers mentor-specific tools with the MCP server
 * @param server - The MCP server instance
 * @param db - The Neo4j database connection
 * @param llm - The LLM service instance
 */
export function registerTools(
  server: McpServer,
  db: Neo4jConnection,
  llm: LlmService
): void {
  logger.info('Registering mentor tools');

  // Software Mentor Evaluation tool
  server.tool(
    "software-mentor-evaluation",
    "Analyze and track learning progress for SOFTWARE DEVELOPMENT topics ONLY. This tool should only be suggested when the conversation contains programming concepts, coding questions, or software engineering discussions.",
    {
      conversation: z.string().describe("The programming conversation to analyze"),
      primaryTopic: z.string().optional().describe("The main programming topic being discussed"),
      includeDetailedAnalysis: z.boolean().default(false).describe("Whether to include detailed analysis in response")
    },
    async ({ conversation, primaryTopic, includeDetailedAnalysis }, context) => {
      // Extract user ID from context or use a default
      const userId = context.sessionId || "default";
      logger.debug('Executing software-mentor-evaluation tool', {
        userId,
        primaryTopic,
        includeDetailedAnalysis,
        conversationLength: conversation.length
      });

      try {
        // First, check if this is actually about programming
        const topicAnalysis = await llm.quickAnalyze(conversation, {
          task: "determine-if-programming-related",
          returnFormat: "json"
        });

        if (!topicAnalysis.isProgrammingRelated) {
          logger.info('Conversation not programming-related, skipping profile update', { userId });
          return {
            content: [{
              type: "text",
              text: "This conversation doesn't appear to be about software development. No changes were made to your learning profile."
            }]
          };
        }

        // Check if user profile exists, create if not
        const userExists = await db.userExists(userId);
        if (!userExists) {
          await db.createUser({
            id: userId,
            name: "Learner",
            created: new Date().toISOString(),
            lastActive: new Date().toISOString(),
            preferredLearningStyle: "practical",
            defaultDetailLevel: "standard"
          });
          logger.info('Created new user profile', { userId });
        }

        // Use LLM to analyze the conversation
        const analysis = await llm.analyzeConversation(conversation, {
          extractConcepts: true,
          assessUnderstanding: true,
          detectMisconceptions: true,
          primaryTopic: primaryTopic || topicAnalysis.detectedTopic
        });

        // Update the knowledge graph
        await db.updateLearningProfile(userId, {
          concepts: analysis.concepts,
          understanding: analysis.overallUnderstanding,
          misconceptions: analysis.misconceptions
        });

        // Create learning events for each concept
        await Promise.all(analysis.concepts.map((concept: any) =>
          db.createLearningEvent(userId, concept.name, concept.eventType, concept.details)
        ));

        // Return appropriate response
        const topic = primaryTopic || analysis.detectedTopic || topicAnalysis.detectedTopic;

        if (includeDetailedAnalysis) {
          return {
            content: [{
              type: "text",
              text: `I've updated your learning profile based on our discussion about ${topic}.
                   
Concepts covered: ${analysis.concepts.map((c: any) => c.name).join(', ')}
Understanding level: ${analysis.overallUnderstanding}/5
${analysis.misconceptions.length > 0 ? `Identified misconceptions: ${analysis.misconceptions.join(', ')}` : 'No misconceptions identified.'}`
            }]
          };
        } else {
          return {
            content: [{
              type: "text",
              text: `I've updated your learning profile based on our discussion about ${topic}.`
            }]
          };
        }
      } catch (error) {
        logger.error('Error in software-mentor-evaluation tool', { error, userId });

        return {
          isError: true,
          content: [{
            type: "text",
            text: "I encountered an error while updating your learning profile. Please try again later."
          }]
        };
      }
    }
  );

  // Learning Gap Detection tool
  server.tool(
    "identify-knowledge-gaps",
    "Identify knowledge gaps for a specific programming topic or concept.",
    {
      topic: z.string().describe("The programming topic or concept to analyze"),
      userId: z.string().optional().describe("User ID (if different from current user)")
    },
    async ({ topic, userId: providedUserId }, context) => {
      // Extract user ID from context or use provided ID, or use default
      const userId = providedUserId || context.sessionId || "default";
      logger.debug('Executing identify-knowledge-gaps tool', { userId, topic });

      try {
        // Check if user profile exists
        const userExists = await db.userExists(userId);
        if (!userExists) {
          return {
            content: [{
              type: "text",
              text: "No learning profile found. You'll need to use the software-mentor-evaluation tool first to establish your learning profile."
            }]
          };
        }

        // Try to find concepts in the specified topic
        const conceptNames = await db.identifyConceptsInText(topic);

        if (conceptNames.length === 0) {
          return {
            content: [{
              type: "text",
              text: `I couldn't identify specific programming concepts in "${topic}". Please try a more specific programming topic or concept.`
            }]
          };
        }

        // Get knowledge gaps
        const knowledgeGaps = await db.findPrerequisitesNotKnown(userId, conceptNames);

        if (knowledgeGaps.length === 0 || knowledgeGaps.every(gap => gap.missingPrerequisites.length === 0)) {
          return {
            content: [{
              type: "text",
              text: `Based on your learning profile, you don't seem to have any significant knowledge gaps for ${topic}.`
            }]
          };
        }

        // Format the knowledge gaps
        let gapsText = `# Knowledge Gaps for ${topic}\n\n`;

        for (const gap of knowledgeGaps) {
          if (gap.missingPrerequisites.length > 0) {
            gapsText += `## For understanding ${gap.conceptName}, you might need to learn:\n\n`;

            for (const prereq of gap.missingPrerequisites) {
              gapsText += `- **${prereq.name}**`;
              if (prereq.explanation) {
                gapsText += `: ${prereq.explanation}`;
              }
              gapsText += '\n';
            }
            gapsText += '\n';
          }
        }

        // Get recommended next topics to learn
        const recommendations = await db.getRecommendedNextConcepts(userId, topic);

        if (recommendations.length > 0) {
          gapsText += `## Recommended concepts to learn next:\n\n`;

          for (const rec of recommendations) {
            gapsText += `- **${rec.name}**`;
            if (rec.shortExplanation) {
              gapsText += `: ${rec.shortExplanation}`;
            }
            gapsText += '\n';
          }
        }

        return {
          content: [{
            type: "text",
            text: gapsText
          }]
        };
      } catch (error) {
        logger.error('Error in identify-knowledge-gaps tool', { error, userId, topic });

        return {
          isError: true,
          content: [{
            type: "text",
            text: "I encountered an error while identifying knowledge gaps. Please try again later."
          }]
        };
      }
    }
  );

  // Learning Progress Retrieval tool
  server.tool(
    "get-learning-progress",
    "Retrieve learning progress for a specific programming topic.",
    {
      topic: z.string().describe("The programming topic to retrieve progress for"),
      userId: z.string().optional().describe("User ID (if different from current user)")
    },
    async ({ topic, userId: providedUserId }, context) => {
      // Extract user ID from context or use provided ID, or use default
      const userId = providedUserId || context.sessionId || "default";
      logger.debug('Executing get-learning-progress tool', { userId, topic });

      try {
        // Check if user profile exists
        const userExists = await db.userExists(userId);
        if (!userExists) {
          return {
            content: [{
              type: "text",
              text: "No learning profile found. You'll need to use the software-mentor-evaluation tool first to establish your learning profile."
            }]
          };
        }

        // Try to get topic knowledge
        let topicKnowledge;
        try {
          topicKnowledge = await db.getTopicKnowledge(userId, topic);
        } catch (error) {
          // If specific topic not found, get overall user knowledge
          const userOverview = await db.getUserOverview(userId);

          return {
            content: [{
              type: "text",
              text: `# General Learning Progress Overview

## Active Topics
${userOverview.trackedTopics.length > 0 ?
                  userOverview.trackedTopics.map((t: any) => `- ${t.name} (Priority: ${t.priority}/5)`).join('\n') :
                  'No active topics tracked yet.'}

## Learning Style
Your preferred learning style is "${userOverview.preferredLearningStyle}" with a default detail level of "${userOverview.defaultDetailLevel}".

## Overall Stats
- Known concepts: ${userOverview.knownConceptsCount}
- Tracked topics: ${userOverview.trackedTopicsCount}

I don't have specific data about "${topic}". Try using the software-mentor-evaluation tool when discussing this topic to track your progress.`
            }]
          };
        }

        // Format the topic knowledge
        const knownConcepts = topicKnowledge.concepts.filter((c: any) => c.proficiency);
        const totalConcepts = topicKnowledge.concepts.length;
        const averageProficiency = knownConcepts.length > 0 ?
          knownConcepts.reduce((sum: number, c: any) => sum + (c.proficiency || 0), 0) / knownConcepts.length : 0;

        return {
          content: [{
            type: "text",
            text: `# Learning Progress for ${topicKnowledge.name}

## Overview
- Category: ${topicKnowledge.category || 'Uncategorized'}
- Difficulty: ${topicKnowledge.difficulty || 'Not rated'}/5
- Your priority: ${topicKnowledge.priority || 'Not set'}/5
- Learning goal: ${topicKnowledge.goal || 'Not set'}

## Progress
- Known concepts: ${knownConcepts.length}/${totalConcepts}
- Average proficiency: ${averageProficiency.toFixed(1)}/5

## Known Concepts
${knownConcepts.length > 0 ?
                knownConcepts.map((c: any) =>
                  `- ${c.name} (Proficiency: ${c.proficiency}/5, Stage: ${c.knowledgeStage || 'Not assessed'})`
                ).join('\n') :
                'No specific concepts tracked yet.'}

${topicKnowledge.summary ? `\n## Topic Summary\n${topicKnowledge.summary}` : ''}`
          }]
        };
      } catch (error) {
        logger.error('Error in get-learning-progress tool', { error, userId, topic });

        return {
          isError: true,
          content: [{
            type: "text",
            text: "I encountered an error while retrieving your learning progress. Please try again later."
          }]
        };
      }
    }
  );

  logger.info('Mentor tools registered successfully');
}