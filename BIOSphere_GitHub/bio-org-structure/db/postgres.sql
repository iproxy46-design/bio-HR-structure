CREATE TABLE IF NOT EXISTS org_revision (id integer PRIMARY KEY CHECK (id = 1), revision text NOT NULL);
INSERT INTO org_revision VALUES (1, 'initial') ON CONFLICT DO NOTHING;
CREATE TABLE IF NOT EXISTS units (
 id text PRIMARY KEY, name text NOT NULL, parent_id text REFERENCES units(id) DEFERRABLE INITIALLY DEFERRED,
 headcount integer CHECK (headcount >= 0), leader_id text, position integer NOT NULL DEFAULT 0, CHECK (id <> parent_id)
);
CREATE TABLE IF NOT EXISTS employees (
 id text PRIMARY KEY, name text NOT NULL, role text, department text,
 unit_id text REFERENCES units(id) DEFERRABLE INITIALLY DEFERRED,
 location text, phone text, email text, manager_text text,
 manager_id text REFERENCES employees(id) DEFERRABLE INITIALLY DEFERRED,
 photo_url text, photo_version text, position integer NOT NULL DEFAULT 0, CHECK (id <> manager_id)
);
DO $$ BEGIN
 IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='units_leader_fk' AND conrelid='units'::regclass) THEN
  ALTER TABLE units ADD CONSTRAINT units_leader_fk FOREIGN KEY (leader_id) REFERENCES employees(id) DEFERRABLE INITIALLY DEFERRED;
 END IF;
END $$;
CREATE INDEX IF NOT EXISTS employees_unit_idx ON employees(unit_id);
CREATE INDEX IF NOT EXISTS units_parent_idx ON units(parent_id);
CREATE TABLE IF NOT EXISTS employee_photos (employee_id text PRIMARY KEY, content_type text NOT NULL, body bytea NOT NULL, updated_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE IF NOT EXISTS login_attempts (ip text PRIMARY KEY, failures integer NOT NULL, updated_at bigint NOT NULL, blocked_until bigint NOT NULL);
