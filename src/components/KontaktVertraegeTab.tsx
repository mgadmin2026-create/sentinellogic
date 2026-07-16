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
      setContracts(data.data || [])
    } catch (err) {
      console.error('Fehler beim Laden der Verträge:', err)
    } finally {
      setLoading(false)
    }
  }

  const getTypeBadge = (type: string) => {
    switch (type) {
      case 'eigen':
        return '🟢 Eigen'
      case 'fremd':
        return '🔵 Fremd'
      default:
        return '🟡 ?'
    }
  }

  if (loading) {
    return <div className="text-gray-500 py-8">Verträge werden geladen...</div>
  }

  if (contracts.length === 0) {
    return (
      <div className="text-center py-8">
        <p className="text-gray-600">Keine Verträge gefunden</p>
        <p className="text-sm text-gray-500">Verträge werden automatisch erkannt</p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Tabelle */}
      <div className="overflow-x-auto border border-gray-200 rounded-lg">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-50 border-b border-gray-200">
              <th className="px-4 py-2 text-left font-semibold text-gray-700">Versicherer</th>
              <th className="px-4 py-2 text-left font-semibold text-gray-700">Kategorie</th>
              <th className="px-4 py-2 text-left font-semibold text-gray-700">Vertragsnr.</th>
              <th className="px-4 py-2 text-left font-semibold text-gray-700">Beitrag</th>
              <th className="px-4 py-2 text-left font-semibold text-gray-700">Typ</th>
              <th className="px-4 py-2 text-left font-semibold text-gray-700">Leistungen</th>
              <th className="px-4 py-2 text-center font-semibold text-gray-700">Aktion</th>
            </tr>
          </thead>
          <tbody>
            {contracts.map((contract) => (
              <tr
                key={contract.id}
                className="border-b border-gray-100 hover:bg-gray-50 transition"
              >
                <td className="px-4 py-3 font-medium text-gray-900">
                  {contract.insurance_type || '—'}
                </td>
                <td className="px-4 py-3 text-gray-600">
                  {contract.insurance_category || '—'}
                </td>
                <td className="px-4 py-3 text-gray-600 text-xs font-mono">
                  {contract.contract_number || '—'}
                </td>
                <td className="px-4 py-3 text-gray-600">
                  {contract.monthly_premium || '—'}
                </td>
                <td className="px-4 py-3">
                  <span className="text-xs font-semibold">
                    {getTypeBadge(contract.contract_type)}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <span className="text-xs bg-gray-100 text-gray-700 px-2 py-1 rounded">
                    {contract.benefits?.length || 0}
                  </span>
                </td>
                <td className="px-4 py-3 text-center">
                  <button
                    onClick={() => {
                      setSelectedContract(contract)
                      setShowModal(true)
                    }}
                    className="text-xs text-yellow-600 hover:text-yellow-700 font-semibold"
                  >
                    Details
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Details Modal */}
      {showModal && selectedContract && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-lg max-w-2xl w-full max-h-[80vh] overflow-y-auto">
            {/* Header */}
            <div className="sticky top-0 bg-white border-b p-6 flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold text-gray-900">
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
            <div className="p-6 space-y-4">
              {/* Vertragsdetails Grid */}
              <div className="grid grid-cols-2 gap-4 bg-gray-50 p-4 rounded-lg text-sm">
                {selectedContract.contract_number && (
                  <div>
                    <span className="text-gray-600">Vertragsnummer</span>
                    <p className="font-semibold text-gray-900">{selectedContract.contract_number}</p>
                  </div>
                )}
                {selectedContract.monthly_premium && (
                  <div>
                    <span className="text-gray-600">Beitrag</span>
                    <p className="font-semibold text-gray-900">{selectedContract.monthly_premium}</p>
                  </div>
                )}
                {selectedContract.duration_start && (
                  <div>
                    <span className="text-gray-600">Vertragsbeginn</span>
                    <p className="font-semibold text-gray-900">{selectedContract.duration_start}</p>
                  </div>
                )}
                {selectedContract.duration_end && (
                  <div>
                    <span className="text-gray-600">Vertragsende</span>
                    <p className="font-semibold text-gray-900">{selectedContract.duration_end}</p>
                  </div>
                )}
              </div>

              {/* Leistungen */}
              {selectedContract.benefits && selectedContract.benefits.length > 0 && (
                <div>
                  <h3 className="font-semibold text-gray-900 mb-2 text-sm">
                    Leistungen ({selectedContract.benefits.length})
                  </h3>
                  <div className="space-y-2">
                    {selectedContract.benefits.map((benefit, i) => (
                      <div key={i} className="border border-gray-200 rounded p-3 text-sm">
                        <p className="font-semibold text-gray-900">{benefit.type}</p>
                        <p className="text-gray-600 text-xs mt-1">{benefit.description}</p>
                        {benefit.coverage && (
                          <p className="text-gray-500 text-xs mt-1">Deckung: {benefit.coverage}</p>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Metadata */}
              <div className="text-xs text-gray-500 pt-4 border-t">
                Quelle: {selectedContract.created_by === 'ki_upload' ? '🤖 KI' : 'Dokument'} •{' '}
                {new Date(selectedContract.created_at).toLocaleDateString('de-DE')}
              </div>
            </div>

            {/* Close */}
            <div className="sticky bottom-0 bg-gray-50 border-t p-4 flex justify-end">
              <button
                onClick={() => setShowModal(false)}
                className="px-4 py-2 text-sm border border-gray-300 text-gray-700 rounded hover:bg-gray-100"
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
