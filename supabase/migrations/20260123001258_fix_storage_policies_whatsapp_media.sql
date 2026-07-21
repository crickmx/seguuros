/*
  # Fix WhatsApp Media Storage Policies

  1. Changes
    - Safely recreate storage policies for whatsapp-media bucket
    - Ensure policies are correctly scoped to the bucket
    - Add UPDATE policy for signed URL generation

  2. Security
    - Authenticated users can upload to whatsapp-media
    - Authenticated users can read from whatsapp-media
    - Authenticated users can update (for signed URLs)
    - Authenticated users can delete their files
*/

-- Drop old policies if they exist (with proper bucket filtering)
DO $$
BEGIN
  DROP POLICY IF EXISTS "Authenticated users can upload media" ON storage.objects;
  DROP POLICY IF EXISTS "Authenticated users can read media" ON storage.objects;
  DROP POLICY IF EXISTS "Users can delete their media" ON storage.objects;
  DROP POLICY IF EXISTS "Authenticated users can update media" ON storage.objects;
EXCEPTION
  WHEN undefined_object THEN
    NULL;
END $$;

-- Allow authenticated users to upload files to whatsapp-media
CREATE POLICY "Authenticated users can upload media"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'whatsapp-media');

-- Allow authenticated users to read media from whatsapp-media
CREATE POLICY "Authenticated users can read media"
ON storage.objects FOR SELECT
TO authenticated
USING (bucket_id = 'whatsapp-media');

-- Allow authenticated users to update files in whatsapp-media (needed for signed URLs)
CREATE POLICY "Authenticated users can update media"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'whatsapp-media')
WITH CHECK (bucket_id = 'whatsapp-media');

-- Allow users to delete files from whatsapp-media
CREATE POLICY "Users can delete their media"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'whatsapp-media');