/*
  # Fix WhatsApp Activity Trigger

  1. Updates
    - Updates the `create_activity_from_whatsapp()` function to use correct column names
    - Changes `from_number` and `to_number` to `from_plain` and `to_plain`
    - Changes `body` to `text` for message content
    - Updates to match current wa_messages table schema

  2. Notes
    - Fixes the "record new has no field from_number" error
    - Ensures WhatsApp messages are properly logged to activity feed
*/

-- Function to create activity from WhatsApp messages
CREATE OR REPLACE FUNCTION create_activity_from_whatsapp()
RETURNS TRIGGER AS $$
DECLARE
  v_entity_type text;
  v_entity_id uuid;
  v_title text;
  v_phone text;
BEGIN
  -- Get the relevant phone number (from contact, not channel)
  IF NEW.direction = 'in' THEN
    v_phone := NEW.from_plain;
  ELSE
    v_phone := NEW.to_plain;
  END IF;
  
  -- Determine entity type and ID from phone number
  SELECT 
    CASE WHEN p.id IS NOT NULL THEN 'prospect' ELSE 'client' END,
    COALESCE(p.id, c.id)
  INTO v_entity_type, v_entity_id
  FROM (SELECT 1) dummy
  LEFT JOIN prospects p ON p.phone = v_phone
  LEFT JOIN clients c ON c.phone = v_phone
  LIMIT 1;
  
  IF v_entity_id IS NOT NULL THEN
    v_title := CASE 
      WHEN NEW.direction = 'in' THEN 'Mensaje WhatsApp recibido'
      ELSE 'Mensaje WhatsApp enviado'
    END;
    
    INSERT INTO activity_feed (
      entity_type,
      entity_id,
      event_type,
      direction,
      title,
      description,
      preview,
      metadata,
      source_table,
      source_id,
      created_at
    ) VALUES (
      v_entity_type,
      v_entity_id,
      'whatsapp',
      CASE WHEN NEW.direction = 'in' THEN 'inbound' ELSE 'outbound' END,
      v_title,
      NEW.text,
      LEFT(COALESCE(NEW.text, ''), 200),
      jsonb_build_object(
        'message_status', NEW.status,
        'has_media', NEW.media_url IS NOT NULL,
        'message_type', NEW.type
      ),
      'wa_messages',
      NEW.id,
      NEW.created_at
    );
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;