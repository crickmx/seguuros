/*
  # Add direction and from_email to email_messages table

  1. Changes
    - Adds `direction` column to track if email is inbound or outbound
    - Adds `from_email` column to store sender email address (for inbound emails)
    
  2. Notes
    - Direction defaults to 'outbound' for backwards compatibility
    - from_email is nullable since outbound emails don't need it
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'email_messages' AND column_name = 'direction'
  ) THEN
    ALTER TABLE email_messages 
    ADD COLUMN direction text DEFAULT 'outbound' CHECK (direction IN ('inbound', 'outbound'));
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'email_messages' AND column_name = 'from_email'
  ) THEN
    ALTER TABLE email_messages 
    ADD COLUMN from_email text;
  END IF;
END $$;
