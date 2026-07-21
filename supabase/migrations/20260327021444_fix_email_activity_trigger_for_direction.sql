/*
  # Fix email activity feed trigger
  
  1. Changes
    - Update trigger to use the `direction` field from email_messages table
    - Use `sent_at` instead of `created_at` for proper chronological ordering
    - Handle both inbound and outbound emails correctly
*/

-- Drop and recreate the trigger function with correct field mapping
CREATE OR REPLACE FUNCTION create_activity_from_email()
RETURNS TRIGGER AS $$
DECLARE
  v_entity_id uuid;
  v_title text;
BEGIN
  v_entity_id := COALESCE(NEW.prospect_id, NEW.client_id);
  
  IF v_entity_id IS NOT NULL THEN
    v_title := CASE 
      WHEN NEW.direction = 'inbound' THEN CONCAT('Email recibido: ', NEW.subject)
      ELSE CONCAT('Email enviado: ', NEW.subject)
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
      created_by,
      created_at
    ) VALUES (
      NEW.entity_type,
      v_entity_id,
      'email',
      COALESCE(NEW.direction, 'outbound'),
      v_title,
      NEW.body_text,
      LEFT(COALESCE(NEW.body_text, NEW.body_html, ''), 200),
      jsonb_build_object(
        'to_email', NEW.to_email,
        'from_email', NEW.from_email,
        'status', NEW.status
      ),
      'email_messages',
      NEW.id,
      NEW.sent_by,
      COALESCE(NEW.sent_at, NEW.created_at)
    );
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
