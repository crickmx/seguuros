/*
  # Add Clients and Policies Module

  1. New Tables
    - `clients`
      - `id` (uuid, primary key)
      - `owner_user_id` (uuid, foreign key to auth.users) - for client role login
      - `assigned_to` (uuid, foreign key to profiles) - executive/admin managing this client
      - `full_name` (text)
      - `phone` (text)
      - `email` (text, nullable)
      - `internal_notes` (text, nullable)
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)
      - `converted_from_prospect_id` (uuid, nullable) - track if came from prospect
    
    - `policies`
      - `id` (uuid, primary key)
      - `client_id` (uuid, foreign key to clients)
      - `insurance_company` (text) - Aseguradora
      - `policy_number` (text) - Número de póliza
      - `policy_type` (text) - Auto, Vida, GMM, etc.
      - `start_date` (date) - Fecha inicio vigencia
      - `end_date` (date) - Fecha fin vigencia
      - `payment_frequency` (text) - Mensual, Trimestral, Semestral, Anual
      - `total_premium` (numeric) - Prima total
      - `next_payment_date` (date) - Próxima fecha de pago
      - `pdf_url` (text, nullable) - URL to PDF in storage
      - `status` (text) - activa, por_vencer, vencida
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)
      - `created_by` (uuid, foreign key to profiles)

  2. Updates to existing tables
    - `interactions` and `followups` need to support both prospects AND clients
      - Add `client_id` (uuid, nullable, foreign key to clients)
      - Make `prospect_id` nullable
      - Add constraint: at least one of prospect_id or client_id must be set

  3. Security
    - Enable RLS on all new tables
    - Executives can manage clients assigned to them
    - Clients can view their own data (read-only for policies)
    - Admins can manage everything

  4. Important Notes
    - Policy PDFs will be stored in Supabase Storage bucket `policy_pdfs`
    - Status calculation: activa (>30 days), por_vencer (<=30 days), vencida (past end_date)
*/

-- Create clients table
CREATE TABLE IF NOT EXISTS clients (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  assigned_to uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  full_name text NOT NULL,
  phone text NOT NULL,
  email text,
  internal_notes text DEFAULT '',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  converted_from_prospect_id uuid REFERENCES prospects(id) ON DELETE SET NULL
);

-- Create policies table
CREATE TABLE IF NOT EXISTS policies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  insurance_company text NOT NULL,
  policy_number text NOT NULL,
  policy_type text NOT NULL CHECK (policy_type IN ('auto', 'vida', 'gmm', 'daños', 'hogar', 'empresa', 'otro')),
  start_date date NOT NULL,
  end_date date NOT NULL,
  payment_frequency text NOT NULL CHECK (payment_frequency IN ('mensual', 'trimestral', 'semestral', 'anual')),
  total_premium numeric(10, 2) NOT NULL,
  next_payment_date date NOT NULL,
  pdf_url text,
  status text GENERATED ALWAYS AS (
    CASE
      WHEN end_date < CURRENT_DATE THEN 'vencida'
      WHEN end_date <= CURRENT_DATE + INTERVAL '30 days' THEN 'por_vencer'
      ELSE 'activa'
    END
  ) STORED,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  created_by uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE
);

-- Add client_id to interactions table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'interactions' AND column_name = 'client_id'
  ) THEN
    ALTER TABLE interactions ADD COLUMN client_id uuid REFERENCES clients(id) ON DELETE CASCADE;
    ALTER TABLE interactions ALTER COLUMN prospect_id DROP NOT NULL;
    ALTER TABLE interactions ADD CONSTRAINT interactions_prospect_or_client_check 
      CHECK ((prospect_id IS NOT NULL AND client_id IS NULL) OR (prospect_id IS NULL AND client_id IS NOT NULL));
  END IF;
END $$;

-- Add client_id to followups table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'followups' AND column_name = 'client_id'
  ) THEN
    ALTER TABLE followups ADD COLUMN client_id uuid REFERENCES clients(id) ON DELETE CASCADE;
    ALTER TABLE followups ALTER COLUMN prospect_id DROP NOT NULL;
    ALTER TABLE followups ADD CONSTRAINT followups_prospect_or_client_check 
      CHECK ((prospect_id IS NOT NULL AND client_id IS NULL) OR (prospect_id IS NULL AND client_id IS NOT NULL));
  END IF;
END $$;

-- Enable RLS
ALTER TABLE clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE policies ENABLE ROW LEVEL SECURITY;

-- Clients policies
CREATE POLICY "Admins can manage all clients"
  ON clients FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

CREATE POLICY "Executives can view assigned clients"
  ON clients FOR SELECT
  TO authenticated
  USING (
    assigned_to = auth.uid()
    OR EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

CREATE POLICY "Executives can update assigned clients"
  ON clients FOR UPDATE
  TO authenticated
  USING (assigned_to = auth.uid())
  WITH CHECK (assigned_to = auth.uid());

CREATE POLICY "Executives can insert clients"
  ON clients FOR INSERT
  TO authenticated
  WITH CHECK (
    assigned_to = auth.uid()
    OR EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

CREATE POLICY "Client users can view their own data"
  ON clients FOR SELECT
  TO authenticated
  USING (owner_user_id = auth.uid());

-- Policies (insurance policies) RLS
CREATE POLICY "Admins can manage all policies"
  ON policies FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

CREATE POLICY "Executives can view policies of assigned clients"
  ON policies FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM clients
      WHERE clients.id = policies.client_id
      AND clients.assigned_to = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

CREATE POLICY "Executives can manage policies of assigned clients"
  ON policies FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM clients
      WHERE clients.id = policies.client_id
      AND clients.assigned_to = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

CREATE POLICY "Executives can update policies"
  ON policies FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM clients
      WHERE clients.id = policies.client_id
      AND clients.assigned_to = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM clients
      WHERE clients.id = policies.client_id
      AND clients.assigned_to = auth.uid()
    )
  );

CREATE POLICY "Executives can delete policies"
  ON policies FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM clients
      WHERE clients.id = policies.client_id
      AND clients.assigned_to = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

CREATE POLICY "Client users can view their policies"
  ON policies FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM clients
      WHERE clients.id = policies.client_id
      AND clients.owner_user_id = auth.uid()
    )
  );

-- Update interactions policies to support clients
DROP POLICY IF EXISTS "Users can view interactions from their prospects" ON interactions;
CREATE POLICY "Users can view interactions"
  ON interactions FOR SELECT
  TO authenticated
  USING (
    (prospect_id IS NOT NULL AND EXISTS (
      SELECT 1 FROM prospects
      WHERE prospects.id = interactions.prospect_id
      AND (
        prospects.executive_id = auth.uid()
        OR EXISTS (
          SELECT 1 FROM profiles
          WHERE profiles.id = auth.uid()
          AND profiles.role = 'admin'
        )
      )
    ))
    OR
    (client_id IS NOT NULL AND EXISTS (
      SELECT 1 FROM clients
      WHERE clients.id = interactions.client_id
      AND (
        clients.assigned_to = auth.uid()
        OR clients.owner_user_id = auth.uid()
        OR EXISTS (
          SELECT 1 FROM profiles
          WHERE profiles.id = auth.uid()
          AND profiles.role = 'admin'
        )
      )
    ))
  );

DROP POLICY IF EXISTS "Users can create interactions" ON interactions;
CREATE POLICY "Users can create interactions"
  ON interactions FOR INSERT
  TO authenticated
  WITH CHECK (
    created_by = auth.uid()
    AND (
      (prospect_id IS NOT NULL AND EXISTS (
        SELECT 1 FROM prospects
        WHERE prospects.id = interactions.prospect_id
        AND (
          prospects.executive_id = auth.uid()
          OR EXISTS (
            SELECT 1 FROM profiles
            WHERE profiles.id = auth.uid()
            AND profiles.role = 'admin'
          )
        )
      ))
      OR
      (client_id IS NOT NULL AND EXISTS (
        SELECT 1 FROM clients
        WHERE clients.id = interactions.client_id
        AND (
          clients.assigned_to = auth.uid()
          OR EXISTS (
            SELECT 1 FROM profiles
            WHERE profiles.id = auth.uid()
            AND profiles.role = 'admin'
          )
        )
      ))
    )
  );

-- Update followups policies to support clients
DROP POLICY IF EXISTS "Users can view their followups" ON followups;
CREATE POLICY "Users can view followups"
  ON followups FOR SELECT
  TO authenticated
  USING (
    assigned_to = auth.uid()
    OR created_by = auth.uid()
    OR EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
    OR (client_id IS NOT NULL AND EXISTS (
      SELECT 1 FROM clients
      WHERE clients.id = followups.client_id
      AND clients.owner_user_id = auth.uid()
    ))
  );

DROP POLICY IF EXISTS "Users can create followups" ON followups;
CREATE POLICY "Users can create followups"
  ON followups FOR INSERT
  TO authenticated
  WITH CHECK (
    created_by = auth.uid()
    AND (
      (prospect_id IS NOT NULL AND EXISTS (
        SELECT 1 FROM prospects
        WHERE prospects.id = followups.prospect_id
        AND (
          prospects.executive_id = auth.uid()
          OR EXISTS (
            SELECT 1 FROM profiles
            WHERE profiles.id = auth.uid()
            AND profiles.role = 'admin'
          )
        )
      ))
      OR
      (client_id IS NOT NULL AND EXISTS (
        SELECT 1 FROM clients
        WHERE clients.id = followups.client_id
        AND (
          clients.assigned_to = auth.uid()
          OR EXISTS (
            SELECT 1 FROM profiles
            WHERE profiles.id = auth.uid()
            AND profiles.role = 'admin'
          )
        )
      ))
    )
  );

DROP POLICY IF EXISTS "Users can update their followups" ON followups;
CREATE POLICY "Users can update followups"
  ON followups FOR UPDATE
  TO authenticated
  USING (
    assigned_to = auth.uid()
    OR created_by = auth.uid()
    OR EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  )
  WITH CHECK (
    assigned_to = auth.uid()
    OR created_by = auth.uid()
    OR EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_clients_assigned_to ON clients(assigned_to);
CREATE INDEX IF NOT EXISTS idx_clients_owner_user_id ON clients(owner_user_id);
CREATE INDEX IF NOT EXISTS idx_policies_client_id ON policies(client_id);
CREATE INDEX IF NOT EXISTS idx_policies_end_date ON policies(end_date);
CREATE INDEX IF NOT EXISTS idx_policies_next_payment_date ON policies(next_payment_date);
CREATE INDEX IF NOT EXISTS idx_interactions_client_id ON interactions(client_id);
CREATE INDEX IF NOT EXISTS idx_followups_client_id ON followups(client_id);

-- Function to update client last activity
CREATE OR REPLACE FUNCTION update_client_last_activity()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.client_id IS NOT NULL THEN
    UPDATE clients
    SET updated_at = now()
    WHERE id = NEW.client_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger on interactions for clients
DROP TRIGGER IF EXISTS trigger_update_client_activity ON interactions;
CREATE TRIGGER trigger_update_client_activity
  AFTER INSERT ON interactions
  FOR EACH ROW
  EXECUTE FUNCTION update_client_last_activity();

-- Function to auto-update updated_at
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggers for updated_at
DROP TRIGGER IF EXISTS trigger_clients_updated_at ON clients;
CREATE TRIGGER trigger_clients_updated_at
  BEFORE UPDATE ON clients
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();

DROP TRIGGER IF EXISTS trigger_policies_updated_at ON policies;
CREATE TRIGGER trigger_policies_updated_at
  BEFORE UPDATE ON policies
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();
