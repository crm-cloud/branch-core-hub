-- Add max_clients column to trainers for PT capacity tracking
ALTER TABLE trainers ADD COLUMN IF NOT EXISTS max_clients INTEGER DEFAULT 10;