const { createClient } = require('@supabase/supabase-js')

const supabase = createClient(
  'https://wwetuauicumqjczfdtcd.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Ind3ZXR1YXVpY3VtcWpjemZkdGNkIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MDQ4NzAzOSwiZXhwIjoyMDk2MDYzMDM5fQ.BhmiAUFK4G-VSAkBmP0bJaqPu7UaSs6JQdYJbXYG54U'
)

async function updateTagIds() {
  const ids = [
    'e3623928-489e-4fd7-8520-fb72c1b9a7a2',
    '22f03769-b17b-4456-850b-1238ff71a5e5',
    'c055113d-88c6-4574-b102-ae3572f2438a'
  ]

  for (const id of ids) {
    const { data, error } = await supabase
      .from('contacts')
      .update({ klicktipp_tag_ids: [14700012] })
      .eq('id', id)
      .select()
      .single()

    if (error) {
      console.error(`❌ Error updating ${id}:`, error.message)
    } else {
      console.log(`✅ ${data.first_name} ${data.last_name}`)
      console.log(`   Tag Names: ${JSON.stringify(data.klicktipp_tags)}`)
      console.log(`   Tag IDs: ${JSON.stringify(data.klicktipp_tag_ids)}`)
    }
  }
}

updateTagIds()
