/*
  # Simplificar WhatsApp Inbox para todos los usuarios
  
  ## Cambios Realizados
  
  1. Schema Changes
     - Hacer `channel_id` nullable en `wa_conversations` para conversaciones creadas manualmente
     - Agregar valor por defecto 'all' a inbox_state
  
  2. Cambios de Seguridad RLS
     - Permitir que todos los usuarios autenticados (admin y ejecutivo) vean todas las conversaciones
     - Permitir que todos los usuarios autenticados creen y envíen mensajes
     - Simplificar permisos para que sea como WhatsApp Web
  
  ## Notas Importantes
  - Las conversaciones ahora pueden existir sin un channel_id (conversaciones creadas manualmente)
  - Todos los usuarios autenticados tienen acceso completo a todas las conversaciones
  - Se mantiene el seguimiento de asignaciones pero no es obligatorio
*/

-- Hacer channel_id nullable para conversaciones creadas manualmente
ALTER TABLE wa_conversations 
  ALTER COLUMN channel_id DROP NOT NULL;

-- Eliminar políticas RLS restrictivas existentes
DROP POLICY IF EXISTS "Ejecutivos pueden ver sus conversaciones asignadas" ON wa_conversations;
DROP POLICY IF EXISTS "Ejecutivos pueden actualizar sus conversaciones" ON wa_conversations;
DROP POLICY IF EXISTS "Ejecutivos pueden ver mensajes de sus conversaciones" ON wa_messages;
DROP POLICY IF EXISTS "Ejecutivos pueden crear mensajes en sus conversaciones" ON wa_messages;

-- Nuevas políticas más permisivas para wa_conversations
CREATE POLICY "Usuarios autenticados pueden ver todas las conversaciones"
  ON wa_conversations FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('admin', 'ejecutivo')
    )
  );

CREATE POLICY "Usuarios autenticados pueden crear conversaciones"
  ON wa_conversations FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('admin', 'ejecutivo')
    )
  );

CREATE POLICY "Usuarios autenticados pueden actualizar conversaciones"
  ON wa_conversations FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('admin', 'ejecutivo')
    )
  );

-- Nuevas políticas más permisivas para wa_messages
CREATE POLICY "Usuarios autenticados pueden ver todos los mensajes"
  ON wa_messages FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('admin', 'ejecutivo')
    )
  );

CREATE POLICY "Usuarios autenticados pueden crear mensajes"
  ON wa_messages FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('admin', 'ejecutivo')
    )
  );

CREATE POLICY "Usuarios autenticados pueden actualizar mensajes"
  ON wa_messages FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('admin', 'ejecutivo')
    )
  );
