/*
  # Add WABA Features Support

  1. New Columns to wa_messages
    - `storage_path` (text) - Path to file in Supabase Storage
    - `interactive_data` (jsonb) - Data for buttons/lists interactive messages
    - `template_data` (jsonb) - Template information if sent via template

  2. New Tables
    - `wa_templates` - Cache of WhatsApp templates from Wazzup
      - `id` (uuid, primary key)
      - `channel_id` (text) - Which channel owns this template
      - `wazzup_template_id` (text, unique)
      - `name` (text) - Template name
      - `language` (text) - Template language code
      - `category` (text) - Template category
      - `status` (text) - Template status (approved, pending, rejected)
      - `components` (jsonb) - Template structure (header, body, footer, buttons)
      - `synced_at` (timestamptz) - Last sync time
      - `created_at` (timestamptz)

  3. Storage Bucket
    - Create 'whatsapp-media' bucket for attachments

  4. Security
    - Enable RLS on wa_templates
    - Add policies for authenticated users to read templates
    - Storage bucket with authenticated access only

  5. Indexes
    - Index on wa_templates.channel_id for fast lookups
    - Index on wa_templates.wazzup_template_id for webhook updates
*/

-- Add storage_path for Supabase Storage files
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'wa_messages' AND column_name = 'storage_path'
  ) THEN
    ALTER TABLE wa_messages 
    ADD COLUMN storage_path text;
  END IF;
END $$;

-- Add interactive_data for buttons/lists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'wa_messages' AND column_name = 'interactive_data'
  ) THEN
    ALTER TABLE wa_messages 
    ADD COLUMN interactive_data jsonb;
  END IF;
END $$;

-- Add template_data for template messages
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'wa_messages' AND column_name = 'template_data'
  ) THEN
    ALTER TABLE wa_messages 
    ADD COLUMN template_data jsonb;
  END IF;
END $$;

-- Create wa_templates table
CREATE TABLE IF NOT EXISTS wa_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  channel_id text NOT NULL,
  wazzup_template_id text UNIQUE NOT NULL,
  name text NOT NULL,
  language text NOT NULL DEFAULT 'es',
  category text NOT NULL DEFAULT 'MARKETING',
  status text NOT NULL DEFAULT 'APPROVED',
  components jsonb NOT NULL DEFAULT '[]'::jsonb,
  synced_at timestamptz DEFAULT now(),
  created_at timestamptz DEFAULT now()
);

-- Enable RLS on wa_templates
ALTER TABLE wa_templates ENABLE ROW LEVEL SECURITY;

-- Create policies for wa_templates
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'wa_templates' AND policyname = 'Authenticated users can read templates'
  ) THEN
    CREATE POLICY "Authenticated users can read templates"
      ON wa_templates FOR SELECT
      TO authenticated
      USING (true);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'wa_templates' AND policyname = 'Service role can manage templates'
  ) THEN
    CREATE POLICY "Service role can manage templates"
      ON wa_templates FOR ALL
      TO service_role
      USING (true)
      WITH CHECK (true);
  END IF;
END $$;

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_wa_templates_channel_id ON wa_templates(channel_id);
CREATE INDEX IF NOT EXISTS idx_wa_templates_wazzup_id ON wa_templates(wazzup_template_id);
CREATE INDEX IF NOT EXISTS idx_wa_templates_status ON wa_templates(status);
