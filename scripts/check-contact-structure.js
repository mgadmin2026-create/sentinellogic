const { createClient } = require('@supabase/supabase-js')

const supabase = createClient(
  'https://wwetuauicumqjczfdtcd.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Ind3ZXR1YXVpY3VtcWpjemZkdGNkIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MDQ4NzAzOSwiZXhwIjoyMDk2MDYzMDM5fQ.BhmiAUFK4G-VSAkBmP0bJaqPu7UaSs6JQdYJbXYG54U'
)

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
