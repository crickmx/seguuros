/*
  # Create WhatsApp Message Templates System

  1. New Tables
    - `wa_message_templates`
      - `id` (uuid, primary key)
      - `name` (text) - Display name of the template
      - `content` (text) - Message content/body
      - `category` (text) - Category for organization (greeting, follow_up, etc)
      - `is_default` (boolean) - Whether this is a system default template
      - `created_by` (uuid) - Reference to user who created it
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)

  2. Security
    - Enable RLS on `wa_message_templates` table
    - Add policies for authenticated users to read all templates
    - Add policies for users to create/update/delete their own templates
    - Add policies for admins to manage all templates

  3. Initial Data
    - Insert default greeting template
*/

CREATE TABLE IF NOT EXISTS wa_message_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  content text NOT NULL,
  category text DEFAULT 'general',
  is_default boolean DEFAULT false,
  created_by uuid REFERENCES profiles(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE wa_message_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view all templates"
  ON wa_message_templates FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can create own templates"
  ON wa_message_templates FOR INSERT
  TO authenticated
  WITH CHECK (created_by = auth.uid());

CREATE POLICY "Users can update own templates"
  ON wa_message_templates FOR UPDATE
  TO authenticated
  USING (created_by = auth.uid() OR is_default = false)
  WITH CHECK (created_by = auth.uid());

CREATE POLICY "Users can delete own templates"
  ON wa_message_templates FOR DELETE
  TO authenticated
  USING (created_by = auth.uid());

CREATE POLICY "Admins can manage all templates"
  ON wa_message_templates FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

INSERT INTO wa_message_templates (name, content, category, is_default)
VALUES 
  ('Saludo Seguuros', '¡Hola! Te escribimos desde Seguuros.com', 'greeting', true),
  ('Seguimiento', 'Hola, ¿tuviste oportunidad de revisar la información que te compartimos?', 'follow_up', true),
  ('Agradecimiento', 'Muchas gracias por tu tiempo. Quedamos atentos a cualquier duda que tengas.', 'closing', true)
ON CONFLICT DO NOTHING;

CREATE INDEX IF NOT EXISTS idx_wa_message_templates_created_by ON wa_message_templates(created_by);
CREATE INDEX IF NOT EXISTS idx_wa_message_templates_category ON wa_message_templates(category);
