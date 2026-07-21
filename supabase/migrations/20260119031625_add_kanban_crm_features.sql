/*
  # Add Kanban CRM Features
  
  1. New Tables
    - `interactions`
      - `id` (uuid, primary key)
      - `prospect_id` (uuid, foreign key)
      - `created_by` (uuid, foreign key to profiles)
      - `type` (text: 'nota', 'llamada', 'whatsapp', 'email', 'cambio_status')
      - `content` (text)
      - `created_at` (timestamptz)
    
    - `followups`
      - `id` (uuid, primary key)
      - `prospect_id` (uuid, foreign key)
      - `created_by` (uuid, foreign key)
      - `assigned_to` (uuid, foreign key)
      - `due_at` (timestamptz)
      - `channel` (text: 'llamada', 'whatsapp', 'email', 'otro')
      - `title` (text)
      - `notes` (text)
      - `status` (text: 'pendiente', 'completado', 'cancelado')
      - `created_at` (timestamptz)
      - `completed_at` (timestamptz, nullable)
  
  2. Updates to existing tables
    - `prospects`
      - Add `last_activity_at` (timestamptz)
      - Add `priority` (text, nullable)
      - Add `lost_reason` (text, nullable)
      - Add `assigned_to` (uuid, foreign key to profiles) - rename from executive_id
  
  3. Security
    - Enable RLS on new tables
    - Add policies for authenticated users
*/

-- Add new columns to prospects
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'prospects' AND column_name = 'last_activity_at'
  ) THEN
    ALTER TABLE prospects ADD COLUMN last_activity_at timestamptz DEFAULT now();
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'prospects' AND column_name = 'priority'
  ) THEN
    ALTER TABLE prospects ADD COLUMN priority text CHECK (priority IN ('alta', 'media', 'baja'));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'prospects' AND column_name = 'lost_reason'
  ) THEN
    ALTER TABLE prospects ADD COLUMN lost_reason text;
  END IF;
END $$;

-- Create interactions table
CREATE TABLE IF NOT EXISTS interactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  prospect_id uuid NOT NULL REFERENCES prospects(id) ON DELETE CASCADE,
  created_by uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  type text NOT NULL CHECK (type IN ('nota', 'llamada', 'whatsapp', 'email', 'cambio_status')),
  content text NOT NULL,
  created_at timestamptz DEFAULT now()
);

-- Create followups table
CREATE TABLE IF NOT EXISTS followups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  prospect_id uuid NOT NULL REFERENCES prospects(id) ON DELETE CASCADE,
  created_by uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  assigned_to uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  due_at timestamptz NOT NULL,
  channel text NOT NULL CHECK (channel IN ('llamada', 'whatsapp', 'email', 'otro')),
  title text NOT NULL,
  notes text DEFAULT '',
  status text NOT NULL DEFAULT 'pendiente' CHECK (status IN ('pendiente', 'completado', 'cancelado')),
  created_at timestamptz DEFAULT now(),
  completed_at timestamptz
);

-- Enable RLS
ALTER TABLE interactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE followups ENABLE ROW LEVEL SECURITY;

-- Interactions policies
CREATE POLICY "Users can view interactions from their prospects"
  ON interactions FOR SELECT
  TO authenticated
  USING (
    EXISTS (
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
    )
  );

CREATE POLICY "Users can create interactions"
  ON interactions FOR INSERT
  TO authenticated
  WITH CHECK (
    created_by = auth.uid()
    AND EXISTS (
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
    )
  );

-- Followups policies
CREATE POLICY "Users can view their followups"
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
  );

CREATE POLICY "Users can create followups"
  ON followups FOR INSERT
  TO authenticated
  WITH CHECK (
    created_by = auth.uid()
    AND EXISTS (
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
    )
  );

CREATE POLICY "Users can update their followups"
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
CREATE INDEX IF NOT EXISTS idx_interactions_prospect_id ON interactions(prospect_id);
CREATE INDEX IF NOT EXISTS idx_interactions_created_at ON interactions(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_followups_prospect_id ON followups(prospect_id);
CREATE INDEX IF NOT EXISTS idx_followups_assigned_to ON followups(assigned_to);
CREATE INDEX IF NOT EXISTS idx_followups_due_at ON followups(due_at);
CREATE INDEX IF NOT EXISTS idx_followups_status ON followups(status);
CREATE INDEX IF NOT EXISTS idx_prospects_last_activity ON prospects(last_activity_at DESC);

-- Function to update last_activity_at
CREATE OR REPLACE FUNCTION update_prospect_last_activity()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE prospects
  SET last_activity_at = now()
  WHERE id = NEW.prospect_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger on interactions
DROP TRIGGER IF EXISTS trigger_update_prospect_activity ON interactions;
CREATE TRIGGER trigger_update_prospect_activity
  AFTER INSERT ON interactions
  FOR EACH ROW
  EXECUTE FUNCTION update_prospect_last_activity();
