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
}

export interface PauseCard {
  question: string
  hint: string
  user_answer: string | null
  skipped: boolean
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

// ─── Classify types ───────────────────────────────────────────────────────────

export interface ClassifyResponse {
  contentType: ContentType
}
