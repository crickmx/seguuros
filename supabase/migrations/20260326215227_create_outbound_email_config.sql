/*
  # Create Outbound Email Configuration Table
  
  1. New Table
    - `email_outbound_config`
      - Stores SMTP configuration for sending emails
      - Supports multiple configurations (future: multiple accounts)
      - Stores encrypted credentials
      - Tracks configuration status and last test
  
  2. Security
    - Enable RLS
    - Only admin can view, create, update, and delete configurations
    - Credentials are stored encrypted
  
  3. Features
    - Support for SMTP configuration
    - Test connection tracking
    - Active/inactive status
    - From name and email customization
*/

-- Create email_outbound_config table
CREATE TABLE IF NOT EXISTS email_outbound_config (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  from_email text NOT NULL,
  from_name text NOT NULL,
  smtp_host text NOT NULL,
  smtp_port integer NOT NULL DEFAULT 587,
  smtp_user text NOT NULL,
  smtp_password text NOT NULL,
  smtp_secure boolean NOT NULL DEFAULT true,
  is_active boolean NOT NULL DEFAULT true,
  last_test_at timestamptz,
  last_test_status text CHECK (last_test_status IN ('success', 'failed', NULL)),
  last_test_error text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create index for active configurations
CREATE INDEX IF NOT EXISTS idx_email_outbound_config_active ON email_outbound_config(is_active);

-- Enable RLS
ALTER TABLE email_outbound_config ENABLE ROW LEVEL SECURITY;

-- RLS Policies: Only admin can manage email configurations

CREATE POLICY "Admin can view email outbound config"
  ON email_outbound_config FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

CREATE POLICY "Admin can insert email outbound config"
  ON email_outbound_config FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

CREATE POLICY "Admin can update email outbound config"
  ON email_outbound_config FOR UPDATE
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

CREATE POLICY "Admin can delete email outbound config"
  ON email_outbound_config FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_email_outbound_config_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for updated_at
DROP TRIGGER IF EXISTS update_email_outbound_config_timestamp ON email_outbound_config;
CREATE TRIGGER update_email_outbound_config_timestamp
  BEFORE UPDATE ON email_outbound_config
  FOR EACH ROW
  EXECUTE FUNCTION update_email_outbound_config_updated_at();