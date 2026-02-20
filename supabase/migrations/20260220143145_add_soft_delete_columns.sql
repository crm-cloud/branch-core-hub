/*
  # Add Soft Delete Columns to Key Entities

  ## Summary
  Adds `deleted_at` soft delete timestamps to members, trainers, leads, and employees.
  Also adds deactivation tracking and membership cancellation fields.

  ## Changes
  - `members.deleted_at` — Soft delete (null = active)
  - `members.deactivated_at` — Deactivation timestamp
  - `trainers.deleted_at` — Soft delete
  - `leads.deleted_at` — Soft delete
  - `employees.deleted_at` — Soft delete
  - `memberships.cancellation_reason` — Why cancelled
  - `memberships.cancelled_at` — When cancelled

  ## Notes
  All columns are nullable by default; existing records remain unaffected.
*/

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'members' AND column_name = 'deleted_at') THEN
    ALTER TABLE members ADD COLUMN deleted_at timestamptz DEFAULT NULL;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'members' AND column_name = 'deactivated_at') THEN
    ALTER TABLE members ADD COLUMN deactivated_at timestamptz DEFAULT NULL;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'trainers' AND column_name = 'deleted_at') THEN
    ALTER TABLE trainers ADD COLUMN deleted_at timestamptz DEFAULT NULL;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'leads' AND column_name = 'deleted_at') THEN
    ALTER TABLE leads ADD COLUMN deleted_at timestamptz DEFAULT NULL;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'employees' AND column_name = 'deleted_at') THEN
    ALTER TABLE employees ADD COLUMN deleted_at timestamptz DEFAULT NULL;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'memberships' AND column_name = 'cancellation_reason') THEN
    ALTER TABLE memberships ADD COLUMN cancellation_reason text;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'memberships' AND column_name = 'cancelled_at') THEN
    ALTER TABLE memberships ADD COLUMN cancelled_at timestamptz;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_members_active ON members(id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_trainers_active ON trainers(id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_leads_active ON leads(id) WHERE deleted_at IS NULL;
