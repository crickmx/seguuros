import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import type { Client } from '../../types/database';
import { Input } from '../ui/Input';
import { Button } from '../ui/Button';
import { Card } from '../ui/Card';

interface ProfileTabProps {
  client: Client;
  onUpdate: () => void;
}

export function ProfileTab({ client, onUpdate }: ProfileTabProps) {
  const navigate = useNavigate();
  const { profile } = useAuth();
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [formData, setFormData] = useState({
    full_name: client.full_name,
    phone: client.phone,
    email: client.email || '',
    internal_notes: client.internal_notes || ''
  });

  const isAdmin = profile?.role === 'admin';
  const canEdit = isAdmin || client.assigned_to === profile?.id;
  const canDelete = isAdmin;

  async function handleSave() {
    try {
      setIsSaving(true);
      const { error } = await supabase
        .from('clients')
        .update({
          full_name: formData.full_name,
          phone: formData.phone,
          email: formData.email || null,
          internal_notes: formData.internal_notes
        })
        .eq('id', client.id);

      if (error) throw error;

      await supabase.from('interactions').insert({
        client_id: client.id,
        created_by: profile!.id,
        type: 'nota',
        content: 'Perfil del cliente actualizado'
      });

      setIsEditing(false);
      onUpdate();
    } catch (error) {
      console.error('Error updating client:', error);
      alert('Error al actualizar el cliente');
    } finally {
      setIsSaving(false);
    }
  }

  async function handleDelete() {
    try {
      const { error } = await supabase
        .from('clients')
        .delete()
        .eq('id', client.id);

      if (error) throw error;
      navigate('/clientes');
    } catch (error) {
      console.error('Error deleting client:', error);
      alert('Error al eliminar el cliente');
    }
  }

  function handleWhatsApp() {
    const phone = client.phone.replace(/\D/g, '');
    window.open(`https://wa.me/${phone}`, '_blank');
  }

  function handleEmail() {
    if (client.email) {
      window.location.href = `mailto:${client.email}`;
    }
  }

  return (
    <div style={{ padding: '1.5rem', maxWidth: '800px', margin: '0 auto' }}>
      <Card>
        <div style={{ marginBottom: '1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h2 style={{ fontSize: '1.25rem', fontWeight: 600, color: '#202856', margin: 0 }}>
            Información del Cliente
          </h2>
          {canEdit && !isEditing && (
            <Button onClick={() => setIsEditing(true)} variant="secondary">
              Editar
            </Button>
          )}
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div>
            <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 500, color: '#202856', marginBottom: '0.5rem' }}>
              Nombre completo *
            </label>
            <Input
              type="text"
              value={formData.full_name}
              onChange={e => setFormData({ ...formData, full_name: e.target.value })}
              disabled={!isEditing}
              required
            />
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 500, color: '#202856', marginBottom: '0.5rem' }}>
              WhatsApp *
            </label>
            <Input
              type="tel"
              value={formData.phone}
              onChange={e => setFormData({ ...formData, phone: e.target.value })}
              disabled={!isEditing}
              required
            />
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 500, color: '#202856', marginBottom: '0.5rem' }}>
              Email
            </label>
            <Input
              type="email"
              value={formData.email}
              onChange={e => setFormData({ ...formData, email: e.target.value })}
              disabled={!isEditing}
            />
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 500, color: '#202856', marginBottom: '0.5rem' }}>
              Notas internas
            </label>
            <textarea
              value={formData.internal_notes}
              onChange={e => setFormData({ ...formData, internal_notes: e.target.value })}
              disabled={!isEditing}
              rows={4}
              style={{
                width: '100%',
                padding: '0.75rem 1rem',
                border: '1px solid #E6E8EF',
                borderRadius: '0.75rem',
                fontSize: '1rem',
                fontFamily: 'inherit',
                resize: 'vertical',
                background: isEditing ? '#FFFFFF' : '#F7F8FC'
              }}
            />
          </div>
        </div>

        {isEditing && (
          <div style={{ marginTop: '1.5rem', display: 'flex', gap: '1rem' }}>
            <Button onClick={handleSave} disabled={isSaving}>
              {isSaving ? 'Guardando...' : 'Guardar cambios'}
            </Button>
            <Button
              onClick={() => {
                setIsEditing(false);
                setFormData({
                  full_name: client.full_name,
                  phone: client.phone,
                  email: client.email || '',
                  internal_notes: client.internal_notes || ''
                });
              }}
              variant="secondary"
            >
              Cancelar
            </Button>
          </div>
        )}

        {!isEditing && (
          <>
            <div style={{
              marginTop: '1.5rem',
              paddingTop: '1.5rem',
              borderTop: '1px solid #E6E8EF',
              display: 'flex',
              gap: '1rem',
              flexWrap: 'wrap'
            }}>
              <Button onClick={handleWhatsApp} variant="secondary">
                💬 WhatsApp
              </Button>
              {client.email && (
                <Button onClick={handleEmail} variant="secondary">
                  ✉️ Email
                </Button>
              )}
            </div>

            {canDelete && (
              <div style={{ marginTop: '1.5rem', paddingTop: '1.5rem', borderTop: '1px solid #E6E8EF' }}>
                <Button
                  onClick={() => setShowDeleteModal(true)}
                  style={{ background: '#EF4444', color: '#FFFFFF' }}
                >
                  Eliminar Cliente
                </Button>
              </div>
            )}
          </>
        )}
      </Card>

      {showDeleteModal && (
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
          <Card style={{ maxWidth: '500px', width: '100%' }}>
            <h3 style={{ fontSize: '1.25rem', fontWeight: 600, color: '#202856', marginBottom: '1rem' }}>
              ¿Eliminar cliente?
            </h3>
            <p style={{ color: '#718096', marginBottom: '1.5rem' }}>
              Esta acción eliminará el cliente y todas sus pólizas, interacciones y seguimientos asociados.
              <strong> Esta acción no se puede deshacer.</strong>
            </p>
            <div style={{ display: 'flex', gap: '1rem', justifyContent: 'flex-end' }}>
              <Button onClick={() => setShowDeleteModal(false)} variant="secondary">
                Cancelar
              </Button>
              <Button
                onClick={handleDelete}
                style={{ background: '#EF4444', color: '#FFFFFF' }}
              >
                Eliminar
              </Button>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}
