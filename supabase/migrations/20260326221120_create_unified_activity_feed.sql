/*
  # Create Unified Activity Feed System

  ## Overview
  This migration creates a unified activity feed system that aggregates all interactions,
  communications, and events related to prospects and clients into a single timeline view.

  ## New Tables
  
  ### `activity_feed`
  Central table for tracking all CRM activities and events:
  - `id` (uuid, primary key) - Unique identifier for the activity
  - `entity_type` (text) - Type of entity: 'prospect' or 'client'
  - `entity_id` (uuid) - ID of the prospect or client
  - `event_type` (text) - Type of event: 'whatsapp', 'email', 'note', 'followup', 'status_change', 'system'
  - `direction` (text, nullable) - Direction: 'inbound' or 'outbound' (for messages)
  - `title` (text) - Event title/summary
  - `description` (text, nullable) - Detailed description
  - `preview` (text, nullable) - Preview text (first 200 chars of content)
  - `metadata` (jsonb, nullable) - Additional structured data
  - `source_table` (text, nullable) - Origin table (wa_messages, email_messages, etc)
  - `source_id` (uuid, nullable) - ID in the source table
  - `created_by` (uuid, nullable) - User who created the event
  - `created_at` (timestamptz) - When the event occurred
  - `updated_at` (timestamptz) - Last update time

  ## Indexes
  - Fast lookups by entity (entity_type + entity_id)
  - Fast filtering by event type
  - Fast sorting by created_at

  ## Security
  - Enable RLS on activity_feed
  - Admins can view all activities
  - Executives can view activities for their assigned prospects/clients
  - Clients cannot view internal activity feed

  ## Notes
  - This table serves as a materialized view of all CRM activities
  - Can be populated via triggers or application logic
  - Provides fast, unified access to complete activity history
*/

-- Create activity_feed table
CREATE TABLE IF NOT EXISTS activity_feed (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_type text NOT NULL CHECK (entity_type IN ('prospect', 'client')),
  entity_id uuid NOT NULL,
  event_type text NOT NULL CHECK (event_type IN ('whatsapp', 'email', 'note', 'followup', 'status_change', 'system', 'policy')),
  direction text CHECK (direction IN ('inbound', 'outbound')),
  title text NOT NULL,
  description text,
  preview text,
  metadata jsonb DEFAULT '{}'::jsonb,
  source_table text,
  source_id uuid,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_activity_feed_entity ON activity_feed(entity_type, entity_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_activity_feed_event_type ON activity_feed(event_type);
CREATE INDEX IF NOT EXISTS idx_activity_feed_created_at ON activity_feed(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_activity_feed_source ON activity_feed(source_table, source_id);

-- Enable RLS
ALTER TABLE activity_feed ENABLE ROW LEVEL SECURITY;

-- Admin can view all activities
CREATE POLICY "Admins can view all activities"
  ON activity_feed FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

-- Executives can view activities for assigned prospects
CREATE POLICY "Executives can view assigned prospect activities"
  ON activity_feed FOR SELECT
  TO authenticated
  USING (
    entity_type = 'prospect'
    AND EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'ejecutivo'
    )
    AND (
      entity_id IN (
        SELECT id FROM prospects
        WHERE executive_id = auth.uid()
      )
      OR entity_id IN (
        SELECT id FROM prospects
        WHERE executive_id IS NULL
      )
    )
  );

-- Executives can view activities for assigned clients
CREATE POLICY "Executives can view assigned client activities"
  ON activity_feed FOR SELECT
  TO authenticated
  USING (
    entity_type = 'client'
    AND EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'ejecutivo'
    )
    AND entity_id IN (
      SELECT id FROM clients
      WHERE assigned_to = auth.uid()
    )
  );

-- Admin and executives can insert activities
CREATE POLICY "Admin and executives can create activities"
  ON activity_feed FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('admin', 'ejecutivo')
    )
  );

-- Users can update their own activities
CREATE POLICY "Users can update own activities"
  ON activity_feed FOR UPDATE
  TO authenticated
  USING (created_by = auth.uid())
  WITH CHECK (created_by = auth.uid());

-- Admin can update any activity
CREATE POLICY "Admins can update all activities"
  ON activity_feed FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

-- Function to automatically create activity from interactions
CREATE OR REPLACE FUNCTION create_activity_from_interaction()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO activity_feed (
    entity_type,
    entity_id,
    event_type,
    title,
    description,
    preview,
    metadata,
    source_table,
    source_id,
    created_by,
    created_at
  ) VALUES (
    CASE 
      WHEN NEW.prospect_id IS NOT NULL THEN 'prospect'
      WHEN NEW.client_id IS NOT NULL THEN 'client'
    END,
    COALESCE(NEW.prospect_id, NEW.client_id),
    'note',
    'Nota interna',
    NEW.content,
    LEFT(NEW.content, 200),
    jsonb_build_object('interaction_type', NEW.type),
    'interactions',
    NEW.id,
    NEW.created_by,
    NEW.created_at
  );
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger for interactions
DROP TRIGGER IF EXISTS trigger_activity_from_interaction ON interactions;
CREATE TRIGGER trigger_activity_from_interaction
  AFTER INSERT ON interactions
  FOR EACH ROW
  EXECUTE FUNCTION create_activity_from_interaction();

-- Function to create activity from WhatsApp messages
CREATE OR REPLACE FUNCTION create_activity_from_whatsapp()
RETURNS TRIGGER AS $$
DECLARE
  v_entity_type text;
  v_entity_id uuid;
  v_title text;
BEGIN
  -- Determine entity type and ID from phone number
  SELECT 
    CASE WHEN p.id IS NOT NULL THEN 'prospect' ELSE 'client' END,
    COALESCE(p.id, c.id)
  INTO v_entity_type, v_entity_id
  FROM (SELECT 1) dummy
  LEFT JOIN prospects p ON p.phone = NEW.from_number OR p.phone = NEW.to_number
  LEFT JOIN clients c ON c.phone = NEW.from_number OR c.phone = NEW.to_number
  LIMIT 1;
  
  IF v_entity_id IS NOT NULL THEN
    v_title := CASE 
      WHEN NEW.direction = 'inbound' THEN 'Mensaje WhatsApp recibido'
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
      NEW.direction,
      v_title,
      NEW.body,
      LEFT(NEW.body, 200),
      jsonb_build_object(
        'message_status', NEW.status,
        'has_media', NEW.media_url IS NOT NULL
      ),
      'wa_messages',
      NEW.id,
      NEW.created_at
    );
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger for WhatsApp messages
DROP TRIGGER IF EXISTS trigger_activity_from_whatsapp ON wa_messages;
CREATE TRIGGER trigger_activity_from_whatsapp
  AFTER INSERT ON wa_messages
  FOR EACH ROW
  EXECUTE FUNCTION create_activity_from_whatsapp();

-- Function to create activity from email messages
CREATE OR REPLACE FUNCTION create_activity_from_email()
RETURNS TRIGGER AS $$
DECLARE
  v_entity_id uuid;
BEGIN
  v_entity_id := COALESCE(NEW.prospect_id, NEW.client_id);
  
  IF v_entity_id IS NOT NULL THEN
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
      'outbound',
      CONCAT('Email: ', NEW.subject),
      NEW.body_text,
      LEFT(COALESCE(NEW.body_text, NEW.body_html, ''), 200),
      jsonb_build_object(
        'to_email', NEW.to_email,
        'status', NEW.status
      ),
      'email_messages',
      NEW.id,
      NEW.sent_by,
      NEW.created_at
    );
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger for email messages
DROP TRIGGER IF EXISTS trigger_activity_from_email ON email_messages;
CREATE TRIGGER trigger_activity_from_email
  AFTER INSERT ON email_messages
  FOR EACH ROW
  EXECUTE FUNCTION create_activity_from_email();

-- Function to create activity from followups
CREATE OR REPLACE FUNCTION create_activity_from_followup()
RETURNS TRIGGER AS $$
DECLARE
  v_title text;
  v_description text;
BEGIN
  IF TG_OP = 'INSERT' THEN
    v_title := 'Seguimiento programado';
    v_description := CONCAT('Canal: ', NEW.channel, ' - ', NEW.notes);
  ELSIF TG_OP = 'UPDATE' AND OLD.status != NEW.status THEN
    v_title := CASE NEW.status
      WHEN 'completado' THEN 'Seguimiento completado'
      WHEN 'cancelado' THEN 'Seguimiento cancelado'
      ELSE 'Seguimiento actualizado'
    END;
    v_description := NEW.notes;
  ELSE
    RETURN NEW;
  END IF;
  
  INSERT INTO activity_feed (
    entity_type,
    entity_id,
    event_type,
    title,
    description,
    preview,
    metadata,
    source_table,
    source_id,
    created_by,
    created_at
  ) VALUES (
    CASE 
      WHEN NEW.prospect_id IS NOT NULL THEN 'prospect'
      WHEN NEW.client_id IS NOT NULL THEN 'client'
    END,
    COALESCE(NEW.prospect_id, NEW.client_id),
    'followup',
    v_title,
    v_description,
    LEFT(COALESCE(v_description, ''), 200),
    jsonb_build_object(
      'channel', NEW.channel,
      'status', NEW.status,
      'due_at', NEW.due_at
    ),
    'followups',
    NEW.id,
    NEW.created_by,
    now()
  );
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger for followups
DROP TRIGGER IF EXISTS trigger_activity_from_followup ON followups;
CREATE TRIGGER trigger_activity_from_followup
  AFTER INSERT OR UPDATE ON followups
  FOR EACH ROW
  EXECUTE FUNCTION create_activity_from_followup();

-- Function to create activity from prospect status changes
CREATE OR REPLACE FUNCTION create_activity_from_prospect_status()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO activity_feed (
      entity_type,
      entity_id,
      event_type,
      title,
      description,
      metadata,
      created_at
    ) VALUES (
      'prospect',
      NEW.id,
      'system',
      'Lead creado',
      CONCAT('Nuevo lead: ', NEW.full_name),
      jsonb_build_object('status', NEW.status),
      NEW.created_at
    );
  ELSIF TG_OP = 'UPDATE' AND OLD.status != NEW.status THEN
    INSERT INTO activity_feed (
      entity_type,
      entity_id,
      event_type,
      title,
      description,
      metadata,
      created_at
    ) VALUES (
      'prospect',
      NEW.id,
      'status_change',
      'Cambio de estatus',
      CONCAT(OLD.status, ' → ', NEW.status),
      jsonb_build_object('old_status', OLD.status, 'new_status', NEW.status),
      NEW.updated_at
    );
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger for prospect status changes
DROP TRIGGER IF EXISTS trigger_activity_from_prospect_status ON prospects;
CREATE TRIGGER trigger_activity_from_prospect_status
  AFTER INSERT OR UPDATE ON prospects
  FOR EACH ROW
  EXECUTE FUNCTION create_activity_from_prospect_status();

-- Function to create activity from client and policy changes
CREATE OR REPLACE FUNCTION create_activity_from_client()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO activity_feed (
      entity_type,
      entity_id,
      event_type,
      title,
      description,
      metadata,
      created_at
    ) VALUES (
      'client',
      NEW.id,
      'system',
      'Cliente creado',
      CONCAT('Nuevo cliente: ', NEW.full_name),
      jsonb_build_object('converted_from_prospect', NEW.converted_from_prospect_id),
      NEW.created_at
    );
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger for client creation
DROP TRIGGER IF EXISTS trigger_activity_from_client ON clients;
CREATE TRIGGER trigger_activity_from_client
  AFTER INSERT ON clients
  FOR EACH ROW
  EXECUTE FUNCTION create_activity_from_client();

-- Function to create activity from policy changes
CREATE OR REPLACE FUNCTION create_activity_from_policy()
RETURNS TRIGGER AS $$
DECLARE
  v_title text;
  v_description text;
BEGIN
  IF TG_OP = 'INSERT' THEN
    v_title := 'Póliza agregada';
    v_description := CONCAT('Póliza: ', NEW.policy_number, ' - ', NEW.policy_type);
  ELSIF TG_OP = 'UPDATE' THEN
    v_title := 'Póliza modificada';
    v_description := CONCAT('Póliza actualizada: ', NEW.policy_number);
  ELSIF TG_OP = 'DELETE' THEN
    v_title := 'Póliza eliminada';
    v_description := CONCAT('Póliza eliminada: ', OLD.policy_number);
  END IF;
  
  INSERT INTO activity_feed (
    entity_type,
    entity_id,
    event_type,
    title,
    description,
    metadata,
    created_at
  ) VALUES (
    'client',
    COALESCE(NEW.client_id, OLD.client_id),
    'policy',
    v_title,
    v_description,
    jsonb_build_object(
      'policy_number', COALESCE(NEW.policy_number, OLD.policy_number),
      'policy_type', COALESCE(NEW.policy_type, OLD.policy_type),
      'action', TG_OP
    ),
    now()
  );
  
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger for policy changes
DROP TRIGGER IF EXISTS trigger_activity_from_policy ON policies;
CREATE TRIGGER trigger_activity_from_policy
  AFTER INSERT OR UPDATE OR DELETE ON policies
  FOR EACH ROW
  EXECUTE FUNCTION create_activity_from_policy();