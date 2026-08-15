// Gemeinsamer Leerzustand — siehe docs/UI_UX_KONZEPT.md.
interface EmptyStateProps {
  icon?: React.ReactNode
  text: string
  hint?: string
  action?: React.ReactNode
}

export function EmptyState({ icon, text, hint, action }: EmptyStateProps) {
  return (
    <div className="text-center py-12">
      {icon && <div className="text-2xl mb-2">{icon}</div>}
      <p className="text-gray-600 text-sm">{text}</p>
      {hint && <p className="text-gray-400 text-xs mt-1">{hint}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  )
}
