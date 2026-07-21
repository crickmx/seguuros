import { useState } from 'react';
import { Card } from '../ui/Card';
import { Badge } from '../ui/Badge';
import { EmailDetailModal } from './EmailDetailModal';

interface EmailMessage {
  id: string;
  subject: string;
  body_html: string;
  to_email: string;
  cc_email?: string;
  sent_at: string;
  status: 'draft' | 'sent' | 'failed';
  error_details?: string;
  sent_by_profile?: {
    full_name: string;
  };
  attachments?: Array<{
    id: string;
    file_name: string;
    file_size: number;
  }>;
}

interface EmailHistoryItemProps {
  email: EmailMessage;
}

export function EmailHistoryItem({ email }: EmailHistoryItemProps) {
  const [showModal, setShowModal] = useState(false);

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

  const getStatusBadge = () => {
    switch (email.status) {
      case 'sent':
        return <Badge variant="success">Enviado</Badge>;
      case 'failed':
        return <Badge variant="error">Fallido</Badge>;
      case 'draft':
        return <Badge variant="default">Borrador</Badge>;
      default:
        return null;
    }
  };

  return (
    <>
      {showModal && (
        <EmailDetailModal
          emailId={email.id}
          onClose={() => setShowModal(false)}
        />
      )}
      <Card style={{ padding: '1rem' }}>
        <div
          style={{
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'flex-start',
            gap: '0.75rem',
          }}
          onClick={() => setShowModal(true)}
        >
        <div style={{
          fontSize: '1.5rem',
          flexShrink: 0,
          marginTop: '0.125rem',
        }}>
          ✉️
        </div>

        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
            marginBottom: '0.25rem',
            flexWrap: 'wrap',
          }}>
            <span style={{
              fontSize: '0.875rem',
              fontWeight: 600,
              color: '#202856',
            }}>
              {email.subject}
            </span>
            {getStatusBadge()}
          </div>

          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
            fontSize: '0.75rem',
            color: '#718096',
            marginBottom: '0.25rem',
          }}>
            <span>{email.sent_by_profile?.full_name || 'Sistema'}</span>
            <span>•</span>
            <span>{formatDate(email.sent_at)}</span>
          </div>

          <div style={{
            fontSize: '0.75rem',
            color: '#718096',
          }}>
            Para: {email.to_email}
            {email.cc_email && ` • CC: ${email.cc_email}`}
          </div>

          {email.attachments && email.attachments.length > 0 && (
            <div style={{
              marginTop: '0.5rem',
              display: 'flex',
              gap: '0.25rem',
              flexWrap: 'wrap',
            }}>
              {email.attachments.map((att) => (
                <Badge key={att.id} variant="default" style={{ fontSize: '0.7rem' }}>
                  📎 {att.file_name}
                </Badge>
              ))}
            </div>
          )}

          {email.status === 'failed' && email.error_details && (
            <div style={{
              marginTop: '0.5rem',
              padding: '0.5rem',
              background: '#FEE2E2',
              borderRadius: '4px',
              fontSize: '0.75rem',
              color: '#991B1B',
            }}>
              Error: {email.error_details}
            </div>
          )}
        </div>

        <div style={{
          fontSize: '1.25rem',
          color: '#718096',
          flexShrink: 0,
        }}>
          →
        </div>
        </div>
      </Card>
    </>
  );
}