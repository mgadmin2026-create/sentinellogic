const { createScriptSupabaseClient } = require('./supabase-client')
const supabase = createScriptSupabaseClient()

async function cleanupTagNames() {
  const ids = [
    'e3623928-489e-4fd7-8520-fb72c1b9a7a2',
    '22f03769-b17b-4456-850b-1238ff71a5e5',
    'c055113d-88c6-4574-b102-ae3572f2438a'
  ]

  for (const id of ids) {
    const { data, error } = await supabase
      .from('contacts')
      .update({ klicktipp_tags: ['Sentinel'] })
      .eq('id', id)
      .select()
      .single()

    if (error) {
      console.error(`❌ Error: ${error.message}`)
    } else {
      console.log(`✅ Cleaned up ${data.first_name}`)
    }
  }
}

cleanupTagNames()
