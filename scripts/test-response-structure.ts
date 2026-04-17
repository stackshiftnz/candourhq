import { CleanupResponse } from "../lib/anthropic/types";

const mockResponse: CleanupResponse = {
  paragraphs: [
    {
      type: "clean",
      original: "This is some original text.",
      cleaned: "This is some cleaner text.",
      changes: [
        {
          tag: "tightened",
          original_phrase: "original text",
          cleaned_phrase: "cleaner text",
          explanation: "Removed unnecessary complexity."
        }
      ],
      pause_card: null
    },
    {
      type: "pause",
      original: "We are the best.",
      cleaned: null,
      changes: [],
      pause_card: {
        question: "How are you the best?",
        hint: "Example: Market share data.",
        user_answer: null,
        skipped: false
      }
    }
  ]
};

console.log("CleanupResponse Structure Check:");
console.log(JSON.stringify(mockResponse, null, 2));

const isValid = mockResponse.paragraphs.every(p => {
  if (p.type === 'clean') return p.cleaned !== null && p.changes.length > 0;
  if (p.type === 'pause') return p.pause_card !== null && p.cleaned === null;
  return false;
});

console.log(`Validation result: ${isValid ? "✅ Valid" : "❌ Invalid"}`);
