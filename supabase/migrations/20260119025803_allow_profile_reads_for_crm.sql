/*
  # Allow CRM Profile Access

  ## Changes
  - Allow authenticated users to read all profiles (CRM functionality)
  - Keep write restrictions in place
  
  ## Security Note
  - This is a CRM system where executives need to see client profiles
  - Write operations are still restricted
  - Consider app-level role checks for sensitive operations
*/

-- Drop the restrictive read policy
DROP POLICY IF EXISTS "Users can read own profile" ON profiles;
DROP POLICY IF EXISTS "Read assigned profiles" ON profiles;

-- Allow all authenticated users to read profiles (needed for CRM)
CREATE POLICY "Authenticated users can read profiles"
  ON profiles FOR SELECT
  TO authenticated
  USING (true);

-- Keep the update policy restrictive
-- Users can only update their own profile
-- (Admins will create/update through special flows)