'use client'

import { MergedStep, isOverdue } from '@/lib/pipeline'

interface ProcessStepperBarProps {
  mergedSteps: MergedStep[]
  currentPosition: number | null
}

/**
 * Horizontale Prozess-Stepper für Lead-Liste
 * Zeigt: Aktueller Schritt + nächste 3 Schritte mit Chevron-Pfeilen
 */
export function ProcessStepperBar({ mergedSteps, currentPosition }: ProcessStepperBarProps) {
  if (!currentPosition || mergedSteps.length === 0) {
    return <div className="text-xs text-gray-400">—</div>
  }

  // Aktuelle + nächste 3 Schritte
  const visibleSteps = mergedSteps.slice(currentPosition - 1, currentPosition + 3)

  const getStepColor = (step: MergedStep, index: number): string => {
    if (step.done) {
      return 'bg-emerald-500 text-white' // Grün für erledigt
    }
    if (index === 0) {
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
        const position = currentPosition! + idx
        return (
          <div key={step.key} className="flex items-center gap-0 flex-shrink-0">
            {/* Schritt-Badge (kompakt) */}
            <div
              className={`relative group px-2 py-1 text-xs font-bold rounded-sm whitespace-nowrap transition-all cursor-default ${getStepColor(
                step,
                idx
              )} ${idx === 0 ? 'ring-2 ring-[#FFC300]/50' : ''}`}
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
                  className={`absolute inset-0 ${
                    visibleSteps[idx + 1].done
                      ? 'bg-emerald-500'
                      : idx + 1 === 1
                        ? 'bg-[#FFC300]'
                        : 'bg-gray-300'
                  }`}
                  style={{
                    clipPath: 'polygon(100% 0%, 0% 50%, 100% 100%)',
                  }}
                />
              </div>
            )}
          </div>
        )
      })}

      {/* Info-Text wenn noch mehr Steps vorhanden */}
      {currentPosition + 3 < mergedSteps.length && (
        <div className="text-xs text-gray-400 ml-1 flex-shrink-0">
          +{mergedSteps.length - (currentPosition + 3)}
        </div>
      )}
    </div>
  )
}
