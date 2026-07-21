/*
  # Add Last Sync UID Tracking to Email Ingest Accounts

  1. Changes
    - Add `last_sync_uid` column to `email_ingest_accounts` table to track the last processed email UID
    - Add `messages_synced_count` to track total messages processed
  
  2. Purpose
    - Prevent duplicate email ingestion by tracking the highest UID processed
    - Enable incremental email fetching (only fetch emails with UID > last_sync_uid)
    - Track sync progress and history
*/

-- Add tracking columns to email_ingest_accounts
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'email_ingest_accounts' AND column_name = 'last_sync_uid'
  ) THEN
    ALTER TABLE email_ingest_accounts 
    ADD COLUMN last_sync_uid integer DEFAULT NULL;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'email_ingest_accounts' AND column_name = 'messages_synced_count'
  ) THEN
    ALTER TABLE email_ingest_accounts 
    ADD COLUMN messages_synced_count integer DEFAULT 0;
  END IF;
END $$;

-- Add comments explaining the tracking system
COMMENT ON COLUMN email_ingest_accounts.last_sync_uid IS 'UID of the last email message successfully synced from IMAP server';
COMMENT ON COLUMN email_ingest_accounts.messages_synced_count IS 'Total count of messages synced from this account';
