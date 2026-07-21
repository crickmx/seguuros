/*
  # Add RLS policies for email_messages table

  1. Security
    - Enable RLS on email_messages table
    - Add policy for authenticated users to read emails they sent
    - Add policy for authenticated users to read emails linked to their clients
    - Add policy for authenticated users to read emails linked to their prospects
    - Add policy for authenticated users to insert their own emails
*/

-- Enable RLS
ALTER TABLE email_messages ENABLE ROW LEVEL SECURITY;

-- Users can read emails they sent
CREATE POLICY "Users can read own sent emails"
  ON email_messages
  FOR SELECT
  TO authenticated
  USING (sent_by = auth.uid());

-- Users can read emails for their assigned clients
CREATE POLICY "Users can read client emails"
  ON email_messages
  FOR SELECT
  TO authenticated
  USING (
    client_id IN (
      SELECT id FROM clients
      WHERE assigned_to = auth.uid() OR owner_user_id = auth.uid()
    )
  );

-- Users can read emails for their assigned prospects
CREATE POLICY "Users can read prospect emails"
  ON email_messages
  FOR SELECT
  TO authenticated
  USING (
    prospect_id IN (
      SELECT id FROM prospects
      WHERE executive_id = auth.uid()
    )
  );

-- Admins can read all emails
CREATE POLICY "Admins can read all emails"
  ON email_messages
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- Users can insert their own emails
CREATE POLICY "Users can create own emails"
  ON email_messages
  FOR INSERT
  TO authenticated
  WITH CHECK (sent_by = auth.uid());

-- Enable RLS on email_attachments
ALTER TABLE email_attachments ENABLE ROW LEVEL SECURITY;

-- Users can read attachments from emails they can read
CREATE POLICY "Users can read email attachments"
  ON email_attachments
  FOR SELECT
  TO authenticated
  USING (
    email_message_id IN (
      SELECT id FROM email_messages
      WHERE sent_by = auth.uid()
        OR client_id IN (
          SELECT id FROM clients
          WHERE assigned_to = auth.uid() OR owner_user_id = auth.uid()
        )
        OR prospect_id IN (
          SELECT id FROM prospects
          WHERE executive_id = auth.uid()
        )
        OR EXISTS (
          SELECT 1 FROM profiles
          WHERE id = auth.uid() AND role = 'admin'
        )
    )
  );

-- Users can insert attachments for their own emails
CREATE POLICY "Users can create email attachments"
  ON email_attachments
  FOR INSERT
  TO authenticated
  WITH CHECK (
    email_message_id IN (
      SELECT id FROM email_messages
      WHERE sent_by = auth.uid()
    )
  );
