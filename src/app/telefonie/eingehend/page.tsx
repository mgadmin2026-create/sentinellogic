// Eingehender Anruf: Softphone Plus öffnet diese Seite mit der Rufnummer des
// Anrufers. Bei genau einem Treffer geht es direkt zur Kundenakte, sonst wird
// die Nummer angezeigt und die Anlage eines neuen Kontakts angeboten.
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createServerClient } from '@/lib/supabase/server'
import { normalizePhoneNumber } from '@/lib/phone'
import { EingehenderAnrufAktionen } from './EingehenderAnrufAktionen'

export const dynamic = 'force-dynamic'
export const fetchCache = 'force-no-store'

interface Treffer {
  id: string
  first_name: string | null
  last_name: string | null
  company_name: string | null
  phone_mobile: string | null
  phone_office: string | null
}

async function findeKontakte(normalisiert: string): Promise<Treffer[]> {
  const supabase = createServerClient()
  const { data } = await supabase
    .from('contacts')
    .select('id, first_name, last_name, company_name, phone_mobile, phone_office')
    .is('archived_at', null)
    .limit(5_000)

  return ((data ?? []) as Treffer[]).filter(
    (kontakt) =>
      normalizePhoneNumber(kontakt.phone_mobile) === normalisiert ||
      normalizePhoneNumber(kontakt.phone_office) === normalisiert
  )
}

export default async function EingehenderAnrufPage({
  searchParams,
}: {
  searchParams: { nummer?: string; from?: string }
}) {
  const roh = (searchParams.nummer || searchParams.from || '').trim()
  const normalisiert = normalizePhoneNumber(roh)

  if (!normalisiert) {
    return (
      <Rahmen>
        <p className="text-sm text-gray-500">Eingehender Anruf</p>
        <h1 className="mt-1 text-2xl font-bold text-gray-900">Unterdrückte Rufnummer</h1>
        <p className="mt-3 text-sm text-gray-600">
          {roh
            ? <>Die übermittelte Nummer <span className="font-mono">{roh}</span> ließ sich nicht zuordnen.</>
            : 'Es wurde keine Rufnummer übermittelt.'}
        </p>
        <Link
          href="/kontakte"
          className="mt-6 inline-block rounded-lg bg-yellow-400 px-4 py-2.5 text-sm font-semibold text-gray-900 transition-colors hover:bg-yellow-500"
        >
          Zur Kontaktliste
        </Link>
      </Rahmen>
    )
  }

  const treffer = await findeKontakte(normalisiert)

  // Genau ein Treffer: direkt in die Kundenakte, ohne Zwischenklick.
  if (treffer.length === 1) {
    redirect(`/kontakte/${treffer[0].id}?anruf=eingehend`)
  }

  return (
    <Rahmen>
      <p className="text-sm text-gray-500">Eingehender Anruf</p>
      <h1 className="mt-1 font-mono text-2xl font-bold tracking-tight text-gray-900">{normalisiert}</h1>

      {treffer.length === 0 ? (
        <>
          <p className="mt-3 text-sm text-gray-600">
            Zu dieser Rufnummer gibt es noch keinen Kontakt.
          </p>
          <EingehenderAnrufAktionen nummer={normalisiert} />
        </>
      ) : (
        <>
          <p className="mt-3 text-sm text-gray-600">
            {treffer.length} Kontakte haben diese Rufnummer hinterlegt. Bitte den richtigen auswählen.
          </p>
          <ul className="mt-4 divide-y divide-gray-100 overflow-hidden rounded-xl border border-gray-200">
            {treffer.map((kontakt) => (
              <li key={kontakt.id}>
                <Link
                  href={`/kontakte/${kontakt.id}?anruf=eingehend`}
                  className="block px-4 py-3 transition-colors hover:bg-gray-50"
                >
                  <span className="block text-sm font-semibold text-gray-900">
                    {[kontakt.first_name, kontakt.last_name].filter(Boolean).join(' ') || 'Ohne Namen'}
                  </span>
                  {kontakt.company_name && (
                    <span className="block text-xs text-gray-500">{kontakt.company_name}</span>
                  )}
                </Link>
              </li>
            ))}
          </ul>
        </>
      )}
    </Rahmen>
  )
}

function Rahmen({ children }: { children: React.ReactNode }) {
  return (
    <div className="mx-auto max-w-xl px-4 py-12">
      <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">{children}</div>
    </div>
  )
}
