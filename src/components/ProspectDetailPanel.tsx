import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import type { Prospect, Interaction, Followup, Profile } from '../types/database';
import { Button } from './ui/Button';
import { Input } from './ui/Input';
import { Card } from './ui/Card';
import { Badge } from './ui/Badge';
import { EmailComposer } from './Email/EmailComposer';
import { UnifiedTimeline } from './UnifiedTimeline';
import { normalizePhoneNumber } from '../utils/phoneUtils';
import { WhatsAppModal } from './WhatsApp/WhatsAppModal';

interface ProspectDetailPanelProps {
  prospect: Prospect;
  onClose: () => void;
  onUpdate: () => void;
}

export function ProspectDetailPanel({ prospect, onClose, onUpdate }: ProspectDetailPanelProps) {
  const { profile } = useAuth();
  const [interactions, setInteractions] = useState<(Interaction & { created_by_profile?: Profile })[]>([]);
  const [followups, setFollowups] = useState<(Followup & { assigned_to_profile?: Profile })[]>([]);
  const [activeTab, setActiveTab] = useState<'timeline' | 'followups' | 'info' | 'activity'>('info');
  const [showInteractionForm, setShowInteractionForm] = useState(false);
  const [showFollowupForm, setShowFollowupForm] = useState(false);
  const [showConvertModal, setShowConvertModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showEmailComposer, setShowEmailComposer] = useState(false);
  const [showWhatsAppModal, setShowWhatsAppModal] = useState(false);
  const [isEditingInfo, setIsEditingInfo] = useState(false);
  const [loading, setLoading] = useState(false);

  const [editForm, setEditForm] = useState({
    full_name: prospect.full_name,
    phone: prospect.phone,
    email: prospect.email || '',
    product_interest: prospect.product_interest,
    origin: prospect.origin,
    priority: prospect.priority,
    status: prospect.status,
    comments: prospect.comments || ''
  });

  const isAdmin = profile?.role === 'admin';

  const [interactionForm, setInteractionForm] = useState({
    type: 'nota' as Interaction['type'],
    content: ''
  });

  const [followupForm, setFollowupForm] = useState({
    title: '',
    channel: 'llamada' as Followup['channel'],
    due_at: '',
    notes: ''
  });

  useEffect(() => {
    loadInteractions();
    loadFollowups();
  }, [prospect.id]);

  async function loadInteractions() {
    const { data } = await supabase
      .from('interactions')
      .select('*, created_by_profile:profiles!interactions_created_by_fkey(full_name)')
      .eq('prospect_id', prospect.id)
      .order('created_at', { ascending: false });

    if (data) {
      setInteractions(data.map(item => ({
        ...item,
        created_by_profile: item.created_by_profile as any
      })));
    }
  }

  async function loadFollowups() {
    const { data } = await supabase
      .from('followups')
      .select('*, assigned_to_profile:profiles!followups_assigned_to_fkey(full_name)')
      .eq('prospect_id', prospect.id)
      .order('due_at', { ascending: true });

    if (data) {
      setFollowups(data.map(item => ({
        ...item,
        assigned_to_profile: item.assigned_to_profile as any
      })));
    }
  }

  async function handleAddInteraction(e: React.FormEvent) {
    e.preventDefault();
    if (!interactionForm.content.trim()) return;

    setLoading(true);
    try {
      const { error } = await supabase.from('interactions').insert({
        prospect_id: prospect.id,
        created_by: profile!.id,
        type: interactionForm.type,
        content: interactionForm.content
      });

      if (error) throw error;

      setInteractionForm({ type: 'nota', content: '' });
      setShowInteractionForm(false);
      loadInteractions();
    } catch (error: any) {
      alert('Error: ' + error.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleAddFollowup(e: React.FormEvent) {
    e.preventDefault();
    if (!followupForm.title.trim() || !followupForm.due_at) return;

    setLoading(true);
    try {
      const { error } = await supabase.from('followups').insert({
        prospect_id: prospect.id,
        created_by: profile!.id,
        assigned_to: profile!.id,
        title: followupForm.title,
        channel: followupForm.channel,
        due_at: followupForm.due_at,
        notes: followupForm.notes
      });

      if (error) throw error;

      setFollowupForm({ title: '', channel: 'llamada', due_at: '', notes: '' });
      setShowFollowupForm(false);
      loadFollowups();
    } catch (error: any) {
      alert('Error: ' + error.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleCompleteFollowup(followupId: string) {
    setLoading(true);
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
    } catch (error: any) {
      alert('Error: ' + error.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleUpdateProspect() {
    if (!editForm.full_name.trim() || !editForm.phone.trim()) {
      alert('Por favor completa el nombre y teléfono');
      return;
    }

    setLoading(true);
    try {
      const previousStatus = prospect.status;
      const { error } = await supabase
        .from('prospects')
        .update({
          full_name: editForm.full_name.trim(),
          phone: editForm.phone.trim(),
          email: editForm.email.trim() || null,
          product_interest: editForm.product_interest,
          origin: editForm.origin,
          priority: editForm.priority,
          status: editForm.status,
          comments: editForm.comments.trim() || null,
          last_activity_at: new Date().toISOString()
        })
        .eq('id', prospect.id);

      if (error) throw error;

      if (previousStatus !== editForm.status) {
        await supabase.from('interactions').insert({
          prospect_id: prospect.id,
          created_by: profile!.id,
          type: 'cambio_status',
          content: `Cambio de estatus: ${previousStatus} → ${editForm.status}`
        });
      }

      setIsEditingInfo(false);
      onUpdate();
    } catch (error: any) {
      alert('Error al actualizar: ' + error.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleDeleteProspect() {
    setLoading(true);
    try {
      await supabase.from('followups').delete().eq('prospect_id', prospect.id);
      await supabase.from('interactions').delete().eq('prospect_id', prospect.id);

      const { error } = await supabase
        .from('prospects')
        .delete()
        .eq('id', prospect.id);

      if (error) throw error;

      setShowDeleteModal(false);
      onUpdate();
      onClose();
    } catch (error: any) {
      alert('Error al eliminar: ' + error.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleConvertToClient() {
    if (!prospect.email) {
      alert('El prospecto necesita un email para convertirse en cliente');
      return;
    }

    setLoading(true);
    try {
      const password = Math.random().toString(36).slice(-8) + Math.random().toString(36).slice(-8);
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: prospect.email,
        password
      });

      if (authError) throw authError;

      if (authData.user) {
        const { error: profileError } = await supabase.from('profiles').insert({
          id: authData.user.id,
          email: prospect.email,
          full_name: prospect.full_name,
          phone: prospect.phone,
          role: 'cliente',
          assigned_executive_id: prospect.executive_id
        });

        if (profileError) throw profileError;

        await supabase.from('prospects').update({
          status: 'cerrado',
          converted_to_client_id: authData.user.id
        }).eq('id', prospect.id);

        await supabase.from('interactions').insert({
          prospect_id: prospect.id,
          created_by: profile!.id,
          type: 'nota',
          content: `Convertido a cliente. Credenciales enviadas.`
        });

        alert(`✅ Cliente creado exitosamente\n\nCredenciales:\nEmail: ${prospect.email}\nContraseña: ${password}\n\n⚠️ Guarda esta contraseña.`);

        setShowConvertModal(false);
        onUpdate();
        onClose();
      }
    } catch (error: any) {
      alert('Error: ' + error.message);
    } finally {
      setLoading(false);
    }
  }

  const interactionIcons = {
    nota: '📝',
    llamada: '📞',
    whatsapp: '💬',
    email: '✉️',
    cambio_status: '🔄'
  };

  const channelIcons = {
    llamada: '📞',
    whatsapp: '💬',
    email: '✉️',
    otro: '📋'
  };

  return (
    <>
      <div
        style={{
          position: 'fixed',
          top: 0,
          right: 0,
          bottom: 0,
          width: '100%',
          maxWidth: '600px',
          background: '#FFFFFF',
          boxShadow: '-4px 0 16px rgba(0,0,0,0.15)',
          zIndex: 1000,
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden'
        }}
      >
        <div style={{
          padding: '1.5rem',
          borderBottom: '1px solid #E6E8EF',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start'
        }}>
          <div style={{ flex: 1 }}>
            <h2 style={{ fontSize: '1.5rem', fontWeight: 600, color: '#202856', marginBottom: '0.5rem' }}>
              {prospect.full_name}
            </h2>
            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginBottom: '0.75rem' }}>
              <Badge variant={
                prospect.status === 'nuevo' ? 'success' :
                prospect.status === 'contactado' ? 'info' :
                prospect.status === 'cotizado' ? 'warning' :
                prospect.status === 'perdido' ? 'error' : 'default'
              }>
                {prospect.status}
              </Badge>
              {prospect.priority && (
                <Badge variant={
                  prospect.priority === 'alta' ? 'error' :
                  prospect.priority === 'media' ? 'warning' : 'success'
                }>
                  {prospect.priority}
                </Badge>
              )}
            </div>
            <div style={{ fontSize: '0.875rem', color: '#718096' }}>
              <p>📞 {prospect.phone}</p>
              {prospect.email && <p>✉️ {prospect.email}</p>}
              {prospect.product_interest && <p>🎯 {prospect.product_interest}</p>}
            </div>
          </div>
          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'flex-start' }}>
            <button
              onClick={() => setShowWhatsAppModal(true)}
              style={{
                background: '#65EA1E',
                border: 'none',
                borderRadius: '8px',
                padding: '0.5rem 0.75rem',
                fontSize: '1.25rem',
                cursor: 'pointer',
                minWidth: '44px',
                minHeight: '44px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
              title="Abrir chat de WhatsApp"
            >
              💬
            </button>
            {prospect.email && (
              <button
                onClick={() => setShowEmailComposer(true)}
                style={{
                  background: '#65EA1E',
                  border: 'none',
                  borderRadius: '8px',
                  padding: '0.5rem 0.75rem',
                  fontSize: '1.25rem',
                  cursor: 'pointer',
                  minWidth: '44px',
                  minHeight: '44px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
                title="Enviar correo"
              >
                ✉️
              </button>
            )}
            <button
              onClick={onClose}
              style={{
                background: 'none',
                border: 'none',
                fontSize: '2rem',
                color: '#718096',
                cursor: 'pointer',
                padding: 0,
                minWidth: '44px',
                minHeight: '44px'
              }}
            >
              ×
            </button>
          </div>
        </div>

        <div style={{ display: 'flex', borderBottom: '1px solid #E6E8EF', background: '#F7F8FC', overflowX: 'auto' }}>
          <button
            onClick={() => setActiveTab('info')}
            style={{
              flex: 1,
              padding: '1rem',
              background: activeTab === 'info' ? '#FFFFFF' : 'transparent',
              color: activeTab === 'info' ? '#202856' : '#718096',
              border: 'none',
              borderBottom: activeTab === 'info' ? '3px solid #202856' : '3px solid transparent',
              cursor: 'pointer',
              fontWeight: 600,
              fontSize: '0.875rem',
              transition: 'all 0.2s',
              whiteSpace: 'nowrap'
            }}
          >
            Información
          </button>
          <button
            onClick={() => setActiveTab('activity')}
            style={{
              flex: 1,
              padding: '1rem',
              background: activeTab === 'activity' ? '#FFFFFF' : 'transparent',
              color: activeTab === 'activity' ? '#202856' : '#718096',
              border: 'none',
              borderBottom: activeTab === 'activity' ? '3px solid #202856' : '3px solid transparent',
              cursor: 'pointer',
              fontWeight: 600,
              fontSize: '0.875rem',
              transition: 'all 0.2s',
              whiteSpace: 'nowrap'
            }}
          >
            Historial
          </button>
          <button
            onClick={() => setActiveTab('timeline')}
            style={{
              flex: 1,
              padding: '1rem',
              background: activeTab === 'timeline' ? '#FFFFFF' : 'transparent',
              color: activeTab === 'timeline' ? '#202856' : '#718096',
              border: 'none',
              borderBottom: activeTab === 'timeline' ? '3px solid #202856' : '3px solid transparent',
              cursor: 'pointer',
              fontWeight: 600,
              fontSize: '0.875rem',
              transition: 'all 0.2s',
              whiteSpace: 'nowrap'
            }}
          >
            Notas
          </button>
          <button
            onClick={() => setActiveTab('followups')}
            style={{
              flex: 1,
              padding: '1rem',
              background: activeTab === 'followups' ? '#FFFFFF' : 'transparent',
              color: activeTab === 'followups' ? '#202856' : '#718096',
              border: 'none',
              borderBottom: activeTab === 'followups' ? '3px solid #202856' : '3px solid transparent',
              cursor: 'pointer',
              fontWeight: 600,
              fontSize: '0.875rem',
              transition: 'all 0.2s',
              whiteSpace: 'nowrap'
            }}
          >
            Seguimientos {followups.filter(f => f.status === 'pendiente').length > 0 &&
              <span style={{ color: '#EF4444' }}>({followups.filter(f => f.status === 'pendiente').length})</span>
            }
          </button>
        </div>

        <div style={{ flex: 1, overflow: 'auto', padding: '1.5rem' }}>
          {activeTab === 'activity' ? (
            <UnifiedTimeline entityType="prospect" entityId={prospect.id} />
          ) : activeTab === 'info' ? (
            <>
              {!isEditingInfo ? (
                <>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                    <h3 style={{ fontSize: '1.125rem', fontWeight: 600, color: '#202856' }}>
                      Información del Lead
                    </h3>
                    <Button
                      variant="secondary"
                      onClick={() => setIsEditingInfo(true)}
                      style={{ fontSize: '0.875rem', padding: '0.5rem 1rem' }}
                    >
                      Editar
                    </Button>
                  </div>

                  <div style={{ display: 'grid', gap: '1.25rem' }}>
                    <div>
                      <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: '#718096', marginBottom: '4px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                        Estatus
                      </label>
                      <Badge variant={
                        editForm.status === 'nuevo' ? 'success' :
                        editForm.status === 'contactado' ? 'info' :
                        editForm.status === 'cotizado' ? 'warning' :
                        editForm.status === 'perdido' ? 'error' : 'default'
                      } style={{ fontSize: '0.875rem', textTransform: 'capitalize' }}>
                        {editForm.status}
                      </Badge>
                    </div>

                    <div>
                      <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: '#718096', marginBottom: '4px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                        Nombre completo
                      </label>
                      <p style={{ fontSize: '1rem', color: '#202856', fontWeight: 500 }}>{editForm.full_name}</p>
                    </div>

                    <div>
                      <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: '#718096', marginBottom: '4px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                        Teléfono
                      </label>
                      <p style={{ fontSize: '1rem', color: '#202856', fontWeight: 500 }}>{editForm.phone}</p>
                    </div>

                    <div>
                      <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: '#718096', marginBottom: '4px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                        Email
                      </label>
                      <p style={{ fontSize: '1rem', color: '#202856', fontWeight: 500 }}>{editForm.email || 'No registrado'}</p>
                    </div>

                    <div>
                      <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: '#718096', marginBottom: '4px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                        Producto
                      </label>
                      <p style={{ fontSize: '1rem', color: '#202856', fontWeight: 500, textTransform: 'capitalize' }}>{editForm.product_interest}</p>
                    </div>

                    <div>
                      <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: '#718096', marginBottom: '4px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                        Origen
                      </label>
                      <p style={{ fontSize: '1rem', color: '#202856', fontWeight: 500, textTransform: 'capitalize' }}>{editForm.origin}</p>
                    </div>

                    <div>
                      <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: '#718096', marginBottom: '4px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                        Prioridad
                      </label>
                      <Badge variant={
                        editForm.priority === 'alta' ? 'error' :
                        editForm.priority === 'media' ? 'warning' : 'success'
                      } style={{ fontSize: '0.875rem', textTransform: 'capitalize' }}>
                        {editForm.priority}
                      </Badge>
                    </div>

                    {editForm.comments && (
                      <div>
                        <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: '#718096', marginBottom: '4px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                          Comentarios
                        </label>
                        <p style={{ fontSize: '0.875rem', color: '#202856', lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>{editForm.comments}</p>
                      </div>
                    )}
                  </div>

                  {isAdmin && (
                    <div style={{ marginTop: '2rem', paddingTop: '1.5rem', borderTop: '1px solid #E6E8EF' }}>
                      <Button
                        variant="ghost"
                        onClick={() => setShowDeleteModal(true)}
                        style={{ color: '#EF4444', fontSize: '0.875rem' }}
                      >
                        Eliminar Lead
                      </Button>
                    </div>
                  )}
                </>
              ) : (
                <Card style={{ padding: '1.5rem' }}>
                  <h3 style={{ fontSize: '1.125rem', fontWeight: 600, color: '#202856', marginBottom: '1.5rem' }}>
                    Editar Información
                  </h3>

                  <div style={{ display: 'grid', gap: '1.25rem' }}>
                    <div>
                      <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 600, color: '#202856', marginBottom: '8px' }}>
                        Estatus
                      </label>
                      <select
                        value={editForm.status}
                        onChange={e => setEditForm({ ...editForm, status: e.target.value as Prospect['status'] })}
                        className="input-premium"
                        disabled={loading}
                        style={{ width: '100%' }}
                      >
                        <option value="nuevo">Nuevo</option>
                        <option value="contactado">Contactado</option>
                        <option value="cotizado">Cotizado</option>
                        <option value="cerrado">Cerrado</option>
                        <option value="perdido">Perdido</option>
                      </select>
                    </div>

                    <div>
                      <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 600, color: '#202856', marginBottom: '8px' }}>
                        Nombre completo *
                      </label>
                      <Input
                        type="text"
                        value={editForm.full_name}
                        onChange={e => setEditForm({ ...editForm, full_name: e.target.value })}
                        disabled={loading}
                      />
                    </div>

                    <div>
                      <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 600, color: '#202856', marginBottom: '8px' }}>
                        Teléfono *
                      </label>
                      <Input
                        type="tel"
                        value={editForm.phone}
                        onChange={e => setEditForm({ ...editForm, phone: e.target.value })}
                        disabled={loading}
                      />
                    </div>

                    <div>
                      <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 600, color: '#202856', marginBottom: '8px' }}>
                        Email
                      </label>
                      <Input
                        type="email"
                        value={editForm.email}
                        onChange={e => setEditForm({ ...editForm, email: e.target.value })}
                        disabled={loading}
                      />
                    </div>

                    <div>
                      <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 600, color: '#202856', marginBottom: '8px' }}>
                        Producto
                      </label>
                      <select
                        value={editForm.product_interest || ''}
                        onChange={e => setEditForm({ ...editForm, product_interest: e.target.value || null })}
                        className="input-premium"
                        disabled={loading}
                        style={{ width: '100%' }}
                      >
                        <option value="auto">Auto</option>
                        <option value="gastos_medicos">Gastos Médicos</option>
                        <option value="vida">Vida</option>
                        <option value="hogar">Hogar</option>
                        <option value="empresarial">Empresarial</option>
                      </select>
                    </div>

                    <div>
                      <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 600, color: '#202856', marginBottom: '8px' }}>
                        Origen
                      </label>
                      <select
                        value={editForm.origin}
                        onChange={e => setEditForm({ ...editForm, origin: e.target.value as Prospect['origin'] })}
                        className="input-premium"
                        disabled={loading}
                        style={{ width: '100%' }}
                      >
                        <option value="whatsapp">WhatsApp</option>
                        <option value="web">Web</option>
                        <option value="referido">Referido</option>
                        <option value="otro">Otro</option>
                      </select>
                    </div>

                    <div>
                      <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 600, color: '#202856', marginBottom: '8px' }}>
                        Prioridad
                      </label>
                      <select
                        value={editForm.priority || ''}
                        onChange={e => setEditForm({ ...editForm, priority: (e.target.value || null) as Prospect['priority'] })}
                        className="input-premium"
                        disabled={loading}
                        style={{ width: '100%' }}
                      >
                        <option value="alta">Alta</option>
                        <option value="media">Media</option>
                        <option value="baja">Baja</option>
                      </select>
                    </div>

                    <div>
                      <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 600, color: '#202856', marginBottom: '8px' }}>
                        Comentarios
                      </label>
                      <textarea
                        value={editForm.comments}
                        onChange={e => setEditForm({ ...editForm, comments: e.target.value })}
                        disabled={loading}
                        className="input-premium"
                        rows={4}
                        style={{ width: '100%', resize: 'vertical', fontFamily: 'inherit' }}
                        placeholder="Notas adicionales..."
                      />
                    </div>

                    <div style={{ display: 'flex', gap: '12px', marginTop: '8px' }}>
                      <Button
                        onClick={handleUpdateProspect}
                        disabled={loading || !editForm.full_name.trim() || !editForm.phone.trim()}
                        style={{ flex: 1, background: '#65EA1E', color: '#202856', fontWeight: 600 }}
                      >
                        {loading ? 'Guardando...' : 'Guardar Cambios'}
                      </Button>
                      <Button
                        onClick={() => {
                          setIsEditingInfo(false);
                          setEditForm({
                            full_name: prospect.full_name,
                            phone: prospect.phone,
                            email: prospect.email || '',
                            product_interest: prospect.product_interest,
                            origin: prospect.origin,
                            priority: prospect.priority,
                            status: prospect.status,
                            comments: prospect.comments || ''
                          });
                        }}
                        disabled={loading}
                        style={{ flex: 1, background: '#F7F8FC', color: '#718096', border: '2px solid #E6E8EF' }}
                      >
                        Cancelar
                      </Button>
                    </div>
                  </div>
                </Card>
              )}
            </>
          ) : activeTab === 'timeline' ? (
            <>
              {!showInteractionForm ? (
                <Button onClick={() => setShowInteractionForm(true)} variant="secondary" style={{ width: '100%', marginBottom: '1rem' }}>
                  + Agregar interacción
                </Button>
              ) : (
                <Card style={{ marginBottom: '1rem', padding: '1rem' }}>
                  <form onSubmit={handleAddInteraction}>
                    <select
                      value={interactionForm.type}
                      onChange={e => setInteractionForm({ ...interactionForm, type: e.target.value as any })}
                      style={{
                        width: '100%',
                        padding: '0.75rem 1rem',
                        border: '1px solid #E6E8EF',
                        borderRadius: '0.75rem',
                        fontSize: '1rem',
                        background: '#FFFFFF',
                        color: '#202856',
                        marginBottom: '0.75rem',
                        minHeight: '44px'
                      }}
                    >
                      <option value="nota">📝 Nota</option>
                      <option value="llamada">📞 Llamada</option>
                      <option value="whatsapp">💬 WhatsApp</option>
                      <option value="email">✉️ Email</option>
                    </select>
                    <textarea
                      value={interactionForm.content}
                      onChange={e => setInteractionForm({ ...interactionForm, content: e.target.value })}
                      placeholder="Describe la interacción..."
                      required
                      style={{
                        width: '100%',
                        padding: '0.75rem 1rem',
                        border: '1px solid #E6E8EF',
                        borderRadius: '0.75rem',
                        minHeight: '100px',
                        fontSize: '1rem',
                        fontFamily: 'Inter, sans-serif',
                        resize: 'vertical',
                        marginBottom: '0.75rem'
                      }}
                    />
                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                      <Button type="submit" variant="primary" disabled={loading}>
                        {loading ? 'Guardando...' : 'Guardar'}
                      </Button>
                      <Button type="button" variant="ghost" onClick={() => setShowInteractionForm(false)}>
                        Cancelar
                      </Button>
                    </div>
                  </form>
                </Card>
              )}

              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                {interactions.map(interaction => (
                  <div key={interaction.id} style={{
                    display: 'flex',
                    gap: '1rem',
                    position: 'relative',
                    paddingLeft: '2rem'
                  }}>
                    <div style={{
                      position: 'absolute',
                      left: 0,
                      width: '32px',
                      height: '32px',
                      borderRadius: '50%',
                      background: '#F7F8FC',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: '1rem',
                      border: '2px solid #E6E8EF'
                    }}>
                      {interactionIcons[interaction.type]}
                    </div>
                    <div style={{ flex: 1, paddingTop: '0.25rem' }}>
                      <p style={{ fontSize: '0.875rem', color: '#202856', marginBottom: '0.25rem', lineHeight: 1.5 }}>
                        {interaction.content}
                      </p>
                      <p style={{ fontSize: '0.75rem', color: '#718096' }}>
                        {new Date(interaction.created_at).toLocaleString('es-MX', {
                          year: 'numeric',
                          month: 'short',
                          day: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit'
                        })}
                        {interaction.created_by_profile && ` · ${interaction.created_by_profile.full_name}`}
                      </p>
                    </div>
                  </div>
                ))}
                {interactions.length === 0 && (
                  <p style={{ textAlign: 'center', color: '#718096', fontSize: '0.875rem', padding: '2rem' }}>
                    Sin interacciones registradas
                  </p>
                )}
              </div>
            </>
          ) : (
            <>
              {!showFollowupForm ? (
                <Button onClick={() => setShowFollowupForm(true)} variant="secondary" style={{ width: '100%', marginBottom: '1rem' }}>
                  + Programar seguimiento
                </Button>
              ) : (
                <Card style={{ marginBottom: '1rem', padding: '1rem' }}>
                  <form onSubmit={handleAddFollowup}>
                    <Input
                      label="Título"
                      type="text"
                      value={followupForm.title}
                      onChange={e => setFollowupForm({ ...followupForm, title: e.target.value })}
                      placeholder="Ej: Dar seguimiento a cotización"
                      required
                      style={{ marginBottom: '0.75rem' }}
                    />
                    <div style={{ marginBottom: '0.75rem' }}>
                      <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 500, marginBottom: '0.5rem', color: '#202856' }}>
                        Canal
                      </label>
                      <select
                        value={followupForm.channel}
                        onChange={e => setFollowupForm({ ...followupForm, channel: e.target.value as any })}
                        style={{
                          width: '100%',
                          padding: '0.75rem 1rem',
                          border: '1px solid #E6E8EF',
                          borderRadius: '0.75rem',
                          fontSize: '1rem',
                          background: '#FFFFFF',
                          color: '#202856',
                          minHeight: '44px'
                        }}
                      >
                        <option value="llamada">📞 Llamada</option>
                        <option value="whatsapp">💬 WhatsApp</option>
                        <option value="email">✉️ Email</option>
                        <option value="otro">📋 Otro</option>
                      </select>
                    </div>
                    <Input
                      label="Fecha y hora"
                      type="datetime-local"
                      value={followupForm.due_at}
                      onChange={e => setFollowupForm({ ...followupForm, due_at: e.target.value })}
                      required
                      style={{ marginBottom: '0.75rem' }}
                    />
                    <textarea
                      value={followupForm.notes}
                      onChange={e => setFollowupForm({ ...followupForm, notes: e.target.value })}
                      placeholder="Notas adicionales..."
                      style={{
                        width: '100%',
                        padding: '0.75rem 1rem',
                        border: '1px solid #E6E8EF',
                        borderRadius: '0.75rem',
                        minHeight: '80px',
                        fontSize: '1rem',
                        fontFamily: 'Inter, sans-serif',
                        resize: 'vertical',
                        marginBottom: '0.75rem'
                      }}
                    />
                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                      <Button type="submit" variant="primary" disabled={loading}>
                        {loading ? 'Guardando...' : 'Guardar'}
                      </Button>
                      <Button type="button" variant="ghost" onClick={() => setShowFollowupForm(false)}>
                        Cancelar
                      </Button>
                    </div>
                  </form>
                </Card>
              )}

              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                {followups.map(followup => {
                  const isOverdue = new Date(followup.due_at) < new Date() && followup.status === 'pendiente';
                  const isDueToday = new Date(followup.due_at).toDateString() === new Date().toDateString();

                  return (
                    <Card key={followup.id} style={{
                      padding: '1rem',
                      border: isOverdue ? '2px solid #EF4444' : isDueToday && followup.status === 'pendiente' ? '2px solid #F59E0B' : '1px solid #E6E8EF',
                      opacity: followup.status === 'completado' ? 0.6 : 1
                    }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.5rem' }}>
                        <h4 style={{
                          fontSize: '1rem',
                          fontWeight: 600,
                          color: '#202856',
                          textDecoration: followup.status === 'completado' ? 'line-through' : 'none'
                        }}>
                          {channelIcons[followup.channel]} {followup.title}
                        </h4>
                        <Badge variant={
                          followup.status === 'completado' ? 'success' :
                          followup.status === 'cancelado' ? 'default' :
                          isOverdue ? 'error' : 'warning'
                        }>
                          {followup.status === 'completado' ? '✓ Completado' :
                           followup.status === 'cancelado' ? 'Cancelado' :
                           isOverdue ? 'Vencido' : 'Pendiente'}
                        </Badge>
                      </div>
                      <p style={{ fontSize: '0.875rem', color: '#718096', marginBottom: '0.5rem' }}>
                        {new Date(followup.due_at).toLocaleString('es-MX', {
                          weekday: 'short',
                          year: 'numeric',
                          month: 'short',
                          day: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit'
                        })}
                      </p>
                      {followup.notes && (
                        <p style={{ fontSize: '0.875rem', color: '#718096', marginBottom: '0.75rem' }}>
                          {followup.notes}
                        </p>
                      )}
                      {followup.status === 'pendiente' && (
                        <Button
                          variant="primary"
                          onClick={() => handleCompleteFollowup(followup.id)}
                          disabled={loading}
                          style={{ fontSize: '0.75rem', padding: '0.5rem 1rem' }}
                        >
                          ✓ Marcar como completado
                        </Button>
                      )}
                    </Card>
                  );
                })}
                {followups.length === 0 && (
                  <p style={{ textAlign: 'center', color: '#718096', fontSize: '0.875rem', padding: '2rem' }}>
                    Sin seguimientos programados
                  </p>
                )}
              </div>
            </>
          )}
        </div>

        <div style={{
          padding: '1.5rem',
          borderTop: '1px solid #E6E8EF',
          background: '#F7F8FC',
          display: 'flex',
          gap: '0.75rem',
          flexWrap: 'wrap'
        }}>
          {prospect.status !== 'cerrado' && prospect.email && (
            <Button variant="primary" onClick={() => setShowConvertModal(true)} style={{ flex: 1 }}>
              → Convertir a Cliente
            </Button>
          )}
        </div>
      </div>

      {showConvertModal && (
        <div
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setShowConvertModal(false);
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
            style={{ maxWidth: '400px', width: '100%', padding: '1.5rem' }}
          >
            <h3 style={{ fontSize: '1.25rem', fontWeight: 600, color: '#202856', marginBottom: '1rem' }}>
              Convertir en Cliente
            </h3>
            <p style={{ fontSize: '0.875rem', color: '#718096', marginBottom: '1.5rem' }}>
              Se creará un usuario con acceso al portal de clientes con el email:
              <strong style={{ display: 'block', marginTop: '0.5rem', color: '#202856' }}>{prospect.email}</strong>
            </p>
            <div style={{ display: 'flex', gap: '0.75rem' }}>
              <Button
                variant="primary"
                onClick={handleConvertToClient}
                disabled={loading}
                style={{ flex: 1 }}
              >
                {loading ? 'Convirtiendo...' : 'Confirmar'}
              </Button>
              <Button
                variant="ghost"
                onClick={() => setShowConvertModal(false)}
                style={{ flex: 1 }}
              >
                Cancelar
              </Button>
            </div>
          </Card>
        </div>
      )}

      {showEmailComposer && prospect.email && (
        <EmailComposer
          entityType="prospect"
          entityId={prospect.id}
          defaultToEmail={prospect.email}
          defaultSubject={`Seguimiento - ${prospect.full_name}`}
          onClose={() => setShowEmailComposer(false)}
          onSuccess={() => {
            loadInteractions();
            onUpdate();
          }}
        />
      )}

      {showDeleteModal && (
        <div
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setShowDeleteModal(false);
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
            style={{ maxWidth: '400px', width: '100%', padding: '1.5rem' }}
          >
            <h3 style={{ fontSize: '1.25rem', fontWeight: 600, color: '#EF4444', marginBottom: '1rem' }}>
              Eliminar Lead
            </h3>
            <p style={{ fontSize: '0.875rem', color: '#718096', marginBottom: '1.5rem' }}>
              ¿Estás seguro de que deseas eliminar este lead? Esta acción no se puede deshacer y se eliminarán también todas las interacciones y seguimientos asociados.
            </p>
            <div style={{ display: 'flex', gap: '0.75rem' }}>
              <Button
                onClick={handleDeleteProspect}
                disabled={loading}
                style={{ flex: 1, background: '#EF4444', color: '#FFFFFF' }}
              >
                {loading ? 'Eliminando...' : 'Eliminar'}
              </Button>
              <Button
                variant="ghost"
                onClick={() => setShowDeleteModal(false)}
                disabled={loading}
                style={{ flex: 1 }}
              >
                Cancelar
              </Button>
            </div>
          </Card>
        </div>
      )}

      {showWhatsAppModal && (
        <WhatsAppModal
          phoneNumber={normalizePhoneNumber(prospect.phone).e164}
          onClose={() => setShowWhatsAppModal(false)}
        />
      )}
    </>
  );
}
