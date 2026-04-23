// Scoring function definition for OpenAI function calling.
// Mirrors the Anthropic diagnosisTool schema from lib/anthropic/tool-schemas.ts.

export const SCORING_FUNCTION_NAME = "submit_diagnosis";

export const scoringFunction = {
  name: SCORING_FUNCTION_NAME,
  description:
    "Submit the structured content quality diagnosis. Call exactly once with all scores, signal descriptions, and flagged issues.",
  parameters: {
    type: "object" as const,
    properties: {
      headline_finding: {
        type: "string",
        description: "One specific sentence naming the exact problem and its consequence.",
      },
      signals: {
        type: "object",
        properties: {
          substance: {
            type: "object",
            properties: {
              score: { type: "number" },
              description: { type: "string" },
              dimensions: {
                type: "object",
                properties: {
                  specificity:  { type: "integer", minimum: 1, maximum: 10 },
                  evidence:     { type: "integer", minimum: 1, maximum: 10 },
                  info_density: { type: "integer", minimum: 1, maximum: 10 },
                },
                required: ["specificity", "evidence", "info_density"],
              },
            },
            required: ["score", "description", "dimensions"],
          },
          style: {
            type: "object",
            properties: {
              score: { type: "number" },
              description: { type: "string" },
              dimensions: {
                type: "object",
                properties: {
                  generic_phrasing: { type: "integer", minimum: 1, maximum: 10 },
                  repetition:       { type: "integer", minimum: 1, maximum: 10 },
                  readability:      { type: "integer", minimum: 1, maximum: 10 },
                },
                required: ["generic_phrasing", "repetition", "readability"],
              },
            },
            required: ["score", "description", "dimensions"],
          },
          trust: {
            type: "object",
            properties: {
              score: { type: "number" },
              description: { type: "string" },
              dimensions: {
                type: "object",
                properties: {
                  brand_match:    { type: "integer", minimum: 1, maximum: 10 },
                  certainty_risk: { type: "integer", minimum: 1, maximum: 10 },
                },
                required: ["brand_match", "certainty_risk"],
              },
            },
            required: ["score", "description", "dimensions"],
          },
        },
        required: ["substance", "style", "trust"],
      },
      issues: {
        type: "array",
        items: {
          type: "object",
          properties: {
            phrase:      { type: "string" },
            category: {
              type: "string",
              enum: [
                "certainty_risk",
                "unsupported_claim",
                "low_specificity",
                "low_density",
                "no_evidence",
                "ai_cliche",
                "redundant_list",
                "repetition",
                "generic_phrasing",
                "brand_mismatch",
              ],
            },
            explanation: { type: "string" },
            priority:    { type: "string", enum: ["trust", "substance", "style"] },
            char_start:  { type: "integer", minimum: 0 },
            char_end:    { type: "integer", minimum: 0 },
          },
          required: ["phrase", "category", "explanation", "priority", "char_start", "char_end"],
        },
      },
    },
    required: ["headline_finding", "signals", "issues"],
  },
};
