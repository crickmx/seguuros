/*
  # Fix clients table RLS policies

  1. Changes
    - Drop the problematic "FOR ALL" policy for admins
    - Create separate policies for SELECT, INSERT, UPDATE, DELETE for admins
    - Ensure executives can insert clients they are assigned to

  2. Security
    - Admins can perform all operations on all clients
    - Executives can view and manage only their assigned clients
    - Executives can insert new clients and assign them to themselves
*/

-- Drop existing policies
DROP POLICY IF EXISTS "Admins can manage all clients" ON clients;
DROP POLICY IF EXISTS "Executives can view assigned clients" ON clients;
DROP POLICY IF EXISTS "Executives can update assigned clients" ON clients;
DROP POLICY IF EXISTS "Executives can insert clients" ON clients;

-- Admin policies
CREATE POLICY "Admins can view all clients"
  ON clients FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

CREATE POLICY "Admins can insert clients"
  ON clients FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

CREATE POLICY "Admins can update all clients"
  ON clients FOR UPDATE
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

CREATE POLICY "Admins can delete clients"
  ON clients FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

-- Executive policies
CREATE POLICY "Executives can view assigned clients"
  ON clients FOR SELECT
  TO authenticated
  USING (assigned_to = auth.uid());

CREATE POLICY "Executives can insert clients"
  ON clients FOR INSERT
  TO authenticated
  WITH CHECK (assigned_to = auth.uid());

CREATE POLICY "Executives can update assigned clients"
  ON clients FOR UPDATE
  TO authenticated
  USING (assigned_to = auth.uid())
  WITH CHECK (assigned_to = auth.uid());

CREATE POLICY "Executives can delete assigned clients"
  ON clients FOR DELETE
  TO authenticated
  USING (assigned_to = auth.uid());