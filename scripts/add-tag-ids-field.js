const { createScriptSupabaseClient } = require('./supabase-client')
const supabase = createScriptSupabaseClient()

async function addTagIds() {
  // Update klicktipp_tags back to just strings
  const tagUpdate = {
    klicktipp_tags: ['Sentinel'],
    klicktipp_tag_ids: [14700012]  // Add IDs alongside names
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
      console.log(`   Tag Names: ${data.klicktipp_tags}`)
      console.log(`   Tag IDs: ${data.klicktipp_tag_ids}`)
    }
  }
}

addTagIds()
