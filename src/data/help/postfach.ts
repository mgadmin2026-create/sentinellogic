import type { HelpArticle } from '@/types/help'

export const postfachArticles: HelpArticle[] = [
  {
    id: 'postfach.overview',
    area: 'postfach',
    title: 'E-Mail-Postfach — Überblick',
    isPageDefault: true,
    route: '/postfach',
    matchMode: 'exact',
    keywords: ['e-mail', 'strato', 'imap', 'smtp', 'posteingang'],
    body:
      'Das E-Mail-Postfach zeigt den echten STRATO-Posteingang direkt in Sentimental Logic. Ungelesene Nachrichten sind gelb markiert; beim Öffnen wird eine Nachricht als gelesen markiert.\n\n' +
      'Über „+ Neue E-Mail" lassen sich Nachrichten direkt über das STRATO-Postfach versenden. „Antworten" übernimmt Absender, Betreff und die technische Nachrichtenreferenz für einen sauberen E-Mail-Verlauf.',
  },
  {
    id: 'postfach.kontakt',
    area: 'postfach',
    title: 'E-Mail einem Kontakt zuordnen',
    keywords: ['kontakt', 'verknüpfen', 'absender'],
    body:
      'Stimmt die Absenderadresse exakt mit der E-Mail-Adresse eines Kontakts überein, erscheint in der geöffneten Nachricht automatisch „Kontakt öffnen". Ein Klick führt direkt zur Kontaktdetailseite.\n\n' +
      'Beim Versand an eine bekannte Kontaktadresse wird eine Aktivität am Kontakt protokolliert. Der Nachrichtentext selbst wird dabei nicht in der Aktivität gespeichert.',
  },
]
