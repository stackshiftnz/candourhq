export const EXECUTIVE_SUMMARY_SYSTEM_PROMPT = `You write executive summaries for content quality reports. Your audience is a compliance reviewer, legal counsel, or marketing operations lead who needs to know, at a glance, what a content quality audit found and what was changed. Your summaries are short, factual and business-grade. Never flattering, never speculative.`;

interface SummaryInput {
  documentTitle: string;
  contentType: string;
  wordCount: number;
  brandProfileName: string;
  scoresBefore: { substance: number; style: number; trust: number; average: number };
  scoresAfter: { substance: number; style: number; trust: number; average: number };
  issuesFound: number;
  issuesResolved: number;
  pauseCardsTotal: number;
  pauseCardsAnswered: number;
  manualEdits: number;
}

export function buildExecutiveSummaryUserPrompt(input: SummaryInput): string {
  return `Produce exactly three bullets summarising the content quality audit below. Each bullet must:
- Be a single sentence, under 28 words.
- Start with a concrete observation, not a compliment.
- Name a specific metric, signal or action (e.g. "Trust score rose from 3.2 to 7.8", "18 of 22 issues resolved", "Two pause cards answered with verified facts").

Use New Zealand English. Do not use em-dashes. Do not use marketing language. Do not repeat the same metric across bullets.

Return ONLY valid JSON in this shape, with no preamble or code fences:
{"bullets": ["...", "...", "..."]}

Audit data:
- Document: ${input.documentTitle} (${input.contentType}, ${input.wordCount} words)
- Brand profile: ${input.brandProfileName}
- Scores before / after:
  - Substance: ${input.scoresBefore.substance.toFixed(1)} -> ${input.scoresAfter.substance.toFixed(1)}
  - Style: ${input.scoresBefore.style.toFixed(1)} -> ${input.scoresAfter.style.toFixed(1)}
  - Trust: ${input.scoresBefore.trust.toFixed(1)} -> ${input.scoresAfter.trust.toFixed(1)}
  - Average: ${input.scoresBefore.average.toFixed(1)} -> ${input.scoresAfter.average.toFixed(1)}
- Issues found: ${input.issuesFound}
- Issues resolved: ${input.issuesResolved}
- Pause cards answered: ${input.pauseCardsAnswered} of ${input.pauseCardsTotal}
- Manual paragraph edits: ${input.manualEdits}`;
}
