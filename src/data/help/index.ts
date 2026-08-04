import type { HelpArea, HelpArticle } from '@/types/help'
import { dashboardArticles } from './dashboard'
import { kontakteListeArticles } from './kontakte-liste'
import { kontaktDetailArticles } from './kontakt-detail'
import { aufgabenArticles } from './aufgaben'
import { kalenderArticles } from './kalender'
import { postfachArticles } from './postfach'
import { dokumenteArticles } from './dokumente'
import { kiUploadArticles } from './ki-upload'
import { syncArticles } from './sync'
import { regelnArticles } from './regeln'
import { reportingArticles } from './reporting'
import { erwaehnungenArticles } from './erwaehnungen'
import { einstellungenArticles } from './einstellungen'

export const HELP_ARTICLES: HelpArticle[] = [
  ...dashboardArticles,
  ...kontakteListeArticles,
  ...kontaktDetailArticles,
  ...aufgabenArticles,
  ...kalenderArticles,
  ...postfachArticles,
  ...dokumenteArticles,
  ...kiUploadArticles,
  ...syncArticles,
  ...regelnArticles,
  ...reportingArticles,
  ...erwaehnungenArticles,
  ...einstellungenArticles,
]

if (process.env.NODE_ENV !== 'production') {
  const ids = HELP_ARTICLES.map((a) => a.id)
  const uniqueIds = new Set(ids)
  if (uniqueIds.size !== ids.length) {
    const duplicates = ids.filter((id, index) => ids.indexOf(id) !== index)
    throw new Error(`Doppelte Hilfe-Artikel-IDs gefunden: ${Array.from(new Set(duplicates)).join(', ')}`)
  }
}

export const HELP_ARTICLES_BY_ID: Record<string, HelpArticle> = Object.fromEntries(
  HELP_ARTICLES.map((article) => [article.id, article])
)

export const HELP_ARTICLES_BY_AREA: Record<HelpArea, HelpArticle[]> = HELP_ARTICLES.reduce(
  (acc, article) => {
    ;(acc[article.area] ??= []).push(article)
    return acc
  },
  {} as Record<HelpArea, HelpArticle[]>
)

/**
 * Löst die Seiten-Standardhilfe für einen Pfad auf. Exakte Treffer ("exact", Standard) haben
 * Vorrang vor Präfix-Treffern ("prefix", nur für echte dynamische Routen wie /kontakte/[id]),
 * damit z.B. die Kontakte-Listen-Standardhilfe (exact "/kontakte") nicht mit der
 * Kontaktdetail-Standardhilfe (prefix "/kontakte") kollidiert — Details haben immer ein
 * zusätzliches Pfadsegment, die Liste nie.
 */
export function resolvePageDefaultArticle(pathname: string): HelpArticle | null {
  const candidates = HELP_ARTICLES.filter((a) => a.isPageDefault && a.route)

  const exactMatch = candidates.find(
    (a) => (a.matchMode ?? 'exact') === 'exact' && a.route === pathname
  )
  if (exactMatch) return exactMatch

  const prefixMatches = candidates.filter(
    (a) => a.matchMode === 'prefix' && pathname.startsWith(`${a.route}/`)
  )
  if (prefixMatches.length === 0) return null
  return prefixMatches.sort((a, b) => (b.route?.length ?? 0) - (a.route?.length ?? 0))[0]
}
