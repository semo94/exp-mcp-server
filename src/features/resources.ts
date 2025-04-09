import { McpServer, ResourceTemplate } from "@modelcontextprotocol/sdk/server/mcp.js";
import { logger } from '../utils/logger.js';
import { Neo4jConnection } from "../database/neo4j-connector.js";

/**
 * Registers mentor-specific resources with the MCP server
 * @param server - The MCP server instance
 * @param db - The Neo4j database connection
 */
export function registerResources(
  server: McpServer,
  db: Neo4jConnection
): void {
  logger.info('Registering mentor resources');

  // Learning Profile Resource
  server.resource(
    "software-learning-profile",
    new ResourceTemplate("profile://{userId}/{scope?}/{identifier?}", { list: undefined }),
    async (uri, { userId, scope, identifier }) => {
      logger.debug('Reading learning profile resource', { uri: uri.href, userId, scope, identifier });

      try {
        // Check if user profile exists, create if not
        const userExists = await db.userExists(userId as string);
        if (!userExists) {
          await db.createUser({
            id: userId as string,
            name: "Learner",
            created: new Date().toISOString(),
            lastActive: new Date().toISOString(),
            preferredLearningStyle: "practical",
            defaultDetailLevel: "standard"
          });
          logger.info('Created new user profile via resource access', { userId });
        }

        let profileData;

        // General overview
        if (!scope || scope === "overview") {
          profileData = await db.getUserOverview(userId as string);
        }
        // Topic-specific knowledge
        else if (scope === "topic" && identifier) {
          profileData = await db.getTopicKnowledge(userId as string, identifier as string);
        }
        // Concept-specific knowledge
        else if (scope === "concept" && identifier) {
          const conceptKnowledge = await db.getConceptKnowledge(userId as string, [identifier as string]);
          profileData = conceptKnowledge[0] || { name: identifier, error: "Concept not found" };
        }
        // Related concepts
        else if (scope === "related" && identifier) {
          profileData = await db.getRelatedConcepts(userId as string, identifier as string);
        }
        // Recommended learning path
        else if (scope === "next") {
          profileData = await db.getRecommendedNextConcepts(userId as string, identifier as string);
        }
        // Knowledge gaps
        else if (scope === "gaps" && identifier) {
          profileData = await db.findPrerequisitesNotKnown(userId as string, [identifier as string]);
        }
        // Recent learning events
        else if (scope === "recent") {
          const limit = identifier ? parseInt(identifier as string, 10) : 10;
          profileData = await db.getRecentLearningEvents(userId as string, limit);
        }
        else {
          // Default to user overview
          profileData = await db.getUserOverview(userId as string);
        }

        return {
          contents: [{
            uri: uri.href,
            text: JSON.stringify(profileData, null, 2),
            mimeType: "application/json"
          }]
        };
      } catch (error) {
        logger.error('Error reading learning profile resource', { error, uri: uri.href });

        return {
          contents: [{
            uri: uri.href,
            text: JSON.stringify({ error: "Failed to retrieve learning profile" }, null, 2),
            mimeType: "application/json"
          }]
        };
      }
    }
  );

  // Programming Concepts Resource
  server.resource(
    "programming-concepts",
    new ResourceTemplate("concepts://{concept?}", { list: undefined }),
    async (uri, { concept }) => {
      logger.debug('Reading programming concepts resource', { uri: uri.href, concept });

      try {
        if (concept) {
          // Request for a specific concept - use db methods instead of direct session
          try {
            // Get related concepts
            const result = await db.getConceptKnowledge("system", [concept as string]);
            if (result.length === 0) {
              return {
                contents: [{
                  uri: uri.href,
                  text: JSON.stringify({ error: "Concept not found" }, null, 2),
                  mimeType: "application/json"
                }]
              };
            }

            // Also get relationships
            const relatedData = await db.getRelatedConcepts("system", concept as string);
            
            const conceptData = {
              ...result[0],
              relatedConcepts: relatedData.relatedConcepts || [],
              prerequisites: relatedData.prerequisites || []
            };

            return {
              contents: [{
                uri: uri.href,
                text: JSON.stringify(conceptData, null, 2),
                mimeType: "application/json"
              }]
            };
          } catch (error) {
            return {
              contents: [{
                uri: uri.href,
                text: JSON.stringify({ error: "Concept details retrieval failed" }, null, 2),
                mimeType: "application/json"
              }]
            };
          }
        } else {
          // Request for listing concepts
          try {
            // Use identifyConceptsInText with an empty query to get all concepts
            const concepts = await db.identifyConceptsInText("");
            
            // Format the concepts list
            const conceptsList = concepts.map((name: string) => ({
              name,
              category: "programming", // Default category
              complexity: 3 // Default complexity
            }));

            return {
              contents: [{
                uri: uri.href,
                text: JSON.stringify(conceptsList, null, 2),
                mimeType: "application/json"
              }]
            };
          } catch (error) {
            return {
              contents: [{
                uri: uri.href,
                text: JSON.stringify({ error: "Failed to list concepts" }, null, 2),
                mimeType: "application/json"
              }]
            };
          }
        }
      } catch (error) {
        logger.error('Error reading programming concepts resource', { error, uri: uri.href });

        return {
          contents: [{
            uri: uri.href,
            text: JSON.stringify({ error: "Failed to retrieve programming concepts" }, null, 2),
            mimeType: "application/json"
          }]
        };
      }
    }
  );

  // Programming Topics Resource
  server.resource(
    "programming-topics",
    new ResourceTemplate("topics://{topic?}", { list: undefined }),
    async (uri, { topic }) => {
      logger.debug('Reading programming topics resource', { uri: uri.href, topic });

      try {
        if (topic) {
          // Request for a specific topic using db methods
          try {
            const topicData = await db.getTopicKnowledge("system", topic as string);
            
            return {
              contents: [{
                uri: uri.href,
                text: JSON.stringify(topicData, null, 2),
                mimeType: "application/json"
              }]
            };
          } catch (error) {
            return {
              contents: [{
                uri: uri.href,
                text: JSON.stringify({ error: "Topic not found" }, null, 2),
                mimeType: "application/json"
              }]
            };
          }
        } else {
          // Request for listing topics - use db methods
          try {
            // Get a set of topics from known concepts
            const concepts = await db.identifyConceptsInText("");
            const topics = ["JavaScript", "Python", "Java", "C++", "Algorithms", "Data Structures"];
            
            // Format topic list
            const topicsList = topics.map((name: string) => ({
              name,
              category: name.includes("Script") ? "scripting" : "programming",
              difficulty: 3 // Default difficulty
            }));

            return {
              contents: [{
                uri: uri.href,
                text: JSON.stringify(topicsList, null, 2),
                mimeType: "application/json"
              }]
            };
          } catch (error) {
            return {
              contents: [{
                uri: uri.href,
                text: JSON.stringify({ error: "Failed to list topics" }, null, 2),
                mimeType: "application/json"
              }]
            };
          }
        }
      } catch (error) {
        logger.error('Error reading programming topics resource', { error, uri: uri.href });

        return {
          contents: [{
            uri: uri.href,
            text: JSON.stringify({ error: "Failed to retrieve programming topics" }, null, 2),
            mimeType: "application/json"
          }]
        };
      }
    }
  );

  logger.info('Mentor resources registered successfully');
}