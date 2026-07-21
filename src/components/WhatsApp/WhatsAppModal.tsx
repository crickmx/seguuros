import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import type { WhatsAppConversation, WhatsAppMessage } from '../../types/whatsapp';
import { ConversationsList } from './ConversationsList';
import { ChatPanel } from './ChatPanel';

interface WhatsAppModalProps {
  phoneNumber?: string;
  onClose: () => void;
}

export function WhatsAppModal({ phoneNumber, onClose }: WhatsAppModalProps) {
  const { profile } = useAuth();
  const [conversations, setConversations] = useState<WhatsAppConversation[]>([]);
  const [selectedConversation, setSelectedConversation] = useState<WhatsAppConversation | null>(null);
  const [messages, setMessages] = useState<WhatsAppMessage[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadConversations();

    const channel = supabase
      .channel('wa_modal_changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'wa_conversations'
        },
        () => {
          loadConversations();
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'wa_messages'
        },
        () => {
          if (selectedConversation) {
            loadMessages(selectedConversation.id);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  useEffect(() => {
    if (phoneNumber && conversations.length > 0) {
      const conv = conversations.find(c => c.contact_phone_e164 === phoneNumber);
      if (conv) {
        setSelectedConversation(conv);
        loadMessages(conv.id);
      }
    }
  }, [phoneNumber, conversations]);

  async function loadConversations() {
    try {
      const query = supabase
        .from('wa_conversations')
        .select(`
          *,
          prospect:prospects(id, full_name, phone, email),
          client:clients(id, full_name, phone, email),
          assigned_user:profiles!assigned_to(id, full_name)
        `)
        .order('last_message_at', { ascending: false });

      if (profile?.role !== 'admin') {
        query.or(`assigned_to.eq.${profile?.id},assigned_to.is.null`);
      }

      const { data, error } = await query;

      if (error) throw error;
      setConversations(data || []);
    } catch (error) {
      console.error('Error loading conversations:', error);
    } finally {
      setLoading(false);
    }
  }

  async function loadMessages(conversationId: string) {
    try {
      const { data, error } = await supabase
        .from('wa_messages')
        .select('*')
        .eq('conversation_id', conversationId)
        .order('created_at', { ascending: true });

      if (error) throw error;
      setMessages(data || []);
    } catch (error) {
      console.error('Error loading messages:', error);
    }
  }

  async function handleSelectConversation(conversation: WhatsAppConversation) {
    setSelectedConversation(conversation);
    await loadMessages(conversation.id);

    const unreadCount = profile?.role === 'admin' ? conversation.unread_admin : conversation.unread_exec;
    if (unreadCount > 0) {
      const updateField = profile?.role === 'admin' ? 'unread_admin' : 'unread_exec';
      await supabase
        .from('wa_conversations')
        .update({ [updateField]: 0 })
        .eq('id', conversation.id);
    }
  }

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        background: 'rgba(0, 0, 0, 0.5)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000,
        padding: '20px',
      }}
      onClick={onClose}
    >
      <div
        style={{
          background: 'var(--background)',
          borderRadius: '12px',
          width: '100%',
          maxWidth: '1200px',
          height: '80vh',
          maxHeight: '800px',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          boxShadow: '0 20px 60px rgba(0, 0, 0, 0.3)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div
          style={{
            padding: '16px 20px',
            borderBottom: '1px solid var(--border)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            background: 'var(--surface)',
          }}
        >
          <h2
            style={{
              fontSize: '18px',
              fontWeight: 600,
              color: 'var(--text-primary)',
              margin: 0,
            }}
          >
            WhatsApp
          </h2>
          <button
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              fontSize: '24px',
              cursor: 'pointer',
              color: 'var(--text-secondary)',
              padding: '4px 8px',
              lineHeight: 1,
            }}
          >
            ×
          </button>
        </div>

        <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
          <div
            style={{
              width: '320px',
              borderRight: '1px solid var(--border)',
              overflow: 'auto',
            }}
          >
            {loading ? (
              <div style={{ padding: '20px', textAlign: 'center', color: 'var(--text-secondary)' }}>
                Cargando...
              </div>
            ) : (
              <ConversationsList
                conversations={conversations}
                selectedConversation={selectedConversation}
                onSelectConversation={handleSelectConversation}
                loading={false}
                isAdmin={profile?.role === 'admin'}
              />
            )}
          </div>

          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0, overflow: 'hidden' }}>
            {selectedConversation ? (
              <ChatPanel
                conversation={selectedConversation}
                messages={messages}
                onClose_={() => {}}
                onMessagesUpdate={() => loadMessages(selectedConversation.id)}
              />
            ) : (
              <div
                style={{
                  flex: 1,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: 'var(--text-secondary)',
                }}
              >
                Selecciona una conversación para comenzar
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
