// JSON schemas for Anthropic tool use. Tool use guarantees the model returns
// valid JSON matching these shapes — no markdown-fence stripping or try/catch
// parsing required downstream.

import type { Tool } from "@anthropic-ai/sdk/resources/messages";

export const DIAGNOSIS_TOOL_NAME = "submit_diagnosis";

export const diagnosisTool: Tool = {
  name: DIAGNOSIS_TOOL_NAME,
  description:
    "Submit the structured content quality diagnosis. Must be called exactly once with all scores, signal descriptions, and flagged issues.",
  input_schema: {
    type: "object",
    properties: {
      headline_finding: {
        type: "string",
        description: "One specific sentence naming the exact problem and its consequence."
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
                  specificity: { type: "integer", minimum: 1, maximum: 10 },
                  evidence: { type: "integer", minimum: 1, maximum: 10 },
                  info_density: { type: "integer", minimum: 1, maximum: 10 }
                },
                required: ["specificity", "evidence", "info_density"]
              }
            },
            required: ["score", "description", "dimensions"]
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
                  repetition: { type: "integer", minimum: 1, maximum: 10 },
                  readability: { type: "integer", minimum: 1, maximum: 10 }
                },
                required: ["generic_phrasing", "repetition", "readability"]
              }
            },
            required: ["score", "description", "dimensions"]
          },
          trust: {
            type: "object",
            properties: {
              score: { type: "number" },
              description: { type: "string" },
              dimensions: {
                type: "object",
                properties: {
                  brand_match: { type: "integer", minimum: 1, maximum: 10 },
                  certainty_risk: { type: "integer", minimum: 1, maximum: 10 }
                },
                required: ["brand_match", "certainty_risk"]
              }
            },
            required: ["score", "description", "dimensions"]
          }
        },
        required: ["substance", "style", "trust"]
      },
      issues: {
        type: "array",
        items: {
          type: "object",
          properties: {
            phrase: { type: "string" },
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
                "brand_mismatch"
              ]
            },
            explanation: { type: "string" },
            priority: { type: "string", enum: ["trust", "substance", "style"] },
            char_start: { type: "integer", minimum: 0 },
            char_end: { type: "integer", minimum: 0 }
          },
          required: ["phrase", "category", "explanation", "priority", "char_start", "char_end"]
        }
      }
    },
    required: ["headline_finding", "signals", "issues"]
  }
};

export const CLEANUP_TOOL_NAME = "submit_cleanup";

export const cleanupTool: Tool = {
  name: CLEANUP_TOOL_NAME,
  description:
    "Submit the structured cleanup result. Must be called exactly once with the paragraph array, preserving the original paragraph count.",
  input_schema: {
    type: "object",
    properties: {
      paragraphs: {
        type: "array",
        items: {
          type: "object",
          properties: {
            type: { type: "string", enum: ["clean", "pause"] },
            original: { type: "string" },
            cleaned: { type: ["string", "null"] },
            changes: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  tag: {
                    type: "string",
                    enum: [
                      "tightened",
                      "made_specific",
                      "hedge_removed",
                      "brand_voice",
                      "cliche_removed",
                      "softened",
                      "fact_added"
                    ]
                  },
                  original_phrase: { type: "string" },
                  cleaned_phrase: { type: "string" },
                  explanation: { type: "string" },
                  issue_id: { type: "string" }
                },
                required: ["tag", "original_phrase", "cleaned_phrase", "explanation"]
              }
            },
            pause_card: {
              type: ["object", "null"],
              properties: {
                question: { type: "string" },
                hint: { type: "string" },
                user_answer: { type: ["string", "null"] },
                skipped: { type: "boolean" },
                issue_id: { type: "string" }
              }
            }
          },
          required: ["type", "original", "cleaned", "changes", "pause_card"]
        }
      }
    },
    required: ["paragraphs"]
  }
};

export const CALIBRATE_TOOL_NAME = "submit_calibration";

export const calibrateTool: Tool = {
  name: CALIBRATE_TOOL_NAME,
  description:
    "Submit the inferred brand profile after analyzing writing samples. Identifies tone, language variant, and key phrase lists.",
  input_schema: {
    type: "object",
    properties: {
      profileName: {
        type: "string",
        description: "A professional name for this brand profile (e.g., 'Corporate Tech' or 'Friendly E-commerce')."
      },
      tone: {
        type: "string",
        enum: ["formal", "conversational", "technical", "warm", "direct"],
        description: "The primary stylistic tone inferred from the samples."
      },
      languageVariant: {
        type: "string",
        enum: ["en-US", "en-GB"],
        description: "The detected English variant based on spelling patterns (color vs colour, etc.)."
      },
      approvedPhrases: {
        type: "array",
        items: { type: "string" },
        description: "5-10 key professional terms or preferred phrases identified as high-quality in the samples."
      },
      bannedPhrases: {
        type: "array",
        items: { type: "string" },
        description: "5-10 stylistic artifacts or filler words to avoid, based on the samples' best versions."
      }
    },
    required: ["profileName", "tone", "languageVariant", "approvedPhrases", "bannedPhrases"]
  }
};
