-- Dauerhafte, nicht-personenbezogene Ergebnisprotokolle der Regressionstests.

CREATE TABLE IF NOT EXISTS public.test_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  started_at TIMESTAMPTZ NOT NULL,
  completed_at TIMESTAMPTZ NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('passed', 'failed', 'skipped', 'interrupted')),
  environment TEXT NOT NULL DEFAULT 'production',
  source TEXT NOT NULL DEFAULT 'github-actions',
  source_url TEXT,
  commit_sha TEXT,
  branch TEXT,
  duration_ms BIGINT NOT NULL DEFAULT 0 CHECK (duration_ms >= 0),
  total_count INTEGER NOT NULL DEFAULT 0 CHECK (total_count >= 0),
  passed_count INTEGER NOT NULL DEFAULT 0 CHECK (passed_count >= 0),
  failed_count INTEGER NOT NULL DEFAULT 0 CHECK (failed_count >= 0),
  skipped_count INTEGER NOT NULL DEFAULT 0 CHECK (skipped_count >= 0),
  results JSONB NOT NULL DEFAULT '[]'::JSONB,
  CONSTRAINT test_runs_run_id_check CHECK (run_id ~ '^[a-zA-Z0-9._:-]{1,100}$'),
  CONSTRAINT test_runs_environment_check CHECK (environment ~ '^[a-zA-Z0-9._:-]{1,40}$'),
  CONSTRAINT test_runs_commit_sha_check CHECK (commit_sha IS NULL OR commit_sha ~ '^[0-9a-f]{7,40}$'),
  CONSTRAINT test_runs_result_counts_check CHECK (
    passed_count + failed_count + skipped_count <= total_count
  ),
  CONSTRAINT test_runs_results_array_check CHECK (jsonb_typeof(results) = 'array')
);

CREATE INDEX IF NOT EXISTS test_runs_completed_at_idx
  ON public.test_runs(completed_at DESC);

CREATE INDEX IF NOT EXISTS test_runs_status_idx
  ON public.test_runs(status, completed_at DESC);

ALTER TABLE public.test_runs ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.test_runs FROM PUBLIC, anon, authenticated;

COMMENT ON TABLE public.test_runs IS
  'Nicht-personenbezogene Playwright-Ergebnisse für das Testdashboard.';
COMMENT ON COLUMN public.test_runs.results IS
  'Bereinigte Einzeltestergebnisse ohne Kundendaten, Secrets, Traces oder Screenshots.';
