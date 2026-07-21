/*
  # Create Storage Bucket for Policy PDFs

  1. Storage Bucket
    - Create `policy_pdfs` bucket
    - Private bucket (files require authentication)
    - Allow PDF uploads

  2. Security
    - Executives and Admins can upload/download PDFs for their clients
    - Client users can only view their own policy PDFs
*/

-- Create storage bucket for policy PDFs
INSERT INTO storage.buckets (id, name, public)
VALUES ('policy_pdfs', 'policy_pdfs', false)
ON CONFLICT (id) DO NOTHING;

-- Storage policies for policy_pdfs bucket

-- Allow authenticated users to view policy PDFs
CREATE POLICY "Users can view policy PDFs"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'policy_pdfs'
  AND (
    -- Admins can see all
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
    OR
    -- Executives can see PDFs from their clients
    EXISTS (
      SELECT 1 FROM policies
      JOIN clients ON clients.id = policies.client_id
      WHERE storage.objects.name LIKE clients.id::text || '/%'
      AND clients.assigned_to = auth.uid()
    )
    OR
    -- Client users can see their own PDFs
    EXISTS (
      SELECT 1 FROM clients
      WHERE storage.objects.name LIKE clients.id::text || '/%'
      AND clients.owner_user_id = auth.uid()
    )
  )
);

-- Allow executives and admins to upload policy PDFs
CREATE POLICY "Executives and admins can upload policy PDFs"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'policy_pdfs'
  AND (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('admin', 'ejecutivo')
    )
  )
);

-- Allow executives and admins to update policy PDFs
CREATE POLICY "Executives and admins can update policy PDFs"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'policy_pdfs'
  AND (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('admin', 'ejecutivo')
    )
  )
);

-- Allow executives and admins to delete policy PDFs
CREATE POLICY "Executives and admins can delete policy PDFs"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'policy_pdfs'
  AND (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
    OR
    EXISTS (
      SELECT 1 FROM policies
      JOIN clients ON clients.id = policies.client_id
      WHERE storage.objects.name LIKE clients.id::text || '/%'
      AND clients.assigned_to = auth.uid()
    )
  )
);
