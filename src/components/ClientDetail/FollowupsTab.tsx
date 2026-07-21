import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import type { Client, Followup } from '../../types/database';
import { Button } from '../ui/Button';
import { Card } from '../ui/Card';
import { Badge } from '../ui/Badge';
import { Input } from '../ui/Input';

interface FollowupsTabProps {
  client: Client;
}

type FollowupWithProfiles = Followup & {
  created_by_profile: { full_name: string };
  assigned_to_profile: { full_name: string };
};

export function FollowupsTab({ client }: FollowupsTabProps) {
  const [followups, setFollowups] = useState<FollowupWithProfiles[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [filter, setFilter] = useState<'all' | 'today' | 'overdue'>('all');

  useEffect(() => {
    loadFollowups();
  }, [client.id]);

  async function loadFollowups() {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('followups')
        .select(`
          *,
          created_by_profile:profiles!created_by(full_name),
          assigned_to_profile:profiles!assigned_to(full_name)
        `)
        .eq('client_id', client.id)
        .order('due_at', { ascending: true });

      if (error) throw error;
      if (data) setFollowups(data as any);
    } catch (error) {
      console.error('Error loading followups:', error);
    } finally {
      setLoading(false);
    }
  }

  async function handleCompleteFollowup(followupId: string) {
    try {
      const { error } = await supabase
        .from('followups')
        .update({
          status: 'completado',
          completed_at: new Date().toISOString()
        })
        .eq('id', followupId);

      if (error) throw error;
      loadFollowups();
    } catch (error) {
      console.error('Error completing followup:', error);
      alert('Error al completar el seguimiento');
    }
  }

  async function handleCancelFollowup(followupId: string) {
    try {
      const { error } = await supabase
        .from('followups')
        .update({ status: 'cancelado' })
        .eq('id', followupId);

      if (error) throw error;
      loadFollowups();
    } catch (error) {
      console.error('Error canceling followup:', error);
      alert('Error al cancelar el seguimiento');
    }
  }

  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  const filteredFollowups = followups.filter(followup => {
    if (filter === 'today') {
      const dueDate = new Date(followup.due_at);
      const dueDay = new Date(dueDate.getFullYear(), dueDate.getMonth(), dueDate.getDate());
      return dueDay.getTime() === today.getTime() && followup.status === 'pendiente';
    }
    if (filter === 'overdue') {
      return new Date(followup.due_at) < now && followup.status === 'pendiente';
    }
    return true;
  });

  const todayCount = followups.filter(f => {
    const dueDate = new Date(f.due_at);
    const dueDay = new Date(dueDate.getFullYear(), dueDate.getMonth(), dueDate.getDate());
    return dueDay.getTime() === today.getTime() && f.status === 'pendiente';
  }).length;

  const overdueCount = followups.filter(f =>
    new Date(f.due_at) < now && f.status === 'pendiente'
  ).length;

  return (
    <div style={{ padding: '1.5rem', maxWidth: '900px', margin: '0 auto' }}>
      <div style={{ marginBottom: '1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
        <h2 style={{ fontSize: '1.25rem', fontWeight: 600, color: '#202856', margin: 0 }}>
          Seguimientos
        </h2>
        <Button onClick={() => setShowAddModal(true)}>
          + Nuevo seguimiento
        </Button>
      </div>

      <div style={{ marginBottom: '1.5rem', display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
        <Button
          onClick={() => setFilter('all')}
          variant={filter === 'all' ? 'primary' : 'secondary'}
          style={{ fontSize: '0.875rem' }}
        >
          Todos
        </Button>
        <Button
          onClick={() => setFilter('today')}
          variant={filter === 'today' ? 'primary' : 'secondary'}
          style={{ fontSize: '0.875rem' }}
        >
          Hoy {todayCount > 0 && `(${todayCount})`}
        </Button>
        <Button
          onClick={() => setFilter('overdue')}
          variant={filter === 'overdue' ? 'primary' : 'secondary'}
          style={{ fontSize: '0.875rem' }}
        >
          Vencidos {overdueCount > 0 && `(${overdueCount})`}
        </Button>
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: '3rem', color: '#718096' }}>
          Cargando seguimientos...
        </div>
      ) : filteredFollowups.length === 0 ? (
        <Card>
          <div style={{ textAlign: 'center', padding: '2rem' }}>
            <p style={{ color: '#718096', marginBottom: '1rem' }}>
              {filter === 'all' ? 'Aún no hay seguimientos' : 'No hay seguimientos en esta categoría'}
            </p>
            {filter === 'all' && (
              <Button onClick={() => setShowAddModal(true)}>
                + Agregar primer seguimiento
              </Button>
            )}
          </div>
        </Card>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {filteredFollowups.map(followup => (
            <FollowupCard
              key={followup.id}
              followup={followup}
              onComplete={() => handleCompleteFollowup(followup.id)}
              onCancel={() => handleCancelFollowup(followup.id)}
            />
          ))}
        </div>
      )}

      {showAddModal && (
        <AddFollowupModal
          client={client}
          onClose={() => setShowAddModal(false)}
          onSuccess={() => {
            setShowAddModal(false);
            loadFollowups();
          }}
        />
      )}
    </div>
  );
}

interface FollowupCardProps {
  followup: FollowupWithProfiles;
  onComplete: () => void;
  onCancel: () => void;
}

function FollowupCard({ followup, onComplete, onCancel }: FollowupCardProps) {
  const now = new Date();
  const dueDate = new Date(followup.due_at);
  const isOverdue = dueDate < now && followup.status === 'pendiente';
  const isToday = dueDate.toDateString() === now.toDateString();

  function getStatusColor(status: string): string {
    switch (status) {
      case 'pendiente': return isOverdue ? '#EF4444' : '#F59E0B';
      case 'completado': return '#65EA1E';
      case 'cancelado': return '#718096';
      default: return '#718096';
    }
  }

  function getStatusLabel(status: string): string {
    if (status === 'pendiente' && isOverdue) return 'Vencido';
    switch (status) {
      case 'pendiente': return 'Pendiente';
      case 'completado': return 'Completado';
      case 'cancelado': return 'Cancelado';
      default: return status;
    }
  }

  function getChannelIcon(channel: string): string {
    switch (channel) {
      case 'llamada': return '📞';
      case 'whatsapp': return '💬';
      case 'email': return '✉️';
      default: return '📌';
    }
  }

  return (
    <Card>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1rem' }}>
        <div style={{ flex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.5rem' }}>
            <span style={{ fontSize: '1.125rem' }}>{getChannelIcon(followup.channel)}</span>
            <h3 style={{ fontSize: '1rem', fontWeight: 600, color: '#202856', margin: 0 }}>
              {followup.title}
            </h3>
            <Badge style={{ background: getStatusColor(followup.status) + '20', color: getStatusColor(followup.status) }}>
              {getStatusLabel(followup.status)}
            </Badge>
          </div>
          {followup.notes && (
            <p style={{ fontSize: '0.875rem', color: '#718096', margin: '0.5rem 0' }}>
              {followup.notes}
            </p>
          )}
        </div>
      </div>

      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingTop: '1rem',
        borderTop: '1px solid #E6E8EF',
        fontSize: '0.875rem',
        color: '#718096'
      }}>
        <div>
          <div>
            <strong style={{ color: isOverdue || isToday ? '#EF4444' : '#718096' }}>
              {dueDate.toLocaleDateString('es-MX', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
            </strong>
          </div>
          <div style={{ fontSize: '0.75rem', marginTop: '0.25rem' }}>
            Asignado a: {followup.assigned_to_profile.full_name}
          </div>
        </div>

        {followup.status === 'pendiente' && (
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <Button onClick={onComplete} style={{ fontSize: '0.875rem', padding: '0.5rem 1rem' }}>
              Completar
            </Button>
            <Button
              onClick={onCancel}
              variant="secondary"
              style={{ fontSize: '0.875rem', padding: '0.5rem 1rem' }}
            >
              Cancelar
            </Button>
          </div>
        )}
      </div>
    </Card>
  );
}

interface AddFollowupModalProps {
  client: Client;
  onClose: () => void;
  onSuccess: () => void;
}

function AddFollowupModal({ client, onClose, onSuccess }: AddFollowupModalProps) {
  const { profile } = useAuth();
  const [isSaving, setIsSaving] = useState(false);
  const [formData, setFormData] = useState({
    title: '',
    channel: 'llamada' as const,
    due_at: '',
    notes: ''
  });

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    try {
      setIsSaving(true);
      const { error } = await supabase.from('followups').insert({
        client_id: client.id,
        created_by: profile!.id,
        assigned_to: client.assigned_to,
        title: formData.title,
        channel: formData.channel,
        due_at: formData.due_at,
        notes: formData.notes,
        status: 'pendiente'
      });

      if (error) throw error;
      onSuccess();
    } catch (error) {
      console.error('Error adding followup:', error);
      alert('Error al agregar el seguimiento');
    } finally {
      setIsSaving(false);
    }
  }

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
      padding: '1rem'
    }}>
      <Card style={{ maxWidth: '600px', width: '100%' }}>
        <h3 style={{ fontSize: '1.25rem', fontWeight: 600, color: '#202856', marginBottom: '1.5rem' }}>
          Nuevo Seguimiento
        </h3>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div>
            <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 500, color: '#202856', marginBottom: '0.5rem' }}>
              Título *
            </label>
            <Input
              type="text"
              value={formData.title}
              onChange={e => setFormData({ ...formData, title: e.target.value })}
              placeholder="Ej: Llamar para recordar pago"
              required
            />
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 500, color: '#202856', marginBottom: '0.5rem' }}>
              Canal *
            </label>
            <select
              value={formData.channel}
              onChange={e => setFormData({ ...formData, channel: e.target.value as any })}
              required
              style={{
                width: '100%',
                padding: '0.75rem 1rem',
                border: '1px solid #E6E8EF',
                borderRadius: '0.75rem',
                fontSize: '1rem',
                background: '#FFFFFF',
                color: '#202856'
              }}
            >
              <option value="llamada">Llamada</option>
              <option value="whatsapp">WhatsApp</option>
              <option value="email">Email</option>
              <option value="otro">Otro</option>
            </select>
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 500, color: '#202856', marginBottom: '0.5rem' }}>
              Fecha y hora *
            </label>
            <Input
              type="datetime-local"
              value={formData.due_at}
              onChange={e => setFormData({ ...formData, due_at: e.target.value })}
              required
            />
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 500, color: '#202856', marginBottom: '0.5rem' }}>
              Notas
            </label>
            <textarea
              value={formData.notes}
              onChange={e => setFormData({ ...formData, notes: e.target.value })}
              rows={4}
              placeholder="Información adicional..."
              style={{
                width: '100%',
                padding: '0.75rem 1rem',
                border: '1px solid #E6E8EF',
                borderRadius: '0.75rem',
                fontSize: '1rem',
                fontFamily: 'inherit',
                resize: 'vertical'
              }}
            />
          </div>

          <div style={{ display: 'flex', gap: '1rem', marginTop: '0.5rem' }}>
            <Button type="submit" disabled={isSaving}>
              {isSaving ? 'Guardando...' : 'Agregar seguimiento'}
            </Button>
            <Button type="button" onClick={onClose} variant="secondary">
              Cancelar
            </Button>
          </div>
        </form>
      </Card>
    </div>
  );
}
