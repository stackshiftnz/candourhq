// Shared TypeScript types for Anthropic API request/response shapes.
// Safe to import in both server and client code — contains no secrets.

// ─── Union types ─────────────────────────────────────────────────────────────

export type IssueCategory =
  | 'certainty_risk'
  | 'unsupported_claim'
  | 'low_specificity'
  | 'low_density'
  | 'no_evidence'
  | 'ai_cliche'
  | 'redundant_list'
  | 'repetition'
  | 'generic_phrasing'
  | 'brand_mismatch'

export type IssuePriority = 'trust' | 'substance' | 'style'

export type ContentType =
  | 'blog_post'
  | 'email'
  | 'report'
  | 'proposal'
  | 'press_release'
  | 'social_post'
  | 'memo'

export type Tone = 'formal' | 'conversational' | 'technical' | 'warm' | 'direct'

export type LanguageVariant = 'en-US' | 'en-GB'

export type RefinementAmbition = 'conservative' | 'transformative'

export type ChangeTagType =
  | 'tightened'
  | 'made_specific'
  | 'hedge_removed'
  | 'brand_voice'
  | 'cliche_removed'
  | 'softened'
  | 'fact_added'

// ─── Diagnosis types ──────────────────────────────────────────────────────────

export interface DiagnosisIssue {
  phrase: string
  category: IssueCategory
  explanation: string
  priority: IssuePriority
  char_start: number
  char_end: number
  // Deterministic identifier computed server-side as `${priority}-${char_start}-${char_end}`.
  // Used to match changes and pause-card resolutions back to the issue that spawned them,
  // without relying on fuzzy string matching of `phrase` / `original_phrase`.
  // Optional for backwards-compat with diagnoses persisted before this field was added.
  issue_id?: string
}

export interface DiagnosisSignal {
  score: number
  description: string
  dimensions: Record<string, number>
}

export interface DiagnosisResponse {
  headline_finding: string
  signals: {
    substance: DiagnosisSignal
    style: DiagnosisSignal
    trust: DiagnosisSignal
  }
  issues: DiagnosisIssue[]
}

// ─── Cleanup types ────────────────────────────────────────────────────────────

export interface ChangeTag {
  tag: ChangeTagType
  original_phrase: string
  cleaned_phrase: string
  explanation: string
  // Links this change back to the DiagnosisIssue it resolves. Optional for backwards-compat.
  issue_id?: string
}

export interface PauseCard {
  question: string
  hint: string
  user_answer: string | null
  skipped: boolean
  // Links this pause card back to the DiagnosisIssue it addresses. Optional for backwards-compat.
  issue_id?: string
}

export interface CleanupParagraph {
  type: 'clean' | 'pause'
  original: string
  cleaned: string | null
  changes: ChangeTag[]
  pause_card: PauseCard | null
}

export interface CleanupResponse {
  paragraphs: CleanupParagraph[]
}

// ─── Calibrate types ─────────────────────────────────────────────────────────

export interface CalibrateResponse {
  profileName: string
  tone: Tone
  languageVariant: LanguageVariant
  approvedPhrases: string[]
  bannedPhrases: string[]
}
