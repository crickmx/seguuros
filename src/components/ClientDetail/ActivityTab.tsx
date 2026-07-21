import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import type { Client, Interaction } from '../../types/database';
import { Button } from '../ui/Button';
import { Card } from '../ui/Card';
import { EmailHistoryItem } from '../Email/EmailHistoryItem';

interface ActivityTabProps {
  client: Client;
}

type InteractionWithProfile = Interaction & {
  profiles: {
    full_name: string;
  };
};

type EmailMessage = {
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
};

type TimelineItem = {
  id: string;
  type: 'interaction' | 'email';
  created_at: string;
  data: InteractionWithProfile | EmailMessage;
};

export function ActivityTab({ client }: ActivityTabProps) {
  const { profile } = useAuth();
  const [timelineItems, setTimelineItems] = useState<TimelineItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [newNote, setNewNote] = useState({ type: 'nota' as const, content: '' });

  useEffect(() => {
    loadInteractions();

    const channel = supabase
      .channel('client_interactions')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'interactions',
          filter: `client_id=eq.${client.id}`
        },
        () => {
          loadInteractions();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [client.id]);

  async function loadInteractions() {
    try {
      setLoading(true);

      const [interactionsResult, emailsResult] = await Promise.all([
        supabase
          .from('interactions')
          .select(`
            *,
            profiles:created_by(full_name)
          `)
          .eq('client_id', client.id)
          .order('created_at', { ascending: false }),

        supabase
          .from('email_messages')
          .select(`
            *,
            sent_by_profile:profiles!email_messages_sent_by_fkey(full_name),
            attachments:email_attachments(id, file_name, file_size)
          `)
          .eq('client_id', client.id)
          .order('sent_at', { ascending: false })
      ]);

      const items: TimelineItem[] = [];

      if (interactionsResult.data) {
        interactionsResult.data.forEach((interaction: any) => {
          items.push({
            id: `interaction-${interaction.id}`,
            type: 'interaction',
            created_at: interaction.created_at,
            data: interaction,
          });
        });
      }

      if (emailsResult.data) {
        emailsResult.data.forEach((email: any) => {
          items.push({
            id: `email-${email.id}`,
            type: 'email',
            created_at: email.sent_at,
            data: email,
          });
        });
      }

      items.sort((a, b) =>
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      );

      setTimelineItems(items);
    } catch (error) {
      console.error('Error loading activity:', error);
    } finally {
      setLoading(false);
    }
  }

  async function handleAddInteraction(e: React.FormEvent) {
    e.preventDefault();

    if (!newNote.content.trim()) return;

    try {
      const { error } = await supabase.from('interactions').insert({
        client_id: client.id,
        created_by: profile!.id,
        type: newNote.type,
        content: newNote.content.trim()
      });

      if (error) throw error;

      setNewNote({ type: 'nota', content: '' });
      setShowAddModal(false);
    } catch (error) {
      console.error('Error adding interaction:', error);
      alert('Error al agregar la interacción');
    }
  }

  function getInteractionIcon(type: string): string {
    switch (type) {
      case 'nota': return '📝';
      case 'llamada': return '📞';
      case 'whatsapp': return '💬';
      case 'email': return '✉️';
      case 'cambio_status': return '🔄';
      default: return '📌';
    }
  }

  function getInteractionColor(type: string): string {
    switch (type) {
      case 'nota': return '#718096';
      case 'llamada': return '#017E7B';
      case 'whatsapp': return '#25D366';
      case 'email': return '#3B82F6';
      case 'cambio_status': return '#8B5CF6';
      default: return '#718096';
    }
  }

  return (
    <div style={{ padding: '1.5rem', maxWidth: '900px', margin: '0 auto' }}>
      <div style={{ marginBottom: '1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h2 style={{ fontSize: '1.25rem', fontWeight: 600, color: '#202856', margin: 0 }}>
          Actividad
        </h2>
        <Button onClick={() => setShowAddModal(true)}>
          + Nueva interacción
        </Button>
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: '3rem', color: '#718096' }}>
          Cargando actividad...
        </div>
      ) : timelineItems.length === 0 ? (
        <Card>
          <div style={{ textAlign: 'center', padding: '2rem' }}>
            <p style={{ color: '#718096', marginBottom: '1rem' }}>
              Aún no hay actividad registrada
            </p>
            <Button onClick={() => setShowAddModal(true)}>
              + Agregar primera interacción
            </Button>
          </div>
        </Card>
      ) : (
        <div style={{ position: 'relative' }}>
          <div style={{
            position: 'absolute',
            left: '1.25rem',
            top: '0',
            bottom: '0',
            width: '2px',
            background: '#E6E8EF'
          }} />

          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {timelineItems.map(item => (
              item.type === 'email' ? (
                <div key={item.id} style={{ position: 'relative', paddingLeft: '3rem' }}>
                  <div style={{
                    position: 'absolute',
                    left: '0',
                    top: '0.5rem',
                    width: '2.5rem',
                    height: '2.5rem',
                    borderRadius: '50%',
                    background: '#FFFFFF',
                    border: '3px solid #3B82F6',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '1.125rem'
                  }}>
                    ✉️
                  </div>
                  <div style={{ marginLeft: '0.5rem' }}>
                    <EmailHistoryItem email={item.data as EmailMessage} />
                  </div>
                </div>
              ) : (
                <div
                  key={item.id}
                  style={{
                    position: 'relative',
                    paddingLeft: '3rem'
                  }}
                >
                  <div style={{
                    position: 'absolute',
                    left: '0',
                    top: '0.5rem',
                    width: '2.5rem',
                    height: '2.5rem',
                    borderRadius: '50%',
                    background: '#FFFFFF',
                    border: `3px solid ${getInteractionColor((item.data as InteractionWithProfile).type)}`,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '1.125rem'
                  }}>
                    {getInteractionIcon((item.data as InteractionWithProfile).type)}
                  </div>

                  <Card style={{ marginLeft: '0.5rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.5rem' }}>
                      <div>
                        <span style={{ fontSize: '0.875rem', fontWeight: 600, color: '#202856' }}>
                          {(item.data as InteractionWithProfile).profiles.full_name}
                        </span>
                        <span style={{ fontSize: '0.875rem', color: '#718096', marginLeft: '0.5rem' }}>
                          • {new Date((item.data as InteractionWithProfile).created_at).toLocaleString('es-MX', {
                            day: '2-digit',
                            month: 'short',
                            hour: '2-digit',
                            minute: '2-digit'
                          })}
                        </span>
                      </div>
                      <span style={{ fontSize: '0.75rem', color: '#718096', textTransform: 'capitalize' }}>
                        {(item.data as InteractionWithProfile).type}
                      </span>
                    </div>
                    <p style={{ fontSize: '0.875rem', color: '#202856', lineHeight: 1.6, whiteSpace: 'pre-wrap', margin: 0 }}>
                      {(item.data as InteractionWithProfile).content}
                    </p>
                  </Card>
                </div>
              )
            ))}
          </div>
        </div>
      )}

      {showAddModal && (
        <div
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setShowAddModal(false);
            }
          }}
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(0,0,0,0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1100,
            padding: '1rem'
          }}
        >
          <Card
            onClick={(e) => e.stopPropagation()}
            style={{ maxWidth: '500px', width: '100%', padding: '1.5rem' }}
          >
            <h3 style={{ fontSize: '1.25rem', fontWeight: 600, color: '#202856', marginBottom: '1.5rem' }}>
              Nueva Interacción
            </h3>
            <form onSubmit={handleAddInteraction} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 500, color: '#202856', marginBottom: '0.5rem' }}>
                  Tipo
                </label>
                <select
                  value={newNote.type}
                  onChange={(e) => setNewNote({ ...newNote, type: e.target.value as any })}
                  style={{
                    width: '100%',
                    padding: '0.5rem',
                    borderRadius: '6px',
                    border: '1px solid #E6E8EF',
                    fontSize: '0.875rem'
                  }}
                >
                  <option value="nota">Nota</option>
                  <option value="llamada">Llamada</option>
                  <option value="whatsapp">WhatsApp</option>
                  <option value="email">Email</option>
                  <option value="cambio_status">Cambio de Status</option>
                </select>
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 500, color: '#202856', marginBottom: '0.5rem' }}>
                  Contenido
                </label>
                <textarea
                  value={newNote.content}
                  onChange={(e) => setNewNote({ ...newNote, content: e.target.value })}
                  rows={4}
                  style={{
                    width: '100%',
                    padding: '0.5rem',
                    borderRadius: '6px',
                    border: '1px solid #E6E8EF',
                    fontSize: '0.875rem',
                    resize: 'vertical',
                    fontFamily: 'inherit'
                  }}
                  placeholder="Describe la interacción..."
                  required
                />
              </div>
              <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
                <Button type="button" variant="ghost" onClick={() => setShowAddModal(false)}>
                  Cancelar
                </Button>
                <Button type="submit">
                  Agregar
                </Button>
              </div>
            </form>
          </Card>
        </div>
      )}
    </div>
  );
}
