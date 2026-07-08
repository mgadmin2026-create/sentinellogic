// Zentrale TypeScript-Typen für Sentinel Logic
// Neue Struktur: Kontakte (statt Leads) mit Opportunities & Tasks

export type ContactStatus = 'new' | 'contacted' | 'qualified' | 'customer'
export type LeadStatus = ContactStatus // Backward compat
export type LeadSource = 'facebook' | 'tiktok' | 'manual' | 'klicktipp'

export type ActivityType = 'sync' | 'research' | 'ai_prep' | 'status_change' | 'task_created' | 'task_completed' | 'opportunity_created' | 'opportunity_updated'

export type OpportunityStatus = 'neu' | 'kontaktiert' | 'analyse' | 'angebot' | 'nachfassen' | 'kunde'
export type TaskStatus = 'offen' | 'in_bearbeitung' | 'erledigt'
export type TaskPriority = 'niedrig' | 'mittel' | 'hoch'

// ── Kontakt (früher Lead) ──────────────────────────────
export interface Contact {
  id: string
  created_at: string
  source: LeadSource
  first_name: string
  last_name: string
  email: string
  phone_mobile?: string
  phone_office?: string
  company_name?: string
  status: ContactStatus
  assigned_user_id?: string
  qualität?: string
  bestandskunde?: boolean
  klicktipp_id?: string
  klicktipp_tags?: string[]
  klicktipp_last_sync?: string
  dialfire_id?: string
  notes?: string
  notes_updated_at?: string
  // Pipeline
  pipeline_stage?: string
  pipeline_steps?: Array<{ key: string; done: boolean; completed_at?: string; due_date?: string }>
}

// Backward-Compatibility
export type Lead = Contact

// ── User (Verantwortlicher) ────────────────────────────
export interface User {
  id: string
  created_at: string
  email: string
  name: string
  active: boolean
}

// ── Opportunity (Verkaufschance) ───────────────────────
export interface Opportunity {
  id: string
  created_at: string
  updated_at: string
  contact_id: string
  thema: string
  status: OpportunityStatus
  wert?: number
  nächster_schritt?: string
  fällig?: string
  notizen?: string
}

// ── Task (Aufgabe) ─────────────────────────────────────
export interface Task {
  id: string
  created_at: string
  updated_at: string
  contact_id: string
  opportunity_id?: string
  assigned_user_id?: string
  created_by_user_id?: string
  titel: string
  beschreibung?: string
  status: TaskStatus
  priorität: TaskPriority
  fällig: string
  erledigt_am?: string
  triggered_by_rule?: string
  triggered_by_process_step?: string
}

export interface Customer {
  id: string
  lead_id: string
  created_at: string
  hidrive_folder_url?: string
  amisnow_id?: string
}

export interface Activity {
  id: string
  lead_id: string
  created_at: string
  type: ActivityType
  description: string
  data?: Record<string, unknown>
}

// Gewerbedaten vom Recherche-Bot
export interface ResearchData {
  company_name?: string
  industry?: string
  address?: string
  employee_count?: number
  founded_year?: number
  website?: string
  raw?: string
}

// Facebook Lead Ads Payload
export interface FacebookLeadPayload {
  object: string
  entry: FacebookLeadEntry[]
}

export interface FacebookLeadEntry {
  id: string
  time: number
  changes: FacebookLeadChange[]
}

export interface FacebookLeadChange {
  value: {
    leadgen_id: string
    page_id: string
    form_id: string
    ad_id: string
    ad_group_id: string
    created_time: number
    field_data?: FacebookFieldData[]
  }
  field: string
}

export interface FacebookFieldData {
  name: string
  values: string[]
}

// Klicktipp API Typen
export interface KlicktippContact {
  email: string
  first_name?: string
  last_name?: string
  phone?: string
  tags?: string[]
  fields?: Record<string, string>
}

export interface KlicktippSubscribeResponse {
  id?: string
  error?: string
}

// Dialfire API Typen
export interface DialfireContact {
  first_name: string
  last_name: string
  phone: string
  email?: string
  company?: string
  notes?: string
}

export interface DialfireCreateResponse {
  id?: string
  error?: string
}

// ── Contract (Versicherungsvertrag) ────────────────────
export interface ContractBenefit {
  type: string
  description: string
  coverage?: string
}

export interface Contract {
  id: string
  contact_id: string
  contract_number?: string
  insurance_type?: string                 // z.B. "Allianz", "Debeka"
  contract_type: 'eigen' | 'fremd' | 'unknown'
  insurance_category?: string             // z.B. "Krankenversicherung"
  monthly_premium?: string
  duration_start?: string
  duration_end?: string
  benefits: ContractBenefit[]
  created_at: string
  created_by: string
  updated_at: string
}

// API Response Wrapper
export interface ApiSuccess<T> {
  success: true
  data: T
}

export interface ApiError {
  success: false
  error: string
}

export type ApiResponse<T> = ApiSuccess<T> | ApiError
