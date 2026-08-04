// Technisch = Sync- und Automations-Mechanik (Dialfire/KlickTipp/Superchat/
// Facebook-Abgleich, Regelausführung, reine Feld-Updates). Alles andere gilt
// als fachlich und ist damit standardmäßig sichtbar — unbekannte künftige
// Typen landen bewusst im fachlichen Default statt unsichtbar zu werden.
//
// Eigenes, plain (kein 'use client') Modul: wird sowohl von der Kontakthistorie-
// UI (AktivitaetenPanel.tsx) als auch von server-seitigem Code (z.B. der
// Call-Prep-API-Route) importiert. Ein Import aus einer 'use client'-Datei
// heraus funktioniert in Route Handlers nicht zuverlässig (Next.js ersetzt
// Exporte solcher Module durch Client-Referenzen).
export function istTechnisch(type: string): boolean {
  if (type.includes('sync')) return true
  if (type.startsWith('automation_')) return true
  if (type === 'facebook_linked' || type === 'facebook_skipped_duplicate') return true
  if (type === 'contact_updated') return true
  return false
}
