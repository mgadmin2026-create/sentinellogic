// Mock-Daten für den Sentimental Logic Prototyp
// Keine echte Datenbankanbindung — alle Daten sind fiktiv

export type LeadStatus = 'new' | 'contacted' | 'qualified' | 'customer'
export type LeadSource = 'facebook' | 'tiktok' | 'calendly' | 'csv' | 'email'

export interface MockActivity {
  id: string
  type: string
  description: string
  date: string
}

export interface MockLead {
  id: string
  // Basisdaten
  first_name: string
  last_name: string
  email: string
  phone_mobile: string
  phone_office?: string
  status: LeadStatus
  source: LeadSource
  created_at: string
  // Persönliche Daten
  birth_date?: string
  marital_status?: string
  children?: number
  profession?: string
  profession_group?: string
  position?: string
  address?: string
  // Unternehmensdaten
  company_name?: string
  legal_form?: string
  founded_year?: number
  employees?: number
  annual_revenue?: string
  trade_register?: string
  vat_id?: string
  industry?: string
  business_description?: string
  website?: string
  headquarters?: string
  // Versicherungsstatus
  existing_insurances: string[]
  current_providers?: string
  next_renewals?: Array<{ type: string; date: string }>
  monthly_premium?: string
  coverage_gaps?: string
  // Gewerbedaten
  research?: {
    trade_register_checked: boolean
    google_rating?: string
    website_info?: string
    bundesanzeiger_checked: boolean
  }
  // Gesprächshistorie
  first_contact_date?: string
  first_contact_channel?: string
  last_contact_date?: string
  next_contact?: { date: string; time: string }
  contact_count?: number
  // Notizen
  notes?: string
  notes_updated_at?: string
  // Aktivitäten-Timeline
  activities?: MockActivity[]
}

export const MOCK_LEADS: MockLead[] = [
  {
    id: 'lead-001',
    first_name: 'Thomas',
    last_name: 'Müller',
    email: 'thomas.mueller@elektro-mueller.de',
    phone_mobile: '+49 176 4421 8800',
    phone_office: '+49 89 4421 880',
    status: 'new',
    source: 'facebook',
    created_at: '2026-05-26T08:14:00Z',
    birth_date: '1981-03-14',
    marital_status: 'verheiratet',
    children: 2,
    profession: 'Elektromeister',
    profession_group: 'Handwerk',
    position: 'Geschäftsführer',
    address: 'Rosenheimer Str. 44, 81669 München',
    company_name: 'Elektro Müller GmbH',
    legal_form: 'GmbH',
    founded_year: 2015,
    employees: 8,
    annual_revenue: '620.000 €',
    trade_register: 'HRB 241089 München',
    vat_id: 'DE312445678',
    industry: 'Elektrotechnik / Handwerk',
    business_description: 'Installation und Wartung von Elektro­anlagen für Gewerbe und Wohnimmobilien in München und Umgebung.',
    website: 'www.elektro-mueller.de',
    headquarters: 'München',
    existing_insurances: ['KFZ', 'BHV'],
    current_providers: 'Allianz (KFZ), Zurich (BHV)',
    next_renewals: [
      { type: 'KFZ', date: '01.01.2027' },
      { type: 'BHV', date: '01.07.2026' },
    ],
    monthly_premium: '480 €/Monat',
    coverage_gaps: 'Kein Cyber-Schutz vorhanden. Betriebsunterbrechung nicht abgesichert. Elektronikversicherung für Maschinen fehlt.',
    research: {
      trade_register_checked: true,
      google_rating: '4,7 ★ (89 Bewertungen)',
      website_info: 'Aktive Website, Impressum vorhanden, ISO-Zertifizierung',
      bundesanzeiger_checked: true,
    },
    first_contact_date: '2026-05-26',
    first_contact_channel: 'Facebook Lead Ad',
    last_contact_date: '2026-05-26',
    next_contact: { date: '2026-05-28', time: '10:00' },
    contact_count: 1,
    notes: 'Sehr interessiert an Gewerbepaket. BHV-Vertrag läuft im Juli aus — gutes Timing für Umdeckung. Frau ist Lehrerin, privat evtl. auch Potenzial.',
    notes_updated_at: '2026-05-26T09:31:00Z',
    activities: [
      { id: 'a1', type: 'sync', description: 'Lead via Facebook Lead Ad synchronisiert', date: '2026-05-26T08:14:00Z' },
      { id: 'a2', type: 'research', description: 'Gewerbedaten automatisch recherchiert', date: '2026-05-26T08:15:30Z' },
      { id: 'a3', type: 'ai_prep', description: 'Gesprächsvorbereitung erstellt', date: '2026-05-26T08:16:00Z' },
    ],
  },
  {
    id: 'lead-002',
    first_name: 'Sabine',
    last_name: 'Hoffmann',
    email: 'sabine.hoffmann@praxis-hoffmann.de',
    phone_mobile: '+49 151 2234 7766',
    status: 'qualified',
    source: 'calendly',
    created_at: '2026-05-24T14:30:00Z',
    birth_date: '1979-11-22',
    marital_status: 'verheiratet',
    children: 3,
    profession: 'Ärztin (Allgemeinmedizin)',
    profession_group: 'Freiberufler / Gesundheitsberufe',
    position: 'Inhaberin',
    address: 'Hauptstr. 12, 70173 Stuttgart',
    company_name: 'Allgemeinarztpraxis Hoffmann',
    legal_form: 'Einzelunternehmen',
    founded_year: 2010,
    employees: 4,
    annual_revenue: '380.000 €',
    industry: 'Gesundheitswesen',
    business_description: 'Allgemeinarztpraxis mit Hausbesuchen und Telemedizin-Angebot.',
    website: 'www.praxis-hoffmann-stuttgart.de',
    headquarters: 'Stuttgart',
    existing_insurances: ['Kranken', 'Leben', 'KFZ', 'Berufshaftpflicht'],
    current_providers: 'Debeka (Kranken), Hannoversche (Leben)',
    next_renewals: [{ type: 'Berufshaftpflicht', date: '01.01.2027' }],
    monthly_premium: '1.240 €/Monat',
    coverage_gaps: 'Keine Berufsunfähigkeitsversicherung. Praxisausfallversicherung fehlt. Cyber-Versicherung für Patientendaten dringend empfohlen.',
    research: {
      trade_register_checked: false,
      google_rating: '4,9 ★ (134 Bewertungen)',
      website_info: 'Professionelle Website, Online-Terminbuchung aktiv',
      bundesanzeiger_checked: false,
    },
    first_contact_date: '2026-05-24',
    first_contact_channel: 'Calendly Termin',
    last_contact_date: '2026-05-25',
    next_contact: { date: '2026-05-27', time: '14:00' },
    contact_count: 2,
    notes: 'Termin für Dienstag bestätigt. Hauptinteresse BU-Absicherung und Praxisausfall. Budget vorhanden, sehr offen für Gespräch.',
    notes_updated_at: '2026-05-25T16:45:00Z',
    activities: [
      { id: 'b1', type: 'sync', description: 'Termin via Calendly synchronisiert', date: '2026-05-24T14:30:00Z' },
      { id: 'b2', type: 'status_change', description: 'Status geändert: Neu → Qualifiziert', date: '2026-05-24T14:31:00Z' },
      { id: 'b3', type: 'ai_prep', description: 'Gesprächsvorbereitung erstellt', date: '2026-05-24T14:32:00Z' },
    ],
  },
  {
    id: 'lead-003',
    first_name: 'Klaus',
    last_name: 'Weber',
    email: 'k.weber@baeckerei-weber.de',
    phone_mobile: '+49 172 9988 4411',
    phone_office: '+49 221 4455 9900',
    status: 'contacted',
    source: 'csv',
    created_at: '2026-05-22T09:00:00Z',
    birth_date: '1965-07-08',
    marital_status: 'verheiratet',
    children: 4,
    profession: 'Bäckermeister',
    profession_group: 'Lebensmittelhandwerk',
    position: 'Inhaber',
    address: 'Breite Str. 88, 50667 Köln',
    company_name: 'Bäckerei Weber',
    legal_form: 'Einzelunternehmen',
    founded_year: 2001,
    employees: 15,
    annual_revenue: '950.000 €',
    trade_register: 'HRA 33221 Köln',
    vat_id: 'DE199887654',
    industry: 'Lebensmittel / Bäckerei',
    business_description: 'Traditionsbäckerei mit 3 Filialen in Köln. Backen nach alten Rezepten, Catering für Events.',
    website: 'www.baeckerei-weber-koeln.de',
    headquarters: 'Köln',
    existing_insurances: ['BHV', 'Inhaltsversicherung', 'KFZ'],
    current_providers: 'HDI (BHV + Inhalt)',
    next_renewals: [{ type: 'Inhaltsversicherung', date: '01.03.2027' }],
    monthly_premium: '720 €/Monat',
    coverage_gaps: 'Keine Cyber-Absicherung. D&O fehlt (3 Mitarbeiter in Führung). Betriebsunterbrechung nur 6 Wochen abgedeckt — zu wenig.',
    research: {
      trade_register_checked: true,
      google_rating: '4,4 ★ (312 Bewertungen)',
      website_info: 'Webseite vorhanden, etwas veraltet',
      bundesanzeiger_checked: true,
    },
    first_contact_date: '2026-05-22',
    first_contact_channel: 'CSV-Import (Messe)',
    last_contact_date: '2026-05-23',
    next_contact: { date: '2026-05-29', time: '09:00' },
    contact_count: 2,
    notes: 'War auf der IHK-Messe. Skeptisch gegenüber Online-Versicherungen. Persönlicher Kontakt wichtig.',
    notes_updated_at: '2026-05-23T11:00:00Z',
    activities: [
      { id: 'c1', type: 'sync', description: 'Lead via CSV-Import angelegt', date: '2026-05-22T09:00:00Z' },
      { id: 'c2', type: 'research', description: 'Gewerbedaten automatisch recherchiert', date: '2026-05-22T09:02:00Z' },
      { id: 'c3', type: 'status_change', description: 'Status geändert: Neu → Kontaktiert', date: '2026-05-23T10:15:00Z' },
    ],
  },
  {
    id: 'lead-004',
    first_name: 'Maria',
    last_name: 'Schmidt',
    email: 'maria@texterin-schmidt.de',
    phone_mobile: '+49 160 7733 2255',
    status: 'new',
    source: 'email',
    created_at: '2026-05-25T16:22:00Z',
    birth_date: '1990-04-17',
    marital_status: 'ledig',
    children: 0,
    profession: 'Freie Texterin / Content-Strategin',
    profession_group: 'Kreativwirtschaft / Freiberufler',
    position: 'Selbstständig',
    address: 'Kastanienallee 3, 10435 Berlin',
    company_name: 'Maria Schmidt Textagentur',
    legal_form: 'Einzelunternehmen',
    founded_year: 2019,
    employees: 1,
    annual_revenue: '85.000 €',
    industry: 'Kreativwirtschaft / Marketing',
    business_description: 'SEO-Texte, Website-Inhalte und Content-Strategie für KMU.',
    website: 'www.texterin-schmidt.de',
    headquarters: 'Berlin',
    existing_insurances: ['Kranken'],
    current_providers: 'Techniker Krankenkasse',
    monthly_premium: '380 €/Monat',
    coverage_gaps: 'Keine BHV. Keine Berufsunfähigkeit. Keine Altersvorsorge. Gesamtschutz sehr lückenhaft.',
    research: {
      trade_register_checked: false,
      google_rating: '5,0 ★ (18 Bewertungen)',
      website_info: 'Moderne Website, aktiver Blog',
      bundesanzeiger_checked: false,
    },
    first_contact_date: '2026-05-25',
    first_contact_channel: 'E-Mail Anfrage',
    last_contact_date: '2026-05-25',
    contact_count: 1,
    notes: '',
    notes_updated_at: undefined,
    activities: [
      { id: 'd1', type: 'sync', description: 'Lead via E-Mail erkannt und angelegt', date: '2026-05-25T16:22:00Z' },
      { id: 'd2', type: 'research', description: 'Gewerbedaten recherchiert', date: '2026-05-25T16:24:00Z' },
    ],
  },
  {
    id: 'lead-005',
    first_name: 'Andreas',
    last_name: 'Braun',
    email: 'a.braun@braun-bau.de',
    phone_mobile: '+49 175 6644 1122',
    phone_office: '+49 711 6644 112',
    status: 'customer',
    source: 'facebook',
    created_at: '2026-05-10T10:00:00Z',
    birth_date: '1974-09-05',
    marital_status: 'verheiratet',
    children: 3,
    profession: 'Diplom-Bauingenieur',
    profession_group: 'Baugewerbe',
    position: 'Geschäftsführer',
    address: 'Gewerbepark 7, 70565 Stuttgart',
    company_name: 'Braun Bau GmbH',
    legal_form: 'GmbH',
    founded_year: 2008,
    employees: 32,
    annual_revenue: '4.200.000 €',
    trade_register: 'HRB 119944 Stuttgart',
    vat_id: 'DE277665432',
    industry: 'Baugewerbe / Hochbau',
    business_description: 'Schlüsselfertige Wohn- und Gewerbebauten in Baden-Württemberg.',
    website: 'www.braun-bau.de',
    headquarters: 'Stuttgart',
    existing_insurances: ['BHV', 'KFZ', 'Rechtsschutz', 'Cyber', 'D&O', 'Bauleistung'],
    current_providers: 'Allianz (Komplett-Paket)',
    monthly_premium: '3.100 €/Monat',
    coverage_gaps: 'Vollständig abgesichert. Review in 12 Monaten.',
    research: {
      trade_register_checked: true,
      google_rating: '4,6 ★ (56 Bewertungen)',
      website_info: 'Professionelle Website mit Referenzprojekten',
      bundesanzeiger_checked: true,
    },
    first_contact_date: '2026-05-10',
    first_contact_channel: 'Facebook Lead Ad',
    last_contact_date: '2026-05-20',
    contact_count: 4,
    notes: 'Abgeschlossen. Komplett-Paket über Allianz. Jahresprämie verhandelt. Sehr zufrieden.',
    notes_updated_at: '2026-05-20T15:00:00Z',
    activities: [
      { id: 'e1', type: 'sync', description: 'Lead via Facebook Lead Ad synchronisiert', date: '2026-05-10T10:00:00Z' },
      { id: 'e2', type: 'research', description: 'Gewerbedaten automatisch recherchiert', date: '2026-05-10T10:02:00Z' },
      { id: 'e3', type: 'ai_prep', description: 'Gesprächsvorbereitung erstellt', date: '2026-05-10T10:05:00Z' },
      { id: 'e4', type: 'status_change', description: 'Status geändert: Qualifiziert → Kunde', date: '2026-05-20T15:00:00Z' },
    ],
  },
  {
    id: 'lead-006',
    first_name: 'Jana',
    last_name: 'Köhler',
    email: 'jana@restaurant-koehler.de',
    phone_mobile: '+49 152 1122 3344',
    status: 'qualified',
    source: 'calendly',
    created_at: '2026-05-23T11:00:00Z',
    birth_date: '1988-02-28',
    marital_status: 'ledig',
    children: 1,
    profession: 'Restaurantleiterin',
    profession_group: 'Gastronomie',
    position: 'Inhaberin',
    address: 'Friedrichstr. 55, 10117 Berlin',
    company_name: 'Restaurant Köhler',
    legal_form: 'Einzelunternehmen',
    founded_year: 2018,
    employees: 6,
    annual_revenue: '420.000 €',
    industry: 'Gastronomie',
    business_description: 'Modernes Bistro-Restaurant mit saisonaler Küche, Mittagstisch und Catering.',
    website: 'www.restaurant-koehler-berlin.de',
    headquarters: 'Berlin',
    existing_insurances: ['BHV'],
    current_providers: 'Helvetia (BHV)',
    next_renewals: [{ type: 'BHV', date: '01.01.2027' }],
    monthly_premium: '210 €/Monat',
    coverage_gaps: 'Betriebsunterbrechung fehlt komplett (kritisch nach Corona). Keine Cyber-Versicherung. Kein Rechtsschutz. Glasbruch nicht inkludiert.',
    research: {
      trade_register_checked: false,
      google_rating: '4,8 ★ (221 Bewertungen)',
      website_info: 'Gut gepflegte Website, Online-Reservierung aktiv',
      bundesanzeiger_checked: false,
    },
    first_contact_date: '2026-05-23',
    first_contact_channel: 'Calendly Termin',
    last_contact_date: '2026-05-23',
    next_contact: { date: '2026-05-27', time: '11:30' },
    contact_count: 1,
    notes: 'Corona hat sie hart getroffen — daher sehr sensibel für Betriebsunterbrechung. Darauf eingehen!',
    notes_updated_at: '2026-05-23T12:00:00Z',
    activities: [
      { id: 'f1', type: 'sync', description: 'Termin via Calendly synchronisiert', date: '2026-05-23T11:00:00Z' },
      { id: 'f2', type: 'status_change', description: 'Status geändert: Neu → Qualifiziert', date: '2026-05-23T11:01:00Z' },
      { id: 'f3', type: 'ai_prep', description: 'Gesprächsvorbereitung erstellt', date: '2026-05-23T11:02:00Z' },
    ],
  },
  {
    id: 'lead-007',
    first_name: 'Michael',
    last_name: 'Schneider',
    email: 'ms@ms-it-consulting.de',
    phone_mobile: '+49 170 5566 7788',
    status: 'contacted',
    source: 'csv',
    created_at: '2026-05-21T13:45:00Z',
    birth_date: '1986-06-12',
    marital_status: 'ledig',
    children: 0,
    profession: 'IT-Berater',
    profession_group: 'IT / Technologie',
    position: 'Geschäftsführer',
    address: 'Leopoldstr. 200, 80804 München',
    company_name: 'MS IT-Consulting GmbH',
    legal_form: 'GmbH',
    founded_year: 2020,
    employees: 3,
    annual_revenue: '240.000 €',
    trade_register: 'HRB 278891 München',
    vat_id: 'DE344112233',
    industry: 'IT-Dienstleistungen',
    business_description: 'Cloud-Migration, IT-Sicherheitsberatung und Systemintegration für KMU.',
    website: 'www.ms-it-consulting.de',
    headquarters: 'München',
    existing_insurances: ['BHV'],
    current_providers: 'VHV (BHV)',
    monthly_premium: '120 €/Monat',
    coverage_gaps: 'Als IT-Dienstleister dringend: Cyber-Versicherung, D&O, IT-Haftpflicht speziell. BU fehlt.',
    research: {
      trade_register_checked: true,
      google_rating: '5,0 ★ (7 Bewertungen)',
      website_info: 'Professionelle Website, GitHub-Profil vorhanden',
      bundesanzeiger_checked: false,
    },
    first_contact_date: '2026-05-21',
    first_contact_channel: 'CSV-Import',
    last_contact_date: '2026-05-22',
    next_contact: { date: '2026-05-30', time: '15:00' },
    contact_count: 2,
    notes: 'Sehr tech-affin. Versteht Cyber-Risiken gut. Preissensibel, aber einsichtig.',
    notes_updated_at: '2026-05-22T14:00:00Z',
    activities: [
      { id: 'g1', type: 'sync', description: 'Lead via CSV-Import angelegt', date: '2026-05-21T13:45:00Z' },
      { id: 'g2', type: 'research', description: 'Gewerbedaten automatisch recherchiert', date: '2026-05-21T13:47:00Z' },
      { id: 'g3', type: 'status_change', description: 'Status geändert: Neu → Kontaktiert', date: '2026-05-22T09:00:00Z' },
    ],
  },
  {
    id: 'lead-008',
    first_name: 'Christine',
    last_name: 'Fischer',
    email: 'dr.fischer@zahnarztpraxis-fischer.de',
    phone_mobile: '+49 178 4433 5566',
    phone_office: '+49 40 4433 556',
    status: 'new',
    source: 'facebook',
    created_at: '2026-05-26T07:50:00Z',
    birth_date: '1977-12-01',
    marital_status: 'geschieden',
    children: 2,
    profession: 'Zahnärztin',
    profession_group: 'Freiberufler / Gesundheitsberufe',
    position: 'Praxisinhaberin',
    address: 'Mönckebergstr. 3, 20095 Hamburg',
    company_name: 'Zahnarztpraxis Dr. Fischer',
    legal_form: 'Einzelunternehmen',
    founded_year: 2012,
    employees: 5,
    annual_revenue: '520.000 €',
    industry: 'Gesundheitswesen / Zahnmedizin',
    business_description: 'Zahnarztpraxis mit Schwerpunkt ästhetische Zahnheilkunde und Implantologie.',
    website: 'www.zahnarzt-fischer-hamburg.de',
    headquarters: 'Hamburg',
    existing_insurances: ['Berufshaftpflicht'],
    current_providers: 'Ecclesia (Berufshaftpflicht)',
    next_renewals: [{ type: 'Berufshaftpflicht', date: '01.06.2027' }],
    monthly_premium: '340 €/Monat',
    coverage_gaps: 'Praxisausfall nicht versichert (bei Zahnarzt besonders kritisch). Kein Cyber-Schutz für Patientendaten (DSGVO-Risiko). Kein Rechtsschutz.',
    research: {
      trade_register_checked: false,
      google_rating: '4,9 ★ (178 Bewertungen)',
      website_info: 'Sehr professionelle Website, Online-Terminbuchung',
      bundesanzeiger_checked: false,
    },
    first_contact_date: '2026-05-26',
    first_contact_channel: 'Facebook Lead Ad',
    last_contact_date: '2026-05-26',
    contact_count: 1,
    notes: '',
    notes_updated_at: undefined,
    activities: [
      { id: 'h1', type: 'sync', description: 'Lead via Facebook Lead Ad synchronisiert', date: '2026-05-26T07:50:00Z' },
      { id: 'h2', type: 'research', description: 'Gewerbedaten automatisch recherchiert', date: '2026-05-26T07:52:00Z' },
    ],
  },
]

// Sync-Log Einträge
export interface SyncLogEntry {
  id: string
  date: string
  source: string
  count: number
  status: 'success' | 'warning' | 'error'
  message: string
}

export const MOCK_SYNC_LOG: SyncLogEntry[] = [
  { id: 's1', date: '2026-05-26T08:00:00Z', source: 'Facebook Lead Ads', count: 3, status: 'success', message: '3 neue Leads importiert' },
  { id: 's2', date: '2026-05-25T14:30:00Z', source: 'Calendly', count: 2, status: 'success', message: '2 neue Termine synchronisiert' },
  { id: 's3', date: '2026-05-25T08:00:00Z', source: 'Facebook Lead Ads', count: 5, status: 'success', message: '5 neue Leads importiert' },
  { id: 's4', date: '2026-05-24T16:00:00Z', source: 'E-Mail (IMAP)', count: 1, status: 'warning', message: '1 Lead erkannt, manuelle Prüfung empfohlen' },
  { id: 's5', date: '2026-05-24T08:00:00Z', source: 'Facebook Lead Ads', count: 4, status: 'success', message: '4 neue Leads importiert' },
  { id: 's6', date: '2026-05-23T11:00:00Z', source: 'Calendly', count: 1, status: 'success', message: '1 neuer Termin synchronisiert' },
  { id: 's7', date: '2026-05-23T08:00:00Z', source: 'Facebook Lead Ads', count: 0, status: 'warning', message: 'Keine neuen Leads — API-Limit erreicht' },
  { id: 's8', date: '2026-05-22T09:00:00Z', source: 'CSV-Import', count: 12, status: 'success', message: '12 Leads aus Messekontakten importiert' },
  { id: 's9', date: '2026-05-21T16:30:00Z', source: 'E-Mail (IMAP)', count: 2, status: 'success', message: '2 neue Leads aus E-Mail-Anfragen erkannt' },
  { id: 's10', date: '2026-05-21T08:00:00Z', source: 'Facebook Lead Ads', count: 6, status: 'success', message: '6 neue Leads importiert' },
]

// Automatisierungsregeln
export interface AutoRule {
  id: string
  name: string
  condition_source: LeadSource | 'all'
  actions: {
    klicktipp_tag?: string
    dialfire_campaign?: string
    set_status?: LeadStatus
    send_notification?: boolean
  }
  active: boolean
  created_at: string
  runs: number
}

export const MOCK_RULES: AutoRule[] = [
  {
    id: 'rule-001',
    name: 'Facebook → Klicktipp + Dialfire',
    condition_source: 'facebook',
    actions: {
      klicktipp_tag: 'fb-lead',
      dialfire_campaign: 'BHV-Gewerbe',
      send_notification: true,
    },
    active: true,
    created_at: '2026-05-01T10:00:00Z',
    runs: 47,
  },
  {
    id: 'rule-002',
    name: 'Calendly → Qualifiziert',
    condition_source: 'calendly',
    actions: {
      klicktipp_tag: 'termin-vereinbart',
      set_status: 'qualified',
      send_notification: true,
    },
    active: true,
    created_at: '2026-05-01T10:05:00Z',
    runs: 12,
  },
  {
    id: 'rule-003',
    name: 'CSV → Kalt-Akquise Kampagne',
    condition_source: 'csv',
    actions: {
      klicktipp_tag: 'csv-import',
      dialfire_campaign: 'Kalt-Akquise',
    },
    active: false,
    created_at: '2026-05-10T14:00:00Z',
    runs: 24,
  },
]

// Hilfsfunktionen
export function getLeadById(id: string): MockLead | undefined {
  return MOCK_LEADS.find((l) => l.id === id)
}

export const STATUS_LABELS: Record<string, string> = {
  new: 'Neu',
  contacted: 'Kontaktiert',
  qualified: 'Qualifiziert',
  customer: 'Kunde',
}

export const STATUS_COLORS: Record<string, string> = {
  new: 'bg-blue-100 text-blue-800',
  contacted: 'bg-yellow-100 text-yellow-800',
  qualified: 'bg-emerald-100 text-emerald-800',
  customer: 'bg-purple-100 text-purple-800',
}

export const SOURCE_LABELS: Record<string, string> = {
  facebook: 'Facebook',
  tiktok: 'TikTok',
  calendly: 'Calendly',
  csv: 'CSV',
  email: 'E-Mail',
}

export const SOURCE_COLORS: Record<string, string> = {
  facebook: 'bg-blue-50 text-blue-700',
  tiktok: 'bg-gray-900 text-white',
  calendly: 'bg-orange-50 text-orange-700',
  csv: 'bg-gray-100 text-gray-700',
  email: 'bg-green-50 text-green-700',
}
