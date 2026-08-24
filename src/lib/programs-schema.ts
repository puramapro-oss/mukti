// MUKTI — Schéma de validation pour génération programme Opus
// Extrait de programs.ts pour respecter max-lines

/** Le schéma JSON imposé à Opus pour garantir la structure du programme. */
export const PROGRAM_TOOL_SCHEMA = {
  name: 'produce_program',
  description: 'Retourne le programme de libération structuré en JSON strict.',
  input_schema: {
    type: 'object' as const,
    required: [
      'addiction_type',
      'severity',
      'intention',
      'phases',
      'micro_meditations',
      'affirmations',
      'recommended_modes',
      'plants_info',
      'anti_pulsion_actions',
      'breathing_protocols',
      'hypnose_scripts',
      'risk_triggers',
      'success_markers',
      'emergency_message',
    ],
    properties: {
      addiction_type: { type: 'string' },
      severity: { type: 'integer', minimum: 1, maximum: 5 },
      intention: { type: 'string' },
      phases: {
        type: 'array',
        minItems: 3,
        maxItems: 3,
        items: {
          type: 'object',
          required: ['name', 'days_range', 'intent', 'daily_rituals', 'recommended_modes', 'affirmations'],
          properties: {
            name: { type: 'string' },
            days_range: { type: 'string' },
            intent: { type: 'string' },
            daily_rituals: {
              type: 'array',
              items: {
                type: 'object',
                required: ['moment', 'title', 'duration_sec', 'description'],
                properties: {
                  moment: { type: 'string', enum: ['reveil', 'midi', 'soir', 'nuit'] },
                  title: { type: 'string' },
                  duration_sec: { type: 'integer', minimum: 10, maximum: 1800 },
                  description: { type: 'string' },
                },
              },
            },
            recommended_modes: { type: 'array', items: { type: 'string' } },
            affirmations: { type: 'array', items: { type: 'string' } },
          },
        },
      },
      micro_meditations: {
        type: 'array',
        minItems: 4,
        items: {
          type: 'object',
          required: ['trigger', 'title', 'script', 'duration_sec'],
          properties: {
            trigger: { type: 'string', enum: ['reveil', 'midi', 'soir', 'pulsion', 'stress', 'fatigue'] },
            title: { type: 'string' },
            script: { type: 'string' },
            duration_sec: { type: 'integer', minimum: 10, maximum: 60 },
          },
        },
      },
      affirmations: { type: 'array', minItems: 10, items: { type: 'string' } },
      recommended_modes: { type: 'array', items: { type: 'string' } },
      plants_info: {
        type: 'array',
        items: {
          type: 'object',
          required: ['name', 'benefits', 'disclaimer'],
          properties: {
            name: { type: 'string' },
            latin_name: { type: ['string', 'null'] },
            benefits: { type: 'string' },
            disclaimer: { type: 'string' },
          },
        },
      },
      anti_pulsion_actions: {
        type: 'array',
        items: {
          type: 'object',
          required: ['situation', 'action', 'duration_sec'],
          properties: {
            situation: { type: 'string' },
            action: { type: 'string' },
            duration_sec: { type: 'integer', minimum: 5, maximum: 600 },
          },
        },
      },
      breathing_protocols: {
        type: 'array',
        items: {
          type: 'object',
          required: ['name', 'pattern', 'description'],
          properties: {
            name: { type: 'string' },
            pattern: { type: 'string' },
            description: { type: 'string' },
          },
        },
      },
      hypnose_scripts: {
        type: 'array',
        items: {
          type: 'object',
          required: ['title', 'duration_min', 'script'],
          properties: {
            title: { type: 'string' },
            duration_min: { type: 'number', minimum: 1, maximum: 30 },
            script: { type: 'string' },
          },
        },
      },
      risk_triggers: { type: 'array', items: { type: 'string' } },
      success_markers: { type: 'array', items: { type: 'string' } },
      emergency_message: { type: 'string' },
    },
  },
}
