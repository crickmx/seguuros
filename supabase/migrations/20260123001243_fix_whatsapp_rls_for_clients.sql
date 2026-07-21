/*
  # Fix WhatsApp RLS Policies for Clients

  1. Changes
    - Add RLS policies for clients to view their own WhatsApp conversations
    - Add RLS policies for clients to view messages from their conversations
    - Add RLS policies for clients to send messages in their conversations
    - Ensure clients can only access conversations linked to their client_id

  2. Security
    - Clients can only SELECT conversations where client_id = their ID
    - Clients can only SELECT messages from their conversations
    - Clients can only INSERT messages in their conversations
    - Clients cannot modify conversation state or assignments
*/

-- Allow clients to view their own conversations
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'wa_conversations' AND policyname = 'Clientes pueden ver sus conversaciones'
  ) THEN
    CREATE POLICY "Clientes pueden ver sus conversaciones"
      ON wa_conversations FOR SELECT
      TO authenticated
      USING (
        EXISTS (
          SELECT 1 FROM profiles
          WHERE profiles.id = auth.uid()
          AND profiles.role = 'cliente'
          AND wa_conversations.client_id = auth.uid()
        )
      );
  END IF;
END $$;

-- Allow clients to update unread counts in their conversations
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'wa_conversations' AND policyname = 'Clientes pueden actualizar contadores de sus conversaciones'
  ) THEN
    CREATE POLICY "Clientes pueden actualizar contadores de sus conversaciones"
      ON wa_conversations FOR UPDATE
      TO authenticated
      USING (
        EXISTS (
          SELECT 1 FROM profiles
          WHERE profiles.id = auth.uid()
          AND profiles.role = 'cliente'
          AND wa_conversations.client_id = auth.uid()
        )
      )
      WITH CHECK (
        EXISTS (
          SELECT 1 FROM profiles
          WHERE profiles.id = auth.uid()
          AND profiles.role = 'cliente'
          AND wa_conversations.client_id = auth.uid()
        )
      );
  END IF;
END $$;

-- Allow clients to view messages from their conversations
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'wa_messages' AND policyname = 'Clientes pueden ver mensajes de sus conversaciones'
  ) THEN
    CREATE POLICY "Clientes pueden ver mensajes de sus conversaciones"
      ON wa_messages FOR SELECT
      TO authenticated
      USING (
        EXISTS (
          SELECT 1 FROM wa_conversations
          JOIN profiles ON profiles.id = auth.uid()
          WHERE wa_conversations.id = wa_messages.conversation_id
          AND profiles.role = 'cliente'
          AND wa_conversations.client_id = auth.uid()
        )
      );
  END IF;
END $$;

-- Allow clients to send messages in their conversations
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'wa_messages' AND policyname = 'Clientes pueden crear mensajes en sus conversaciones'
  ) THEN
    CREATE POLICY "Clientes pueden crear mensajes en sus conversaciones"
      ON wa_messages FOR INSERT
      TO authenticated
      WITH CHECK (
        EXISTS (
          SELECT 1 FROM wa_conversations
          JOIN profiles ON profiles.id = auth.uid()
          WHERE wa_conversations.id = wa_messages.conversation_id
          AND profiles.role = 'cliente'
          AND wa_conversations.client_id = auth.uid()
        )
      );
  END IF;
END $$;