-- Admin-Alarm bei Google-Drive-Token-Refresh-Fehlern: Cooldown-Zeitstempel,
-- damit nicht bei jedem fehlgeschlagenen Upload/E-Mail-Anhang erneut eine
-- Warn-Mail an alle Admins verschickt wird.
ALTER TABLE google_drive_system_token
  ADD COLUMN IF NOT EXISTS last_failure_notified_at timestamptz;
