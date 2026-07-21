'use client'
// Vollständige Vertriebsprozess-Ansicht (12 Schritte mit Erledigt-Checkboxen
// und Fälligkeitsdaten) — ehemals Prozess-Tab, jetzt Drawer-Inhalt.

export const PIPELINE_STEPS = [
  { key: 'lead_in', label: 'Lead kommt rein' },
  { key: 'contacted', label: 'Lead wird kontaktiert' },
  { key: 'data_gathering', label: 'Daten werden eingeholt' },
  { key: 'wait_policies', label: 'Warten auf Policen' },
  { key: 'calc_offers', label: 'Angebote berechnen' },
  { key: 'download_offers', label: 'Angebote herunterladen & ablegen' },
  { key: 'contract_overview', label: 'Vertragsübersicht erstellen' },
  { key: 'send_offers', label: 'Angebote senden' },
  { key: 'offer_meeting', label: 'Angebotsbesprechung (Termin)' },
  { key: 'sales_talk', label: 'Verkaufsgespräch' },
  { key: 'contracts_store', label: 'Verträge ablegen' },
  { key: 'aftercare', label: 'Nachbereitung' },
]

interface PipelineStep {
  key: string
  done: boolean
  completed_at?: string
  due_date?: string
}

interface ProzessPanelProps {
  pipelineStage?: string
  pipelineSteps?: PipelineStep[]
  saving: boolean
  onNextStep: () => void
  onUpdateStep: (stepKey: string, done: boolean, dueDate?: string) => void
}

export function ProzessPanel({ pipelineStage, pipelineSteps, saving, onNextStep, onUpdateStep }: ProzessPanelProps) {
  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-lg font-semibold text-gray-900">Vertriebsprozess</h2>
        {pipelineStage && (
          <button
            onClick={onNextStep}
            disabled={
              saving ||
              PIPELINE_STEPS.findIndex(s => s.key === pipelineStage) === PIPELINE_STEPS.length - 1
            }
            className="flex items-center gap-2 bg-yellow-400 hover:bg-yellow-500 disabled:opacity-50 disabled:cursor-not-allowed text-gray-900 font-semibold text-sm px-4 py-2 rounded-lg transition-colors"
          >
            {saving ? '…' : '→'} Nächster Schritt
          </button>
        )}
      </div>

      <div className="space-y-3">
        {PIPELINE_STEPS.map((step, index) => {
          const stepData = (pipelineSteps || []).find((s) => s.key === step.key)
          const isCompleted = stepData?.done || false
          const isDueDate = stepData?.due_date
          const isCurrent = pipelineStage === step.key

          return (
            <div
              key={step.key}
              className={`flex gap-4 p-4 rounded-lg border-2 transition-all ${
                isCurrent
                  ? 'border-yellow-400 bg-yellow-50'
                  : isCompleted
                    ? 'border-emerald-200 bg-emerald-50'
                    : 'border-gray-200 bg-gray-50'
              }`}
            >
              <div className="flex-shrink-0">
                {isCompleted ? (
                  <div className="w-8 h-8 rounded-full bg-emerald-500 flex items-center justify-center text-white font-bold">
                    ✓
                  </div>
                ) : isCurrent ? (
                  <div className="w-8 h-8 rounded-full bg-yellow-400 flex items-center justify-center text-gray-900 font-bold">
                    {index + 1}
                  </div>
                ) : (
                  <div className="w-8 h-8 rounded-full border-2 border-gray-300 flex items-center justify-center text-gray-400 text-sm font-medium">
                    {index + 1}
                  </div>
                )}
              </div>

              <div className="flex-1">
                <div className="flex items-center justify-between mb-2">
                  <p className={`font-semibold ${isCompleted ? 'text-emerald-900' : isCurrent ? 'text-yellow-900' : 'text-gray-700'}`}>
                    {step.label}
                  </p>
                  {isCompleted && stepData?.completed_at && (
                    <span className="text-xs text-emerald-600 font-medium">
                      ✓ {new Date(stepData.completed_at).toLocaleDateString('de-DE')}
                    </span>
                  )}
                </div>

                <div className="flex gap-3 items-center">
                  <input
                    type="checkbox"
                    checked={isCompleted}
                    onChange={(e) => onUpdateStep(step.key, e.target.checked, isDueDate)}
                    disabled={saving}
                    className="w-4 h-4 rounded border-gray-300 cursor-pointer"
                    title="Als erledigt markieren"
                  />
                  <input
                    type="date"
                    value={isDueDate || ''}
                    onChange={(e) => onUpdateStep(step.key, isCompleted, e.target.value)}
                    disabled={saving}
                    className="text-xs px-2 py-1 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-yellow-400/40"
                    title="Fälligkeitsdatum"
                  />
                  {isDueDate && (
                    <span className="text-xs text-gray-500">
                      Fällig: {new Date(isDueDate).toLocaleDateString('de-DE')}
                    </span>
                  )}
                </div>
              </div>
            </div>
          )
        })}
      </div>

      {pipelineStage === PIPELINE_STEPS[PIPELINE_STEPS.length - 1].key && (
        <div className="mt-6 p-4 bg-emerald-50 border-2 border-emerald-200 rounded-lg">
          <p className="text-sm font-semibold text-emerald-900">
            🎉 Kontakt hat alle Prozessschritte abgeschlossen!
          </p>
        </div>
      )}
    </div>
  )
}
