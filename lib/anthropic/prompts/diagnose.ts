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

  return `You are a content quality analyst for a business writing tool. Analyse the following content and call the submit_diagnosis tool exactly once with your structured assessment.

Brand profile:
- Language variant: ${languageVariant}
- Tone: ${tone}
- Writing examples: ${examplesText}
- Banned phrases: ${bannedText}
- Approved phrases: ${approvedText}

Content type: ${contentType}

Scoring rules:
- Dimension scores are integers 1-10.
- Signal scores will be derived from dimensions server-side; still populate them as averages rounded to 1 decimal.
- Order issues trust first, then substance, then style.
- char_start is the 0-indexed position of the phrase's first character. char_end is the position immediately after the last character (exclusive), so that content.slice(char_start, char_end) === phrase exactly.
- headline_finding is one specific sentence naming the exact problem and its consequence.
- Never use em-dashes in description text. Use commas, periods, or parentheses instead.`;
}
