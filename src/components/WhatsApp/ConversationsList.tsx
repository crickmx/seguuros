import type { WhatsAppConversation } from '../../types/whatsapp';
import { Badge } from '../ui/Badge';

interface ConversationsListProps {
  conversations: WhatsAppConversation[];
  selectedConversation: WhatsAppConversation | null;
  onSelectConversation: (conversation: WhatsAppConversation) => void;
  loading: boolean;
  isAdmin: boolean;
}

export function ConversationsList({
  conversations,
  selectedConversation,
  onSelectConversation,
  loading,
  isAdmin
}: ConversationsListProps) {
  function getDisplayName(conversation: WhatsAppConversation): string {
    if (conversation.client) {
      return conversation.client.full_name;
    }
    if (conversation.prospect) {
      return conversation.prospect.full_name;
    }
    return `WhatsApp ${conversation.contact_phone_e164}`;
  }

  function formatTime(timestamp: string): string {
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Ahora';
    if (diffMins < 60) return `${diffMins}m`;
    if (diffHours < 24) return `${diffHours}h`;
    if (diffDays < 7) return `${diffDays}d`;

    return date.toLocaleDateString('es-MX', { day: '2-digit', month: '2-digit' });
  }

  if (loading) {
    return (
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        height: '100%',
        padding: '24px'
      }}>
        <div className="empty-state">
          <div className="empty-state-icon">⏳</div>
          <p className="empty-state-description">Cargando conversaciones...</p>
        </div>
      </div>
    );
  }

  if (conversations.length === 0) {
    return (
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        height: '100%',
        padding: '24px'
      }}>
        <div className="empty-state">
          <div className="empty-state-icon">📭</div>
          <h3 className="empty-state-title">Sin conversaciones</h3>
          <p className="empty-state-description">
            No hay conversaciones en esta categoría
          </p>
        </div>
      </div>
    );
  }

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      height: '100%',
      overflow: 'hidden'
    }}>
      <div style={{
        padding: '16px 20px',
        borderBottom: '1px solid #E6E8EF',
        flexShrink: 0
      }}>
        <h3 style={{
          fontSize: '15px',
          fontWeight: 600,
          color: '#202856',
          margin: 0
        }}>
          {conversations.length} {conversations.length === 1 ? 'conversación' : 'conversaciones'}
        </h3>
      </div>

      <div style={{
        flex: 1,
        overflowY: 'auto',
        display: 'flex',
        flexDirection: 'column'
      }}>
        {conversations.map(conversation => {
          const isSelected = selectedConversation?.id === conversation.id;
          const unreadCount = isAdmin ? conversation.unread_admin : conversation.unread_exec;

          return (
            <button
              key={conversation.id}
              onClick={() => onSelectConversation(conversation)}
              style={{
                padding: '16px',
                border: 'none',
                borderBottom: '1px solid #E6E8EF',
                background: isSelected ? '#F7F8FC' : 'white',
                cursor: 'pointer',
                textAlign: 'left',
                transition: 'all 0.2s ease',
                display: 'flex',
                flexDirection: 'column',
                gap: '8px',
                position: 'relative'
              }}
              onMouseEnter={(e) => {
                if (!isSelected) {
                  e.currentTarget.style.background = '#FAFBFC';
                }
              }}
              onMouseLeave={(e) => {
                if (!isSelected) {
                  e.currentTarget.style.background = 'white';
                }
              }}
            >
              <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'flex-start',
                gap: '8px'
              }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    marginBottom: '4px'
                  }}>
                    <div style={{
                      fontSize: '14px',
                      fontWeight: 600,
                      color: '#202856',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                      flex: 1
                    }}>
                      {getDisplayName(conversation)}
                    </div>
                    {!conversation.client && !conversation.prospect && (
                      <span style={{
                        fontSize: '9px',
                        background: '#FEF3C7',
                        color: '#92400E',
                        padding: '2px 6px',
                        borderRadius: '4px',
                        fontWeight: 600,
                        flexShrink: 0
                      }}>
                        SIN CONTACTO
                      </span>
                    )}
                    {(conversation.client || conversation.prospect) && (
                      <span style={{
                        fontSize: '9px',
                        background: '#E0F2F1',
                        color: '#017E7B',
                        padding: '2px 6px',
                        borderRadius: '4px',
                        fontWeight: 600,
                        flexShrink: 0
                      }}>
                        VINCULADO
                      </span>
                    )}
                  </div>
                  <div style={{
                    fontSize: '12px',
                    color: '#718096',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap'
                  }}>
                    {conversation.contact_phone_e164}
                  </div>
                  {(conversation.client?.phone || conversation.prospect?.phone) && (
                    <div style={{
                      fontSize: '11px',
                      color: '#017E7B',
                      marginTop: '2px',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px'
                    }}>
                      <span>📱</span>
                      <span>{conversation.client?.phone || conversation.prospect?.phone}</span>
                    </div>
                  )}
                </div>
                <div style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'flex-end',
                  gap: '4px'
                }}>
                  <span style={{
                    fontSize: '11px',
                    color: '#718096'
                  }}>
                    {formatTime(conversation.last_message_at)}
                  </span>
                  {unreadCount > 0 && (
                    <Badge variant="success" style={{
                      background: '#65EA1E',
                      color: '#202856',
                      fontSize: '11px',
                      padding: '2px 8px',
                      minWidth: '20px',
                      textAlign: 'center'
                    }}>
                      {unreadCount}
                    </Badge>
                  )}
                </div>
              </div>

              {conversation.last_message_preview && (
                <div style={{
                  fontSize: '13px',
                  color: '#718096',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                  marginTop: '4px'
                }}>
                  {conversation.last_message_preview}
                </div>
              )}

              {conversation.assigned_user && (
                <div style={{
                  fontSize: '11px',
                  color: '#017E7B',
                  marginTop: '4px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px'
                }}>
                  <span>👤</span>
                  <span>{conversation.assigned_user.full_name}</span>
                </div>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
