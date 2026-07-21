/*
  # Create email attachments storage bucket

  1. Storage
    - Creates `email-attachments` bucket for storing email attachments
    - Configured as private bucket (not public)
    
  2. Security
    - Enables RLS on storage.objects
    - Admins and executives can upload attachments for their entities
    - Admins and executives can view attachments for their entities
    - Clients can view their own email attachments
*/

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'email-attachments',
  'email-attachments',
  false,
  52428800,
  ARRAY[
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'text/plain',
    'text/csv',
    'image/jpeg',
    'image/png',
    'image/gif',
    'image/webp'
  ]
)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Admins and executives can upload email attachments"
  ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'email-attachments' AND
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('admin', 'executive')
    )
  );

CREATE POLICY "Users can view their email attachments"
  ON storage.objects
  FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'email-attachments' AND
    (
      EXISTS (
        SELECT 1 FROM profiles
        WHERE profiles.id = auth.uid()
        AND profiles.role IN ('admin', 'executive')
      )
      OR
      EXISTS (
        SELECT 1 FROM email_messages em
        JOIN email_attachments ea ON ea.email_message_id = em.id
        WHERE ea.file_path = storage.objects.name
        AND (
          (em.entity_type = 'prospect' AND EXISTS (
            SELECT 1 FROM prospects p
            WHERE p.id = em.prospect_id
            AND p.executive_id = auth.uid()
          ))
          OR
          (em.entity_type = 'client' AND EXISTS (
            SELECT 1 FROM clients c
            WHERE c.id = em.client_id
            AND (c.assigned_to = auth.uid() OR c.owner_user_id = auth.uid())
          ))
        )
      )
    )
  );

CREATE POLICY "Admins and executives can delete email attachments"
  ON storage.objects
  FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'email-attachments' AND
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('admin', 'executive')
    )
  );
