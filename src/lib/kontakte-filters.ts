// Gemeinsame Filter-Prädikate für Kontakte, die (noch) nicht serverseitig in
// GET /api/kontakte abgebildet sind. Spiegelt exakt die Client-Logik in
// src/app/kontakte/page.tsx (Zeile ~688ff), damit Liste und Export konsistent
// bleiben.
export interface KontakteFilterParams {
  source?: string | null
  kontaktTyp?: string | null
  pipelineStage?: string | null
  sparte?: string | null
  pruefungGrund?: string | null
  tagIds?: string[]
}

export function applyKontakteFilters<
  T extends {
    source?: string | null
    kontakt_typ?: string | null
    pipeline_stage?: string | null
    sparte?: string | null
    'prüfung_grund'?: string | null
    tags?: { id: string; name: string }[]
  }
>(rows: T[], filters: KontakteFilterParams): T[] {
  return rows.filter((k) => {
    if (filters.source && filters.source !== 'all' && (k.source || 'manuell') !== filters.source) return false
    if (filters.kontaktTyp && filters.kontaktTyp !== 'all' && (k.kontakt_typ || 'gewerbe') !== filters.kontaktTyp) return false
    if (filters.pipelineStage && filters.pipelineStage !== 'all' && k.pipeline_stage !== filters.pipelineStage) return false
    if (filters.sparte && filters.sparte !== 'all' && k.sparte !== filters.sparte) return false
    if (filters.pruefungGrund && filters.pruefungGrund !== 'all' && (k['prüfung_grund'] || '') !== filters.pruefungGrund) return false
    if (filters.tagIds && filters.tagIds.length > 0) {
      const tagIds = filters.tagIds
      if (!tagIds.every((tId) => (k.tags ?? []).some((t) => t.id === tId))) return false
    }
    return true
  })
}
