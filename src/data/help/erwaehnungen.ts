import type { HelpArticle } from '@/types/help'

export const erwaehnungenArticles: HelpArticle[] = [
  {
    id: 'erwaehnungen.overview',
    area: 'erwaehnungen',
    title: 'Erwähnungen — Überblick',
    isPageDefault: true,
    route: '/erwaehnungen',
    matchMode: 'exact',
    keywords: ['mention', '@', 'benachrichtigung'],
    body:
      'Hier siehst du alle Kommentare, in denen du mit @ erwähnt wurdest — egal ob an einem Kontakt oder an einer Aufgabe. Neue Erwähnungen erscheinen außerdem als Zähler-Badge neben "Erwähnungen" in der Seitenleiste.\n\n' +
      'Ein Klick auf eine Erwähnung markiert sie als gelesen und springt direkt zum jeweiligen Kontakt bzw. zur jeweiligen Aufgabe.',
  },
  {
    id: 'erwaehnungen.filter',
    area: 'erwaehnungen',
    title: 'Alle / Ungelesen',
    keywords: ['filter', 'ungelesen', 'badge'],
    body:
      'Der Umschalter oben zeigt entweder alle Erwähnungen oder nur die noch ungelesenen. Die Zahl in Klammern zeigt jeweils die genaue Anzahl.',
  },
]
