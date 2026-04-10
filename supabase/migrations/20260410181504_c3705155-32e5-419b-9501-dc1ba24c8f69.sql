-- Create attachments storage bucket if not exists
INSERT INTO storage.buckets (id, name, public) 
VALUES ('attachments', 'attachments', true)
ON CONFLICT (id) DO NOTHING;

-- Allow authenticated users to upload
CREATE POLICY "Authenticated users can upload attachments" ON storage.objects
FOR INSERT TO authenticated WITH CHECK (bucket_id = 'attachments');

-- Allow public read
CREATE POLICY "Public read access for attachments" ON storage.objects
FOR SELECT TO public USING (bucket_id = 'attachments');