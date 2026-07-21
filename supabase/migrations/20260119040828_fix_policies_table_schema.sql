/*
  # Fix Policies Table Schema

  ## Summary
  This migration fixes the policies table schema to match the code expectations
  and properly use the new `clients` table instead of `profiles`.

  ## Changes

  ### 1. Drop old policies table
  - The old table referenced `profiles` as clients
  - Column names don't match code expectations

  ### 2. Create new policies table
  - Uses `clients` table for client references
  - Column names match frontend code:
    - `insurance_company` (not `insurer`)
    - `policy_type` (not `insurance_type`)
    - `created_by` (not `executive_id`)

  ### 3. Security
  - Enable RLS
  - Admins can manage all policies
  - Executives can manage policies of assigned clients
  - Client users can view their own policies (read-only)

  ## Important Notes
  - This replaces the old policies table with a new one
  - The new table properly integrates with the `clients` table
*/

-- Drop old policies table and its dependencies
DROP TABLE IF EXISTS policies CASCADE;

-- Create new policies table with correct schema
CREATE TABLE policies (
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
  status text DEFAULT 'activa',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  created_by uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE
);

-- Enable RLS
ALTER TABLE policies ENABLE ROW LEVEL SECURITY;

-- RLS Policies for policies table
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

CREATE POLICY "Executives can insert policies"
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

-- Create indexes for performance
CREATE INDEX idx_policies_client_id ON policies(client_id);
CREATE INDEX idx_policies_end_date ON policies(end_date);
CREATE INDEX idx_policies_next_payment_date ON policies(next_payment_date);

-- Function to calculate and update policy status
CREATE OR REPLACE FUNCTION calculate_policy_status()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.end_date < CURRENT_DATE THEN
    NEW.status := 'vencida';
  ELSIF NEW.end_date <= CURRENT_DATE + INTERVAL '30 days' THEN
    NEW.status := 'por_vencer';
  ELSE
    NEW.status := 'activa';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to auto-calculate status
DROP TRIGGER IF EXISTS trigger_calculate_policy_status ON policies;
CREATE TRIGGER trigger_calculate_policy_status
  BEFORE INSERT OR UPDATE ON policies
  FOR EACH ROW
  EXECUTE FUNCTION calculate_policy_status();

-- Trigger for updated_at
DROP TRIGGER IF EXISTS trigger_policies_updated_at ON policies;
CREATE TRIGGER trigger_policies_updated_at
  BEFORE UPDATE ON policies
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();
