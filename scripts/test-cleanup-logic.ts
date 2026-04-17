import { getCleanupSystemPrompt } from "../lib/anthropic/prompts/cleanup";
import { DiagnosisIssue } from "../lib/anthropic/types";

const mockIssues: DiagnosisIssue[] = [
  {
    phrase: "We are the best in the market",
    category: "unsupported_claim",
    explanation: "This is a bold claim without evidence.",
    priority: "substance",
    char_start: 10,
    char_end: 38
  },
  {
    phrase: "leveraging synergies",
    category: "ai_cliche",
    explanation: "Generic corporate jargon.",
    priority: "style",
    char_start: 45,
    char_end: 65
  }
];

const prompt = getCleanupSystemPrompt({
  languageVariant: "en-GB",
  tone: "direct",
  writingExamples: [],
  bannedPhrases: ["synergy"],
  approvedPhrases: ["Candour"],
  contentType: "blog_post",
  diagnosisIssues: mockIssues
});

console.log("--- SYSTEM PROMPT ---");
console.log(prompt);

console.log("\n--- VERIFICATION ---");
const hasBritishRule = prompt.includes("British spellings");
const hasJSONRule = prompt.includes("Return ONLY valid JSON");
const hasPauseRule = prompt.includes("generate a pause card");

console.log(`Has British Rule: ${hasBritishRule ? "✅" : "❌"}`);
console.log(`Has JSON Rule: ${hasJSONRule ? "✅" : "❌"}`);
console.log(`Has Pause Rule: ${hasPauseRule ? "✅" : "❌"}`);
