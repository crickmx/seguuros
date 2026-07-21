/*
  # Crear módulo WhatsApp Inbox con Wazzup24 WABA

  ## Nuevas tablas

  1. **wa_channels**
     - `id` (uuid, primary key)
     - `channel_id` (text, unique) - UUID de Wazzup
     - `transport` (text) - tipo de transporte (waba/whatsapp)
     - `plain_id` (text) - número sin símbolos
     - `state` (text) - estado del canal
     - `is_primary` (boolean) - canal principal
     - `created_at` (timestamptz)

  2. **wa_conversations**
     - `id` (uuid, primary key)
     - `channel_id` (text) - ID del canal Wazzup
     - `contact_phone_e164` (text) - teléfono formato E164
     - `contact_plain` (text) - teléfono sin formato
     - `prospect_id` (uuid, nullable) - referencia a prospects
     - `client_id` (uuid, nullable) - referencia a clients
     - `assigned_to` (uuid, nullable) - ejecutivo asignado
     - `inbox_state` (text) - estado: unassigned|assigned|closed
     - `last_message_at` (timestamptz)
     - `last_message_preview` (text)
     - `unread_admin` (int) - mensajes no leídos por admin
     - `unread_exec` (int) - mensajes no leídos por ejecutivo
     - `created_at` (timestamptz)

  3. **wa_messages**
     - `id` (uuid, primary key)
     - `conversation_id` (uuid) - referencia a wa_conversations
     - `direction` (text) - in|out|system
     - `wazzup_message_id` (text, unique) - ID de Wazzup para idempotencia
     - `from_plain` (text) - remitente
     - `to_plain` (text) - destinatario
     - `type` (text) - text|image|file|template|status
     - `text` (text, nullable)
     - `media_url` (text, nullable)
     - `media_meta` (jsonb, nullable)
     - `status` (text, nullable) - sent|delivered|read|failed
     - `sent_at` (timestamptz, nullable)
     - `created_at` (timestamptz)

  4. **wa_templates_cache**
     - `id` (uuid, primary key)
     - `template_id` (text)
     - `name` (text)
     - `language` (text)
     - `category` (text)
     - `components` (jsonb)
     - `updated_at` (timestamptz)

  ## Seguridad
  - RLS habilitado en todas las tablas
  - Admin puede leer/escribir todo
  - Ejecutivos solo ven conversaciones asignadas a ellos
  - Clientes no tienen acceso
*/

-- Tabla wa_channels: canales de WhatsApp configurados
CREATE TABLE IF NOT EXISTS wa_channels (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  channel_id text UNIQUE NOT NULL,
  transport text NOT NULL DEFAULT 'waba',
  plain_id text NOT NULL,
  state text,
  is_primary boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);

-- Tabla wa_conversations: conversaciones de WhatsApp
CREATE TABLE IF NOT EXISTS wa_conversations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  channel_id text NOT NULL,
  contact_phone_e164 text NOT NULL,
  contact_plain text NOT NULL,
  prospect_id uuid REFERENCES prospects(id) ON DELETE SET NULL,
  client_id uuid REFERENCES clients(id) ON DELETE SET NULL,
  assigned_to uuid REFERENCES profiles(id) ON DELETE SET NULL,
  inbox_state text NOT NULL DEFAULT 'unassigned',
  last_message_at timestamptz DEFAULT now(),
  last_message_preview text,
  unread_admin int DEFAULT 0,
  unread_exec int DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  CONSTRAINT unique_conversation UNIQUE (channel_id, contact_plain)
);

-- Índices para wa_conversations
CREATE INDEX IF NOT EXISTS idx_wa_conversations_assigned 
  ON wa_conversations(assigned_to, inbox_state, last_message_at DESC);

CREATE INDEX IF NOT EXISTS idx_wa_conversations_prospect 
  ON wa_conversations(prospect_id);

CREATE INDEX IF NOT EXISTS idx_wa_conversations_client 
  ON wa_conversations(client_id);

-- Tabla wa_messages: mensajes de WhatsApp
CREATE TABLE IF NOT EXISTS wa_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid NOT NULL REFERENCES wa_conversations(id) ON DELETE CASCADE,
  direction text NOT NULL,
  wazzup_message_id text UNIQUE,
  from_plain text NOT NULL,
  to_plain text NOT NULL,
  type text NOT NULL DEFAULT 'text',
  text text,
  media_url text,
  media_meta jsonb,
  status text,
  sent_at timestamptz,
  created_at timestamptz DEFAULT now()
);

-- Índices para wa_messages
CREATE INDEX IF NOT EXISTS idx_wa_messages_conversation 
  ON wa_messages(conversation_id, created_at);

CREATE INDEX IF NOT EXISTS idx_wa_messages_wazzup_id 
  ON wa_messages(wazzup_message_id);

-- Tabla wa_templates_cache: cache de templates WABA
CREATE TABLE IF NOT EXISTS wa_templates_cache (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id text NOT NULL,
  name text NOT NULL,
  language text NOT NULL,
  category text,
  components jsonb,
  updated_at timestamptz DEFAULT now(),
  CONSTRAINT unique_template UNIQUE (template_id, language)
);

-- Habilitar RLS en todas las tablas
ALTER TABLE wa_channels ENABLE ROW LEVEL SECURITY;
ALTER TABLE wa_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE wa_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE wa_templates_cache ENABLE ROW LEVEL SECURITY;

-- Políticas RLS para wa_channels
CREATE POLICY "Admins pueden ver todos los canales"
  ON wa_channels FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

CREATE POLICY "Admins pueden gestionar canales"
  ON wa_channels FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

-- Políticas RLS para wa_conversations
CREATE POLICY "Admins pueden ver todas las conversaciones"
  ON wa_conversations FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

CREATE POLICY "Ejecutivos pueden ver sus conversaciones asignadas"
  ON wa_conversations FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'ejecutivo'
      AND wa_conversations.assigned_to = auth.uid()
    )
  );

CREATE POLICY "Admins pueden gestionar todas las conversaciones"
  ON wa_conversations FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

CREATE POLICY "Ejecutivos pueden actualizar sus conversaciones"
  ON wa_conversations FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'ejecutivo'
      AND wa_conversations.assigned_to = auth.uid()
    )
  );

-- Políticas RLS para wa_messages
CREATE POLICY "Admins pueden ver todos los mensajes"
  ON wa_messages FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

CREATE POLICY "Ejecutivos pueden ver mensajes de sus conversaciones"
  ON wa_messages FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM wa_conversations
      JOIN profiles ON profiles.id = auth.uid()
      WHERE wa_conversations.id = wa_messages.conversation_id
      AND profiles.role = 'ejecutivo'
      AND wa_conversations.assigned_to = auth.uid()
    )
  );

CREATE POLICY "Admins pueden crear mensajes"
  ON wa_messages FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

CREATE POLICY "Ejecutivos pueden crear mensajes en sus conversaciones"
  ON wa_messages FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM wa_conversations
      JOIN profiles ON profiles.id = auth.uid()
      WHERE wa_conversations.id = wa_messages.conversation_id
      AND profiles.role = 'ejecutivo'
      AND wa_conversations.assigned_to = auth.uid()
    )
  );

-- Políticas RLS para wa_templates_cache
CREATE POLICY "Usuarios autenticados pueden ver templates"
  ON wa_templates_cache FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('admin', 'ejecutivo')
    )
  );

CREATE POLICY "Solo admins pueden gestionar templates"
  ON wa_templates_cache FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );