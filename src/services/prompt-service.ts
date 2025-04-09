import { logger } from '../utils/logger.js';

export function formatLearningContext(data: {
  user: any,
  profile: any,
  conceptKnowledge: any[],
  knowledgeGaps: any[],
  recentLearning: any[]
}): string {
  logger.debug('Formatting learning context', {
    user: data.user.id,
    conceptsCount: data.conceptKnowledge.length,
    gapsCount: data.knowledgeGaps.length
  });

  // Format the learning context as a readable text
  return `
# Learning Profile for ${data.user.name}

## Learning Preferences
- Preferred learning style: ${data.user.preferredLearningStyle}
- Default detail level: ${data.user.defaultDetailLevel}

## Knowledge Status
${data.conceptKnowledge.map(concept => `
### ${concept.name}
- Proficiency: ${concept.proficiency || 'Unknown'}/5
- Knowledge stage: ${concept.knowledgeStage || 'Not assessed'}
- First seen: ${concept.firstSeen || 'N/A'}
- Topics: ${concept.topics?.join(', ') || 'None'}
`).join('')}

## Knowledge Gaps
${data.knowledgeGaps.map(gap => `
### For ${gap.conceptName}
${gap.missingPrerequisites.map((prereq: any) => `
- ${prereq.name} (Proficiency: ${prereq.proficiency || 'Not learned'}/5)
  ${prereq.explanation ? `  - ${prereq.explanation}` : ''}
`).join('')}
`).join('')}

## Recent Learning Activities
${data.recentLearning.map(event => `
- ${new Date(event.timestamp).toLocaleString()}: ${event.eventType} - ${event.concepts.join(', ')}
  ${event.details ? `  - ${event.details}` : ''}
`).join('')}

## Learning Goals
${data.profile.learningGoals || 'No specific learning goals set.'}
  `;
}

export function buildSystemPrompt(options: {
  learningStyle: string,
  detailLevel: string,
  includeExamples: boolean,
  relateToFamiliarConcepts: boolean
}): string {
  logger.debug('Building system prompt', options);

  return `
You are acting as a personal programming mentor who adapts to the learner's needs and background. Use their learning profile to tailor your explanations.

## Teaching approach
- Learning style: ${options.learningStyle}
${options.learningStyle === 'visual' ? '  - Use diagrams, visual metaphors, and spatial descriptions' :
      options.learningStyle === 'conceptual' ? '  - Focus on abstract concepts, principles, and mental models' :
        options.learningStyle === 'practical' ? '  - Emphasize hands-on applications, code examples, and practical use cases' :
          '  - Use analogies that relate programming concepts to familiar real-world scenarios'}

- Detail level: ${options.detailLevel}
${options.detailLevel === 'beginner' ? '  - Use simpler explanations with more background context' :
      options.detailLevel === 'standard' ? '  - Balance depth with clarity, avoid excessive jargon' :
        '  - Include deeper technical details, underlying mechanisms, and nuances'}

## Content guidelines
- ${options.includeExamples ? 'Include practical code examples to illustrate concepts' : 'Focus on conceptual explanations more than code examples'}
- ${options.relateToFamiliarConcepts ? 'Connect new concepts to ones the learner already knows' : 'Explain concepts independently without assuming prior knowledge'}
- Consider knowledge gaps identified in the learning profile
- Avoid terminology beyond the learner's current level unless explaining it
- Check for misconceptions in related areas

Respond in a friendly, encouraging tone that builds confidence while maintaining technical accuracy.
  `;
}