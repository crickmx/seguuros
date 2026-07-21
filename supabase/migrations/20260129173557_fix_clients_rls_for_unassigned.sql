/*
  # Fix RLS for unassigned clients in WhatsApp inbox

  ## Problem
  - Executives can only see clients where assigned_to = auth.uid()
  - WhatsApp conversations might be linked to unassigned clients
  - This blocks the JOIN in wa_conversations query

  ## Solution
  - Update SELECT policy to allow ejecutivos to see unassigned clients (assigned_to IS NULL)

  ## Changes
  1. Drop old restrictive policy
  2. Create new policy allowing access to:
     - Assigned clients (assigned_to = auth.uid())
     - Unassigned clients (assigned_to IS NULL)
     - All clients for admins (already covered by separate policy)
*/

-- Drop the old restrictive policy
DROP POLICY IF EXISTS "Executives can view assigned clients" ON clients;

-- Create new policy that allows viewing unassigned clients
CREATE POLICY "Executives can view assigned and unassigned clients"
  ON clients
  FOR SELECT
  TO authenticated
  USING (
    (assigned_to = auth.uid())
    OR (assigned_to IS NULL)
  );
