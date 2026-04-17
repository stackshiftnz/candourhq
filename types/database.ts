// Auto-generated types for Candour HQ Supabase schema.
// Regenerate with: npx supabase gen types typescript --project-id <id> > types/database.ts

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

// ---------------------------------------------------------------------------
// JSONB column types
// ---------------------------------------------------------------------------

export interface DiagnosisIssue {
  phrase: string
  category:
    | 'certainty_risk'
    | 'unsupported_claim'
    | 'low_specificity'
    | 'low_density'
    | 'no_evidence'
    | 'ai_cliche'
    | 'redundant_list'
    | 'repetition'
    | 'brand_mismatch'
  explanation: string
  priority: 'trust' | 'substance' | 'style'
  char_start: number
  char_end: number
}

export interface ChangeTag {
  tag:
    | 'tightened'
    | 'made_specific'
    | 'hedge_removed'
    | 'brand_voice'
    | 'cliche_removed'
    | 'softened'
    | 'fact_added'
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

export interface UserEdit {
  paragraph_index: number
  original_cleaned: string
  user_version: string
  edited_at: string
}

export interface SampleEventMetadata {
  tab?: string
  tag?: string
  [key: string]: Json | undefined
}

// ---------------------------------------------------------------------------
// Database table types
// ---------------------------------------------------------------------------

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string
          full_name: string | null
          email: string | null
          avatar_url: string | null
          onboarding_completed: boolean
          onboarding_step: number
          default_brand_profile_id: string | null
          plan: string
          trial_ends_at: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id: string
          full_name?: string | null
          email?: string | null
          avatar_url?: string | null
          onboarding_completed?: boolean
          onboarding_step?: number
          default_brand_profile_id?: string | null
          plan?: string
          trial_ends_at?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          full_name?: string | null
          email?: string | null
          avatar_url?: string | null
          onboarding_completed?: boolean
          onboarding_step?: number
          default_brand_profile_id?: string | null
          plan?: string
          trial_ends_at?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      brand_profiles: {
        Row: {
          id: string
          user_id: string
          name: string
          language_variant: string
          tone: string
          writing_examples: string[]
          banned_phrases: string[]
          approved_phrases: string[]
          is_default: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          name?: string
          language_variant?: string
          tone?: string
          writing_examples?: string[]
          banned_phrases?: string[]
          approved_phrases?: string[]
          is_default?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          name?: string
          language_variant?: string
          tone?: string
          writing_examples?: string[]
          banned_phrases?: string[]
          approved_phrases?: string[]
          is_default?: boolean
          created_at?: string
          updated_at?: string
        }
      }
      workspaces: {
        Row: {
          id: string
          name: string
          owner_id: string
          plan: string
          require_approval_before_export: boolean
          minimum_score_to_export: boolean
          minimum_score_threshold: number
          notify_on_submission: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          name: string
          owner_id: string
          plan?: string
          require_approval_before_export?: boolean
          minimum_score_to_export?: boolean
          minimum_score_threshold?: number
          notify_on_submission?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          name?: string
          owner_id?: string
          plan?: string
          require_approval_before_export?: boolean
          minimum_score_to_export?: boolean
          minimum_score_threshold?: number
          notify_on_submission?: boolean
          created_at?: string
          updated_at?: string
        }
      }
      team_members: {
        Row: {
          id: string
          workspace_id: string
          user_id: string
          role: string
          joined_at: string
        }
        Insert: {
          id?: string
          workspace_id: string
          user_id: string
          role?: string
          joined_at?: string
        }
        Update: {
          id?: string
          workspace_id?: string
          user_id?: string
          role?: string
          joined_at?: string
        }
      }
      team_invitations: {
        Row: {
          id: string
          workspace_id: string
          invited_email: string
          role: string
          invited_by: string
          status: string
          created_at: string
          accepted_at: string | null
        }
        Insert: {
          id?: string
          workspace_id: string
          invited_email: string
          role?: string
          invited_by: string
          status?: string
          created_at?: string
          accepted_at?: string | null
        }
        Update: {
          id?: string
          workspace_id?: string
          invited_email?: string
          role?: string
          invited_by?: string
          status?: string
          created_at?: string
          accepted_at?: string | null
        }
      }
      documents: {
        Row: {
          id: string
          user_id: string
          brand_profile_id: string | null
          workspace_id: string | null
          title: string | null
          content_type: string
          original_content: string
          word_count: number | null
          language_variant: string
          status: string
          submitted_for_approval_at: string | null
          submitted_by: string | null
          approved_at: string | null
          approved_by: string | null
          approval_note: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          brand_profile_id?: string | null
          workspace_id?: string | null
          title?: string | null
          content_type?: string
          original_content: string
          word_count?: number | null
          language_variant?: string
          status?: string
          submitted_for_approval_at?: string | null
          submitted_by?: string | null
          approved_at?: string | null
          approved_by?: string | null
          approval_note?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          brand_profile_id?: string | null
          workspace_id?: string | null
          title?: string | null
          content_type?: string
          original_content?: string
          word_count?: number | null
          language_variant?: string
          status?: string
          submitted_for_approval_at?: string | null
          submitted_by?: string | null
          approved_at?: string | null
          approved_by?: string | null
          approval_note?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      diagnoses: {
        Row: {
          id: string
          document_id: string
          headline_finding: string
          substance_score: number
          substance_desc: string | null
          specificity_score: number
          evidence_score: number
          info_density_score: number
          style_score: number
          style_desc: string | null
          generic_phrasing_score: number
          repetition_score: number
          readability_score: number
          trust_score: number
          trust_desc: string | null
          brand_match_score: number
          certainty_risk_score: number
          average_score_original: number
          substance_score_final: number | null
          style_score_final: number | null
          trust_score_final: number | null
          average_score_final: number | null
          issues: DiagnosisIssue[]
          issue_count: number
          created_at: string
        }
        Insert: {
          id?: string
          document_id: string
          headline_finding: string
          substance_score: number
          substance_desc?: string | null
          specificity_score: number
          evidence_score: number
          info_density_score: number
          style_score: number
          style_desc?: string | null
          generic_phrasing_score: number
          repetition_score: number
          readability_score: number
          trust_score: number
          trust_desc?: string | null
          brand_match_score: number
          certainty_risk_score: number
          average_score_original: number
          substance_score_final?: number | null
          style_score_final?: number | null
          trust_score_final?: number | null
          average_score_final?: number | null
          issues?: DiagnosisIssue[]
          issue_count?: number
          created_at?: string
        }
        Update: {
          id?: string
          document_id?: string
          headline_finding?: string
          substance_score?: number
          substance_desc?: string | null
          specificity_score?: number
          evidence_score?: number
          info_density_score?: number
          style_score?: number
          style_desc?: string | null
          generic_phrasing_score?: number
          repetition_score?: number
          readability_score?: number
          trust_score?: number
          trust_desc?: string | null
          brand_match_score?: number
          certainty_risk_score?: number
          average_score_original?: number
          substance_score_final?: number | null
          style_score_final?: number | null
          trust_score_final?: number | null
          average_score_final?: number | null
          issues?: DiagnosisIssue[]
          issue_count?: number
          created_at?: string
        }
      }
      cleanups: {
        Row: {
          id: string
          document_id: string
          diagnosis_id: string
          paragraphs: CleanupParagraph[]
          issues_total: number
          issues_resolved: number
          pause_cards_total: number
          pause_cards_answered: number
          user_edits: UserEdit[]
          final_content: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          document_id: string
          diagnosis_id: string
          paragraphs?: CleanupParagraph[]
          issues_total?: number
          issues_resolved?: number
          pause_cards_total?: number
          pause_cards_answered?: number
          user_edits?: UserEdit[]
          final_content?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          document_id?: string
          diagnosis_id?: string
          paragraphs?: CleanupParagraph[]
          issues_total?: number
          issues_resolved?: number
          pause_cards_total?: number
          pause_cards_answered?: number
          user_edits?: UserEdit[]
          final_content?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      sample_content: {
        Row: {
          id: string
          title: string
          content: string
          content_type: string
          language_variant: string
          diagnosis: Json
          cleaned_version: string
          paragraphs: CleanupParagraph[]
          is_active: boolean
          created_at: string
        }
        Insert: {
          id?: string
          title: string
          content: string
          content_type?: string
          language_variant?: string
          diagnosis: Json
          cleaned_version: string
          paragraphs?: CleanupParagraph[]
          is_active?: boolean
          created_at?: string
        }
        Update: {
          id?: string
          title?: string
          content?: string
          content_type?: string
          language_variant?: string
          diagnosis?: Json
          cleaned_version?: string
          paragraphs?: CleanupParagraph[]
          is_active?: boolean
          created_at?: string
        }
      }
      sample_events: {
        Row: {
          id: string
          user_id: string
          event_type: string
          metadata: SampleEventMetadata | null
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          event_type: string
          metadata?: SampleEventMetadata | null
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          event_type?: string
          metadata?: SampleEventMetadata | null
          created_at?: string
        }
      }
    }
    Views: Record<string, never>
    Functions: Record<string, never>
    Enums: Record<string, never>
  }
}
