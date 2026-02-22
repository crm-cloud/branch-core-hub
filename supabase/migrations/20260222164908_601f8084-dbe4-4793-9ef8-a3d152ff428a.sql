-- Create storage bucket for contract documents
INSERT INTO storage.buckets (id, name, public) 
VALUES ('documents', 'documents', true)
ON CONFLICT (id) DO NOTHING;

-- Allow authenticated users to upload to documents bucket
CREATE POLICY "Authenticated users can upload documents"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'documents' AND auth.role() = 'authenticated');

-- Allow authenticated users to read documents
CREATE POLICY "Authenticated users can read documents"
ON storage.objects FOR SELECT
USING (bucket_id = 'documents' AND auth.role() = 'authenticated');