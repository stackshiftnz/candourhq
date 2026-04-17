import { ContentType, LanguageVariant } from "../types";

export interface DiagnosePromptOptions {
  languageVariant: LanguageVariant;
  tone: string;
  writingExamples: string[];
  bannedPhrases: string[];
  approvedPhrases: string[];
  contentType: ContentType;
}

export function getDiagnoseSystemPrompt(options: DiagnosePromptOptions) {
  const {
    languageVariant,
    tone,
    writingExamples,
    bannedPhrases,
    approvedPhrases,
    contentType,
  } = options;

  const examplesText = writingExamples.length ? writingExamples.join("\n---\n") : "None provided";
  const bannedText = bannedPhrases.length ? bannedPhrases.join(", ") : "None";
  const approvedText = approvedPhrases.length ? approvedPhrases.join(", ") : "None";

  return `You are a content quality analyst for a business writing tool. Analyse the following content and return a JSON diagnosis.

Brand profile:
- Language variant: ${languageVariant}
- Tone: ${tone}
- Writing examples: ${examplesText}
- Banned phrases: ${bannedText}
- Approved phrases: ${approvedText}

Content type: ${contentType}

Return ONLY valid JSON — no preamble, no markdown fences:
{
  "headline_finding": "one specific sentence naming the exact problem and its consequence",
  "signals": {
    "substance": { "score": 0.0, "description": "...", "dimensions": { "specificity": 0, "evidence": 0, "info_density": 0 } },
    "style": { "score": 0.0, "description": "...", "dimensions": { "generic_phrasing": 0, "repetition": 0, "readability": 0 } },
    "trust": { "score": 0.0, "description": "...", "dimensions": { "brand_match": 0, "certainty_risk": 0 } }
  },
  "issues": [
    { "phrase": "exact phrase", "category": "...", "explanation": "...", "priority": "trust|substance|style", "char_start": 0, "char_end": 0 }
  ]
}

Rules: scores are integers 1-10. Signal scores are averages of dimensions rounded to 1 decimal. Issues ordered trust first then substance then style. char_start/char_end are character positions in the original content.`;
}
