import { useState, useEffect, useMemo } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import type { Prospect } from '../types/database';
import { ProspectCard } from './ProspectCard';
import { ProspectDetailPanel } from './ProspectDetailPanel';
import { Input } from './ui/Input';
import { Button } from './ui/Button';
import { Card } from './ui/Card';
import {
  DndContext,
  DragOverlay,
  closestCorners,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
  DragStartEvent,
  DragEndEvent,
} from '@dnd-kit/core';
import { useDroppable } from '@dnd-kit/core';
import { useDraggable } from '@dnd-kit/core';

const STATUSES = [
  { id: 'nuevo', label: 'Nuevo', color: '#65EA1E' },
  { id: 'contactado', label: 'Contactado', color: '#017E7B' },
  { id: 'cotizado', label: 'Cotizado', color: '#F59E0B' },
  { id: 'cerrado', label: 'Cerrado', color: '#194988' },
  { id: 'perdido', label: 'Perdido', color: '#EF4444' }
] as const;

type StatusId = typeof STATUSES[number]['id'];

interface KanbanFilters {
  search: string;
  product: string;
  origin: string;
  priority: string;
}

interface NewLeadForm {
  full_name: string;
  phone: string;
  email: string;
  product_interest: string;
  origin: string;
  priority: string;
  comments: string;
}

export function KanbanBoard() {
  const { profile } = useAuth();
  const [prospects, setProspects] = useState<Prospect[]>([]);
  const [selectedProspect, setSelectedProspect] = useState<Prospect | null>(null);
  const [loading, setLoading] = useState(true);
  const [showNewLeadModal, setShowNewLeadModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [filters, setFilters] = useState<KanbanFilters>({
    search: '',
    product: '',
    origin: '',
    priority: ''
  });

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(TouchSensor, {
      activationConstraint: {
        delay: 200,
        tolerance: 8,
      },
    })
  );

  const [newLead, setNewLead] = useState<NewLeadForm>({
    full_name: '',
    phone: '',
    email: '',
    product_interest: 'auto',
    origin: 'whatsapp',
    priority: 'media',
    comments: ''
  });

  const isAdmin = profile?.role === 'admin';

  useEffect(() => {
    loadProspects();

    const channel = supabase
      .channel('prospects_changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'prospects'
        },
        () => {
          loadProspects();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  async function loadProspects() {
    try {
      setLoading(true);
      const query = supabase
        .from('prospects')
        .select('*')
        .order('last_activity_at', { ascending: false });

      if (!isAdmin) {
        query.eq('executive_id', profile!.id);
      }

      const { data, error } = await query;

      if (error) throw error;
      if (data) setProspects(data);
    } catch (error) {
      console.error('Error loading prospects:', error);
    } finally {
      setLoading(false);
    }
  }

  const filteredProspects = useMemo(() => {
    return prospects.filter(prospect => {
      if (filters.search) {
        const searchLower = filters.search.toLowerCase();
        const matchesSearch =
          prospect.full_name.toLowerCase().includes(searchLower) ||
          prospect.phone.includes(searchLower) ||
          (prospect.email?.toLowerCase().includes(searchLower) ?? false);
        if (!matchesSearch) return false;
      }

      if (filters.product && prospect.product_interest !== filters.product) {
        return false;
      }

      if (filters.origin && prospect.origin !== filters.origin) {
        return false;
      }

      if (filters.priority && prospect.priority !== filters.priority) {
        return false;
      }

      return true;
    });
  }, [prospects, filters]);

  const prospectsByStatus = useMemo(() => {
    const grouped: Record<StatusId, Prospect[]> = {
      nuevo: [],
      contactado: [],
      cotizado: [],
      cerrado: [],
      perdido: []
    };

    filteredProspects.forEach(prospect => {
      if (prospect.status in grouped) {
        grouped[prospect.status as StatusId].push(prospect);
      }
    });

    return grouped;
  }, [filteredProspects]);

  const inactiveProspects = prospects.filter(
    p => new Date(p.last_activity_at) < new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
      && p.status !== 'cerrado'
      && p.status !== 'perdido'
  );

  async function handleCreateLead() {
    if (!newLead.full_name.trim() || !newLead.phone.trim()) {
      alert('Por favor completa el nombre y teléfono');
      return;
    }

    setSaving(true);
    try {
      const { error } = await supabase
        .from('prospects')
        .insert({
          full_name: newLead.full_name.trim(),
          phone: newLead.phone.trim(),
          email: newLead.email.trim() || null,
          product_interest: newLead.product_interest,
          origin: newLead.origin,
          priority: newLead.priority,
          comments: newLead.comments.trim() || null,
          status: 'nuevo',
          executive_id: profile!.id,
          last_activity_at: new Date().toISOString()
        });

      if (error) throw error;

      setShowNewLeadModal(false);
      setNewLead({
        full_name: '',
        phone: '',
        email: '',
        product_interest: 'auto',
        origin: 'whatsapp',
        priority: 'media',
        comments: ''
      });
      loadProspects();
    } catch (error) {
      console.error('Error creating lead:', error);
      alert('Error al crear el lead');
    } finally {
      setSaving(false);
    }
  }

  function handleDragStart(event: DragStartEvent) {
    setActiveId(event.active.id as string);
  }

  async function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    setActiveId(null);

    if (!over || active.id === over.id) return;

    const prospectId = active.id as string;
    const newStatus = over.id as StatusId;

    const prospect = prospects.find(p => p.id === prospectId);
    if (!prospect) return;

    if (prospect.status === newStatus) return;

    if (!isAdmin && prospect.executive_id !== profile?.id) {
      alert('Solo puedes mover leads asignados a ti');
      return;
    }

    const oldStatus = prospect.status;

    setProspects(prevProspects =>
      prevProspects.map(p =>
        p.id === prospectId
          ? { ...p, status: newStatus, last_activity_at: new Date().toISOString() }
          : p
      )
    );

    try {
      const { error: updateError } = await supabase
        .from('prospects')
        .update({
          status: newStatus,
          last_activity_at: new Date().toISOString()
        })
        .eq('id', prospectId);

      if (updateError) throw updateError;

      const statusLabels: Record<StatusId, string> = {
        nuevo: 'Nuevo',
        contactado: 'Contactado',
        cotizado: 'Cotizado',
        cerrado: 'Cerrado',
        perdido: 'Perdido'
      };

      const { error: interactionError } = await supabase
        .from('interactions')
        .insert({
          prospect_id: prospectId,
          type: 'nota',
          content: `Cambio de estatus: ${statusLabels[oldStatus as StatusId]} → ${statusLabels[newStatus]}`
        });

      if (interactionError) {
        console.error('Error creating interaction:', interactionError);
      }
    } catch (error) {
      console.error('Error updating prospect status:', error);
      alert('No se pudo actualizar el estatus del lead');

      setProspects(prevProspects =>
        prevProspects.map(p =>
          p.id === prospectId
            ? { ...p, status: oldStatus }
            : p
        )
      );
    }
  }

  const activeProspect = activeId ? prospects.find(p => p.id === activeId) : null;

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCorners}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100%' }}>
        <div style={{ marginBottom: '24px' }}>
          <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', marginBottom: '16px', alignItems: 'center' }}>
          <Input
            type="text"
            placeholder="Buscar lead..."
            value={filters.search}
            onChange={e => setFilters({ ...filters, search: e.target.value })}
            style={{ flex: '1 1 200px' }}
          />
          <select
            value={filters.origin}
            onChange={e => setFilters({ ...filters, origin: e.target.value })}
            className="input-premium"
            style={{ flex: '0 1 140px', width: 'auto' }}
          >
            <option value="">Origen</option>
            <option value="whatsapp">WhatsApp</option>
            <option value="web">Web</option>
            <option value="referido">Referido</option>
            <option value="otro">Otro</option>
          </select>
          <select
            value={filters.priority}
            onChange={e => setFilters({ ...filters, priority: e.target.value })}
            className="input-premium"
            style={{ flex: '0 1 140px', width: 'auto' }}
          >
            <option value="">Prioridad</option>
            <option value="alta">Alta</option>
            <option value="media">Media</option>
            <option value="baja">Baja</option>
          </select>
          <Button
            onClick={() => setShowNewLeadModal(true)}
            style={{
              flex: '0 0 auto',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              background: '#65EA1E',
              color: '#202856',
              fontWeight: 600
            }}
          >
            <span style={{ fontSize: '18px' }}>+</span>
            Nuevo Lead
          </Button>
        </div>

        {inactiveProspects.length > 0 && (
          <div className="badge-warning" style={{
            padding: '12px 16px',
            display: 'block',
            width: '100%',
            textAlign: 'left',
            fontSize: '14px'
          }}>
            ⚠️ {inactiveProspects.length} lead{inactiveProspects.length > 1 ? 's' : ''} sin actividad en 7+ días
          </div>
        )}
      </div>

      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
        gap: '16px',
        width: '100%'
      }}>
        {STATUSES.map(status => (
          <KanbanColumn
            key={status.id}
            id={status.id}
            label={status.label}
            color={status.color}
            prospects={prospectsByStatus[status.id]}
            onProspectClick={setSelectedProspect}
            loading={loading}
          />
        ))}
      </div>

      {selectedProspect && (
        <ProspectDetailPanel
          prospect={selectedProspect}
          onClose={() => setSelectedProspect(null)}
          onUpdate={loadProspects}
        />
      )}

      {showNewLeadModal && (
        <div
          onClick={() => !saving && setShowNewLeadModal(false)}
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(32, 40, 86, 0.7)',
            backdropFilter: 'blur(8px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '1rem',
            zIndex: 1000,
            animation: 'fadeIn 0.2s ease'
          }}
        >
          <Card
            onClick={(e) => e?.stopPropagation()}
            style={{
              maxWidth: '600px',
              width: '100%',
              maxHeight: '90vh',
              overflow: 'auto',
              animation: 'slideUp 0.3s ease'
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
              <h2 style={{ fontSize: '1.5rem', fontWeight: 600, color: '#202856' }}>
                Crear Nuevo Lead
              </h2>
              <button
                onClick={() => setShowNewLeadModal(false)}
                disabled={saving}
                style={{
                  background: '#F7F8FC',
                  border: 'none',
                  width: '40px',
                  height: '40px',
                  borderRadius: '10px',
                  fontSize: '1.5rem',
                  cursor: 'pointer',
                  color: '#718096',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  transition: 'all 0.2s ease'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = '#E6E8EF';
                  e.currentTarget.style.color = '#202856';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = '#F7F8FC';
                  e.currentTarget.style.color = '#718096';
                }}
              >
                ×
              </button>
            </div>

            <div style={{ display: 'grid', gap: '1.25rem' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 600, color: '#202856', marginBottom: '8px' }}>
                  Nombre completo *
                </label>
                <Input
                  type="text"
                  value={newLead.full_name}
                  onChange={e => setNewLead({ ...newLead, full_name: e.target.value })}
                  placeholder="Juan Pérez"
                  disabled={saving}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 600, color: '#202856', marginBottom: '8px' }}>
                  Teléfono *
                </label>
                <Input
                  type="tel"
                  value={newLead.phone}
                  onChange={e => setNewLead({ ...newLead, phone: e.target.value })}
                  placeholder="+52 1234567890"
                  disabled={saving}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 600, color: '#202856', marginBottom: '8px' }}>
                  Email
                </label>
                <Input
                  type="email"
                  value={newLead.email}
                  onChange={e => setNewLead({ ...newLead, email: e.target.value })}
                  placeholder="correo@ejemplo.com"
                  disabled={saving}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 600, color: '#202856', marginBottom: '8px' }}>
                    Producto
                  </label>
                  <select
                    value={newLead.product_interest}
                    onChange={e => setNewLead({ ...newLead, product_interest: e.target.value })}
                    className="input-premium"
                    disabled={saving}
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
                    value={newLead.origin}
                    onChange={e => setNewLead({ ...newLead, origin: e.target.value })}
                    className="input-premium"
                    disabled={saving}
                    style={{ width: '100%' }}
                  >
                    <option value="whatsapp">WhatsApp</option>
                    <option value="web">Web</option>
                    <option value="referido">Referido</option>
                    <option value="otro">Otro</option>
                  </select>
                </div>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 600, color: '#202856', marginBottom: '8px' }}>
                  Prioridad
                </label>
                <select
                  value={newLead.priority}
                  onChange={e => setNewLead({ ...newLead, priority: e.target.value })}
                  className="input-premium"
                  disabled={saving}
                  style={{ width: '100%' }}
                >
                  <option value="alta">Alta</option>
                  <option value="media">Media</option>
                  <option value="baja">Baja</option>
                </select>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 600, color: '#202856', marginBottom: '8px' }}>
                  Notas
                </label>
                <textarea
                  value={newLead.comments}
                  onChange={e => setNewLead({ ...newLead, comments: e.target.value })}
                  placeholder="Información adicional sobre el lead..."
                  disabled={saving}
                  className="input-premium"
                  rows={3}
                  style={{ width: '100%', resize: 'vertical', fontFamily: 'inherit' }}
                />
              </div>

              <div style={{ display: 'flex', gap: '12px', marginTop: '8px' }}>
                <Button
                  onClick={() => setShowNewLeadModal(false)}
                  disabled={saving}
                  style={{
                    flex: 1,
                    background: '#F7F8FC',
                    color: '#718096',
                    border: '2px solid #E6E8EF'
                  }}
                >
                  Cancelar
                </Button>
                <Button
                  onClick={handleCreateLead}
                  disabled={saving || !newLead.full_name.trim() || !newLead.phone.trim()}
                  style={{
                    flex: 1,
                    background: '#65EA1E',
                    color: '#202856',
                    fontWeight: 600
                  }}
                >
                  {saving ? 'Creando...' : 'Crear Lead'}
                </Button>
              </div>
            </div>
          </Card>
        </div>
      )}
      </div>

      <DragOverlay>
        {activeProspect ? (
          <div style={{ opacity: 0.9, cursor: 'grabbing' }}>
            <ProspectCard prospect={activeProspect} onClick={() => {}} />
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}

interface KanbanColumnProps {
  id: string;
  label: string;
  color: string;
  prospects: Prospect[];
  onProspectClick: (prospect: Prospect) => void;
  loading: boolean;
}

function KanbanColumn({ id, label, color, prospects, onProspectClick, loading }: KanbanColumnProps) {
  const { setNodeRef, isOver } = useDroppable({ id });

  return (
    <div
      ref={setNodeRef}
      style={{
        display: 'flex',
        flexDirection: 'column',
        minHeight: '400px',
        maxHeight: '70vh',
        transition: 'all 0.2s ease',
        transform: isOver ? 'scale(1.02)' : 'scale(1)',
      }}
    >
      <div style={{
        padding: '16px',
        marginBottom: '12px',
        background: isOver ? '#F0F9FF' : 'var(--background)',
        borderRadius: '16px',
        boxShadow: isOver ? '0 4px 12px rgba(1, 126, 123, 0.2)' : '0 2px 8px rgba(32, 40, 86, 0.06)',
        borderLeft: '4px solid',
        borderColor: color,
        transition: 'all 0.2s ease'
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h3 style={{ fontSize: '15px', fontWeight: 600, color: 'var(--text-primary)', letterSpacing: '-0.01em' }}>
            {label}
          </h3>
          <span className="badge-premium badge-info">
            {prospects.length}
          </span>
        </div>
      </div>

      <div style={{
        flex: 1,
        overflowY: 'auto',
        display: 'flex',
        flexDirection: 'column',
        gap: '12px',
        paddingRight: '4px',
        background: isOver ? 'rgba(1, 126, 123, 0.03)' : 'transparent',
        borderRadius: '12px',
        padding: '8px',
        transition: 'all 0.2s ease'
      }}>
        {loading ? (
          <div className="empty-state">
            <div className="empty-state-icon">⏳</div>
            <p className="empty-state-description">Cargando...</p>
          </div>
        ) : prospects.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state-icon">📭</div>
            <p className="empty-state-description">Sin leads</p>
          </div>
        ) : (
          prospects.map(prospect => (
            <DraggableProspectCard
              key={prospect.id}
              prospect={prospect}
              onClick={() => onProspectClick(prospect)}
            />
          ))
        )}
      </div>
    </div>
  );
}

interface DraggableProspectCardProps {
  prospect: Prospect;
  onClick: () => void;
}

function DraggableProspectCard({ prospect, onClick }: DraggableProspectCardProps) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: prospect.id,
  });

  const style = {
    transform: transform ? `translate3d(${transform.x}px, ${transform.y}px, 0)` : undefined,
    opacity: isDragging ? 0.5 : 1,
    cursor: isDragging ? 'grabbing' : 'grab',
    transition: 'opacity 0.2s ease',
  };

  return (
    <div ref={setNodeRef} style={style} {...listeners} {...attributes}>
      <ProspectCard prospect={prospect} onClick={onClick} />
    </div>
  );
}
