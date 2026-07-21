import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import type { Client } from '../types/database';
import { Input } from './ui/Input';
import { Button } from './ui/Button';
import { Card } from './ui/Card';

export function ClientsList() {
  const navigate = useNavigate();
  const { profile } = useAuth();
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  const isAdmin = profile?.role === 'admin';

  useEffect(() => {
    loadClients();

    const channel = supabase
      .channel('clients_changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'clients'
        },
        () => {
          loadClients();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  async function loadClients() {
    try {
      setLoading(true);
      const query = supabase
        .from('clients')
        .select('*')
        .order('updated_at', { ascending: false });

      if (!isAdmin) {
        query.eq('assigned_to', profile!.id);
      }

      const { data, error } = await query;

      if (error) throw error;
      if (data) setClients(data);
    } catch (error) {
      console.error('Error loading clients:', error);
    } finally {
      setLoading(false);
    }
  }

  const filteredClients = clients.filter(client => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return (
      client.full_name.toLowerCase().includes(query) ||
      client.phone.includes(query) ||
      client.email?.toLowerCase().includes(query)
    );
  });

  return (
    <div style={{ height: '100vh', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      <div style={{
        padding: '1.5rem',
        background: '#FFFFFF',
        borderBottom: '1px solid #E6E8EF',
        display: 'flex',
        flexDirection: 'column',
        gap: '1rem'
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
          <h1 style={{ fontSize: '1.5rem', fontWeight: 600, color: '#202856', margin: 0 }}>
            Clientes
          </h1>
          <Button onClick={() => navigate('/clientes/nuevo')}>
            + Agregar Cliente
          </Button>
        </div>
        <Input
          type="text"
          placeholder="Buscar por nombre, teléfono o email..."
          value={searchQuery}
          onChange={e => setSearchQuery(e.target.value)}
          style={{ maxWidth: '500px' }}
        />
      </div>

      <div style={{ flex: 1, overflow: 'auto', padding: '1.5rem', background: '#F7F8FC' }}>
        {loading ? (
          <div style={{ textAlign: 'center', padding: '3rem', color: '#718096' }}>
            Cargando clientes...
          </div>
        ) : filteredClients.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '3rem' }}>
            <p style={{ color: '#718096', marginBottom: '1rem' }}>
              {searchQuery ? 'No se encontraron clientes' : 'Aún no tienes clientes'}
            </p>
            {!searchQuery && (
              <Button onClick={() => navigate('/clientes/nuevo')}>
                + Agregar tu primer cliente
              </Button>
            )}
          </div>
        ) : (
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(350px, 1fr))',
            gap: '1rem'
          }}>
            {filteredClients.map(client => (
              <ClientCard
                key={client.id}
                client={client}
                onClick={() => navigate(`/clientes/${client.id}`)}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

interface ClientCardProps {
  client: Client;
  onClick: () => void;
}

function ClientCard({ client, onClick }: ClientCardProps) {
  const [policyCount, setPolicyCount] = useState<number>(0);

  useEffect(() => {
    loadPolicyCount();
  }, [client.id]);

  async function loadPolicyCount() {
    const { count } = await supabase
      .from('policies')
      .select('*', { count: 'exact', head: true })
      .eq('client_id', client.id);

    if (count !== null) setPolicyCount(count);
  }

  return (
    <Card
      onClick={onClick}
      style={{
        cursor: 'pointer',
        transition: 'all 0.2s'
      }}
    >
      <div style={{ marginBottom: '1rem' }}>
        <h3 style={{ fontSize: '1.125rem', fontWeight: 600, color: '#202856', marginBottom: '0.5rem' }}>
          {client.full_name}
        </h3>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem', fontSize: '0.875rem', color: '#718096' }}>
          <div>📱 {client.phone}</div>
          {client.email && <div>✉️ {client.email}</div>}
        </div>
      </div>

      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingTop: '1rem',
        borderTop: '1px solid #E6E8EF'
      }}>
        <span style={{ fontSize: '0.875rem', color: '#718096' }}>
          {policyCount} {policyCount === 1 ? 'póliza' : 'pólizas'}
        </span>
        <span style={{ fontSize: '0.75rem', color: '#A0AEC0' }}>
          {new Date(client.updated_at).toLocaleDateString('es-MX')}
        </span>
      </div>
    </Card>
  );
}
