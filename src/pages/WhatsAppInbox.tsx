import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import type { WhatsAppConversation, WhatsAppMessage } from '../types/whatsapp';
import { ConversationsList } from '../components/WhatsApp/ConversationsList';
import { ChatPanel } from '../components/WhatsApp/ChatPanel';
import { NewConversationModal } from '../components/WhatsApp/NewConversationModal';
import { Button } from '../components/ui/Button';

function formatTimeAgo(date: Date): string {
  const seconds = Math.floor((Date.now() - date.getTime()) / 1000);

  if (seconds < 60) return 'hace un momento';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `hace ${minutes}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `hace ${hours}h`;
  return 'hace más de 1 día';
}

export function WhatsAppInbox() {
  const { profile } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const [conversations, setConversations] = useState<WhatsAppConversation[]>([]);
  const [selectedConversation, setSelectedConversation] = useState<WhatsAppConversation | null>(null);
  const [messages, setMessages] = useState<WhatsAppMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'all' | 'closed'>('all');
  const [syncing, setSyncing] = useState(false);
  const [showNewConversation, setShowNewConversation] = useState(false);
  const [lastSyncTime, setLastSyncTime] = useState<Date | null>(null);
  const [autoSyncing, setAutoSyncing] = useState(false);

  const isAdmin = profile?.role === 'admin';

  useEffect(() => {
    loadConversations();

    const channel = supabase
      .channel('wa_inbox_changes')
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
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [activeTab]);

  useEffect(() => {
    if (!selectedConversation) return;

    const messagesChannel = supabase
      .channel(`wa_messages_${selectedConversation.id}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'wa_messages',
          filter: `conversation_id=eq.${selectedConversation.id}`
        },
        (payload) => {
          setMessages(prev => [...prev, payload.new as WhatsAppMessage]);
          loadConversations();
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'wa_messages',
          filter: `conversation_id=eq.${selectedConversation.id}`
        },
        (payload) => {
          setMessages(prev => prev.map(msg =>
            msg.id === payload.new.id ? payload.new as WhatsAppMessage : msg
          ));
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(messagesChannel);
    };
  }, [selectedConversation?.id]);

  useEffect(() => {
    syncMessagesAutomatically();

    const interval = setInterval(() => {
      syncMessagesAutomatically();
    }, 30000);

    return () => {
      clearInterval(interval);
    };
  }, []);

  useEffect(() => {
    const updateTimer = setInterval(() => {
      if (lastSyncTime) {
        setLastSyncTime(new Date(lastSyncTime.getTime()));
      }
    }, 30000);

    return () => clearInterval(updateTimer);
  }, [lastSyncTime]);

  useEffect(() => {
    const phoneParam = searchParams.get('phone');
    if (phoneParam && conversations.length > 0) {
      const cleanParam = phoneParam.replace(/\D/g, '');
      const conversation = conversations.find(c =>
        c.contact_phone_e164 === phoneParam ||
        c.contact_plain === phoneParam ||
        c.contact_plain === cleanParam
      );
      if (conversation) {
        handleSelectConversation(conversation);
        setSearchParams({});
      }
    }
  }, [searchParams, conversations]);

  async function loadConversations() {
    try {
      setLoading(true);

      const { data: primaryChannel } = await supabase
        .from('wa_channels')
        .select('channel_id')
        .eq('is_primary', true)
        .maybeSingle();

      if (!primaryChannel) {
        console.warn('No primary channel found');
        setConversations([]);
        setLoading(false);
        return;
      }

      let query = supabase
        .from('wa_conversations')
        .select(`
          *,
          prospect:prospects(id, full_name, phone, email),
          client:clients(id, full_name, phone, email),
          assigned_user:profiles!wa_conversations_assigned_to_fkey(id, full_name)
        `)
        .eq('channel_id', primaryChannel.channel_id)
        .order('last_message_at', { ascending: false });

      if (activeTab === 'closed') {
        query = query.eq('inbox_state', 'closed');
      } else {
        query = query.neq('inbox_state', 'closed');
      }

      const { data, error } = await query;

      if (error) throw error;
      if (data) setConversations(data as WhatsAppConversation[]);
    } catch (error) {
      console.error('Error loading conversations:', error);
    } finally {
      setLoading(false);
    }
  }

  async function loadMessages(conversationId: string) {
    console.log('Loading messages for conversation:', conversationId);

    const { data, error } = await supabase
      .from('wa_messages')
      .select('*')
      .eq('conversation_id', conversationId)
      .order('created_at', { ascending: true });

    if (error) {
      console.error('Error loading messages:', error);
      return;
    }

    console.log('Loaded messages:', data?.length, data);
    console.log('Latest message:', data?.[data.length - 1]);
    if (data) setMessages(data);

    if (isAdmin) {
      await supabase
        .from('wa_conversations')
        .update({ unread_admin: 0 })
        .eq('id', conversationId);
    } else {
      await supabase
        .from('wa_conversations')
        .update({ unread_exec: 0 })
        .eq('id', conversationId);
    }
  }

  async function syncMessagesAutomatically() {
    if (autoSyncing) return;

    try {
      setAutoSyncing(true);
      const secret = import.meta.env.VITE_INTERNAL_SYNC_SECRET;
      if (!secret) return;

      await supabase.functions.invoke('wazzup-sync-messages', {
        body: {},
        headers: {
          'X-Internal-Secret': secret
        }
      });

      setLastSyncTime(new Date());
      await loadConversations();

      if (selectedConversation) {
        await loadMessages(selectedConversation.id);
      }
    } catch (error) {
      console.error('Error auto-syncing messages:', error);
    } finally {
      setAutoSyncing(false);
    }
  }

  async function handleSelectConversation(conversation: WhatsAppConversation) {
    setMessages([]);
    setSelectedConversation(conversation);
    await loadMessages(conversation.id);

    syncMessagesAutomatically();
  }


  async function handleCloseConversation() {
    if (!selectedConversation) return;

    const { error } = await supabase
      .from('wa_conversations')
      .update({ inbox_state: 'closed' })
      .eq('id', selectedConversation.id);

    if (error) {
      console.error('Error closing conversation:', error);
      alert('Error al cerrar conversación');
      return;
    }

    loadConversations();
    setSelectedConversation(null);
  }

  async function handleSyncChannels() {
    setSyncing(true);
    try {
      const secret = import.meta.env.VITE_INTERNAL_SYNC_SECRET;
      if (!secret) {
        alert('Missing VITE_INTERNAL_SYNC_SECRET');
        return;
      }

      console.log('Syncing channels with internal secret...');
      console.log('Has internal secret:', Boolean(secret));

      const { data, error } = await supabase.functions.invoke('wazzup-sync-channels', {
        body: {},
        headers: {
          'X-Internal-Secret': secret
        }
      });

      if (error) {
        console.error('Function error:', error);
        throw error;
      }

      console.log('Sync response:', data);
      alert('Canales sincronizados correctamente');
    } catch (error) {
      console.error('Error syncing channels:', error);
      alert('Error al sincronizar canales: ' + (error as Error).message);
    } finally {
      setSyncing(false);
    }
  }

  async function handleSyncTemplates() {
    setSyncing(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        alert('Tu sesión ha expirado. Por favor inicia sesión nuevamente.');
        return;
      }

      if (!session.access_token) {
        alert('No hay access_token. La sesión no está inicializada.');
        return;
      }

      console.log('User:', session.user.id, '| Token:', session.access_token.slice(0, 20) + '...');

      const { data, error } = await supabase.functions.invoke('wazzup-sync-templates', {
        headers: {
          Authorization: `Bearer ${session.access_token}`
        }
      });

      if (error) {
        console.error('Function error:', error);
        throw error;
      }

      console.log('Sync response:', data);
      alert(`Plantillas sincronizadas: ${data.synced} plantillas, ${data.errors} errores`);
    } catch (error) {
      console.error('Error syncing templates:', error);
      alert('Error al sincronizar plantillas: ' + (error as Error).message);
    } finally {
      setSyncing(false);
    }
  }

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      height: '100vh',
      maxHeight: '100vh',
      overflow: 'hidden',
      background: '#F7F8FC'
    }}>
      <div style={{
        background: 'white',
        borderBottom: '1px solid #E6E8EF',
        padding: '16px 24px',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        gap: '12px',
        flexShrink: 0
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <h1 style={{
            fontSize: '20px',
            fontWeight: 600,
            color: '#202856',
            margin: 0
          }}>
            WhatsApp
          </h1>
          {lastSyncTime && (
            <div style={{
              fontSize: '12px',
              color: '#718096',
              display: 'flex',
              alignItems: 'center',
              gap: '4px'
            }}>
              <span style={{
                width: '6px',
                height: '6px',
                borderRadius: '50%',
                background: autoSyncing ? '#FFA500' : '#65EA1E',
                display: 'inline-block'
              }}></span>
              {autoSyncing ? 'Sincronizando...' : `Sincronizado ${formatTimeAgo(lastSyncTime)}`}
            </div>
          )}
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          <Button
            onClick={() => setShowNewConversation(true)}
            style={{
              background: '#65EA1E',
              color: '#202856',
              fontSize: '14px',
              padding: '8px 16px',
              display: 'flex',
              alignItems: 'center',
              gap: '6px'
            }}
          >
            <span style={{ fontSize: '18px' }}>+</span>
            Nueva Conversación
          </Button>
          {isAdmin && (
            <>
              <Button
                onClick={handleSyncChannels}
                disabled={syncing}
                style={{
                  background: '#017E7B',
                  color: 'white',
                  fontSize: '14px',
                  padding: '8px 16px'
                }}
                title="Sincronizar canales"
              >
                {syncing ? '...' : '🔄 Canales'}
              </Button>
              <Button
                onClick={handleSyncTemplates}
                disabled={syncing}
                style={{
                  background: '#017E7B',
                  color: 'white',
                  fontSize: '14px',
                  padding: '8px 16px'
                }}
                title="Sincronizar plantillas de WhatsApp"
              >
                {syncing ? '...' : '📝 Plantillas'}
              </Button>
            </>
          )}
        </div>
      </div>

      <div style={{
        display: 'flex',
        gap: '8px',
        padding: '12px 24px',
        background: 'white',
        borderBottom: '1px solid #E6E8EF',
        overflowX: 'auto',
        flexShrink: 0
      }}>
        <button
          onClick={() => setActiveTab('all')}
          style={{
            padding: '8px 16px',
            background: activeTab === 'all' ? '#017E7B' : '#F7F8FC',
            border: 'none',
            borderRadius: '20px',
            cursor: 'pointer',
            fontWeight: 500,
            color: activeTab === 'all' ? 'white' : '#718096',
            fontSize: '13px',
            transition: 'all 0.2s ease',
            whiteSpace: 'nowrap'
          }}
        >
          Activas
        </button>
        <button
          onClick={() => setActiveTab('closed')}
          style={{
            padding: '8px 16px',
            background: activeTab === 'closed' ? '#017E7B' : '#F7F8FC',
            border: 'none',
            borderRadius: '20px',
            cursor: 'pointer',
            fontWeight: 500,
            color: activeTab === 'closed' ? 'white' : '#718096',
            fontSize: '13px',
            transition: 'all 0.2s ease',
            whiteSpace: 'nowrap'
          }}
        >
          Archivadas
        </button>
      </div>

      <div style={{
        display: 'grid',
        gridTemplateColumns: selectedConversation ? '380px 1fr' : '1fr',
        flex: 1,
        minHeight: 0,
        overflow: 'hidden'
      }}>
        <div style={{
          background: 'white',
          borderRight: '1px solid #E6E8EF',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden'
        }}>
          <ConversationsList
            conversations={conversations}
            selectedConversation={selectedConversation}
            onSelectConversation={handleSelectConversation}
            loading={loading}
            isAdmin={isAdmin}
          />
        </div>

        {selectedConversation ? (
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden'
          }}>
            <ChatPanel
              conversation={selectedConversation}
              messages={messages}
              onClose_={handleCloseConversation}
              onMessagesUpdate={() => loadMessages(selectedConversation.id)}
            />
          </div>
        ) : (
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: '#FAFBFC'
          }}>
            <div className="empty-state">
              <div className="empty-state-icon">💬</div>
              <h3 className="empty-state-title">Selecciona una conversación</h3>
              <p className="empty-state-description">
                Elige una conversación de la lista o crea una nueva
              </p>
            </div>
          </div>
        )}
      </div>

      {showNewConversation && (
        <NewConversationModal
          onClose={() => setShowNewConversation(false)}
          onConversationCreated={() => {
            setShowNewConversation(false);
            loadConversations();
          }}
        />
      )}
    </div>
  );
}
