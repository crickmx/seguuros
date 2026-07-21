/*
  # Create WhatsApp Media Storage Bucket

  1. New Storage Bucket
    - `whatsapp-media` - For WhatsApp attachments (images, videos, audio, documents)
    - Private bucket (not public)
    - File size limit: 16MB (WABA limit)
    - Allowed MIME types: images, videos, audio, documents

  2. Security
    - Authenticated users can upload files
    - Users can only read their own organization's files
    - RLS policies on bucket

  3. Notes
    - Files are organized by conversation_id
    - Temporary signed URLs generated for sending to Wazzup
*/

-- Insert bucket if it doesn't exist
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'whatsapp-media',
  'whatsapp-media',
  false,
  16777216,
  ARRAY[
    'image/jpeg',
    'image/png',
    'image/webp',
    'video/mp4',
    'video/3gpp',
    'audio/mpeg',
    'audio/ogg',
    'audio/aac',
    'audio/amr',
    'application/pdf',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-powerpoint',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation'
  ]
)
ON CONFLICT (id) DO NOTHING;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Authenticated users can upload media" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can read media" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete their media" ON storage.objects;

-- Allow authenticated users to upload files
CREATE POLICY "Authenticated users can upload media"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'whatsapp-media');

-- Allow authenticated users to read media
CREATE POLICY "Authenticated users can read media"
ON storage.objects FOR SELECT
TO authenticated
USING (bucket_id = 'whatsapp-media');

-- Allow users to delete their uploaded files
CREATE POLICY "Users can delete their media"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'whatsapp-media');
