'use client'

import { useState } from 'react'
import { MergedStep, isOverdue, getNextStageKey, getPreviousStageKey } from '@/lib/pipeline'

interface ProcessStepperProps {
  mergedSteps: MergedStep[]
  currentStageKey: string | null
  onStageChange: (newStageKey: string) => Promise<void>
  onStepsUpdate?: (steps: Array<{ key: string; done: boolean; completed_at?: string; due_date?: string }>) => Promise<void>
  loading?: boolean
}

export function ProcessStepper({
  mergedSteps,
  currentStageKey,
  onStageChange,
  onStepsUpdate,
  loading = false,
}: ProcessStepperProps) {
  const [editingDueDate, setEditingDueDate] = useState<string | null>(null)
  const [editingDueDateValue, setEditingDueDateValue] = useState<string>('')
  const [saving, setSaving] = useState(false)

  if (!currentStageKey || mergedSteps.length === 0) {
    return <div className="text-sm text-gray-400">—</div>
  }

  const currentIndex = mergedSteps.findIndex((s) => s.key === currentStageKey)
  const currentStep = mergedSteps[currentIndex]
  const nextStageKey = getNextStageKey(currentStageKey, mergedSteps as any)
  const prevStageKey = getPreviousStageKey(currentStageKey, mergedSteps as any)

  async function handleNextStep() {
    if (!nextStageKey) return
    setSaving(true)
    try {
      await onStageChange(nextStageKey)
    } finally {
      setSaving(false)
    }
  }

  async function handlePreviousStep() {
    if (!prevStageKey) return
    setSaving(true)
    try {
      await onStageChange(prevStageKey)
    } finally {
      setSaving(false)
    }
  }

  async function handleSaveDueDate(stepKey: string) {
    if (!onStepsUpdate) return
    setSaving(true)
    try {
      const updatedSteps = mergedSteps.map((s) =>
        s.key === stepKey ? { ...s, due_date: editingDueDateValue || undefined } : s
      )
      await onStepsUpdate(updatedSteps)
      setEditingDueDate(null)
      setEditingDueDateValue('')
    } finally {
      setSaving(false)
    }
  }

  async function handleToggleDone(stepKey: string, currentDone: boolean) {
    if (!onStepsUpdate) return
    setSaving(true)
    try {
      const updatedSteps = mergedSteps.map((s) =>
        s.key === stepKey
          ? {
              ...s,
              done: !currentDone,
              completed_at: !currentDone ? new Date().toISOString() : undefined,
            }
          : s
      )
      await onStepsUpdate(updatedSteps)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
      <h2 className="text-sm font-bold text-[#1A1A1A] uppercase tracking-wide mb-4 pb-3 border-b border-gray-100">
        Vertriebs-Prozess
      </h2>

      {/* Stepper */}
      <div className="space-y-2 mb-6">
        {mergedSteps.map((step, idx) => {
          const isCurrent = step.key === currentStageKey
          const isDone = step.done
          const isFuture = idx > currentIndex
          const isOverdueStatus = step.due_date && isOverdue(step.due_date)

          return (
            <div key={step.key} className="flex items-start gap-3">
              {/* Step Circle */}
              <div
                className={`flex-shrink-0 w-7 h-7 rounded-full flex items-center justify-center text-xs font-semibold border transition-all ${
                  isDone
                    ? 'bg-emerald-100 text-emerald-700 border-emerald-300'
                    : isCurrent
                      ? 'bg-[#FFC300]/20 text-[#FFC300] border-[#FFC300] ring-2 ring-[#FFC300]/30'
                      : isFuture
                        ? 'bg-gray-100 text-gray-400 border-gray-200'
                        : 'bg-gray-200 text-gray-600 border-gray-300'
                }`}
              >
                {isDone ? '✓' : idx + 1}
              </div>

              {/* Step Info */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <h4
                    className={`text-sm font-medium ${
                      isCurrent
                        ? 'text-[#FFC300]'
                        : isDone
                          ? 'text-emerald-700'
                          : isFuture
                            ? 'text-gray-400'
                            : 'text-[#1A1A1A]'
                    }`}
                  >
                    {step.label}
                  </h4>
                  {step.is_optional && (
                    <span className="text-xs px-1.5 py-0.5 bg-amber-50 text-amber-700 rounded border border-amber-200">
                      Optional
                    </span>
                  )}
                </div>

                {/* Due Date + Completed Date */}
                <div className="mt-1.5 flex items-center gap-3 flex-wrap">
                  {isDone && step.completed_at && (
                    <div className="text-xs text-emerald-600">
                      ✓ Erledigt: {new Date(step.completed_at).toLocaleDateString('de-DE')}
                    </div>
                  )}

                  {!isDone && step.due_date && (
                    <div className={`text-xs font-medium ${isOverdueStatus ? 'text-red-600' : 'text-gray-600'}`}>
                      {isOverdueStatus ? '⏰ Überfällig: ' : 'Fällig: '}
                      {new Date(step.due_date).toLocaleDateString('de-DE')}
                    </div>
                  )}

                  {(isCurrent || isDone) && (
                    <button
                      onClick={() => {
                        setEditingDueDate(step.key)
                        setEditingDueDateValue(step.due_date || new Date().toISOString().split('T')[0])
                      }}
                      className="text-xs text-blue-600 hover:text-blue-700 font-medium"
                    >
                      {step.due_date ? 'Ändern' : '+ Fälligkeit'}
                    </button>
                  )}
                </div>

                {/* Due Date Editor */}
                {editingDueDate === step.key && (
                  <div className="mt-2 flex gap-2">
                    <input
                      type="date"
                      value={editingDueDateValue}
                      onChange={(e) => setEditingDueDateValue(e.target.value)}
                      className="px-2 py-1 text-xs border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-[#FFC300]/40"
                    />
                    <button
                      onClick={() => handleSaveDueDate(step.key)}
                      disabled={saving}
                      className="text-xs px-2 py-1 bg-green-500 text-white rounded hover:bg-green-600 disabled:opacity-50"
                    >
                      {saving ? '...' : '✓'}
                    </button>
                    <button
                      onClick={() => setEditingDueDate(null)}
                      className="text-xs px-2 py-1 bg-gray-200 text-gray-700 rounded hover:bg-gray-300"
                    >
                      ✕
                    </button>
                  </div>
                )}
              </div>

              {/* Checkbox for Current/Done Steps */}
              {(isCurrent || isDone) && (
                <input
                  type="checkbox"
                  checked={isDone}
                  onChange={() => handleToggleDone(step.key, isDone)}
                  disabled={isFuture || saving}
                  className="flex-shrink-0 w-4 h-4 rounded border-gray-300 accent-emerald-500 cursor-pointer mt-1"
                  title={isDone ? 'Schritt als unerledigt markieren' : 'Schritt als erledigt markieren'}
                />
              )}
            </div>
          )
        })}
      </div>

      {/* Navigation Buttons */}
      <div className="flex gap-2 pt-4 border-t border-gray-100">
        <button
          onClick={handlePreviousStep}
          disabled={!prevStageKey || saving}
          className="flex-1 flex items-center justify-center gap-1.5 px-4 py-2 bg-gray-100 text-gray-600 rounded-lg hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium transition-colors"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <polyline points="15 18 9 12 15 6" />
          </svg>
          Vorheriger Schritt
        </button>

        <button
          onClick={handleNextStep}
          disabled={!nextStageKey || saving}
          className="flex-1 flex items-center justify-center gap-1.5 px-4 py-2 bg-[#FFC300] text-[#1A1A1A] rounded-lg hover:bg-[#e6b000] disabled:opacity-50 disabled:cursor-not-allowed text-sm font-semibold transition-colors"
        >
          Nächster Schritt
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <polyline points="9 18 15 12 9 6" />
          </svg>
        </button>
      </div>

      {currentIndex === mergedSteps.length - 1 && (
        <div className="mt-3 text-xs text-emerald-600 bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-2 text-center font-medium">
          🎉 Letzter Schritt abgeschlossen!
        </div>
      )}
    </div>
  )
}
