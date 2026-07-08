'use client'

import { useState, useEffect } from 'react'
import type { Contract } from '@/types'

interface KontaktVertraegeTabProps {
  kontaktId: string
}

export function KontaktVertraegeTab({ kontaktId }: KontaktVertraegeTabProps) {
  const [contracts, setContracts] = useState<Contract[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedContract, setSelectedContract] = useState<Contract | null>(null)
  const [showModal, setShowModal] = useState(false)

  useEffect(() => {
    loadContracts()
  }, [kontaktId])

  async function loadContracts() {
    try {
      const res = await fetch(`/api/kontakte/${kontaktId}/vertraege`)
      if (!res.ok) throw new Error('Verträge konnten nicht geladen werden')
      const data = await res.json()
      setContracts(data.contracts || [])
    } catch (err) {
      console.error('Fehler beim Laden der Verträge:', err)
    } finally {
      setLoading(false)
    }
  }

  const getTypeColor = (type: string) => {
    switch (type) {
      case 'eigen':
        return 'bg-green-50 border-green-200'
      case 'fremd':
        return 'bg-blue-50 border-blue-200'
      default:
        return 'bg-gray-50 border-gray-200'
    }
  }

  const getTypeBadge = (type: string) => {
    switch (type) {
      case 'eigen':
        return '🟢 Eigenvertrag'
      case 'fremd':
        return '🔵 Fremdvertrag'
      default:
        return '🟡 Unbekannt'
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-gray-500">Verträge werden geladen...</div>
      </div>
    )
  }

  if (contracts.length === 0) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-600 mb-2">Keine Verträge gefunden</p>
        <p className="text-sm text-gray-500">Verträge werden durch KI-Upload automatisch erfasst</p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {contracts.map((contract) => (
        <div
          key={contract.id}
          className={`border rounded-lg p-4 cursor-pointer hover:shadow-md transition ${getTypeColor(contract.contract_type)}`}
          onClick={() => {
            setSelectedContract(contract)
            setShowModal(true)
          }}
        >
          {/* Header */}
          <div className="flex items-start justify-between mb-3">
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-1">
                <h3 className="font-semibold text-gray-900">
                  {contract.insurance_type || 'Versicherung'} — {contract.insurance_category || 'Unbekannt'}
                </h3>
                <span className="text-xs font-semibold px-2 py-1 rounded-full bg-white bg-opacity-60">
                  {getTypeBadge(contract.contract_type)}
                </span>
              </div>
              {contract.contract_number && (
                <p className="text-sm text-gray-600">Vertragsnummer: {contract.contract_number}</p>
              )}
            </div>
          </div>

          {/* Details Grid */}
          <div className="grid grid-cols-2 gap-3 mb-3 text-sm">
            {contract.monthly_premium && (
              <div>
                <span className="text-gray-600">Beitrag:</span>
                <p className="font-semibold text-gray-900">{contract.monthly_premium}</p>
              </div>
            )}
            {contract.duration_start && (
              <div>
                <span className="text-gray-600">Laufzeit:</span>
                <p className="font-semibold text-gray-900">
                  {contract.duration_start}
                  {contract.duration_end ? ` bis ${contract.duration_end}` : ''}
                </p>
              </div>
            )}
          </div>

          {/* Benefits Preview */}
          {contract.benefits && contract.benefits.length > 0 && (
            <div className="border-t border-white/50 pt-3 mt-3">
              <p className="text-xs font-semibold text-gray-700 mb-2">Leistungen ({contract.benefits.length})</p>
              <div className="flex flex-wrap gap-1">
                {contract.benefits.slice(0, 3).map((benefit, i) => (
                  <span key={i} className="text-xs bg-white bg-opacity-60 px-2 py-1 rounded">
                    {benefit.type}
                  </span>
                ))}
                {contract.benefits.length > 3 && (
                  <span className="text-xs bg-white bg-opacity-60 px-2 py-1 rounded text-gray-600">
                    +{contract.benefits.length - 3} mehr
                  </span>
                )}
              </div>
            </div>
          )}

          {/* Metadata */}
          <div className="text-xs text-gray-500 mt-3 pt-3 border-t border-white/50">
            {new Date(contract.created_at).toLocaleDateString('de-DE')}
          </div>
        </div>
      ))}

      {/* Details Modal */}
      {showModal && selectedContract && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-lg max-w-2xl w-full mx-4 max-h-[80vh] overflow-y-auto">
            {/* Header */}
            <div className="sticky top-0 bg-white border-b p-6 flex items-center justify-between">
              <div>
                <h2 className="text-xl font-semibold text-gray-900">
                  {selectedContract.insurance_type} — {selectedContract.insurance_category}
                </h2>
                <p className="text-sm text-gray-600 mt-1">
                  {getTypeBadge(selectedContract.contract_type)}
                </p>
              </div>
              <button
                onClick={() => setShowModal(false)}
                className="text-gray-400 hover:text-gray-600 text-2xl"
              >
                ✕
              </button>
            </div>

            {/* Content */}
            <div className="p-6 space-y-6">
              {/* Vertragsdetails */}
              <div>
                <h3 className="font-semibold text-gray-900 mb-3">Vertragsdetails</h3>
                <div className="grid grid-cols-2 gap-4 bg-gray-50 p-4 rounded-lg">
                  {selectedContract.contract_number && (
                    <div>
                      <span className="text-sm text-gray-600">Vertragsnummer</span>
                      <p className="font-semibold text-gray-900">{selectedContract.contract_number}</p>
                    </div>
                  )}
                  {selectedContract.monthly_premium && (
                    <div>
                      <span className="text-sm text-gray-600">Beitrag</span>
                      <p className="font-semibold text-gray-900">{selectedContract.monthly_premium}</p>
                    </div>
                  )}
                  {selectedContract.duration_start && (
                    <div>
                      <span className="text-sm text-gray-600">Vertragsbeginn</span>
                      <p className="font-semibold text-gray-900">{selectedContract.duration_start}</p>
                    </div>
                  )}
                  {selectedContract.duration_end && (
                    <div>
                      <span className="text-sm text-gray-600">Vertragsende</span>
                      <p className="font-semibold text-gray-900">{selectedContract.duration_end}</p>
                    </div>
                  )}
                </div>
              </div>

              {/* Leistungen */}
              {selectedContract.benefits && selectedContract.benefits.length > 0 && (
                <div>
                  <h3 className="font-semibold text-gray-900 mb-3">Leistungen ({selectedContract.benefits.length})</h3>
                  <div className="space-y-3">
                    {selectedContract.benefits.map((benefit, i) => (
                      <div key={i} className="border border-gray-200 rounded-lg p-4">
                        <p className="font-semibold text-gray-900">{benefit.type}</p>
                        <p className="text-sm text-gray-600 mt-1">{benefit.description}</p>
                        {benefit.coverage && (
                          <p className="text-sm text-gray-500 mt-2">Deckung: {benefit.coverage}</p>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Metadata */}
              <div className="text-xs text-gray-500 pt-4 border-t">
                Quelle: {selectedContract.created_by === 'ki_upload' ? '🤖 KI Upload' : 'Manuell'} •{' '}
                {new Date(selectedContract.created_at).toLocaleString('de-DE')}
              </div>
            </div>

            {/* Close Button */}
            <div className="sticky bottom-0 bg-gray-50 border-t p-6 flex justify-end">
              <button
                onClick={() => setShowModal(false)}
                className="px-6 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-100"
              >
                Schließen
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
