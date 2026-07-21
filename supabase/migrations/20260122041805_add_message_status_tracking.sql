/*
  # Add Message Status Tracking

  1. Changes
    - Add `error_details` field to wa_messages for storing error information
    - Add `last_inbound_at` to wa_conversations to track 24h window for WABA compliance
    - Update status column constraint to include all delivery states
    - Add index on wazzup_message_id for fast webhook lookups (if not exists)

  2. Security
    - No RLS changes needed (inherits from existing policies)
  
  3. Notes
    - Status values: pending, sent, delivered, read, failed
    - last_inbound_at tracks when client last messaged us (for 24h template rule)
*/

-- Add error details field for failed messages
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'wa_messages' AND column_name = 'error_details'
  ) THEN
    ALTER TABLE wa_messages 
    ADD COLUMN error_details jsonb;
  END IF;
END $$;

-- Add index for fast webhook lookups by wazzup_message_id
CREATE INDEX IF NOT EXISTS idx_wa_messages_wazzup_id ON wa_messages(wazzup_message_id);

-- Add last_inbound_at to conversations for 24h window tracking
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'wa_conversations' AND column_name = 'last_inbound_at'
  ) THEN
    ALTER TABLE wa_conversations 
    ADD COLUMN last_inbound_at timestamptz;
  END IF;
END $$;

-- Initialize last_inbound_at from existing inbound messages
UPDATE wa_conversations c
SET last_inbound_at = (
  SELECT MAX(m.sent_at)
  FROM wa_messages m
  WHERE m.conversation_id = c.id
  AND m.direction = 'inbound'
)
WHERE last_inbound_at IS NULL;