import neo4j from 'neo4j-driver';
import { logger } from '../utils/logger.js';

export interface TopicData {
  id?: string;
  name: string;
  category: "language" | "framework" | "concept" | "paradigm";
  difficulty: number;
  summary: string;
  prerequisites?: string[];
}

export interface ConceptData {
  id?: string;
  name: string;
  description: string;
  complexity: number;
  shortExplanation: string;
  commonMisconceptions?: string[];
  useCases?: string[];
  codeExample?: string;
}

export class Neo4jConnection {
  driver: neo4j.Driver;

  constructor(config: { uri: string, username: string, password: string }) {
    this.driver = neo4j.driver(
      config.uri,
      neo4j.auth.basic(config.username, config.password)
    );
    logger.debug('Neo4j driver initialized', { uri: config.uri });
  }

  async initialize() {
    try {
      // Test connection
      const session = this.driver.session();
      await session.run("RETURN 1");
      session.close();
      logger.info('Neo4j connection established');

      // Initialize schema if needed
      await this.initializeSchema();
    } catch (error) {
      logger.error('Failed to connect to Neo4j:', { error });
      throw error;
    }
  }

  private async initializeSchema() {
    const session = this.driver.session();
    try {
      // Create constraints
      await session.run(`
        CREATE CONSTRAINT IF NOT EXISTS FOR (u:User) REQUIRE u.id IS UNIQUE
      `);
      await session.run(`
        CREATE CONSTRAINT IF NOT EXISTS FOR (t:Topic) REQUIRE t.id IS UNIQUE
      `);
      await session.run(`
        CREATE CONSTRAINT IF NOT EXISTS FOR (c:Concept) REQUIRE c.id IS UNIQUE
      `);
      await session.run(`
        CREATE CONSTRAINT IF NOT EXISTS FOR (lp:LearningProfile) REQUIRE lp.id IS UNIQUE
      `);
      await session.run(`
        CREATE CONSTRAINT IF NOT EXISTS FOR (le:LearningEvent) REQUIRE le.id IS UNIQUE
      `);
      logger.info('Neo4j schema initialized');
    } catch (error) {
      logger.error('Failed to initialize Neo4j schema:', { error });
      throw error;
    } finally {
      session.close();
    }
  }

  // ============= TOPIC METHODS =============

  /**
   * Creates a new topic in the knowledge graph
   * @param topic The topic data to create
   * @returns The created topic with generated ID
   */
  async createTopic(topic: TopicData): Promise<TopicData> {
    const session = this.driver.session();
    try {
      // Generate UUID if not provided
      const topicId = topic.id || crypto.randomUUID();

      const result = await session.run(
        `
        CREATE (t:Topic {
          id: $id,
          name: $name,
          category: $category,
          difficulty: $difficulty,
          summary: $summary,
          prerequisites: $prerequisites
        })
        RETURN t
        `,
        {
          id: topicId,
          name: topic.name,
          category: topic.category,
          difficulty: topic.difficulty,
          summary: topic.summary,
          prerequisites: topic.prerequisites || []
        }
      );

      logger.info('Topic created', { topicName: topic.name });
      return { ...topic, id: topicId };
    } catch (error) {
      logger.error('Failed to create topic', { error, topicName: topic.name });
      throw error;
    } finally {
      session.close();
    }
  }

  /**
   * Checks if a topic exists
   * @param topicName The name of the topic to check
   */
  async topicExists(topicName: string): Promise<boolean> {
    const session = this.driver.session();
    try {
      const result = await session.run(
        `MATCH (t:Topic {name: $topicName}) RETURN count(t) > 0 AS exists`,
        { topicName }
      );
      return result.records[0].get('exists');
    } finally {
      session.close();
    }
  }

  /**
   * Ensures a topic exists, creating it if it doesn't
   * @param topicName The name of the topic to ensure exists
   * @param category Optional category for the topic if it needs to be created
   */
  async ensureTopicExists(topicName: string, category: "language" | "framework" | "concept" | "paradigm" = "concept"): Promise<void> {
    const exists = await this.topicExists(topicName);
    if (!exists) {
      await this.createTopic({
        name: topicName,
        category: category,
        difficulty: 3, // Default medium difficulty
        summary: `Auto-generated topic for ${topicName}`,
        prerequisites: []
      });
      logger.info('Created new topic placeholder', { topicName });
    }
  }

  // ============= CONCEPT METHODS =============

  /**
   * Creates a new concept in the knowledge graph
   * @param concept The concept data to create
   * @returns The created concept with generated ID
   */
  async createConcept(concept: ConceptData): Promise<ConceptData> {
    const session = this.driver.session();
    try {
      // Generate UUID if not provided
      const conceptId = concept.id || crypto.randomUUID();

      const result = await session.run(
        `
        CREATE (c:Concept {
          id: $id,
          name: $name,
          description: $description,
          complexity: $complexity,
          shortExplanation: $shortExplanation,
          commonMisconceptions: $commonMisconceptions,
          useCases: $useCases,
          codeExample: $codeExample
        })
        RETURN c
        `,
        {
          id: conceptId,
          name: concept.name,
          description: concept.description,
          complexity: concept.complexity,
          shortExplanation: concept.shortExplanation,
          commonMisconceptions: concept.commonMisconceptions || [],
          useCases: concept.useCases || [],
          codeExample: concept.codeExample || ""
        }
      );

      logger.info('Concept created', { conceptName: concept.name });
      return { ...concept, id: conceptId };
    } catch (error) {
      logger.error('Failed to create concept', { error, conceptName: concept.name });
      throw error;
    } finally {
      session.close();
    }
  }

  /**
   * Checks if a concept exists
   * @param conceptName The name of the concept
   */
  async conceptExists(conceptName: string): Promise<boolean> {
    const session = this.driver.session();
    try {
      const result = await session.run(
        `MATCH (c:Concept {name: $conceptName}) RETURN count(c) > 0 AS exists`,
        { conceptName }
      );
      return result.records[0].get('exists');
    } finally {
      session.close();
    }
  }

  /**
   * Ensures a concept exists, creating it with placeholder data if it doesn't
   */
  async ensureConceptExists(conceptName: string) {
    const exists = await this.conceptExists(conceptName);
    if (!exists) {
      // Create a placeholder concept
      await this.createConcept({
        name: conceptName,
        description: "Auto-generated concept",
        complexity: 3,
        shortExplanation: "This concept was automatically created based on learning data",
        commonMisconceptions: [],
        useCases: []
      });
      logger.info('Created new concept placeholder', { conceptName });
    }
  }

  // ============= RELATIONSHIP METHODS =============

  /**
   * Associates a concept with a topic (BELONGS_TO relationship)
   * @param conceptName Name of the concept
   * @param topicName Name of the topic
   * @param isPrimary Whether this is the primary topic for the concept
   * @param importance The importance of this concept to the topic (0-1)
   */
  async associateConceptWithTopic(
    conceptName: string,
    topicName: string,
    isPrimary: boolean = false,
    importance: number = 0.5
  ): Promise<void> {
    const session = this.driver.session();
    try {
      // Ensure both concept and topic exist
      await this.ensureConceptExists(conceptName);
      await this.ensureTopicExists(topicName);

      // Create the BELONGS_TO relationship
      await session.run(
        `
        MATCH (c:Concept {name: $conceptName})
        MATCH (t:Topic {name: $topicName})
        MERGE (c)-[b:BELONGS_TO]->(t)
        ON CREATE SET 
          b.primary = $isPrimary,
          b.importance = $importance
        ON MATCH SET
          b.primary = $isPrimary,
          b.importance = $importance
        `,
        { conceptName, topicName, isPrimary, importance }
      );

      logger.debug('Associated concept with topic', {
        conceptName,
        topicName,
        isPrimary,
        importance
      });
    } catch (error) {
      logger.error('Failed to associate concept with topic', {
        error,
        conceptName,
        topicName
      });
      throw error;
    } finally {
      session.close();
    }
  }

  /**
   * Establishes a prerequisite relationship between concepts (PREREQUISITE_FOR)
   * @param prerequisiteName The name of the prerequisite concept
   * @param conceptName The name of the concept that requires the prerequisite
   * @param strength The strength of the prerequisite relationship (0-1)
   * @param explanation An explanation of why this is a prerequisite
   */
  async setConceptPrerequisite(
    prerequisiteName: string,
    conceptName: string,
    strength: number = 0.5,
    explanation: string = ''
  ): Promise<void> {
    const session = this.driver.session();
    try {
      // Ensure both concepts exist
      await this.ensureConceptExists(prerequisiteName);
      await this.ensureConceptExists(conceptName);

      // Create the PREREQUISITE_FOR relationship
      await session.run(
        `
        MATCH (prereq:Concept {name: $prerequisiteName})
        MATCH (concept:Concept {name: $conceptName})
        MERGE (prereq)-[p:PREREQUISITE_FOR]->(concept)
        ON CREATE SET 
          p.strength = $strength,
          p.explanation = $explanation
        ON MATCH SET
          p.strength = $strength,
          p.explanation = $explanation
        `,
        { prerequisiteName, conceptName, strength, explanation }
      );

      logger.debug('Set concept prerequisite', {
        prerequisiteName,
        conceptName,
        strength
      });
    } catch (error) {
      logger.error('Failed to set concept prerequisite', {
        error,
        prerequisiteName,
        conceptName
      });
      throw error;
    } finally {
      session.close();
    }
  }

  /**
   * Creates a relationship between two concepts (RELATED_TO)
   * @param concept1Name The name of the first concept
   * @param concept2Name The name of the second concept
   * @param relationshipType The type of relationship
   * @param strength The strength of the relationship (0-1)
   * @param contextualNote An optional note explaining the relationship
   */
  async relateConceptsTogether(
    concept1Name: string,
    concept2Name: string,
    relationshipType: "similar" | "builds_on" | "alternative_to" | "applied_in",
    strength: number = 0.5,
    contextualNote: string = ''
  ): Promise<void> {
    const session = this.driver.session();
    try {
      // Ensure both concepts exist
      await this.ensureConceptExists(concept1Name);
      await this.ensureConceptExists(concept2Name);

      // Create the RELATED_TO relationship
      await session.run(
        `
        MATCH (c1:Concept {name: $concept1Name})
        MATCH (c2:Concept {name: $concept2Name})
        MERGE (c1)-[r:RELATED_TO]->(c2)
        ON CREATE SET 
          r.relationshipType = $relationshipType,
          r.strength = $strength,
          r.contextualNote = $contextualNote
        ON MATCH SET
          r.relationshipType = $relationshipType,
          r.strength = $strength,
          r.contextualNote = $contextualNote
        `,
        { concept1Name, concept2Name, relationshipType, strength, contextualNote }
      );

      logger.debug('Related concepts together', {
        concept1Name,
        concept2Name,
        relationshipType,
        strength
      });
    } catch (error) {
      logger.error('Failed to relate concepts', {
        error,
        concept1Name,
        concept2Name
      });
      throw error;
    } finally {
      session.close();
    }
  }

  // ============= USER METHODS =============

  async userExists(userId: string): Promise<boolean> {
    const session = this.driver.session();
    try {
      const result = await session.run(
        `MATCH (u:User {id: $userId}) RETURN count(u) > 0 AS exists`,
        { userId }
      );
      return result.records[0].get('exists');
    } finally {
      session.close();
    }
  }

  async getUser(userId: string) {
    const session = this.driver.session();
    try {
      const result = await session.run(
        `MATCH (u:User {id: $userId}) RETURN u`,
        { userId }
      );

      if (result.records.length === 0) {
        throw new Error(`User not found: ${userId}`);
      }

      return result.records[0].get('u').properties;
    } finally {
      session.close();
    }
  }

  async createUser(user: any) {
    const session = this.driver.session();
    try {
      await session.run(
        `
        CREATE (u:User {
          id: $id,
          name: $name,
          created: $created,
          lastActive: $lastActive,
          preferredLearningStyle: $preferredLearningStyle,
          defaultDetailLevel: $defaultDetailLevel
        })
        WITH u
        CREATE (lp:LearningProfile {
          id: randomUUID(),
          userId: u.id,
          created: u.created,
          lastUpdated: u.created,
          activeTopics: [],
          learningGoals: ""
        })
        CREATE (u)-[:HAS]->(lp)
        `,
        user
      );
      logger.info('User created', { userId: user.id });
      return user;
    } catch (error) {
      logger.error('Failed to create user', { error, userId: user.id });
      throw error;
    } finally {
      session.close();
    }
  }

  // ============= LEARNING PROFILE METHODS =============

  async getLearningProfile(userId: string) {
    const session = this.driver.session();
    try {
      const result = await session.run(
        `
        MATCH (u:User {id: $userId})-[:HAS]->(lp:LearningProfile)
        RETURN lp
        `,
        { userId }
      );

      if (result.records.length === 0) {
        throw new Error(`Learning profile not found for user ${userId}`);
      }

      return result.records[0].get('lp').properties;
    } finally {
      session.close();
    }
  }

  async getUserOverview(userId: string) {
    const session = this.driver.session();
    try {
      const result = await session.run(
        `
        MATCH (u:User {id: $userId})-[:HAS]->(lp:LearningProfile)
        OPTIONAL MATCH (lp)-[k:KNOWS]->(c:Concept)
        OPTIONAL MATCH (lp)-[t:TRACKS]->(topic:Topic)
        RETURN 
          u.name AS name,
          u.preferredLearningStyle AS preferredLearningStyle,
          u.defaultDetailLevel AS defaultDetailLevel,
          lp.activeTopics AS activeTopics,
          lp.learningGoals AS learningGoals,
          count(DISTINCT c) AS knownConceptsCount,
          count(DISTINCT topic) AS trackedTopicsCount,
          collect(DISTINCT {
            name: topic.name,
            category: topic.category,
            priority: t.priority
          }) AS trackedTopics,
          collect(DISTINCT {
            name: c.name,
            proficiency: k.proficiency,
            knowledgeStage: k.knowledgeStage
          }) AS knownConcepts
        `,
        { userId }
      );

      if (result.records.length === 0) {
        throw new Error(`User overview not found for user ${userId}`);
      }

      return result.records[0].toObject();
    } finally {
      session.close();
    }
  }

  // ============= TOPIC KNOWLEDGE METHODS =============

  async getTopicKnowledge(userId: string, topicName: string) {
    const session = this.driver.session();
    try {
      const result = await session.run(
        `
        MATCH (u:User {id: $userId})-[:HAS]->(lp:LearningProfile)
        MATCH (topic:Topic {name: $topicName})
        OPTIONAL MATCH (lp)-[t:TRACKS]->(topic)
        OPTIONAL MATCH (topic)<-[:BELONGS_TO]-(c:Concept)
        OPTIONAL MATCH (lp)-[k:KNOWS]->(c)
        RETURN 
          topic.name AS name,
          topic.category AS category,
          topic.difficulty AS difficulty,
          topic.summary AS summary,
          t.priority AS priority,
          t.goal AS goal,
          collect(DISTINCT {
            name: c.name,
            proficiency: k.proficiency,
            knowledgeStage: k.knowledgeStage,
            firstSeen: k.firstSeen,
            lastUpdated: k.lastUpdated
          }) AS concepts
        `,
        { userId, topicName }
      );

      if (result.records.length === 0) {
        throw new Error(`Topic knowledge not found for topic ${topicName}`);
      }

      return result.records[0].toObject();
    } finally {
      session.close();
    }
  }

  // ============= CONCEPT KNOWLEDGE METHODS =============

  async getConceptKnowledge(userId: string, conceptNames: string[]) {
    const session = this.driver.session();
    try {
      const result = await session.run(
        `
        MATCH (u:User {id: $userId})-[:HAS]->(lp:LearningProfile)
        MATCH (c:Concept)
        WHERE c.name IN $conceptNames
        OPTIONAL MATCH (lp)-[k:KNOWS]->(c)
        OPTIONAL MATCH (c)-[:BELONGS_TO]->(t:Topic)
        RETURN 
          c.name AS name,
          c.description AS description,
          c.complexity AS complexity,
          k.proficiency AS proficiency,
          k.knowledgeStage AS knowledgeStage,
          k.firstSeen AS firstSeen,
          k.lastUpdated AS lastUpdated,
          collect(DISTINCT t.name) AS topics
        `,
        { userId, conceptNames }
      );

      return result.records.map(record => record.toObject());
    } finally {
      session.close();
    }
  }

  async findPrerequisitesNotKnown(userId: string, conceptNames: string[]) {
    const session = this.driver.session();
    try {
      const result = await session.run(
        `
        MATCH (u:User {id: $userId})-[:HAS]->(lp:LearningProfile)
        MATCH (c:Concept)
        WHERE c.name IN $conceptNames
        MATCH (c)<-[p:PREREQUISITE_FOR]-(prereq:Concept)
        OPTIONAL MATCH (lp)-[k:KNOWS]->(prereq)
        WHERE k IS NULL OR k.proficiency < 3
        RETURN 
          c.name AS conceptName,
          collect(DISTINCT {
            name: prereq.name,
            description: prereq.description,
            strength: p.strength,
            explanation: p.explanation,
            proficiency: k.proficiency
          }) AS missingPrerequisites
        `,
        { userId, conceptNames }
      );

      return result.records.map(record => record.toObject());
    } finally {
      session.close();
    }
  }

  // ============= LEARNING EVENT METHODS =============

  async getRecentLearningEvents(userId: string, limit: number = 10) {
    const session = this.driver.session();
    try {
      const result = await session.run(
        `
        MATCH (u:User {id: $userId})-[:HAS]->(lp:LearningProfile)
        MATCH (u)-[:EXPERIENCED]->(le:LearningEvent)
        OPTIONAL MATCH (le)-[:INVOLVES]->(c:Concept)
        RETURN 
          le.id AS id,
          le.timestamp AS timestamp,
          le.eventType AS eventType,
          le.details AS details,
          collect(DISTINCT c.name) AS concepts
        ORDER BY le.timestamp DESC
        LIMIT $limit
        `,
        { userId, limit }
      );

      return result.records.map(record => record.toObject());
    } finally {
      session.close();
    }
  }

  async createLearningEvent(userId: string, conceptName: string, eventType: string, details: string) {
    const session = this.driver.session();
    try {
      await this.ensureConceptExists(conceptName);

      await session.run(
        `
        MATCH (u:User {id: $userId})
        MATCH (c:Concept {name: $conceptName})
        CREATE (le:LearningEvent {
          id: randomUUID(),
          userId: $userId,
          timestamp: datetime(),
          eventType: $eventType,
          details: $details
        })
        CREATE (u)-[:EXPERIENCED]->(le)
        CREATE (le)-[:INVOLVES]->(c)
        `,
        { userId, conceptName, eventType, details }
      );
      logger.debug('Learning event created', { userId, conceptName, eventType });
    } catch (error) {
      logger.error('Failed to create learning event', { error, userId, conceptName, eventType });
      throw error;
    } finally {
      session.close();
    }
  }

  // ============= LEARNING PROFILE UPDATE METHODS =============

  async updateLearningProfile(userId: string, data: {
    concepts: Array<{
      name: string;
      proficiency: number;
      eventType: string;
      details: string;
    }>;
    understanding: number;
    misconceptions: string[];
  }) {
    const session = this.driver.session();
    try {
      // Update each concept knowledge
      for (const concept of data.concepts) {
        await this.updateConceptKnowledge(userId, concept);
      }

      // Update learning profile
      await session.run(
        `
        MATCH (u:User {id: $userId})-[:HAS]->(lp:LearningProfile)
        SET lp.lastUpdated = datetime()
        `,
        { userId }
      );

      logger.info('Learning profile updated', { userId, conceptsCount: data.concepts.length });
    } catch (error) {
      logger.error('Failed to update learning profile', { error, userId });
      throw error;
    } finally {
      session.close();
    }
  }

  private async updateConceptKnowledge(userId: string, concept: {
    name: string;
    proficiency: number;
    eventType: string;
    details: string;
  }) {
    const session = this.driver.session();
    try {
      // First, ensure the concept exists
      await this.ensureConceptExists(concept.name);

      // Update or create knowledge relationship
      await session.run(
        `
        MATCH (u:User {id: $userId})-[:HAS]->(lp:LearningProfile)
        MATCH (c:Concept {name: $conceptName})
        MERGE (lp)-[k:KNOWS]->(c)
        ON CREATE SET 
          k.proficiency = $proficiency,
          k.confidence = 0.8,
          k.firstSeen = datetime(),
          k.lastUpdated = datetime(),
          k.evidenceCount = 1,
          k.knowledgeStage = $knowledgeStage,
          k.misconceptions = [],
          k.notes = $details
        ON MATCH SET 
          k.proficiency = CASE WHEN $proficiency > k.proficiency THEN $proficiency ELSE k.proficiency END,
          k.lastUpdated = datetime(),
          k.evidenceCount = k.evidenceCount + 1,
          k.knowledgeStage = $knowledgeStage,
          k.notes = k.notes + '\n' + $details
        `,
        {
          userId,
          conceptName: concept.name,
          proficiency: concept.proficiency,
          knowledgeStage: this.getKnowledgeStage(concept.eventType, concept.proficiency),
          details: concept.details
        }
      );

      // Also update topic tracking if concept belongs to topics
      await session.run(
        `
        MATCH (u:User {id: $userId})-[:HAS]->(lp:LearningProfile)
        MATCH (c:Concept {name: $conceptName})
        MATCH (c)-[:BELONGS_TO]->(t:Topic)
        MERGE (lp)-[track:TRACKS]->(t)
        ON CREATE SET 
          track.since = datetime(),
          track.active = true,
          track.priority = 3,
          track.goal = "Learning"
        ON MATCH SET 
          track.active = true
        `,
        { userId, conceptName: concept.name }
      );

      logger.debug('Concept knowledge updated', { userId, conceptName: concept.name, proficiency: concept.proficiency });
    } catch (error) {
      logger.error('Failed to update concept knowledge', { error, userId, conceptName: concept.name });
      throw error;
    } finally {
      session.close();
    }
  }

  private getKnowledgeStage(eventType: string, proficiency: number): string {
    switch (eventType) {
      case "learned":
        return proficiency <= 2 ? "aware" : "learning";
      case "practiced":
        return proficiency <= 3 ? "learning" : "practicing";
      case "confused":
        return "learning";
      case "mastered":
        return "mastered";
      default:
        return proficiency <= 1 ? "aware" :
          proficiency <= 3 ? "learning" :
            proficiency <= 4 ? "practicing" : "mastered";
    }
  }

  // ============= GENERAL GRAPH OPERATIONS =============

  async identifyConceptsInText(text: string): Promise<string[]> {
    const session = this.driver.session();
    try {
      const result = await session.run(
        `
        MATCH (c:Concept)
        WITH c, toLower(c.name) AS lowerName, toLower($text) AS lowerText
        WHERE lowerText CONTAINS lowerName
        RETURN c.name AS name
        `,
        { text }
      );

      return result.records.map(record => record.get('name'));
    } finally {
      session.close();
    }
  }

  async getRelatedConcepts(userId: string, conceptName: string) {
    const session = this.driver.session();
    try {
      const result = await session.run(
        `
        MATCH (c:Concept {name: $conceptName})
        MATCH (c)-[r:RELATED_TO]-(related:Concept)
        OPTIONAL MATCH (u:User {id: $userId})-[:HAS]->(lp:LearningProfile)
        OPTIONAL MATCH (lp)-[k:KNOWS]->(related)
        RETURN 
          c.name AS sourceConcept,
          collect(DISTINCT {
            name: related.name,
            relationshipType: r.relationshipType,
            strength: r.strength,
            contextualNote: r.contextualNote,
            known: k IS NOT NULL,
            proficiency: k.proficiency
          }) AS relatedConcepts
        `,
        { userId, conceptName }
      );

      if (result.records.length === 0) {
        return { sourceConcept: conceptName, relatedConcepts: [] };
      }

      return result.records[0].toObject();
    } finally {
      session.close();
    }
  }

  async getRecommendedNextConcepts(userId: string, topic?: string) {
    const session = this.driver.session();
    try {
      let query = `
        MATCH (u:User {id: $userId})-[:HAS]->(lp:LearningProfile)
        MATCH (c:Concept)
        OPTIONAL MATCH (lp)-[k:KNOWS]->(c)
        WHERE k IS NULL OR k.proficiency < 4
        OPTIONAL MATCH (c)-[:BELONGS_TO]->(t:Topic)
        OPTIONAL MATCH (lp)-[track:TRACKS]->(t)
        WHERE track.active = true OR track IS NULL
      `;

      // If topic is specified, filter by that topic
      if (topic) {
        query += `AND t.name = $topic `;
      }

      query += `
        // Prerequisites check - only recommend concepts where prerequisites are known
        OPTIONAL MATCH (c)<-[p:PREREQUISITE_FOR]-(prereq:Concept)
        OPTIONAL MATCH (lp)-[pk:KNOWS]->(prereq)
        WITH c, t, track, 
             count(DISTINCT p) AS prereqCount,
             count(DISTINCT pk) AS knownPrereqCount
        WHERE prereqCount = knownPrereqCount OR prereqCount = 0
        
        // Score based on topic priority, concept complexity, prerequisite completion
        WITH c, 
             CASE WHEN track IS NULL THEN 3 ELSE track.priority END AS topicPriority,
             CASE WHEN c.complexity IS NULL THEN 3 ELSE c.complexity END AS conceptComplexity
        
        RETURN 
          c.name AS name,
          c.description AS description,
          c.complexity AS complexity,
          c.shortExplanation AS shortExplanation,
          collect(DISTINCT t.name) AS topics,
          topicPriority,
          conceptComplexity,
          (topicPriority * 2) - conceptComplexity AS recommendationScore
        ORDER BY recommendationScore DESC
        LIMIT 5
      `;

      const result = await session.run(query, { userId, topic });

      return result.records.map(record => record.toObject());
    } finally {
      session.close();
    }
  }

  // ============= DATABASE STATS AND UTILITIES =============

  /**
   * Get statistics about the knowledge graph
   */
  async getKnowledgeGraphStats() {
    const session = this.driver.session();
    try {
      const result = await session.run(`
        MATCH (c:Concept) 
        WITH count(c) AS conceptCount
        MATCH (t:Topic)
        WITH conceptCount, count(t) AS topicCount
        MATCH (c:Concept)-[b:BELONGS_TO]->(t:Topic)
        WITH conceptCount, topicCount, count(b) AS belongsToCount
        MATCH (c1:Concept)-[p:PREREQUISITE_FOR]->(c2:Concept)
        WITH conceptCount, topicCount, belongsToCount, count(p) AS prerequisiteCount
        MATCH (c1:Concept)-[r:RELATED_TO]->(c2:Concept)
        RETURN 
          conceptCount, 
          topicCount, 
          belongsToCount, 
          prerequisiteCount, 
          count(r) AS relatedToCount
      `);

      if (result.records.length === 0) {
        return {
          conceptCount: 0,
          topicCount: 0,
          belongsToCount: 0,
          prerequisiteCount: 0,
          relatedToCount: 0
        };
      }

      return result.records[0].toObject();
    } finally {
      session.close();
    }
  }

  /**
   * Clear all data from the database
   * CAUTION: This will delete all data!
   */
  async clearDatabase() {
    const session = this.driver.session();
    try {
      await session.run('MATCH (n) DETACH DELETE n');
      logger.warn('Cleared entire database!');
    } finally {
      session.close();
    }
  }

  async close() {
    await this.driver.close();
    logger.info('Neo4j connection closed');
  }
}