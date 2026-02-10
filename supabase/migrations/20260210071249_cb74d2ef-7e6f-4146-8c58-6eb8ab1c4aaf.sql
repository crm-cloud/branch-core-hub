-- Allow member_code to be temporarily null so the trigger can set it
ALTER TABLE members ALTER COLUMN member_code DROP NOT NULL;