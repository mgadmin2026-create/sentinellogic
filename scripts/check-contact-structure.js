const { createScriptSupabaseClient } = require('./supabase-client')
const supabase = createScriptSupabaseClient()

async function checkStructure() {
  // Get first contact
  const { data: contact } = await supabase
    .from('contacts')
    .select('*')
    .limit(1)
    .single()

  if (contact) {
    console.log('📋 Kontakt-Struktur:')
    Object.keys(contact).forEach(key => {
      console.log(`  ${key}: ${typeof contact[key]}`)
    })
  }

  // Check for tags table
  const { data: sentinelContact } = await supabase
    .from('contacts')
    .select('*')
    .eq('first_name', 'Sentinel')
    .single()

  console.log('\n🏷️ Sentinel Test Kontakt:')
  console.log(JSON.stringify(sentinelContact, null, 2))
}

checkStructure()
