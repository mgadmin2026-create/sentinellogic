// Liest die KlickTipp-Tags einer Regel aus — neues Format ist ein Array
// (actions.klicktipp_tags), ältere Regeln haben nur ein einzelnes Tag
// (actions.klicktipp_tag). Einheitlicher Lesezugriff, damit beide Formate
// nebeneinander funktionieren, ohne bestehende Regeln zu migrieren.
export function ruleKlicktippTags(actions: { klicktipp_tag?: string; klicktipp_tags?: string[] }): string[] {
  if (actions.klicktipp_tags?.length) return actions.klicktipp_tags
  if (actions.klicktipp_tag) return [actions.klicktipp_tag]
  return []
}
