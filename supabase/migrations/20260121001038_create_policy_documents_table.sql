/*
  # Create policy documents table

  1. New Tables
    - `policy_documents`
      - `id` (uuid, primary key)
      - `policy_id` (uuid, foreign key to policies)
      - `document_type` (text) - tipo de documento: poliza, recibo, endoso, carta_finiquito, otro
      - `file_name` (text) - nombre original del archivo
      - `file_url` (text) - URL del archivo en storage
      - `file_size` (bigint) - tamaño del archivo en bytes
      - `uploaded_by` (uuid, foreign key to profiles)
      - `created_at` (timestamptz)

  2. Security
    - Enable RLS on `policy_documents` table
    - Add policies for authenticated users to read documents of their own policies
    - Add policies for executives and admins to manage all documents

  3. Storage
    - Create storage bucket for policy documents if not exists
*/

CREATE TABLE IF NOT EXISTS policy_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  policy_id uuid NOT NULL REFERENCES policies(id) ON DELETE CASCADE,
  document_type text NOT NULL CHECK (document_type IN ('poliza', 'recibo', 'endoso', 'carta_finiquito', 'otro')),
  file_name text NOT NULL,
  file_url text NOT NULL,
  file_size bigint,
  uploaded_by uuid REFERENCES profiles(id),
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS policy_documents_policy_id_idx ON policy_documents(policy_id);
CREATE INDEX IF NOT EXISTS policy_documents_created_at_idx ON policy_documents(created_at DESC);

ALTER TABLE policy_documents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view documents of their own policies"
  ON policy_documents FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM policies p
      JOIN clients c ON p.client_id = c.id
      WHERE p.id = policy_documents.policy_id
      AND c.owner_user_id = auth.uid()
    )
  );

CREATE POLICY "Executives can view documents of their clients' policies"
  ON policy_documents FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM policies p
      JOIN clients c ON p.client_id = c.id
      JOIN profiles prof ON prof.id = auth.uid()
      WHERE p.id = policy_documents.policy_id
      AND (c.assigned_to = auth.uid() OR prof.role = 'admin')
    )
  );

CREATE POLICY "Executives can insert documents for their clients' policies"
  ON policy_documents FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM policies p
      JOIN clients c ON p.client_id = c.id
      JOIN profiles prof ON prof.id = auth.uid()
      WHERE p.id = policy_documents.policy_id
      AND (c.assigned_to = auth.uid() OR prof.role = 'admin')
    )
  );

CREATE POLICY "Executives can update documents for their clients' policies"
  ON policy_documents FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM policies p
      JOIN clients c ON p.client_id = c.id
      JOIN profiles prof ON prof.id = auth.uid()
      WHERE p.id = policy_documents.policy_id
      AND (c.assigned_to = auth.uid() OR prof.role = 'admin')
    )
  );

CREATE POLICY "Executives can delete documents for their clients' policies"
  ON policy_documents FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM policies p
      JOIN clients c ON p.client_id = c.id
      JOIN profiles prof ON prof.id = auth.uid()
      WHERE p.id = policy_documents.policy_id
      AND (c.assigned_to = auth.uid() OR prof.role = 'admin')
    )
  );

INSERT INTO storage.buckets (id, name, public)
VALUES ('policy-documents', 'policy-documents', false)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Authenticated users can view policy documents"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (bucket_id = 'policy-documents');

CREATE POLICY "Executives can upload policy documents"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'policy-documents' AND
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid()
      AND role IN ('ejecutivo', 'admin')
    )
  );

CREATE POLICY "Executives can delete policy documents"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'policy-documents' AND
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid()
      AND role IN ('ejecutivo', 'admin')
    )
  );
