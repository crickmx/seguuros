/*
  # Enable Realtime for WhatsApp Tables

  1. Changes
    - Enable Realtime replication for wa_conversations table
    - Enable Realtime replication for wa_messages table
  
  2. Purpose
    - Allow instant updates when messages are received
    - Update conversation list in real-time
    - Improve user experience with instant message delivery

  3. Notes
    - Realtime subscriptions are already implemented in frontend
    - This enables the backend to broadcast changes
*/

-- Enable realtime for wa_conversations
ALTER PUBLICATION supabase_realtime ADD TABLE wa_conversations;

-- Enable realtime for wa_messages
ALTER PUBLICATION supabase_realtime ADD TABLE wa_messages;
