import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { Card } from '../ui/Card';
import { Badge } from '../ui/Badge';

interface EmailMessage {
  id: string;
  from_email: string;
  subject: string;
  status: 'processed' | 'duplicate' | 'error' | 'skipped';
  parsed_name: string | null;
  parsed_phone: string | null;
  parsed_email: string | null;
  parsed_details: string | null;
  error_details: string | null;
  received_at: string | null;
  processed_at: string;
  created_prospect_id: string | null;
}

export function MessagesHistory() {
  const [messages, setMessages] = useState<EmailMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string>('all');
  const [selectedMessage, setSelectedMessage] = useState<EmailMessage | null>(null);

  useEffect(() => {
    loadMessages();
  }, [filter]);

  async function loadMessages() {
    try {
      setLoading(true);

      let query = supabase
        .from('email_ingest_messages')
        .select('*')
        .order('processed_at', { ascending: false })
        .limit(50);

      if (filter !== 'all') {
        query = query.eq('status', filter);
      }

      const { data, error } = await query;

      if (error) throw error;
      if (data) setMessages(data);
    } catch (error) {
      console.error('Error loading messages:', error);
    } finally {
      setLoading(false);
    }
  }

  function getStatusBadge(status: string) {
    switch (status) {
      case 'processed':
        return <Badge variant="success">Procesado</Badge>;
      case 'duplicate':
        return <Badge variant="warning">Duplicado</Badge>;
      case 'error':
        return <Badge variant="error">Error</Badge>;
      case 'skipped':
        return <Badge variant="default">Omitido</Badge>;
      default:
        return <Badge variant="default">{status}</Badge>;
    }
  }

  const stats = {
    total: messages.length,
    processed: messages.filter(m => m.status === 'processed').length,
    duplicates: messages.filter(m => m.status === 'duplicate').length,
    errors: messages.filter(m => m.status === 'error').length,
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      <div>
        <h2 style={{ fontSize: '1.5rem', fontWeight: 600, color: '#202856', marginBottom: '0.5rem' }}>
          Historial de Correos
        </h2>
        <p style={{ fontSize: '0.875rem', color: '#718096' }}>
          Últimos 50 correos procesados del sistema
        </p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
        <Card style={{ padding: '1rem', background: 'linear-gradient(135deg, #194988 0%, #017E7B 100%)', color: 'white' }}>
          <div style={{ fontSize: '0.875rem', opacity: 0.9, marginBottom: '0.25rem' }}>Total</div>
          <div style={{ fontSize: '2rem', fontWeight: 700 }}>{stats.total}</div>
        </Card>

        <Card style={{ padding: '1rem', background: '#D1FAE5', color: '#065F46' }}>
          <div style={{ fontSize: '0.875rem', marginBottom: '0.25rem' }}>Procesados</div>
          <div style={{ fontSize: '2rem', fontWeight: 700 }}>{stats.processed}</div>
        </Card>

        <Card style={{ padding: '1rem', background: '#FEF3C7', color: '#92400E' }}>
          <div style={{ fontSize: '0.875rem', marginBottom: '0.25rem' }}>Duplicados</div>
          <div style={{ fontSize: '2rem', fontWeight: 700 }}>{stats.duplicates}</div>
        </Card>

        <Card style={{ padding: '1rem', background: '#FEE2E2', color: '#991B1B' }}>
          <div style={{ fontSize: '0.875rem', marginBottom: '0.25rem' }}>Errores</div>
          <div style={{ fontSize: '2rem', fontWeight: 700 }}>{stats.errors}</div>
        </Card>
      </div>

      <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
        {[
          { value: 'all', label: 'Todos' },
          { value: 'processed', label: 'Procesados' },
          { value: 'duplicate', label: 'Duplicados' },
          { value: 'error', label: 'Errores' },
          { value: 'skipped', label: 'Omitidos' }
        ].map(f => (
          <button
            key={f.value}
            onClick={() => setFilter(f.value)}
            style={{
              padding: '0.5rem 1rem',
              borderRadius: '0.5rem',
              border: 'none',
              background: filter === f.value ? '#194988' : '#F3F4F6',
              color: filter === f.value ? 'white' : '#202856',
              fontSize: '0.875rem',
              fontWeight: 500,
              cursor: 'pointer',
              transition: 'all 0.2s'
            }}
          >
            {f.label}
          </button>
        ))}
      </div>

      {loading ? (
        <Card>
          <div style={{ padding: '2rem', textAlign: 'center', color: '#718096' }}>
            Cargando historial...
          </div>
        </Card>
      ) : messages.length === 0 ? (
        <Card>
          <div style={{ padding: '2rem', textAlign: 'center', color: '#718096' }}>
            No hay correos procesados
          </div>
        </Card>
      ) : (
        <div style={{ display: 'grid', gap: '1rem' }}>
          {messages.map(message => (
            <Card key={message.id} style={{ cursor: 'pointer' }} onClick={() => setSelectedMessage(message)}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '1rem' }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.5rem' }}>
                    <h3 style={{ fontSize: '1rem', fontWeight: 600, color: '#202856', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {message.subject || 'Sin asunto'}
                    </h3>
                    {getStatusBadge(message.status)}
                  </div>

                  <div style={{ display: 'grid', gap: '0.25rem', fontSize: '0.875rem', color: '#718096' }}>
                    <div><strong>De:</strong> {message.from_email}</div>
                    {message.parsed_name && <div><strong>Nombre:</strong> {message.parsed_name}</div>}
                    {message.parsed_email && <div><strong>Email:</strong> {message.parsed_email}</div>}
                    {message.parsed_phone && <div><strong>Teléfono:</strong> {message.parsed_phone}</div>}
                    {message.received_at && (
                      <div><strong>Recibido:</strong> {new Date(message.received_at).toLocaleString('es-MX')}</div>
                    )}
                  </div>

                  {message.error_details && (
                    <div style={{
                      marginTop: '0.5rem',
                      padding: '0.5rem',
                      background: '#FEE2E2',
                      borderRadius: '0.5rem',
                      fontSize: '0.75rem',
                      color: '#991B1B'
                    }}>
                      Error: {message.error_details}
                    </div>
                  )}

                  {message.created_prospect_id && (
                    <div style={{
                      marginTop: '0.5rem',
                      padding: '0.5rem',
                      background: '#D1FAE5',
                      borderRadius: '0.5rem',
                      fontSize: '0.75rem',
                      color: '#065F46'
                    }}>
                      ✓ Prospecto creado
                    </div>
                  )}
                </div>

                <div style={{ fontSize: '0.75rem', color: '#718096', textAlign: 'right' }}>
                  {new Date(message.processed_at).toLocaleDateString('es-MX')}
                  <br />
                  {new Date(message.processed_at).toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' })}
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      {selectedMessage && (
        <div
          onClick={() => setSelectedMessage(null)}
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
            padding: '1rem'
          }}
        >
          <Card
            onClick={(e) => e.stopPropagation()}
            style={{ maxWidth: '700px', width: '100%', maxHeight: '90vh', overflow: 'auto' }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1.5rem' }}>
              <h3 style={{ fontSize: '1.25rem', fontWeight: 600, color: '#202856', margin: 0 }}>
                Detalle del Correo
              </h3>
              <button
                onClick={() => setSelectedMessage(null)}
                style={{
                  background: 'none',
                  border: 'none',
                  fontSize: '1.5rem',
                  cursor: 'pointer',
                  color: '#718096',
                  padding: '0',
                  lineHeight: 1
                }}
              >
                ×
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div>
                <div style={{ fontSize: '0.75rem', color: '#718096', marginBottom: '0.25rem' }}>Estado</div>
                <div>{getStatusBadge(selectedMessage.status)}</div>
              </div>

              <div>
                <div style={{ fontSize: '0.75rem', color: '#718096', marginBottom: '0.25rem' }}>Asunto</div>
                <div style={{ fontSize: '0.875rem', color: '#202856' }}>{selectedMessage.subject || 'Sin asunto'}</div>
              </div>

              <div>
                <div style={{ fontSize: '0.75rem', color: '#718096', marginBottom: '0.25rem' }}>De</div>
                <div style={{ fontSize: '0.875rem', color: '#202856' }}>{selectedMessage.from_email}</div>
              </div>

              {selectedMessage.parsed_name && (
                <div>
                  <div style={{ fontSize: '0.75rem', color: '#718096', marginBottom: '0.25rem' }}>Nombre extraído</div>
                  <div style={{ fontSize: '0.875rem', color: '#202856' }}>{selectedMessage.parsed_name}</div>
                </div>
              )}

              {selectedMessage.parsed_email && (
                <div>
                  <div style={{ fontSize: '0.75rem', color: '#718096', marginBottom: '0.25rem' }}>Email extraído</div>
                  <div style={{ fontSize: '0.875rem', color: '#202856' }}>{selectedMessage.parsed_email}</div>
                </div>
              )}

              {selectedMessage.parsed_phone && (
                <div>
                  <div style={{ fontSize: '0.75rem', color: '#718096', marginBottom: '0.25rem' }}>Teléfono extraído</div>
                  <div style={{ fontSize: '0.875rem', color: '#202856' }}>{selectedMessage.parsed_phone}</div>
                </div>
              )}

              {selectedMessage.parsed_details && (
                <div>
                  <div style={{ fontSize: '0.75rem', color: '#718096', marginBottom: '0.25rem' }}>Detalles extraídos</div>
                  <div style={{ fontSize: '0.875rem', color: '#202856', whiteSpace: 'pre-wrap' }}>{selectedMessage.parsed_details}</div>
                </div>
              )}

              {selectedMessage.error_details && (
                <div>
                  <div style={{ fontSize: '0.75rem', color: '#718096', marginBottom: '0.25rem' }}>Error</div>
                  <div style={{
                    padding: '0.75rem',
                    background: '#FEE2E2',
                    borderRadius: '0.5rem',
                    fontSize: '0.875rem',
                    color: '#991B1B'
                  }}>
                    {selectedMessage.error_details}
                  </div>
                </div>
              )}
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}
