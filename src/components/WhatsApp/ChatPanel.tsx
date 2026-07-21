import { useEffect, useRef, useState } from 'react';
import type { WhatsAppConversation, WhatsAppMessage } from '../../types/whatsapp';
import { Button } from '../ui/Button';
import { MessageComposer } from './MessageComposer';
import { LinkContactModal } from './LinkContactModal';

interface ChatPanelProps {
  conversation: WhatsAppConversation;
  messages: WhatsAppMessage[];
  onClose_: () => void;
  onMessagesUpdate: () => void;
}

export function ChatPanel({
  conversation,
  messages,
  onClose_,
  onMessagesUpdate
}: ChatPanelProps) {
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [showLinkModal, setShowLinkModal] = useState(false);

  useEffect(() => {
    console.log('ChatPanel received messages:', messages.length);
    if (messages.length > 0 && messagesContainerRef.current) {
      const scrollToBottom = () => {
        if (messagesContainerRef.current) {
          const container = messagesContainerRef.current;
          container.scrollTop = container.scrollHeight;
          console.log('Scrolled to:', container.scrollTop, 'of', container.scrollHeight);
        }
      };

      setTimeout(scrollToBottom, 0);
      requestAnimationFrame(() => {
        requestAnimationFrame(scrollToBottom);
      });
    }
  }, [messages]);

  function getDisplayName(): string {
    if (conversation.client) {
      return conversation.client.full_name;
    }
    if (conversation.prospect) {
      return conversation.prospect.full_name;
    }
    return `WhatsApp ${conversation.contact_phone_e164}`;
  }

  function hasLinkedContact(): boolean {
    return !!(conversation.client || conversation.prospect);
  }

  function formatMessageTime(timestamp: string): string {
    const date = new Date(timestamp);
    return date.toLocaleTimeString('es-MX', {
      hour: '2-digit',
      minute: '2-digit'
    });
  }

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      height: '100%',
      background: 'white',
      minHeight: 0,
      overflow: 'hidden'
    }}>
      <div style={{
        padding: '16px 24px',
        borderBottom: '1px solid #E6E8EF',
        background: 'white',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        gap: '12px',
        flexShrink: 0
      }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            marginBottom: '2px'
          }}>
            <h3 style={{
              fontSize: '17px',
              fontWeight: 600,
              color: '#202856',
              margin: 0
            }}>
              {getDisplayName()}
            </h3>
            {!hasLinkedContact() && (
              <span style={{
                fontSize: '11px',
                background: '#FEF3C7',
                color: '#92400E',
                padding: '2px 8px',
                borderRadius: '6px',
                fontWeight: 600
              }}>
                SIN CONTACTO
              </span>
            )}
          </div>
          <p style={{
            fontSize: '12px',
            color: '#718096',
            margin: 0
          }}>
            {conversation.contact_phone_e164}
          </p>
        </div>

        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          {!hasLinkedContact() && (
            <Button
              onClick={() => setShowLinkModal(true)}
              style={{
                background: '#F59E0B',
                color: 'white',
                fontSize: '13px',
                padding: '8px 16px',
                border: 'none'
              }}
            >
              Vincular Contacto
            </Button>
          )}
          {conversation.inbox_state !== 'closed' && (
            <Button
              onClick={onClose_}
              style={{
                background: 'transparent',
                color: '#718096',
                fontSize: '13px',
                padding: '8px 16px',
                border: '1px solid #E6E8EF'
              }}
            >
              Archivar
            </Button>
          )}
        </div>
      </div>

      <div
        ref={messagesContainerRef}
        style={{
          flex: 1,
          overflowY: 'auto',
          overflowX: 'hidden',
          padding: '20px',
          background: '#FAFBFC',
          minHeight: 0
        }}
      >
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          gap: '12px',
          minHeight: 'min-content',
          paddingBottom: '20px'
        }}>
          {messages.length === 0 ? (
            <div className="empty-state">
              <div className="empty-state-icon">💬</div>
              <p className="empty-state-description">No hay mensajes aún</p>
            </div>
          ) : (
            messages.map(message => {
            const isOutgoing = message.direction === 'out';
            const isSystem = message.direction === 'system';

            if (isSystem) {
              return (
                <div
                  key={message.id}
                  style={{
                    display: 'flex',
                    justifyContent: 'center',
                    margin: '8px 0'
                  }}
                >
                  <div style={{
                    background: '#E6E8EF',
                    color: '#718096',
                    padding: '6px 12px',
                    borderRadius: '12px',
                    fontSize: '12px',
                    maxWidth: '80%',
                    textAlign: 'center'
                  }}>
                    {message.text}
                  </div>
                </div>
              );
            }

            return (
              <div
                key={message.id}
                style={{
                  display: 'flex',
                  justifyContent: isOutgoing ? 'flex-end' : 'flex-start'
                }}
              >
                <div style={{
                  maxWidth: '70%',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '4px'
                }}>
                  <div style={{
                    background: isOutgoing ? '#017E7B' : 'white',
                    color: isOutgoing ? 'white' : '#202856',
                    padding: message.media_url && !message.text ? '4px' : '12px 16px',
                    borderRadius: '16px',
                    borderTopLeftRadius: isOutgoing ? '16px' : '4px',
                    borderTopRightRadius: isOutgoing ? '4px' : '16px',
                    boxShadow: isOutgoing ? '0 1px 2px rgba(0, 0, 0, 0.05)' : '0 2px 8px rgba(0, 0, 0, 0.12)',
                    border: isOutgoing ? 'none' : '1px solid #E6E8EF',
                    wordWrap: 'break-word'
                  }}>
                    {message.media_url && (
                      <div style={{ marginBottom: message.text ? '8px' : '0' }}>
                        {message.type === 'image' ? (
                          <img
                            src={message.media_url || ''}
                            alt="Image"
                            style={{
                              maxWidth: '100%',
                              maxHeight: '400px',
                              borderRadius: '12px',
                              display: 'block',
                              cursor: 'pointer'
                            }}
                            onClick={() => message.media_url && window.open(message.media_url, '_blank')}
                          />
                        ) : message.type === 'video' ? (
                          <video
                            controls
                            style={{
                              maxWidth: '100%',
                              maxHeight: '400px',
                              borderRadius: '12px',
                              display: 'block',
                              background: '#000'
                            }}
                          >
                            <source src={message.media_url} />
                            Tu navegador no soporta video
                          </video>
                        ) : message.type === 'audio' ? (
                          <audio
                            controls
                            style={{
                              width: '100%',
                              maxWidth: '300px'
                            }}
                          >
                            <source src={message.media_url} />
                            Tu navegador no soporta audio
                          </audio>
                        ) : (
                          <a
                            href={message.media_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: '12px',
                              padding: '12px',
                              background: isOutgoing ? 'rgba(255,255,255,0.1)' : '#F9FAFB',
                              borderRadius: '8px',
                              color: isOutgoing ? 'white' : '#202856',
                              textDecoration: 'none',
                              transition: 'background 0.2s'
                            }}
                            onMouseEnter={(e) => {
                              e.currentTarget.style.background = isOutgoing ? 'rgba(255,255,255,0.2)' : '#F3F4F6';
                            }}
                            onMouseLeave={(e) => {
                              e.currentTarget.style.background = isOutgoing ? 'rgba(255,255,255,0.1)' : '#F9FAFB';
                            }}
                          >
                            <span style={{ fontSize: '32px' }}>📄</span>
                            <div style={{ flex: 1 }}>
                              <div style={{ fontWeight: 600, fontSize: '14px' }}>
                                {message.media_meta?.fileName || 'Documento'}
                              </div>
                              <div style={{ fontSize: '12px', opacity: 0.7 }}>
                                Click para descargar
                              </div>
                            </div>
                            <span style={{ fontSize: '20px' }}>⬇</span>
                          </a>
                        )}
                      </div>
                    )}
                    {message.text && (
                      <div style={{ fontSize: '14px', lineHeight: '1.5', padding: message.media_url ? '0 12px 8px 12px' : '0' }}>
                        {message.text}
                      </div>
                    )}
                  </div>
                  <div style={{
                    fontSize: '11px',
                    color: '#718096',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    paddingLeft: isOutgoing ? '0' : '12px',
                    paddingRight: isOutgoing ? '12px' : '0',
                    justifyContent: isOutgoing ? 'flex-end' : 'flex-start'
                  }}>
                    <span>{formatMessageTime(message.created_at)}</span>
                    {isOutgoing && (
                      <span style={{
                        color: message.status === 'read' ? '#017E7B' :
                               message.status === 'failed' ? '#DC2626' : '#718096'
                      }}>
                        {message.status === 'pending' && '🕐'}
                        {message.status === 'sent' && '✓'}
                        {message.status === 'delivered' && '✓✓'}
                        {message.status === 'read' && '✓✓'}
                        {message.status === 'failed' && '✗'}
                      </span>
                    )}
                    {isOutgoing && message.status === 'failed' && message.error_details && (
                      <span
                        style={{
                          color: '#DC2626',
                          cursor: 'pointer',
                          fontSize: '10px'
                        }}
                        title={JSON.stringify(message.error_details, null, 2)}
                      >
                        (error)
                      </span>
                    )}
                  </div>
                </div>
              </div>
            );
            })
          )}
          <div ref={messagesEndRef} style={{ height: '1px', flexShrink: 0 }} />
        </div>
      </div>

      {conversation.inbox_state !== 'closed' && (
        <MessageComposer
          conversation={conversation}
          onMessageSent={onMessagesUpdate}
        />
      )}

      {showLinkModal && (
        <LinkContactModal
          conversation={conversation}
          onClose={() => setShowLinkModal(false)}
          onLinked={() => {
            setShowLinkModal(false);
            onMessagesUpdate();
          }}
        />
      )}
    </div>
  );
}
