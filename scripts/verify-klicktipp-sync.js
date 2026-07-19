const { createScriptSupabaseClient } = require('./supabase-client')
const supabase = createScriptSupabaseClient()

const KLICKTIPP_API_URL = 'https://api.klicktipp.com'
const KLICKTIPP_USER = process.env.KLICKTIPP_USERNAME
const KLICKTIPP_PASS = process.env.KLICKTIPP_PASSWORD

if (!KLICKTIPP_USER || !KLICKTIPP_PASS) {
  throw new Error('Klicktipp-Zugangsdaten fehlen')
}

let sessionId = null

async function loginKlickTipp() {
  try {
    // Try different endpoints
    const endpoints = [
      `${KLICKTIPP_API_URL}/v3/session`,
      `${KLICKTIPP_API_URL}/api/session`,
      `${KLICKTIPP_API_URL}/session`
    ]

    for (const endpoint of endpoints) {
      console.log(`Trying: ${endpoint}...`)
      try {
        const response = await fetch(endpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            username: KLICKTIPP_USER,
            password: KLICKTIPP_PASS
          })
        })

        console.log(`  Status: ${response.status}`)

        if (response.ok) {
          const data = await response.json()
          sessionId = data.session_id || data.sessionId || data.id
          if (sessionId) {
            console.log('✅ KlickTipp Login erfolgreich')
            return sessionId
          }
        }
      } catch (e) {
        // Continue to next endpoint
      }
    }

    throw new Error('No login endpoint worked')
  } catch (err) {
    console.error('❌ Login error:', err.message)
    throw err
  }
}

async function checkKlickTippContact(email) {
  if (!sessionId) {
    throw new Error('Not logged in to KlickTipp')
  }

  try {
    const response = await fetch(`https://api.klicktipp.com/v3/subscribers?email=${encodeURIComponent(email)}`, {
      method: 'GET',
      headers: {
        'X-Session-Id': sessionId,
        'Content-Type': 'application/json'
      }
    })

    if (!response.ok) {
      console.log(`  Response status: ${response.status}`)
      return null
    }

    const data = await response.json()
    return data.subscribers && data.subscribers.length > 0 ? data.subscribers[0] : null
  } catch (err) {
    console.error(`Error checking ${email}:`, err.message)
    return null
  }
}

async function verifySync() {
  try {
    // Login to KlickTipp
    await loginKlickTipp()

    // Get all test contacts with tag ID 14700012
    const { data: contacts } = await supabase
      .from('contacts')
      .select('*')
      .filter('klicktipp_tag_ids', 'cs', '{14700012}')

    if (!contacts || contacts.length === 0) {
      console.log('Keine Kontakte mit Tag ID 14700012 gefunden')
      return
    }

    console.log(`\n🔍 Verifiziere ${contacts.length} Kontakte in KlickTipp...\n`)

    for (const contact of contacts) {
      console.log(`Checking: ${contact.first_name} ${contact.last_name} (${contact.email})`)
      
      const ktContact = await checkKlickTippContact(contact.email)

      if (ktContact) {
        console.log(`  ✅ Gefunden in KlickTipp (ID: ${ktContact.id})`)
        
        const { error } = await supabase
          .from('contacts')
          .update({
            klicktipp_id: String(ktContact.id),
            klicktipp_last_sync: new Date().toISOString()
          })
          .eq('id', contact.id)

        if (error) {
          console.error(`  ❌ Update error: ${error.message}`)
        } else {
          console.log(`  ✅ Supabase aktualisiert`)
        }
      } else {
        console.log(`  ⚠️  NICHT gefunden in KlickTipp`)
      }
      console.log()
    }
  } catch (err) {
    console.error('Fatal error:', err.message)
    process.exit(1)
  }
}

verifySync()
