
-- Make member-photos bucket public so avatar URLs work
UPDATE storage.buckets SET public = true WHERE id = 'member-photos';
