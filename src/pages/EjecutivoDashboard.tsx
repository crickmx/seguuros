import { useState, useEffect } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { Layout } from '../components/Layout';
import { KanbanBoard } from '../components/KanbanBoard';
import { ClientsList } from '../components/ClientsList';
import { ClientDetail } from '../components/ClientDetail';
import { WhatsAppInbox } from './WhatsAppInbox';
import { Card } from '../components/ui/Card';
import { Badge } from '../components/ui/Badge';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';

export function EjecutivoDashboard() {
  return (
    <Layout>
      <Routes>
        <Route path="/" element={<Navigate to="/ejecutivo/crm" replace />} />
        <Route path="/crm" element={<KanbanBoard />} />
        <Route path="/whatsapp" element={<WhatsAppInbox />} />
        <Route path="/clientes" element={<ClientsList />} />
        <Route path="/clientes/:clientId" element={<ClientDetail />} />
        <Route path="/seguimientos" element={<SeguimientosView />} />
        <Route path="/perfil" element={<PerfilView />} />
      </Routes>
    </Layout>
  );
}

function SeguimientosView() {
  const { profile } = useAuth();
  const [followups, setFollowups] = useState<any[]>([]);

  useEffect(() => {
    loadFollowups();
  }, []);

  async function loadFollowups() {
    const { data: prospects } = await supabase
      .from('prospects')
      .select('id')
      .eq('executive_id', profile!.id);

    if (prospects && prospects.length > 0) {
      const prospectIds = prospects.map(p => p.id);
      const { data } = await supabase
        .from('followups')
        .select(`
          *,
          prospect:prospects(full_name, phone, email)
        `)
        .in('prospect_id', prospectIds)
        .order('scheduled_date', { ascending: true });

      if (data) setFollowups(data);
    }
  }

  return (
    <div>
      <h2 style={{ fontSize: '1.5rem', fontWeight: 600, color: '#202856', marginBottom: '1.5rem' }}>
        Mis Seguimientos
      </h2>
      <Card>
        {followups.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state-icon">📋</div>
            <p className="empty-state-description">No tienes seguimientos programados</p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {followups.map(followup => (
              <div
                key={followup.id}
                style={{
                  padding: '16px',
                  background: '#F7F8FC',
                  borderRadius: '10px',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  gap: '1rem',
                  flexWrap: 'wrap'
                }}
              >
                <div>
                  <h3 style={{ fontWeight: 600, color: '#202856', marginBottom: '4px' }}>
                    {followup.prospect?.full_name}
                  </h3>
                  <p style={{ fontSize: '0.875rem', color: '#718096', marginBottom: '4px' }}>
                    {followup.notes}
                  </p>
                  <p style={{ fontSize: '0.8125rem', color: '#718096' }}>
                    {new Date(followup.scheduled_date).toLocaleDateString('es-MX', {
                      day: 'numeric',
                      month: 'long',
                      year: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit'
                    })}
                  </p>
                </div>
                <Badge variant={followup.completed ? 'success' : 'warning'}>
                  {followup.completed ? 'Completado' : 'Pendiente'}
                </Badge>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}

function PerfilView() {
  const { profile } = useAuth();

  return (
    <div>
      <h2 style={{ fontSize: '1.5rem', fontWeight: 600, color: '#202856', marginBottom: '1.5rem' }}>
        Mi Perfil
      </h2>
      <Card>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div>
            <label style={{ fontSize: '0.875rem', fontWeight: 600, color: '#718096', display: 'block', marginBottom: '4px' }}>
              Nombre completo
            </label>
            <p style={{ fontSize: '1rem', color: '#202856', fontWeight: 500 }}>
              {profile?.full_name}
            </p>
          </div>
          <div>
            <label style={{ fontSize: '0.875rem', fontWeight: 600, color: '#718096', display: 'block', marginBottom: '4px' }}>
              Correo electrónico
            </label>
            <p style={{ fontSize: '1rem', color: '#202856', fontWeight: 500 }}>
              {profile?.email}
            </p>
          </div>
          <div>
            <label style={{ fontSize: '0.875rem', fontWeight: 600, color: '#718096', display: 'block', marginBottom: '4px' }}>
              Teléfono
            </label>
            <p style={{ fontSize: '1rem', color: '#202856', fontWeight: 500 }}>
              {profile?.phone || 'No registrado'}
            </p>
          </div>
          <div>
            <label style={{ fontSize: '0.875rem', fontWeight: 600, color: '#718096', display: 'block', marginBottom: '4px' }}>
              Rol
            </label>
            <Badge variant="info" style={{ display: 'inline-block', textTransform: 'capitalize' }}>
              {profile?.role}
            </Badge>
          </div>
        </div>
      </Card>
    </div>
  );
}
