const { createClient } = require('@supabase/supabase-js')
require('dotenv').config({ path: '.env.local' })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !serviceRoleKey) {
  throw new Error('Supabase-Umgebungsvariablen fehlen')
}

const supabase = createClient(supabaseUrl, serviceRoleKey)

async function executeMigration() {
  const sql = `
    ALTER TABLE public.contacts
    ADD COLUMN IF NOT EXISTS klicktipp_tag_ids bigint[] DEFAULT '{}';
  `

  try {
    const { data, error } = await supabase.rpc('exec_sql', { sql })
    
    if (error) {
      console.error('❌ Migration error:', error.message)
    } else {
      console.log('✅ Migration executed successfully')
    }
  } catch (err) {
    console.error('❌ Error:', err.message)
  }
}

executeMigration()
