const { createScriptSupabaseClient } = require('./supabase-client')
const supabase = createScriptSupabaseClient()

async function checkSchema() {
  // Check tables
  const { data: tables } = await supabase
    .from('information_schema.tables')
    .select('table_name')
    .eq('table_schema', 'public')

  console.log('📋 Tabellen:')
  tables?.forEach(t => console.log('  -', t.table_name))

  // Check contacts table structure
  const { data: columns } = await supabase
    .from('information_schema.columns')
    .select('column_name, data_type')
    .eq('table_name', 'contacts')

  console.log('\n📝 contacts-Spalten:')
  columns?.forEach(c => console.log('  -', c.column_name, `(${c.data_type})`))
}

checkSchema()
