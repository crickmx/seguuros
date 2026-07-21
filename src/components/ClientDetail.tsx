import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import type { Client } from '../types/database';
import { ProfileTab } from './ClientDetail/ProfileTab';
import { PoliciesTab } from './ClientDetail/PoliciesTab';
import { ActivityTab } from './ClientDetail/ActivityTab';
import { FollowupsTab } from './ClientDetail/FollowupsTab';
import { EmailComposer } from './Email/EmailComposer';
import { UnifiedTimeline } from './UnifiedTimeline';
import { normalizePhoneNumber } from '../utils/phoneUtils';
import { WhatsAppModal } from './WhatsApp/WhatsAppModal';

type TabId = 'perfil' | 'polizas' | 'actividad' | 'seguimientos' | 'historial';

const TABS: { id: TabId; label: string }[] = [
  { id: 'perfil', label: 'Perfil' },
  { id: 'polizas', label: 'Pólizas' },
  { id: 'historial', label: 'Historial' },
  { id: 'actividad', label: 'Notas' },
  { id: 'seguimientos', label: 'Seguimientos' }
];

export function ClientDetail() {
  const { clientId } = useParams<{ clientId: string }>();
  const navigate = useNavigate();
  const [client, setClient] = useState<Client | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<TabId>('perfil');
  const [showEmailComposer, setShowEmailComposer] = useState(false);
  const [showWhatsAppModal, setShowWhatsAppModal] = useState(false);

  useEffect(() => {
    if (clientId) {
      loadClient();
    }
  }, [clientId]);

  async function loadClient() {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('clients')
        .select('*')
        .eq('id', clientId)
        .maybeSingle();

      if (error) throw error;
      if (!data) {
        navigate('/clientes');
        return;
      }

      setClient(data);
    } catch (error) {
      console.error('Error loading client:', error);
      navigate('/clientes');
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return (
      <div style={{
        height: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: '#718096'
      }}>
        Cargando...
      </div>
    );
  }

  if (!client) {
    return null;
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', paddingTop: '56px', paddingBottom: '80px' }}>
      <div style={{
        padding: '24px 16px',
        background: 'var(--background)',
        borderBottom: '1px solid var(--border)'
      }}>
        <button
          onClick={() => navigate(-1)}
          style={{
            background: 'none',
            border: 'none',
            color: 'var(--teal)',
            fontSize: '15px',
            cursor: 'pointer',
            padding: '8px 0',
            marginBottom: '16px',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            fontWeight: 500
          }}
        >
          ← Volver
        </button>

        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '16px',
          marginBottom: '20px'
        }}>
          <div className="app-avatar" style={{
            width: '56px',
            height: '56px',
            fontSize: '20px'
          }}>
            {client.full_name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)}
          </div>
          <div style={{ flex: 1 }}>
            <h1 style={{
              fontSize: '22px',
              fontWeight: 700,
              color: 'var(--text-primary)',
              marginBottom: '4px',
              letterSpacing: '-0.02em'
            }}>
              {client.full_name}
            </h1>
            {client.phone && (
              <a
                href={`https://wa.me/${client.phone.replace(/\D/g, '')}`}
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  fontSize: '14px',
                  color: 'var(--teal)',
                  textDecoration: 'none',
                  fontWeight: 500
                }}
              >
                {client.phone}
              </a>
            )}
          </div>
          <div style={{ display: 'flex', gap: '8px' }}>
            {client.phone && (
              <button
                onClick={() => setShowWhatsAppModal(true)}
                style={{
                  background: '#65EA1E',
                  border: 'none',
                  borderRadius: '8px',
                  padding: '10px 16px',
                  fontSize: '20px',
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
            )}
            {client.email && (
              <button
                onClick={() => setShowEmailComposer(true)}
                style={{
                  background: '#65EA1E',
                  border: 'none',
                  borderRadius: '8px',
                  padding: '10px 16px',
                  fontSize: '20px',
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
          </div>
        </div>

        <div className="segmented-control">
          {TABS.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`segmented-control-item ${activeTab === tab.id ? 'active' : ''}`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      <div style={{ flex: 1, background: 'var(--surface)', padding: '16px' }}>
        {activeTab === 'perfil' && <ProfileTab client={client} onUpdate={loadClient} />}
        {activeTab === 'polizas' && <PoliciesTab client={client} />}
        {activeTab === 'historial' && <UnifiedTimeline entityType="client" entityId={client.id} />}
        {activeTab === 'actividad' && <ActivityTab client={client} />}
        {activeTab === 'seguimientos' && <FollowupsTab client={client} />}
      </div>

      {showEmailComposer && client.email && (
        <EmailComposer
          entityType="client"
          entityId={client.id}
          defaultToEmail={client.email}
          defaultSubject={`Actualización - ${client.full_name}`}
          onClose={() => setShowEmailComposer(false)}
          onSuccess={() => {
            loadClient();
          }}
        />
      )}

      {showWhatsAppModal && client.phone && (
        <WhatsAppModal
          phoneNumber={normalizePhoneNumber(client.phone).e164}
          onClose={() => setShowWhatsAppModal(false)}
        />
      )}
    </div>
  );
}
