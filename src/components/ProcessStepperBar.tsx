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

  return (
    <div className="flex items-center gap-0 overflow-x-auto pb-1 min-w-0">
      {visibleSteps.map((step, idx) => (
        <div key={step.key} className="flex items-center gap-0 flex-shrink-0">
          {/* Schritt-Badge */}
          <div
            className={`px-3 py-1.5 text-xs font-semibold rounded-sm whitespace-nowrap transition-all ${getStepColor(
              step,
              idx
            )} ${idx === 0 ? 'ring-2 ring-[#FFC300]/50' : ''}`}
            title={step.label}
          >
            {step.label}
          </div>

          {/* Chevron-Pfeil (außer beim letzten) */}
          {idx < visibleSteps.length - 1 && (
            <div className="relative w-4 h-6 flex-shrink-0 ml-0">
              {/* Linker Chevron (endet links) */}
              <div
                className={`absolute inset-0 ${
                  visibleSteps[idx + 1].done
                    ? 'bg-emerald-500'
                    : idx + 1 === 1
                      ? 'bg-[#FFC300]'
                      : 'bg-gray-300'
                } clip-path-chevron-l`}
                style={{
                  clipPath: 'polygon(100% 0%, 0% 50%, 100% 100%)',
                }}
              />
            </div>
          )}
        </div>
      ))}

      {/* Info-Text wenn noch mehr Steps vorhanden */}
      {currentPosition + 3 < mergedSteps.length && (
        <div className="text-xs text-gray-400 ml-2 flex-shrink-0">
          +{mergedSteps.length - (currentPosition + 3)} mehr
        </div>
      )}
    </div>
  )
}
