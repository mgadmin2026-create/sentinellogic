'use client'

import { MergedStep, isOverdue } from '@/lib/pipeline'

interface ProcessStepperBarProps {
  mergedSteps: MergedStep[]
  currentPosition: number | null
}

/**
 * Horizontale Prozess-Stepper für Lead-Liste
 * Zeigt: Alle 12 Schritte mit Chevron-Pfeilen
 */
export function ProcessStepperBar({ mergedSteps, currentPosition }: ProcessStepperBarProps) {
  if (!currentPosition || mergedSteps.length === 0) {
    return <div className="text-xs text-gray-400">—</div>
  }

  // Alle Schritte anzeigen
  const visibleSteps = mergedSteps

  const getStepColor = (step: MergedStep, type: 'done' | 'current' | 'future'): string => {
    if (type === 'done' || step.done) {
      return 'bg-emerald-500 text-white' // Grün für erledigt
    }
    if (type === 'current') {
      return 'bg-[#FFC300] text-[#1A1A1A]' // Gold für aktuell
    }
    return 'bg-gray-300 text-white' // Grau für zukünftig
  }

  // Hilfsfunktion: Kürze Label auf Position + 3-5 Buchstaben
  const formatLabel = (label: string, position: number): string => {
    const abbr = label.substring(0, 4).toUpperCase()
    return `${position}. ${abbr}`
  }

  return (
    <div className="flex items-center gap-0 overflow-x-auto pb-1 min-w-0">
      {visibleSteps.map((step, idx) => {
        const position = idx + 1 // Position im Array (1-indexed)
        const isCurrent = idx + 1 === currentPosition
        const isDone = step.done
        const isFuture = idx + 1 > currentPosition!

        const nextStep = idx < visibleSteps.length - 1 ? visibleSteps[idx + 1] : null
        const nextStepColor = nextStep
          ? nextStep.done
            ? 'bg-emerald-500'
            : idx + 2 === currentPosition
              ? 'bg-[#FFC300]'
              : 'bg-gray-300'
          : 'bg-gray-300'

        return (
          <div key={step.key} className="flex items-center gap-0 flex-shrink-0">
            {/* Schritt-Badge (kompakt) */}
            <div
              className={`relative group px-2 py-1 text-xs font-bold rounded-sm whitespace-nowrap transition-all cursor-default ${getStepColor(
                step,
                isDone ? 'done' : isCurrent ? 'current' : 'future'
              )} ${isCurrent ? 'ring-2 ring-[#FFC300]/50' : ''}`}
              title={step.label}
            >
              {formatLabel(step.label, position)}

              {/* Tooltip */}
              <div className="absolute left-0 bottom-full mb-1 hidden group-hover:block bg-[#1A1A1A] text-white text-xs rounded-lg px-2 py-1 whitespace-nowrap z-50 pointer-events-none">
                {step.label}
                {step.due_date && (
                  <div className="text-gray-300 text-xs mt-0.5">
                    Fällig: {new Date(step.due_date).toLocaleDateString('de-DE')}
                  </div>
                )}
              </div>
            </div>

            {/* Chevron-Pfeil (außer beim letzten) */}
            {idx < visibleSteps.length - 1 && (
              <div className="relative w-2 h-5 flex-shrink-0">
                <div
                  className={`absolute inset-0 ${nextStepColor}`}
                  style={{
                    clipPath: 'polygon(100% 0%, 0% 50%, 100% 100%)',
                  }}
                />
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
