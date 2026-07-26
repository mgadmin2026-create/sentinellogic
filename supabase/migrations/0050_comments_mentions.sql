-- Kommentare mit @-Erwähnungen für Aufgaben und Kontakte.
-- entity_type/entity_id ist polymorph statt zwei fast identischer Tabellen,
-- damit sich das Muster später leicht auf weitere Entitäten ausweiten lässt.
CREATE TABLE IF NOT EXISTS comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_type text NOT NULL CHECK (entity_type IN ('task', 'contact')),
  entity_id uuid NOT NULL,
  author_user_id uuid NOT NULL REFERENCES users(id),
  body text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_comments_entity ON comments(entity_type, entity_id, created_at DESC);

-- "@Alle" wird beim Anlegen zu einer Einzel-Erwähnung pro aktivem Teammitglied
-- aufgelöst (siehe API-Route) — dieselbe Tabelle bedient Einzel- und
-- Gruppen-Erwähnungen, keine Sonderlogik für "alle" nötig.
CREATE TABLE IF NOT EXISTS comment_mentions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  comment_id uuid NOT NULL REFERENCES comments(id) ON DELETE CASCADE,
  mentioned_user_id uuid NOT NULL REFERENCES users(id),
  read_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_comment_mentions_user ON comment_mentions(mentioned_user_id, read_at);

-- Anhänge werden zusätzlich als echtes Dokument in Google Drive abgelegt
-- (dokument_id), analog zu E-Mail-Anhängen. Nur möglich, wenn sich für die
-- Entität ein Kontakt auflösen lässt (Kontakt direkt, oder Aufgabe mit
-- contact_id) — ohne Drive-Ordner gibt es keinen Ablageort.
CREATE TABLE IF NOT EXISTS comment_attachments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  comment_id uuid NOT NULL REFERENCES comments(id) ON DELETE CASCADE,
  dokument_id uuid REFERENCES dokumente_metadata(id),
  file_name text NOT NULL,
  file_size integer,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_comment_attachments_comment ON comment_attachments(comment_id);
