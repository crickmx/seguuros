export interface WhatsAppConversation {
  id: string;
  channel_id: string;
  contact_phone_e164: string;
  contact_plain: string;
  prospect_id: string | null;
  client_id: string | null;
  assigned_to: string | null;
  inbox_state: 'unassigned' | 'assigned' | 'closed';
  last_message_at: string;
  last_message_preview: string | null;
  last_inbound_at: string | null;
  unread_admin: number;
  unread_exec: number;
  created_at: string;
  prospect?: {
    id: string;
    full_name: string;
    phone: string | null;
    email: string | null;
  };
  client?: {
    id: string;
    full_name: string;
    phone: string | null;
    email: string | null;
  };
  assigned_user?: {
    id: string;
    full_name: string;
  };
}

export interface WhatsAppMessage {
  id: string;
  conversation_id: string;
  direction: 'in' | 'out' | 'system';
  wazzup_message_id: string | null;
  from_plain: string;
  to_plain: string;
  type: 'text' | 'image' | 'video' | 'audio' | 'document' | 'file' | 'template' | 'status';
  text: string | null;
  media_url: string | null;
  media_meta: any;
  status: string | null;
  error_details?: {
    code?: string;
    description?: string;
  };
  sent_at: string | null;
  created_at: string;
}

export interface WhatsAppTemplate {
  id: string;
  template_id: string;
  name: string;
  language: string;
  category: string;
  components: any[];
  updated_at: string;
}
