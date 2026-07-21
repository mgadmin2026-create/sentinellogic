export type PlacetelCallDirection = 'incoming' | 'outgoing'

export type PlacetelCallStatus =
  | 'initiated'
  | 'ringing'
  | 'accepted'
  | 'completed'
  | 'missed'
  | 'blocked'
  | 'voicemail'
  | 'busy'
  | 'canceled'
  | 'unavailable'
  | 'congestion'
  | 'failed'

export type PlacetelCallResult =
  | 'termin'
  | 'wiedervorlage'
  | 'kein_interesse'
  | 'nicht_erreicht'
  | 'falsche_nummer'
  | 'sonstiges'

export interface PlacetelApiCall {
  id?: number | string
  type?: 'voicemail' | 'missed' | 'blocked' | 'accepted' | string
  from_number?: string
  to_number?: unknown
  duration?: number
  received_at?: string
  [key: string]: unknown
}
export interface CallLog {
  id: string
  contact_id: string | null
  placetel_call_id: string | null
  direction: PlacetelCallDirection
  status: PlacetelCallStatus
  from_number: string | null
  to_number: string | null
  started_at: string
  accepted_at: string | null
  ended_at: string | null
  duration_seconds: number | null
  result: PlacetelCallResult | null
  notes: string | null
  created_at: string
}
