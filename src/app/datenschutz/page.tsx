// Datenschutzerklärung — öffentlich erreichbar, aber bewusst nicht in der
// Sidebar verlinkt. Dient u.a. als Pflicht-URL in den Facebook-App-Einstellungen
// (Basic Settings -> Datenschutzrichtlinien-URL) für die Lead-Ads-Integration.
export const metadata = {
  title: 'Datenschutzerklärung — Allianz Generalvertretung Gün',
  robots: 'noindex, nofollow',
}

function Abschnitt({ titel, children }: { titel: string; children: React.ReactNode }) {
  return (
    <section className="mb-8">
      <h2 className="text-lg font-bold text-gray-900 mb-2">{titel}</h2>
      <div className="text-sm text-gray-700 leading-relaxed space-y-3">{children}</div>
    </section>
  )
}

export default function DatenschutzPage() {
  return (
    <div className="min-h-dvh bg-gray-50 px-4 py-12">
      <div className="max-w-2xl mx-auto bg-white rounded-xl border border-gray-200 p-6 sm:p-10">
        <div className="flex items-center gap-2 mb-8">
          <span className="w-9 h-9 rounded-lg bg-brand flex items-center justify-center font-bold text-gray-900">SL</span>
          <span className="font-bold text-lg text-gray-900">Allianz Generalvertretung Gün</span>
        </div>

        <h1 className="text-2xl font-bold text-gray-900 mb-1">Datenschutzerklärung</h1>
        <p className="text-xs text-gray-400 mb-8">Stand: {new Date().toLocaleDateString('de-DE', { day: '2-digit', month: 'long', year: 'numeric' })}</p>

        <Abschnitt titel="1. Verantwortlicher">
          <p>
            Verantwortlich für die Verarbeitung personenbezogener Daten im Sinne der
            Datenschutz-Grundverordnung (DSGVO) ist:
          </p>
          <p>
            Allianz Generalvertretung Gün<br />
            Melih Gün<br />
            Westendstraße 23<br />
            63179 Obertshausen<br />
            E-Mail: <a href="mailto:noreply@guen-versicherung.de" className="text-yellow-700 hover:underline">noreply@guen-versicherung.de</a>
          </p>
        </Abschnitt>

        <Abschnitt titel="2. Erhebung über Facebook- und Instagram-Lead-Formulare">
          <p>
            Wenn Sie über ein Lead-Formular auf Facebook oder Instagram (u.a. der Seiten „FirmenProfis"
            und „KinderProfis") ein Interesse an einer Beratung oder einem Angebot äußern, übermittelt
            Meta Platforms Ireland Limited die von Ihnen im Formular angegebenen Daten an uns. Dazu
            gehören typischerweise: Name, Telefonnummer, E-Mail-Adresse sowie Ihre Antworten auf die im
            jeweiligen Formular gestellten Fragen (z.B. zu Versicherungsinteresse, Unternehmensgröße
            oder Reisezeitraum).
          </p>
          <p>
            Die Verarbeitung erfolgt auf Grundlage Ihrer im Rahmen des Formulars erteilten Einwilligung
            (Art. 6 Abs. 1 lit. a DSGVO) sowie zur Anbahnung eines Beratungs- bzw. Versicherungsvertrags
            auf Ihre Anfrage hin (Art. 6 Abs. 1 lit. b DSGVO). Informationen zur Datenverarbeitung durch
            Meta selbst finden Sie in der Datenrichtlinie von Meta.
          </p>
        </Abschnitt>

        <Abschnitt titel="3. Weitere Datenerhebung im Beratungsprozess">
          <p>
            Im Rahmen der weiteren Kontaktaufnahme und Beratung erheben wir ggf. zusätzliche Angaben,
            die für die Erstellung eines passenden Versicherungsangebots erforderlich sind. Hierzu
            können in Ausnahmefällen auch Gesundheitsdaten gehören (besondere Kategorien
            personenbezogener Daten gemäß Art. 9 DSGVO), etwa im Rahmen einer privaten
            Krankenversicherung. Diese Daten erheben und verarbeiten wir ausschließlich auf Grundlage
            Ihrer ausdrücklichen, gesonderten Einwilligung (Art. 9 Abs. 2 lit. a DSGVO), die wir vor der
            Erhebung gesondert einholen.
          </p>
        </Abschnitt>

        <Abschnitt titel="4. Empfänger und Auftragsverarbeiter">
          <p>
            Zur Abwicklung unserer Geschäftsprozesse setzen wir folgende Dienstleister ein, die als
            Auftragsverarbeiter im Sinne von Art. 28 DSGVO ausschließlich nach unserer Weisung tätig
            werden bzw. als eigenständig Verantwortliche im Rahmen der Vertragsabwicklung agieren:
          </p>
          <ul className="list-disc pl-5 space-y-1">
            <li>Supabase (Datenbank- und Speicher-Infrastruktur unseres internen CRM-Systems)</li>
            <li>Vercel (Hosting des internen CRM-Systems)</li>
            <li>Resend (Versand von E-Mails im Rahmen der Kontaktaufnahme)</li>
            <li>Dialfire, Placetel (Telefonie und Anrufabwicklung)</li>
            <li>Allianz Versicherungs-AG (Erstellung und Verwaltung von Versicherungsverträgen, sofern es zu einem Vertragsabschluss kommt)</li>
          </ul>
          <p>Eine Weitergabe an sonstige Dritte erfolgt nicht, es sei denn, wir sind gesetzlich dazu verpflichtet.</p>
        </Abschnitt>

        <Abschnitt titel="5. Speicherdauer und Löschung">
          <p>
            Wir speichern personenbezogene Daten nur so lange, wie dies für die jeweiligen Zwecke
            erforderlich ist, oder wie es gesetzliche Aufbewahrungsfristen (insbesondere aus dem
            Handels- und Steuerrecht) vorschreiben. Kommt kein Vertrag zustande, löschen wir Ihre
            Anfragedaten spätestens nach angemessener Zeit, sofern keine gesetzliche
            Aufbewahrungspflicht entgegensteht oder Sie einer längeren Speicherung ausdrücklich
            zustimmen.
          </p>
          <p>
            Sie können jederzeit die Löschung Ihrer Daten verlangen; wir kommen dem nach, soweit keine
            gesetzliche Aufbewahrungspflicht entgegensteht.
          </p>
        </Abschnitt>

        <Abschnitt titel="6. Ihre Rechte">
          <p>Ihnen stehen nach der DSGVO folgende Rechte zu:</p>
          <ul className="list-disc pl-5 space-y-1">
            <li>Auskunft über die zu Ihrer Person gespeicherten Daten (Art. 15 DSGVO)</li>
            <li>Berichtigung unrichtiger Daten (Art. 16 DSGVO)</li>
            <li>Löschung Ihrer Daten (Art. 17 DSGVO)</li>
            <li>Einschränkung der Verarbeitung (Art. 18 DSGVO)</li>
            <li>Datenübertragbarkeit (Art. 20 DSGVO)</li>
            <li>Widerspruch gegen die Verarbeitung (Art. 21 DSGVO)</li>
            <li>Widerruf einer erteilten Einwilligung mit Wirkung für die Zukunft (Art. 7 Abs. 3 DSGVO)</li>
          </ul>
          <p>
            Zur Ausübung dieser Rechte genügt eine formlose Mitteilung an die oben genannte
            E-Mail-Adresse. Ihnen steht zudem ein Beschwerderecht bei einer Datenschutz-Aufsichtsbehörde
            zu, insbesondere in dem Mitgliedstaat Ihres gewöhnlichen Aufenthalts, Ihres Arbeitsplatzes
            oder des Orts des mutmaßlichen Verstoßes.
          </p>
        </Abschnitt>

        <Abschnitt titel="7. Kontakt bei Datenschutzfragen">
          <p>
            Bei Fragen zur Verarbeitung Ihrer personenbezogenen Daten wenden Sie sich bitte an:{' '}
            <a href="mailto:noreply@guen-versicherung.de" className="text-yellow-700 hover:underline">
              noreply@guen-versicherung.de
            </a>
          </p>
        </Abschnitt>
      </div>
    </div>
  )
}
