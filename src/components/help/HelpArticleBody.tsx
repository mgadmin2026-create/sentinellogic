// Reiner Text → JSX: Absätze durch Leerzeile getrennt, Zeilen mit "- " werden zur Liste.
// Bewusst kein Markdown-Package — Inhalte sind kurze, einfache Hilfetexte (siehe src/types/help.ts).
import type { HelpArticle } from '@/types/help'

function renderParagraph(paragraph: string, key: number) {
  const lines = paragraph.split('\n')
  const isList = lines.every((line) => line.trim().startsWith('- '))

  if (isList) {
    return (
      <ul key={key} className="list-disc list-outside pl-5 space-y-1">
        {lines.map((line, i) => (
          <li key={i}>{line.trim().slice(2)}</li>
        ))}
      </ul>
    )
  }

  return (
    <p key={key} className="whitespace-pre-wrap">
      {paragraph}
    </p>
  )
}

export function HelpArticleBody({ article }: { article: HelpArticle }) {
  const paragraphs = article.body.split('\n\n').filter((p) => p.trim().length > 0)
  return <div className="space-y-3 text-sm text-gray-700 leading-relaxed">{paragraphs.map(renderParagraph)}</div>
}
