/*
  # Fix RLS Policies - Remove Infinite Recursion

  ## Changes
  - Drop existing policies on profiles table
  - Create new simplified policies without circular references
  - Users can always read their own profile
  - Admins, ejecutivos, and clientes can update their own data
  
  ## Security
  - Maintains security while removing recursion
  - Each user can view their own profile
  - Admins can be identified after loading their profile
*/

-- Drop existing problematic policies
DROP POLICY IF EXISTS "Admins can view all profiles" ON profiles;
DROP POLICY IF EXISTS "Ejecutivos can view their assigned clients" ON profiles;
DROP POLICY IF EXISTS "Users can view their own profile" ON profiles;
DROP POLICY IF EXISTS "Admins can insert profiles" ON profiles;
DROP POLICY IF EXISTS "Admins can update profiles" ON profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON profiles;

-- Create simple, non-recursive policies

-- Allow users to read their own profile (no recursion)
CREATE POLICY "Users can read own profile"
  ON profiles FOR SELECT
  TO authenticated
  USING (auth.uid() = id);

-- Allow users to update their own profile
CREATE POLICY "Users can update own profile"
  ON profiles FOR UPDATE
  TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- Allow reading profiles for assigned executive or admin
-- This uses a simpler check without nested SELECT on profiles
CREATE POLICY "Read assigned profiles"
  ON profiles FOR SELECT
  TO authenticated
  USING (
    auth.uid() = id OR 
    assigned_executive_id = auth.uid()
  );

-- Allow INSERT only for service role or through application logic
-- Users will be created via auth.signUp and then profile inserted
CREATE POLICY "Allow profile creation"
  ON profiles FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = id);