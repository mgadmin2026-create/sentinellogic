const { createScriptSupabaseClient } = require('./supabase-client')
const supabase = createScriptSupabaseClient()

async function updateTags() {
  // Update all 3 Sentinel test contacts with tag ID
  const tagUpdate = {
    klicktipp_tags: [{ id: 14700012, name: 'Sentinel' }]
  }

  const ids = [
    'e3623928-489e-4fd7-8520-fb72c1b9a7a2',
    '22f03769-b17b-4456-850b-1238ff71a5e5',
    'c055113d-88c6-4574-b102-ae3572f2438a'
  ]

  for (const id of ids) {
    const { data, error } = await supabase
      .from('contacts')
      .update(tagUpdate)
      .eq('id', id)
      .select()
      .single()

    if (error) {
      console.error(`❌ Error updating ${id}:`, error.message)
    } else {
      console.log(`✅ Updated ${data.first_name} ${data.last_name}`)
      console.log(`   Tags:`, JSON.stringify(data.klicktipp_tags))
    }
  }
}

updateTags()
