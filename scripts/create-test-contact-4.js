const { createClient } = require('@supabase/supabase-js')

const supabase = createClient(
  'https://wwetuauicumqjczfdtcd.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Ind3ZXR1YXVpY3VtcWpjemZkdGNkIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MDQ4NzAzOSwiZXhwIjoyMDk2MDYzMDM5fQ.BhmiAUFK4G-VSAkBmP0bJaqPu7UaSs6JQdYJbXYG54U'
)

async function createTestContact() {
  const testContact = {
    first_name: 'Thomas',
    last_name: 'Schmidt',
    email: 'thomas.schmidt@test.local',
    status: 'new',
    company_name: 'Schmidt Consulting',
    klicktipp_tags: ['Sentinel'],
    klicktipp_tag_ids: [14700012]
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

    console.log('✅ 4. Kontakt erstellt:')
    console.log('   ID:', contact.id)
    console.log('   Name:', contact.first_name, contact.last_name)
    console.log('   Email:', contact.email)
    console.log('   Tag Name:', contact.klicktipp_tags)
    console.log('   Tag ID:', contact.klicktipp_tag_ids)
  } catch (err) {
    console.error('❌ Error:', err.message)
    process.exit(1)
  }
}

createTestContact()
