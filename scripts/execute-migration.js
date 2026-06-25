const { createClient } = require('@supabase/supabase-js')

const supabase = createClient(
  'https://wwetuauicumqjczfdtcd.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Ind3ZXR1YXVpY3VtcWpjemZkdGNkIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MDQ4NzAzOSwiZXhwIjoyMDk2MDYzMDM5fQ.BhmiAUFK4G-VSAkBmP0bJaqPu7UaSs6JQdYJbXYG54U'
)

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
