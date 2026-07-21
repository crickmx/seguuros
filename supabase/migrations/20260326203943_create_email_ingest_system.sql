/*
  # Create Email Ingest System for Lead Generation

  ## New Tables

  1. **email_ingest_accounts**
    - Stores IMAP account configurations for receiving leads via email
    - Columns:
      - `id` (uuid, primary key)
      - `name` (text) - Account display name
      - `imap_host` (text) - IMAP server host
      - `imap_port` (integer) - IMAP server port
      - `imap_user` (text) - IMAP username
      - `imap_password` (text) - IMAP password (encrypted)
      - `imap_tls` (boolean) - Use TLS/SSL
      - `imap_mailbox` (text) - Mailbox folder to monitor
      - `is_active` (boolean) - Account active status
      - `last_sync_at` (timestamptz) - Last sync timestamp
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)

  2. **email_ingest_messages**
    - Records all processed emails and their results
    - Columns:
      - `id` (uuid, primary key)
      - `account_id` (uuid) - References email_ingest_accounts
      - `message_id` (text, unique) - Email message ID
      - `from_email` (text) - Sender email
      - `subject` (text) - Email subject
      - `raw_body` (text) - Raw email body
      - `parsed_name` (text) - Extracted name
      - `parsed_phone` (text) - Extracted phone
      - `parsed_email` (text) - Extracted email
      - `parsed_details` (text) - Extracted details
      - `status` (text) - Processing status
      - `created_prospect_id` (uuid) - Created prospect reference
      - `error_details` (text) - Error information
      - `received_at` (timestamptz) - Email received date
      - `processed_at` (timestamptz) - Processing timestamp
      - `created_at` (timestamptz)

  ## Security
  
  - Enable RLS on both tables
  - Only admins can manage email ingest accounts
  - Only admins and ejecutivos can view processed messages
*/

CREATE TABLE IF NOT EXISTS email_ingest_accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  imap_host text NOT NULL,
  imap_port integer NOT NULL,
  imap_user text NOT NULL,
  imap_password text NOT NULL,
  imap_tls boolean DEFAULT true,
  imap_mailbox text DEFAULT 'INBOX',
  is_active boolean DEFAULT true,
  last_sync_at timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS email_ingest_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id uuid NOT NULL REFERENCES email_ingest_accounts(id) ON DELETE CASCADE,
  message_id text UNIQUE NOT NULL,
  from_email text,
  subject text,
  raw_body text,
  parsed_name text,
  parsed_phone text,
  parsed_email text,
  parsed_details text,
  status text NOT NULL CHECK (status IN ('processed', 'duplicate', 'error', 'skipped')),
  created_prospect_id uuid REFERENCES prospects(id) ON DELETE SET NULL,
  error_details text,
  received_at timestamptz,
  processed_at timestamptz DEFAULT now(),
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_email_ingest_messages_account ON email_ingest_messages(account_id);
CREATE INDEX IF NOT EXISTS idx_email_ingest_messages_status ON email_ingest_messages(status);
CREATE INDEX IF NOT EXISTS idx_email_ingest_messages_processed ON email_ingest_messages(processed_at DESC);

ALTER TABLE email_ingest_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE email_ingest_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage email ingest accounts"
  ON email_ingest_accounts FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

CREATE POLICY "Admins and ejecutivos can view processed messages"
  ON email_ingest_messages FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('admin', 'ejecutivo')
    )
  );

CREATE POLICY "Admins can manage processed messages"
  ON email_ingest_messages FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );
