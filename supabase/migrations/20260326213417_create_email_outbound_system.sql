/*
  # Create Outbound Email System
  
  1. New Tables
    - `email_messages`
      - Stores all outbound emails sent from the CRM
      - Links to prospects or clients
      - Tracks sender, recipients, status, and timestamps
      - Supports CC, BCC fields
      - Stores both HTML and plain text versions
    
    - `email_attachments`
      - Stores metadata for email attachments
      - Links to email_messages
      - Tracks file path in storage, size, MIME type
  
  2. Security
    - Enable RLS on both tables
    - Admin: full access to all emails
    - Executive: access only to emails for assigned prospects/clients
    - Client: no access to this module
  
  3. Features
    - Support for draft, sent, and failed statuses
    - Track provider message IDs for delivery confirmation
    - Error tracking for failed sends
    - Cascade deletes when prospect/client is deleted
*/

-- Create email_messages table
CREATE TABLE IF NOT EXISTS email_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_type text NOT NULL CHECK (entity_type IN ('prospect', 'client')),
  prospect_id uuid REFERENCES prospects(id) ON DELETE CASCADE,
  client_id uuid REFERENCES clients(id) ON DELETE CASCADE,
  sent_by uuid REFERENCES profiles(id) ON DELETE SET NULL,
  to_email text NOT NULL,
  cc_email text,
  bcc_email text,
  subject text NOT NULL,
  body_html text NOT NULL,
  body_text text,
  status text NOT NULL DEFAULT 'sent' CHECK (status IN ('draft', 'sent', 'failed')),
  provider_message_id text,
  error_details text,
  created_at timestamptz DEFAULT now(),
  sent_at timestamptz DEFAULT now(),
  
  CONSTRAINT email_entity_check CHECK (
    (entity_type = 'prospect' AND prospect_id IS NOT NULL AND client_id IS NULL) OR
    (entity_type = 'client' AND client_id IS NOT NULL AND prospect_id IS NULL)
  )
);

-- Create indexes for email_messages
CREATE INDEX IF NOT EXISTS idx_email_messages_prospect_id ON email_messages(prospect_id);
CREATE INDEX IF NOT EXISTS idx_email_messages_client_id ON email_messages(client_id);
CREATE INDEX IF NOT EXISTS idx_email_messages_sent_by ON email_messages(sent_by);
CREATE INDEX IF NOT EXISTS idx_email_messages_sent_at ON email_messages(sent_at DESC);
CREATE INDEX IF NOT EXISTS idx_email_messages_status ON email_messages(status);

-- Create email_attachments table
CREATE TABLE IF NOT EXISTS email_attachments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email_message_id uuid NOT NULL REFERENCES email_messages(id) ON DELETE CASCADE,
  file_name text NOT NULL,
  file_path text NOT NULL,
  mime_type text,
  file_size integer,
  created_at timestamptz DEFAULT now()
);

-- Create index for email_attachments
CREATE INDEX IF NOT EXISTS idx_email_attachments_message_id ON email_attachments(email_message_id);

-- Enable RLS
ALTER TABLE email_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE email_attachments ENABLE ROW LEVEL SECURITY;

-- RLS Policies for email_messages

-- Admin: full access
CREATE POLICY "Admin can view all email messages"
  ON email_messages FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

CREATE POLICY "Admin can insert email messages"
  ON email_messages FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

CREATE POLICY "Admin can update email messages"
  ON email_messages FOR UPDATE
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

CREATE POLICY "Admin can delete email messages"
  ON email_messages FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

-- Executive: access to emails for assigned prospects/clients
CREATE POLICY "Executive can view assigned prospect emails"
  ON email_messages FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'executive'
    )
    AND (
      (entity_type = 'prospect' AND prospect_id IN (
        SELECT id FROM prospects WHERE executive_id = auth.uid()
      ))
      OR
      (entity_type = 'client' AND client_id IN (
        SELECT id FROM clients WHERE assigned_to = auth.uid()
      ))
    )
  );

CREATE POLICY "Executive can insert emails for assigned entities"
  ON email_messages FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'executive'
    )
    AND (
      (entity_type = 'prospect' AND prospect_id IN (
        SELECT id FROM prospects WHERE executive_id = auth.uid()
      ))
      OR
      (entity_type = 'client' AND client_id IN (
        SELECT id FROM clients WHERE assigned_to = auth.uid()
      ))
    )
  );

CREATE POLICY "Executive can update own emails"
  ON email_messages FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'executive'
    )
    AND sent_by = auth.uid()
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'executive'
    )
    AND sent_by = auth.uid()
  );

-- RLS Policies for email_attachments

-- Admin: full access
CREATE POLICY "Admin can view all email attachments"
  ON email_attachments FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

CREATE POLICY "Admin can insert email attachments"
  ON email_attachments FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

CREATE POLICY "Admin can delete email attachments"
  ON email_attachments FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

-- Executive: access to attachments for their emails
CREATE POLICY "Executive can view attachments for assigned emails"
  ON email_attachments FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'executive'
    )
    AND email_message_id IN (
      SELECT id FROM email_messages
      WHERE sent_by = auth.uid()
      OR (
        entity_type = 'prospect' AND prospect_id IN (
          SELECT id FROM prospects WHERE executive_id = auth.uid()
        )
      )
      OR (
        entity_type = 'client' AND client_id IN (
          SELECT id FROM clients WHERE assigned_to = auth.uid()
        )
      )
    )
  );

CREATE POLICY "Executive can insert attachments for own emails"
  ON email_attachments FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'executive'
    )
    AND email_message_id IN (
      SELECT id FROM email_messages WHERE sent_by = auth.uid()
    )
  );