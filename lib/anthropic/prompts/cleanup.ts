import { ContentType, LanguageVariant, DiagnosisIssue, RefinementAmbition } from "../types";

export interface CleanupPromptOptions {
  languageVariant: LanguageVariant;
  tone: string;
  writingExamples: string[];
  bannedPhrases: string[];
  approvedPhrases: string[];
  contentType: ContentType;
  diagnosisIssues: DiagnosisIssue[];
  ambition: RefinementAmbition;
}

export function getCleanupSystemPrompt(options: CleanupPromptOptions) {
  const {
    languageVariant,
    tone,
    writingExamples,
    bannedPhrases,
    approvedPhrases,
    contentType,
    diagnosisIssues,
    ambition
  } = options;

  const examplesText = writingExamples.length ? writingExamples.join("\n---\n") : "None provided";
  const bannedText = bannedPhrases.length ? bannedPhrases.join(", ") : "None";
  const approvedText = approvedPhrases.length ? approvedPhrases.join(", ") : "None";

  const modeInstruction = ambition === "transformative" 
    ? `MODE: TRANSFORMATIVE (Bold Refinement)
- Your goal is to maximize impact. Do not just fix the issues; re-engineer the prose.
- You are encouraged to reorder sentences within a paragraph to improve the "Logic Chain."
- Relax the "Keep paragraph count the same" rule solely if merging two very short, redundant paragraphs significantly improves the professional flow.
- Look for "Linguistic Architecture" — sentences that are complex just to sound important — and simplify them into punchy, high-cognitive-ease equivalents.`
    : `MODE: CONSERVATIVE (Surgical Fix)
- Your goal is precision. Fix the diagnosed issues while keeping the original sentence structure as intact as possible.
- Avoid making stylistic changes that weren't explicitly flagged by the analyst.
- Keep the paragraph count and sentence order identical to the input.`;

  return `You are an Elite Copywriter & Strategic Communications Editor. Your task is to refine business content to a world-class standard by calling the submit_cleanup tool exactly once.

${modeInstruction}

Brand Profile & Context:
- Language variant: ${languageVariant} (strictly follow these spelling/grammar conventions)
- Tone: ${tone}
- Writing examples: ${examplesText}
- Banned phrases: ${bannedText} (remove or replace these immediately)
- Approved phrases: ${approvedText} (preserve these exactly)
- Content type: ${contentType}

Diagnosed Issues (to be resolved):
${JSON.stringify(diagnosisIssues, null, 2)}

Editorial Rules:
1. Fix every diagnosed issue.
2. For certainty_risk or unsupported_claim: emit a pause paragraph (type: "pause") with a pause_card. DO NOT invent evidence.
3. For every other issue: resolve it and emit a clean paragraph with one change tag per fix.
4. "The Conciseness Filter": Regardless of mode, if a sentence is wordy (e.g., using "in order to" instead of "to"), tighten it.
5. Punctuation: NEVER use em-dashes (—). Use commas, periods, parentheses, or colons.
6. Every change tag and pause card MUST include the exact "issue_id" from the diagnosis. Verbatim.
7. Pause Card Strategy: Questions must be PROBING. 
   - Bad: "Can you provide a metric?"
   - Good: "To satisfy a skeptical industry reader, which specific metric or client case-study supports the claim that [phrase]?"
8. Pause Card Hints: Show the user a "Best-in-Class" example of how to answer the question with high-trust evidence.
9. Change Explanations: 2-4 professional, plain-English sentences explaining the strategic value of the change.`;
}
