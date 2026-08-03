-- Dialfire Sync Configuration Table (analog zu facebook_sync_config)
-- Macht den "Auto"-Toggle für Dialfire auf /sync tatsächlich wirksam --
-- vorher lief der Cron-Trigger unbedingt bei jedem GitHub-Actions-Takt,
-- unabhängig vom Toggle-Zustand.
CREATE TABLE dialfire_sync_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  enabled BOOLEAN DEFAULT false,
  interval_type TEXT DEFAULT '30min' CHECK (interval_type IN ('15min', '30min', '60min', 'daily', 'weekly')),
  daily_hour INT DEFAULT 8,
  weekly_day INT DEFAULT 1,
  weekly_hour INT DEFAULT 8,
  last_sync_at TIMESTAMPTZ,
  next_sync_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE UNIQUE INDEX idx_dialfire_sync_config_single ON dialfire_sync_config ((1)) WHERE id IS NOT NULL;

INSERT INTO dialfire_sync_config (enabled, interval_type, daily_hour, weekly_day, weekly_hour)
VALUES (false, '30min', 8, 1, 8)
ON CONFLICT DO NOTHING;
