import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { logger } from '../utils/logger.js';
import { Neo4jConnection } from "../database/neo4j-connector.js";
import { formatLearningContext, buildSystemPrompt } from "../services/prompt-service.js";

/**
 * Registers mentor-specific prompts with the MCP server
 * @param server - The MCP server instance
 * @param db - The Neo4j database connection
 */
export function registerPrompts(
  server: McpServer,
  db: Neo4jConnection
): void {
  logger.info('Registering mentor prompts');

  // Software Mentor prompt
  server.prompt(
    "software-mentor",
    "Get personalized programming guidance from your software mentor",
    {
      question: z.string().describe("Your programming question"),
      topic: z.string().optional().describe("Specific programming topic you're asking about"),
      learningStyle: z.enum(["visual", "conceptual", "practical", "analogical"]).optional()
        .describe("Your preferred learning style"),
      detailLevel: z.enum(["beginner", "standard", "advanced"]).optional()
        .describe("The level of detail you want in the explanation"),
      includeExamples: z.enum(["true", "false"]).optional()
        .describe("Whether to include code examples"),
      relateToFamiliarConcepts: z.enum(["true", "false"]).optional()
        .describe("Connect new concepts to ones you already know")
    },
    async ({ question, topic, learningStyle, detailLevel, includeExamples, relateToFamiliarConcepts }, context) => {
      // Extract user ID from context or use a default
      const userId = context.sessionId || "default";
      logger.debug('Executing software-mentor prompt', {
        userId,
        topic,
        learningStyle,
        detailLevel,
        questionLength: question?.length || 0
      });

      try {
        // Check if user profile exists, create if not
        const userExists = await db.userExists(userId);
        if (!userExists) {
          await db.createUser({
            id: userId,
            name: "Learner",
            created: new Date().toISOString(),
            lastActive: new Date().toISOString(),
            preferredLearningStyle: learningStyle || "practical",
            defaultDetailLevel: detailLevel || "standard"
          });
          logger.info('Created new user profile via prompt', { userId });
        }

        // Get user data
        const user = await db.getUser(userId);
        const profile = await db.getLearningProfile(userId);

        // Identify concepts in the question
        const conceptNames = await db.identifyConceptsInText(question || "");
        logger.debug('Identified concepts in question', { conceptNames });

        // Get knowledge for these concepts and related ones
        const conceptKnowledge = await db.getConceptKnowledge(userId, conceptNames);
        const knowledgeGaps = await db.findPrerequisitesNotKnown(userId, conceptNames);
        const recentLearning = await db.getRecentLearningEvents(userId, 5);

        // Build learning context
        const learningContext = formatLearningContext({
          user,
          profile,
          conceptKnowledge,
          knowledgeGaps,
          recentLearning
        });

        // Build system instructions
        const systemInstructions = buildSystemPrompt({
          learningStyle: learningStyle || user.preferredLearningStyle,
          detailLevel: detailLevel || user.defaultDetailLevel,
          includeExamples: includeExamples !== "false", 
          relateToFamiliarConcepts: relateToFamiliarConcepts !== "false"
        });

        // Include topic context if specified
        let topicContext = "";
        if (topic) {
          try {
            const topicKnowledge = await db.getTopicKnowledge(userId, topic);

            topicContext = `
# Topic Context: ${topic}
- Category: ${topicKnowledge.category || 'Uncategorized'}
- Difficulty: ${topicKnowledge.difficulty || 'Not rated'}/5
- Your current priority: ${topicKnowledge.priority || 'Not set'}/5
- Related concepts known: ${topicKnowledge.concepts.filter((c: any) => c.proficiency).length}/${topicKnowledge.concepts.length}
            `;
          } catch (error) {
            // If topic not found, just skip the topic context
            logger.debug('Topic not found in database, skipping topic context', { topic });
          }
        }

        // Construct message array
        return {
          description: `Personalized mentor guidance for: ${question.substring(0, 50)}${question.length > 50 ? '...' : ''}`,
          messages: [
            // Resource inclusion with learning profile
            {
              role: "user",
              content: {
                type: "text",
                text: `# Your Learning Profile
${learningContext}
${topicContext}`
              }
            },
            // System guidance
            {
              role: "assistant",
              content: {
                type: "text",
                text: systemInstructions
              }
            },
            // User question
            {
              role: "user",
              content: {
                type: "text",
                text: question
              }
            }
          ]
        };
      } catch (error) {
        logger.error('Error in software-mentor prompt', { error, userId });

        // Fallback to just the question if we can't get the learning profile
        return {
          description: `Mentor guidance (without profile) for: ${question.substring(0, 50)}${question.length > 50 ? '...' : ''}`,
          messages: [
            {
              role: "assistant",
              content: {
                type: "text",
                text: "You are a helpful programming mentor. Explain concepts clearly and provide useful examples."
              }
            },
            {
              role: "user",
              content: {
                type: "text",
                text: question
              }
            }
          ]
        };
      }
    }
  );

  // Learning Path prompt
  server.prompt(
    "learning-path",
    "Get a personalized learning path for a programming topic",
    {
      topic: z.string().describe("The programming topic you want to learn"),
      goalLevel: z.enum(["beginner", "intermediate", "advanced"]).optional()
        .describe("Your target proficiency level"),
      timeframe: z.string().optional().describe("Your desired learning timeframe (e.g., '2 weeks', '3 months')")
    },
    async ({ topic, goalLevel, timeframe }, context) => {
      // Extract user ID from context or use a default
      const userId = context.sessionId || "default";
      logger.debug('Executing learning-path prompt', { userId, topic, goalLevel, timeframe });

      try {
        // Check if user profile exists
        const userExists = await db.userExists(userId);
        if (!userExists) {
          return {
            description: `Learning path for ${topic} (new user)`,
            messages: [
              {
                role: "assistant",
                content: {
                  type: "text",
                  text: "You are a helpful programming mentor. Create a learning path for a beginner with no prior knowledge of the topic."
                }
              },
              {
                role: "user",
                content: {
                  type: "text",
                  text: `I want to learn ${topic}${goalLevel ? ` at a ${goalLevel} level` : ''}${timeframe ? ` within ${timeframe}` : ''}. Please create a learning path for me as a complete beginner.`
                }
              }
            ]
          };
        }

        // Get user data
        const user = await db.getUser(userId);
        const profile = await db.getLearningProfile(userId);

        // Get concept recommendations
        const recommendations = await db.getRecommendedNextConcepts(userId, topic);

        // Get relevant concepts already known
        const conceptNames = await db.identifyConceptsInText(topic);
        const conceptKnowledge = await db.getConceptKnowledge(userId, conceptNames);

        // Format the learning path context
        let learningPathContext = `# Creating a Learning Path for ${topic}\n\n`;

        // Add known concepts
        if (conceptKnowledge.length > 0) {
          learningPathContext += "## Concepts You Already Know\n";
          for (const concept of conceptKnowledge) {
            if (concept.proficiency && concept.proficiency >= 3) {
              learningPathContext += `- ${concept.name} (Proficiency: ${concept.proficiency}/5)\n`;
            }
          }
          learningPathContext += "\n";
        }

        // Add recommended next concepts
        if (recommendations.length > 0) {
          learningPathContext += "## Recommended Next Concepts\n";
          for (const rec of recommendations) {
            learningPathContext += `- ${rec.name} (Complexity: ${rec.complexity}/5)\n`;
            if (rec.shortExplanation) {
              learningPathContext += `  - ${rec.shortExplanation}\n`;
            }
          }
          learningPathContext += "\n";
        }

        // Add learning preferences
        learningPathContext += `## Your Learning Preferences\n`;
        learningPathContext += `- Learning style: ${user.preferredLearningStyle}\n`;
        learningPathContext += `- Detail level: ${user.defaultDetailLevel}\n`;
        if (profile.learningGoals) {
          learningPathContext += `- Current learning goals: ${profile.learningGoals}\n`;
        }
        learningPathContext += "\n";

        // Add timeframe if specified
        if (timeframe) {
          learningPathContext += `## Timeframe\n`;
          learningPathContext += `- Desired completion: ${timeframe}\n\n`;
        }

        // Add goal level if specified
        if (goalLevel) {
          learningPathContext += `## Target Level\n`;
          learningPathContext += `- Goal: ${goalLevel} proficiency\n\n`;
        }

        return {
          description: `Personalized learning path for ${topic}`,
          messages: [
            {
              role: "assistant",
              content: {
                type: "text",
                text: `You are a personalized programming mentor creating a learning path. 
Adapt to the learner's current knowledge and preferences.
Break down complex topics into manageable steps.
Focus on practical milestones that build upon each other.
Include specific resources, practice exercises, and projects where appropriate.`
              }
            },
            {
              role: "user",
              content: {
                type: "text",
                text: learningPathContext
              }
            },
            {
              role: "user",
              content: {
                type: "text",
                text: `Based on my current knowledge and learning preferences, please create a personalized learning path for ${topic}${goalLevel ? ` to reach a ${goalLevel} level` : ''}${timeframe ? ` within ${timeframe}` : ''}.`
              }
            }
          ]
        };
      } catch (error) {
        logger.error('Error in learning-path prompt', { error, userId, topic });

        // Fallback to a generic learning path
        return {
          description: `Learning path for ${topic} (fallback)`,
          messages: [
            {
              role: "assistant",
              content: {
                type: "text",
                text: "You are a helpful programming mentor. Create a general learning path for someone interested in this topic."
              }
            },
            {
              role: "user",
              content: {
                type: "text",
                text: `I want to learn ${topic}${goalLevel ? ` at a ${goalLevel} level` : ''}${timeframe ? ` within ${timeframe}` : ''}. Please create a learning path for me.`
              }
            }
          ]
        };
      }
    }
  );

  // Concept Explanation prompt
  server.prompt(
    "explain-concept",
    "Get a personalized explanation of a programming concept",
    {
      concept: z.string().describe("The programming concept you want explained"),
      learningStyle: z.enum(["visual", "conceptual", "practical", "analogical"]).optional()
        .describe("Your preferred learning style"),
      detailLevel: z.enum(["beginner", "standard", "advanced"]).optional()
        .describe("The level of detail you want")
    },
    async ({ concept, learningStyle, detailLevel }, context) => {
      // Extract user ID from context or use a default
      const userId = context.sessionId || "default";
      logger.debug('Executing explain-concept prompt', { userId, concept, learningStyle, detailLevel });

      try {
        // Check if user profile exists, get or create user data
        const userExists = await db.userExists(userId);
        let user;
        let profile;

        if (userExists) {
          user = await db.getUser(userId);
          profile = await db.getLearningProfile(userId);
        } else {
          user = {
            id: userId,
            name: "Learner",
            preferredLearningStyle: learningStyle || "practical",
            defaultDetailLevel: detailLevel || "standard"
          };
          profile = { learningGoals: "" };
        }

        // Get related concepts and prerequisites
        let relatedConceptsInfo = "";
        try {
          // Try to get related concepts
          const relatedConcepts = await db.getRelatedConcepts(userId, concept);

          if (relatedConcepts.relatedConcepts.length > 0) {
            relatedConceptsInfo += "\n## Related Concepts\n";

            // First list known related concepts
            const knownRelated = relatedConcepts.relatedConcepts.filter((c: any) => c.known);
            if (knownRelated.length > 0) {
              relatedConceptsInfo += "### Concepts You Already Know\n";
              for (const rel of knownRelated) {
                relatedConceptsInfo += `- ${rel.name} (Relationship: ${rel.relationshipType || 'related'}, Proficiency: ${rel.proficiency || '?'}/5)\n`;
                if (rel.contextualNote) {
                  relatedConceptsInfo += `  - ${rel.contextualNote}\n`;
                }
              }
              relatedConceptsInfo += "\n";
            }

            // Then list unknown related concepts
            const unknownRelated = relatedConcepts.relatedConcepts.filter((c: any) => !c.known);
            if (unknownRelated.length > 0) {
              relatedConceptsInfo += "### Related Concepts You Haven't Learned Yet\n";
              for (const rel of unknownRelated) {
                relatedConceptsInfo += `- ${rel.name} (Relationship: ${rel.relationshipType || 'related'})\n`;
                if (rel.contextualNote) {
                  relatedConceptsInfo += `  - ${rel.contextualNote}\n`;
                }
              }
              relatedConceptsInfo += "\n";
            }
          }
        } catch (error) {
          logger.debug('Error getting related concepts, skipping related concepts info', { error, concept });
        }

        // Check for knowledge gaps
        let knowledgeGapsInfo = "";
        try {
          const knowledgeGaps = await db.findPrerequisitesNotKnown(userId, [concept]);

          if (knowledgeGaps.length > 0 && knowledgeGaps[0].missingPrerequisites.length > 0) {
            knowledgeGapsInfo += "\n## Prerequisites You Might Need\n";

            for (const prereq of knowledgeGaps[0].missingPrerequisites) {
              knowledgeGapsInfo += `- ${prereq.name}\n`;
              if (prereq.explanation) {
                knowledgeGapsInfo += `  - ${prereq.explanation}\n`;
              }
            }
            knowledgeGapsInfo += "\n";
          }
        } catch (error) {
          logger.debug('Error getting knowledge gaps, skipping knowledge gaps info', { error, concept });
        }

        // Build system instructions
        const systemInstructions = buildSystemPrompt({
          learningStyle: learningStyle || user.preferredLearningStyle,
          detailLevel: detailLevel || user.defaultDetailLevel,
          includeExamples: true,
          relateToFamiliarConcepts: true
        });

        return {
          description: `Personalized explanation of ${concept}`,
          messages: [
            {
              role: "assistant",
              content: {
                type: "text",
                text: systemInstructions
              }
            },
            {
              role: "user",
              content: {
                type: "text",
                text: `# Explain: ${concept}

## Learning Profile
- Preferred learning style: ${learningStyle || user.preferredLearningStyle}
- Detail level: ${detailLevel || user.defaultDetailLevel}
${relatedConceptsInfo}
${knowledgeGapsInfo}

Please explain the concept of "${concept}" adapted to my learning profile.`
              }
            }
          ]
        };
      } catch (error) {
        logger.error('Error in explain-concept prompt', { error, userId, concept });

        // Fallback to a simple explanation request
        return {
          description: `Explanation of ${concept} (fallback)`,
          messages: [
            {
              role: "assistant",
              content: {
                type: "text",
                text: "You are a helpful programming mentor. Explain concepts clearly with useful examples."
              }
            },
            {
              role: "user",
              content: {
                type: "text",
                text: `Please explain the concept of "${concept}"${learningStyle ? ` using a ${learningStyle} learning style` : ''}${detailLevel ? ` at a ${detailLevel} level` : ''}.`
              }
            }
          ]
        };
      }
    }
  );

  logger.info('Mentor prompts registered successfully');
}