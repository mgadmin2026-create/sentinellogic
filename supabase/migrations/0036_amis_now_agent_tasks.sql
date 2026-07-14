-- AMIS.Now Browser-Agent Queue auf Basis der tasks-Tabelle.
-- Aufgaben mit triggered_by_process_step = 'amis_now' und status = 'offen' werden vom Agenten gepollt.

ALTER TABLE tasks
  ADD COLUMN IF NOT EXISTS amis_task_type TEXT NOT NULL DEFAULT 'person_create_quote',
  ADD COLUMN IF NOT EXISTS amis_input JSONB NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS amis_status TEXT,
  ADD COLUMN IF NOT EXISTS amis_quote_number TEXT,
  ADD COLUMN IF NOT EXISTS amis_premium TEXT,
  ADD COLUMN IF NOT EXISTS amis_screenshot_path TEXT,
  ADD COLUMN IF NOT EXISTS amis_error TEXT,
  ADD COLUMN IF NOT EXISTS amis_agent_id TEXT,
  ADD COLUMN IF NOT EXISTS amis_claimed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS amis_processed_at TIMESTAMPTZ;

ALTER TABLE tasks
  DROP CONSTRAINT IF EXISTS tasks_amis_task_type_check;

ALTER TABLE tasks
  ADD CONSTRAINT tasks_amis_task_type_check
  CHECK (amis_task_type IN ('person_create', 'person_create_quote'));

ALTER TABLE tasks
  DROP CONSTRAINT IF EXISTS tasks_amis_status_check;

ALTER TABLE tasks
  ADD CONSTRAINT tasks_amis_status_check
  CHECK (amis_status IS NULL OR amis_status IN ('person_created', 'quoted', 'error'));

CREATE INDEX IF NOT EXISTS tasks_amis_queue_idx
  ON tasks(status, created_at)
  WHERE triggered_by_process_step = 'amis_now';
