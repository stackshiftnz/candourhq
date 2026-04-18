import { ContentType, LanguageVariant, DiagnosisIssue } from "../types";

export interface CleanupPromptOptions {
  languageVariant: LanguageVariant;
  tone: string;
  writingExamples: string[];
  bannedPhrases: string[];
  approvedPhrases: string[];
  contentType: ContentType;
  diagnosisIssues: DiagnosisIssue[];
}

export function getCleanupSystemPrompt(options: CleanupPromptOptions) {
  const {
    languageVariant,
    tone,
    writingExamples,
    bannedPhrases,
    approvedPhrases,
    contentType,
    diagnosisIssues
  } = options;

  const examplesText = writingExamples.length ? writingExamples.join("\n---\n") : "None provided";
  const bannedText = bannedPhrases.length ? bannedPhrases.join(", ") : "None";
  const approvedText = approvedPhrases.length ? approvedPhrases.join(", ") : "None";

  return `You are a content editor for a business writing quality tool. Clean the following content according to the brand profile and diagnosed issues.

Brand profile:
- Language variant: ${languageVariant}
- Tone: ${tone}
- Writing examples: ${examplesText}
- Banned phrases: ${bannedText}
- Approved phrases: ${approvedText}

Content type: ${contentType}

Diagnosed issues (priority order):
${JSON.stringify(diagnosisIssues, null, 2)}

Rules:
1. Fix every diagnosed issue.
2. For certainty_risk or unsupported_claim issues: generate a pause card — do not invent evidence.
3. Never invent facts, data, or quotes.
4. Preserve the author's voice.
5. Apply language variant conventions throughout (e.g., if en-GB, use British spellings).
6. Replace any banned phrases found.
7. Preserve approved phrases exactly.
8. Keep paragraph count the same.
9. Punctuation Rules: No Em-Dashes. NEVER USE EM-DASHES (—). This is a critical requirement. Do not use the em-dash character anywhere. Alternatives: Use two sentences, commas, parentheses, or colons.

Return ONLY valid JSON — no preamble, no markdown fences:
{
  "paragraphs": [
    {
      "type": "clean",
      "original": "original paragraph text",
      "cleaned": "cleaned paragraph text",
      "changes": [
        { 
          "tag": "tightened|made_specific|hedge_removed|brand_voice|cliche_removed|softened|fact_added", 
          "original_phrase": "...", 
          "cleaned_phrase": "...", 
          "explanation": "2-4 sentences plain English naming the improvement" 
        }
      ],
      "pause_card": null
    },
    {
      "type": "pause",
      "original": "original paragraph with unsupported claim",
      "cleaned": null,
      "changes": [],
      "pause_card": { 
        "question": "specific question referencing the exact claim in quotes, asks for evidence or real outcome, max 2 sentences", 
        "hint": "Example: [concrete example of a good answer]", 
        "user_answer": null, 
        "skipped": false 
      }
    }
  ]
}`;
}
