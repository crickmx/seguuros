/*
  # Seguuros.com - Complete Database Schema

  ## Overview
  This migration creates the complete database structure for Seguuros.com,
  an InsurTech CRM and digital insurance wallet platform.

  ## New Tables

  ### 1. `profiles`
  Extends auth.users with additional user information
  - `id` (uuid, FK to auth.users)
  - `email` (text)
  - `full_name` (text)
  - `phone` (text)
  - `role` (text) - 'admin', 'ejecutivo', 'cliente'
  - `assigned_executive_id` (uuid) - FK to profiles (for clients)
  - `created_at` (timestamptz)
  - `updated_at` (timestamptz)

  ### 2. `prospects`
  Stores potential clients (leads)
  - `id` (uuid, PK)
  - `full_name` (text)
  - `phone` (text)
  - `email` (text)
  - `product_interest` (text)
  - `origin` (text) - 'whatsapp', 'web', 'referido', 'otro'
  - `status` (text) - 'nuevo', 'contactado', 'cotizado', 'cerrado', 'perdido'
  - `comments` (text)
  - `executive_id` (uuid, FK to profiles)
  - `converted_to_client_id` (uuid, FK to profiles, nullable)
  - `created_at` (timestamptz)
  - `updated_at` (timestamptz)

  ### 3. `notes`
  Activity log and notes for prospects and clients
  - `id` (uuid, PK)
  - `prospect_id` (uuid, FK to prospects, nullable)
  - `client_id` (uuid, FK to profiles, nullable)
  - `executive_id` (uuid, FK to profiles)
  - `content` (text)
  - `created_at` (timestamptz)

  ### 4. `policies`
  Insurance policies attached to clients
  - `id` (uuid, PK)
  - `client_id` (uuid, FK to profiles)
  - `insurer` (text) - Insurance company name
  - `policy_number` (text)
  - `insurance_type` (text) - 'auto', 'vida', 'gmm', 'hogar', etc.
  - `start_date` (date)
  - `end_date` (date)
  - `payment_frequency` (text) - 'mensual', 'trimestral', 'semestral', 'anual'
  - `total_premium` (decimal)
  - `next_payment_date` (date)
  - `pdf_url` (text, nullable)
  - `status` (text) - 'activa', 'proxima_renovacion', 'vencida'
  - `executive_id` (uuid, FK to profiles)
  - `created_at` (timestamptz)
  - `updated_at` (timestamptz)

  ## Security
  - RLS enabled on all tables
  - Admin: full access to everything
  - Ejecutivo: access to assigned prospects, clients, and policies
  - Cliente: access only to their own data

  ## Important Notes
  - Automatic date calculations for next_payment_date
  - Status updates based on dates
  - Complete audit trail with created_at/updated_at
*/

-- Create profiles table (extends auth.users)
CREATE TABLE IF NOT EXISTS profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email text UNIQUE NOT NULL,
  full_name text NOT NULL,
  phone text,
  role text NOT NULL CHECK (role IN ('admin', 'ejecutivo', 'cliente')) DEFAULT 'cliente',
  assigned_executive_id uuid REFERENCES profiles(id),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create prospects table
CREATE TABLE IF NOT EXISTS prospects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  full_name text NOT NULL,
  phone text NOT NULL,
  email text,
  product_interest text,
  origin text CHECK (origin IN ('whatsapp', 'web', 'referido', 'otro')) DEFAULT 'otro',
  status text CHECK (status IN ('nuevo', 'contactado', 'cotizado', 'cerrado', 'perdido')) DEFAULT 'nuevo',
  comments text,
  executive_id uuid REFERENCES profiles(id) NOT NULL,
  converted_to_client_id uuid REFERENCES profiles(id),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create notes table
CREATE TABLE IF NOT EXISTS notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  prospect_id uuid REFERENCES prospects(id) ON DELETE CASCADE,
  client_id uuid REFERENCES profiles(id) ON DELETE CASCADE,
  executive_id uuid REFERENCES profiles(id) NOT NULL,
  content text NOT NULL,
  created_at timestamptz DEFAULT now()
);

-- Create policies table
CREATE TABLE IF NOT EXISTS policies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  insurer text NOT NULL,
  policy_number text NOT NULL,
  insurance_type text NOT NULL,
  start_date date NOT NULL,
  end_date date NOT NULL,
  payment_frequency text CHECK (payment_frequency IN ('mensual', 'trimestral', 'semestral', 'anual')) DEFAULT 'mensual',
  total_premium decimal(10, 2) NOT NULL DEFAULT 0,
  next_payment_date date,
  pdf_url text,
  status text DEFAULT 'activa',
  executive_id uuid REFERENCES profiles(id) NOT NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_prospects_executive ON prospects(executive_id);
CREATE INDEX IF NOT EXISTS idx_prospects_status ON prospects(status);
CREATE INDEX IF NOT EXISTS idx_policies_client ON policies(client_id);
CREATE INDEX IF NOT EXISTS idx_policies_status ON policies(status);
CREATE INDEX IF NOT EXISTS idx_notes_prospect ON notes(prospect_id);
CREATE INDEX IF NOT EXISTS idx_notes_client ON notes(client_id);
CREATE INDEX IF NOT EXISTS idx_profiles_role ON profiles(role);
CREATE INDEX IF NOT EXISTS idx_profiles_assigned_executive ON profiles(assigned_executive_id);

-- Enable RLS on all tables
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE prospects ENABLE ROW LEVEL SECURITY;
ALTER TABLE notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE policies ENABLE ROW LEVEL SECURITY;

-- RLS Policies for profiles
CREATE POLICY "Admins can view all profiles"
  ON profiles FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
    )
  );

CREATE POLICY "Ejecutivos can view their assigned clients"
  ON profiles FOR SELECT
  TO authenticated
  USING (
    auth.uid() = id OR
    assigned_executive_id = auth.uid() OR
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
    )
  );

CREATE POLICY "Users can view their own profile"
  ON profiles FOR SELECT
  TO authenticated
  USING (auth.uid() = id);

CREATE POLICY "Admins can insert profiles"
  ON profiles FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
    )
  );

CREATE POLICY "Admins can update profiles"
  ON profiles FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
    )
  );

CREATE POLICY "Users can update own profile"
  ON profiles FOR UPDATE
  TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- RLS Policies for prospects
CREATE POLICY "Admins can view all prospects"
  ON prospects FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
    )
  );

CREATE POLICY "Ejecutivos can view their prospects"
  ON prospects FOR SELECT
  TO authenticated
  USING (
    executive_id = auth.uid() OR
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
    )
  );

CREATE POLICY "Ejecutivos can insert prospects"
  ON prospects FOR INSERT
  TO authenticated
  WITH CHECK (
    executive_id = auth.uid() OR
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid() AND profiles.role IN ('admin', 'ejecutivo')
    )
  );

CREATE POLICY "Ejecutivos can update their prospects"
  ON prospects FOR UPDATE
  TO authenticated
  USING (
    executive_id = auth.uid() OR
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
    )
  )
  WITH CHECK (
    executive_id = auth.uid() OR
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
    )
  );

CREATE POLICY "Ejecutivos can delete their prospects"
  ON prospects FOR DELETE
  TO authenticated
  USING (
    executive_id = auth.uid() OR
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
    )
  );

-- RLS Policies for notes
CREATE POLICY "Admins can view all notes"
  ON notes FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
    )
  );

CREATE POLICY "Ejecutivos can view notes they created"
  ON notes FOR SELECT
  TO authenticated
  USING (
    executive_id = auth.uid() OR
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
    )
  );

CREATE POLICY "Ejecutivos can insert notes"
  ON notes FOR INSERT
  TO authenticated
  WITH CHECK (
    executive_id = auth.uid() OR
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid() AND profiles.role IN ('admin', 'ejecutivo')
    )
  );

-- RLS Policies for policies
CREATE POLICY "Admins can view all policies"
  ON policies FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
    )
  );

CREATE POLICY "Ejecutivos can view policies they manage"
  ON policies FOR SELECT
  TO authenticated
  USING (
    executive_id = auth.uid() OR
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
    )
  );

CREATE POLICY "Clients can view their own policies"
  ON policies FOR SELECT
  TO authenticated
  USING (
    client_id = auth.uid() OR
    executive_id = auth.uid() OR
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
    )
  );

CREATE POLICY "Ejecutivos can insert policies"
  ON policies FOR INSERT
  TO authenticated
  WITH CHECK (
    executive_id = auth.uid() OR
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid() AND profiles.role IN ('admin', 'ejecutivo')
    )
  );

CREATE POLICY "Ejecutivos can update policies they manage"
  ON policies FOR UPDATE
  TO authenticated
  USING (
    executive_id = auth.uid() OR
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
    )
  )
  WITH CHECK (
    executive_id = auth.uid() OR
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
    )
  );

CREATE POLICY "Ejecutivos can delete policies they manage"
  ON policies FOR DELETE
  TO authenticated
  USING (
    executive_id = auth.uid() OR
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
    )
  );

-- Function to automatically update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggers for updated_at
CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_prospects_updated_at BEFORE UPDATE ON prospects
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_policies_updated_at BEFORE UPDATE ON policies
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Function to calculate next payment date
CREATE OR REPLACE FUNCTION calculate_next_payment_date(
  start_date date,
  payment_frequency text
)
RETURNS date AS $$
BEGIN
  CASE payment_frequency
    WHEN 'mensual' THEN
      RETURN start_date + INTERVAL '1 month';
    WHEN 'trimestral' THEN
      RETURN start_date + INTERVAL '3 months';
    WHEN 'semestral' THEN
      RETURN start_date + INTERVAL '6 months';
    WHEN 'anual' THEN
      RETURN start_date + INTERVAL '1 year';
    ELSE
      RETURN start_date + INTERVAL '1 month';
  END CASE;
END;
$$ LANGUAGE plpgsql;

-- Function to update policy status based on dates
CREATE OR REPLACE FUNCTION update_policy_status()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.end_date < CURRENT_DATE THEN
    NEW.status := 'vencida';
  ELSIF NEW.end_date - CURRENT_DATE <= 30 THEN
    NEW.status := 'proxima_renovacion';
  ELSE
    NEW.status := 'activa';
  END IF;
  
  -- Calculate next payment date if not set
  IF NEW.next_payment_date IS NULL THEN
    NEW.next_payment_date := calculate_next_payment_date(NEW.start_date, NEW.payment_frequency);
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to auto-update policy status
CREATE TRIGGER set_policy_status BEFORE INSERT OR UPDATE ON policies
  FOR EACH ROW EXECUTE FUNCTION update_policy_status();