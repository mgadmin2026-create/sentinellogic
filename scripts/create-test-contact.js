const { createScriptSupabaseClient } = require('./supabase-client')
const supabase = createScriptSupabaseClient()

async function createTestContact() {
  const testContact = {
    first_name: 'Sentinel',
    last_name: 'Test',
    email: 'sentinel@test.local',
    status: 'new',
    company_name: 'Test Company',
    klicktipp_tags: ['Sentinel']
  }

  try {
    const { data: contact, error: insertError } = await supabase
      .from('contacts')
      .insert([testContact])
      .select()
      .single()

    if (insertError) {
      console.error('❌ Insert error:', insertError.message)
      process.exit(1)
    }

    console.log('✅ Kontakt erstellt:')
    console.log('   ID:', contact.id)
    console.log('   Name:', contact.first_name, contact.last_name)
    console.log('   Email:', contact.email)
    console.log('   Tags:', contact.klicktipp_tags)
  } catch (err) {
    console.error('❌ Error:', err.message)
    process.exit(1)
  }
}

createTestContact()
