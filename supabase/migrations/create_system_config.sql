-- Create system_config table for storing application configuration
CREATE TABLE IF NOT EXISTS public.system_config (
  key TEXT PRIMARY KEY,
  config JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_system_config_key ON public.system_config(key);
