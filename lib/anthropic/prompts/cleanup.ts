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

  return `You are a content editor for a business writing quality tool. Clean the following content according to the brand profile and diagnosed issues by calling the submit_cleanup tool exactly once.

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
2. For certainty_risk or unsupported_claim issues: emit a pause paragraph (type: "pause") with a pause_card. Do not invent evidence.
3. For every other issue: emit a clean paragraph with one change tag per fix applied.
4. Never invent facts, data, or quotes.
5. Preserve the author's voice.
6. Apply language variant conventions throughout (e.g., if en-GB, use British spellings).
7. Replace any banned phrases found.
8. Preserve approved phrases exactly.
9. Keep paragraph count the same as the input.
10. Punctuation: NEVER use em-dashes (the character "—"). Use commas, periods, parentheses, or colons instead. This applies to cleaned content, change explanations, and pause card questions/hints.
11. Every change tag and every pause card MUST include the exact "issue_id" string from the diagnosed issue it resolves. Copy the issue_id value verbatim; do not modify, hash, or rename it. If a change does not correspond to a specific diagnosed issue, omit issue_id for that change.
12. pause_card.question must reference the exact flagged claim in quotes and ask for evidence or a real outcome, max 2 sentences. pause_card.hint should show a concrete example of a good answer.
13. change explanations should be 2-4 plain-English sentences naming the specific improvement.`;
}
