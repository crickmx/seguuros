/*
  # Fix RLS for unassigned prospects from WhatsApp

  ## Problem
  - WhatsApp webhook creates prospects without executive_id
  - Current RLS only allows ejecutivos to see prospects where executive_id = auth.uid()
  - This blocks the JOIN in wa_conversations query, hiding conversations in UI

  ## Solution
  - Update SELECT policy to allow ejecutivos to see unassigned prospects (executive_id IS NULL)
  - This allows WhatsApp inbox to display conversations with auto-created prospects

  ## Changes
  1. Drop old restrictive policy
  2. Create new policy allowing access to:
     - Own prospects (executive_id = auth.uid())
     - Unassigned prospects (executive_id IS NULL)
     - All prospects for admins
*/

-- Drop the old restrictive policy
DROP POLICY IF EXISTS "Ejecutivos can view their prospects" ON prospects;

-- Create new policy that allows viewing unassigned prospects
CREATE POLICY "Ejecutivos can view assigned and unassigned prospects"
  ON prospects
  FOR SELECT
  TO authenticated
  USING (
    (executive_id = auth.uid()) 
    OR (executive_id IS NULL)
    OR (EXISTS (
      SELECT 1 FROM profiles 
      WHERE profiles.id = auth.uid() 
      AND profiles.role = 'admin'
    ))
  );
