import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { Button } from '../ui/Button';

interface EmailAttachment {
  id: string;
  file_name: string;
  file_path: string;
  mime_type: string;
  file_size: number;
}

interface EmailDetail {
  id: string;
  subject: string;
  body_html: string;
  body_text: string;
  to_email: string;
  cc_email?: string;
  bcc_email?: string;
  from_email?: string;
  status: string;
  direction: 'inbound' | 'outbound';
  created_at: string;
  sent_by?: string;
  sender_name?: string;
  attachments: EmailAttachment[];
}

interface EmailDetailModalProps {
  emailId: string;
  onClose: () => void;
}

export function EmailDetailModal({ emailId, onClose }: EmailDetailModalProps) {
  const [email, setEmail] = useState<EmailDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadEmailDetail();
  }, [emailId]);

  const loadEmailDetail = async () => {
    try {
      setLoading(true);
      setError(null);

      const { data: emailData, error: emailError } = await supabase
        .from('email_messages')
        .select(`
          *,
          sender:sent_by(full_name)
        `)
        .eq('id', emailId)
        .maybeSingle();

      if (emailError) throw emailError;

      if (!emailData) {
        setError('Email no encontrado');
        return;
      }

      const { data: attachmentsData } = await supabase
        .from('email_attachments')
        .select('*')
        .eq('email_message_id', emailId);

      setEmail({
        ...emailData,
        sender_name: emailData.sender?.full_name,
        attachments: attachmentsData || [],
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al cargar el email');
    } finally {
      setLoading(false);
    }
  };

  const downloadAttachment = async (attachment: EmailAttachment) => {
    try {
      const { data, error } = await supabase.storage
        .from('email-attachments')
        .download(attachment.file_path);

      if (error) throw error;

      const url = URL.createObjectURL(data);
      const a = document.createElement('a');
      a.href = url;
      a.download = attachment.file_name;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Error downloading attachment:', err);
      alert('Error al descargar el archivo');
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleString('es-MX', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  if (loading) {
    return (
      <div style={{
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
      }}>
        <div style={{
          background: '#FFFFFF',
          borderRadius: '12px',
          padding: '2rem',
          color: '#202856',
        }}>
          Cargando...
        </div>
      </div>
    );
  }

  if (error || !email) {
    return (
      <div style={{
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
      }}>
        <div style={{
          background: '#FFFFFF',
          borderRadius: '12px',
          padding: '2rem',
          maxWidth: '400px',
        }}>
          <p style={{ color: '#EF4444', marginBottom: '1rem' }}>
            {error || 'Email no encontrado'}
          </p>
          <Button variant="secondary" onClick={onClose}>
            Cerrar
          </Button>
        </div>
      </div>
    );
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
        padding: '1rem',
        zIndex: 1000,
      }}
      onClick={onClose}
    >
      <div
        style={{
          background: '#FFFFFF',
          borderRadius: '12px',
          width: '100%',
          maxWidth: '900px',
          maxHeight: '90vh',
          overflow: 'auto',
          boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div
          style={{
            padding: '1.5rem',
            borderBottom: '1px solid #E6E8EF',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <h2
              style={{
                fontSize: '1.25rem',
                fontWeight: 600,
                color: '#202856',
                margin: 0,
              }}
            >
              Detalle del correo
            </h2>
            <span
              style={{
                padding: '0.25rem 0.75rem',
                borderRadius: '12px',
                fontSize: '0.75rem',
                fontWeight: 500,
                background: email.direction === 'inbound' ? '#DBEAFE' : '#FEF3C7',
                color: email.direction === 'inbound' ? '#1E40AF' : '#92400E',
              }}
            >
              {email.direction === 'inbound' ? 'Recibido' : 'Enviado'}
            </span>
            {email.status === 'failed' && (
              <span
                style={{
                  padding: '0.25rem 0.75rem',
                  borderRadius: '12px',
                  fontSize: '0.75rem',
                  fontWeight: 500,
                  background: '#FEE2E2',
                  color: '#991B1B',
                }}
              >
                Fallido
              </span>
            )}
          </div>
          <button
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              fontSize: '1.5rem',
              color: '#718096',
              cursor: 'pointer',
              padding: '0.25rem',
              lineHeight: 1,
            }}
          >
            ×
          </button>
        </div>

        <div style={{ padding: '1.5rem' }}>
          <div style={{ marginBottom: '1.5rem' }}>
            <div style={{ fontSize: '0.875rem', color: '#64748B', marginBottom: '0.5rem' }}>
              {formatDate(email.created_at)}
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginBottom: '1rem' }}>
              {email.direction === 'outbound' ? (
                <>
                  <div style={{ fontSize: '0.875rem' }}>
                    <strong style={{ color: '#202856' }}>De:</strong>{' '}
                    <span style={{ color: '#64748B' }}>
                      {email.sender_name || 'Sistema'}
                    </span>
                  </div>
                  <div style={{ fontSize: '0.875rem' }}>
                    <strong style={{ color: '#202856' }}>Para:</strong>{' '}
                    <span style={{ color: '#64748B' }}>{email.to_email}</span>
                  </div>
                  {email.cc_email && (
                    <div style={{ fontSize: '0.875rem' }}>
                      <strong style={{ color: '#202856' }}>CC:</strong>{' '}
                      <span style={{ color: '#64748B' }}>{email.cc_email}</span>
                    </div>
                  )}
                </>
              ) : (
                <>
                  <div style={{ fontSize: '0.875rem' }}>
                    <strong style={{ color: '#202856' }}>De:</strong>{' '}
                    <span style={{ color: '#64748B' }}>{email.from_email}</span>
                  </div>
                  <div style={{ fontSize: '0.875rem' }}>
                    <strong style={{ color: '#202856' }}>Para:</strong>{' '}
                    <span style={{ color: '#64748B' }}>{email.to_email}</span>
                  </div>
                </>
              )}
            </div>

            <h3
              style={{
                fontSize: '1.125rem',
                fontWeight: 600,
                color: '#202856',
                marginBottom: '1rem',
              }}
            >
              {email.subject}
            </h3>
          </div>

          {email.attachments.length > 0 && (
            <div
              style={{
                marginBottom: '1.5rem',
                padding: '1rem',
                background: '#F9FAFB',
                borderRadius: '8px',
                border: '1px solid #E6E8EF',
              }}
            >
              <div
                style={{
                  fontSize: '0.875rem',
                  fontWeight: 600,
                  color: '#202856',
                  marginBottom: '0.75rem',
                }}
              >
                Adjuntos ({email.attachments.length})
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                {email.attachments.map((attachment) => (
                  <div
                    key={attachment.id}
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      padding: '0.75rem',
                      background: '#FFFFFF',
                      borderRadius: '6px',
                      border: '1px solid #E6E8EF',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                      <span style={{ fontSize: '1.5rem' }}>📎</span>
                      <div>
                        <div style={{ fontSize: '0.875rem', color: '#202856', fontWeight: 500 }}>
                          {attachment.file_name}
                        </div>
                        <div style={{ fontSize: '0.75rem', color: '#64748B' }}>
                          {formatFileSize(attachment.file_size)}
                        </div>
                      </div>
                    </div>
                    <button
                      onClick={() => downloadAttachment(attachment)}
                      style={{
                        padding: '0.5rem 1rem',
                        background: '#F3F4F6',
                        border: '1px solid #E6E8EF',
                        borderRadius: '6px',
                        fontSize: '0.875rem',
                        color: '#202856',
                        cursor: 'pointer',
                        fontWeight: 500,
                        transition: 'all 0.2s',
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.background = '#E6E8EF';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.background = '#F3F4F6';
                      }}
                    >
                      Descargar
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div
            style={{
              padding: '1.5rem',
              background: '#F9FAFB',
              borderRadius: '8px',
              border: '1px solid #E6E8EF',
            }}
          >
            <div
              style={{
                fontSize: '0.875rem',
                fontWeight: 600,
                color: '#202856',
                marginBottom: '1rem',
              }}
            >
              Mensaje
            </div>
            <div
              style={{
                color: '#374151',
                fontSize: '0.875rem',
                lineHeight: '1.6',
              }}
              dangerouslySetInnerHTML={{ __html: email.body_html }}
            />
          </div>
        </div>

        <div
          style={{
            padding: '1.5rem',
            borderTop: '1px solid #E6E8EF',
            display: 'flex',
            justifyContent: 'flex-end',
          }}
        >
          <Button variant="secondary" onClick={onClose}>
            Cerrar
          </Button>
        </div>
      </div>
    </div>
  );
}
