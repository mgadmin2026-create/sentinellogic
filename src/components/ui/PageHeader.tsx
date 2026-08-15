// Gemeinsamer Seitenkopf — siehe docs/UI_UX_KONZEPT.md.
// Ersetzt die individuell gebauten <h1>-Köpfe (bisher uneinheitlich text-2xl/text-3xl,
// text-gray-900/text-[#1A1A1A]) durch eine feste Typo-Ebene: h1 = text-2xl font-bold.
interface PageHeaderProps {
  title: string
  subtitle?: React.ReactNode
  actions?: React.ReactNode
}

export function PageHeader({ title, subtitle, actions }: PageHeaderProps) {
  return (
    <div className="flex items-start justify-between gap-4 flex-wrap mb-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">{title}</h1>
        {subtitle && <div className="text-sm text-gray-500 mt-1">{subtitle}</div>}
      </div>
      {actions && <div className="flex items-center gap-2 flex-wrap">{actions}</div>}
    </div>
  )
}
