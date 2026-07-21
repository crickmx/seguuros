import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { Input } from '../ui/Input';
import { Button } from '../ui/Button';
import { Card } from '../ui/Card';

interface EmailAccount {
  id: string;
  name: string;
  imap_host: string;
  imap_port: number;
  imap_user: string;
  imap_password: string;
  imap_tls: boolean;
  imap_mailbox: string;
  is_active: boolean;
  last_sync_at: string | null;
}

export function AccountConfig() {
  const [accounts, setAccounts] = useState<EmailAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [testing, setTesting] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [autoSyncEnabled, setAutoSyncEnabled] = useState(() => {
    const saved = localStorage.getItem('emailAutoSyncEnabled');
    return saved ? JSON.parse(saved) : false;
  });
  const [syncInterval, setSyncInterval] = useState(() => {
    const saved = localStorage.getItem('emailSyncInterval');
    return saved ? parseInt(saved) : 5;
  });
  const [nextSyncIn, setNextSyncIn] = useState<number | null>(null);
  const [lastSyncResult, setLastSyncResult] = useState<{ success: boolean; stats?: any; time?: string } | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    imap_host: '',
    imap_port: 993,
    imap_user: '',
    imap_password: '',
    imap_tls: true,
    imap_mailbox: 'INBOX',
    is_active: true
  });

  useEffect(() => {
    loadAccounts();
  }, []);

  useEffect(() => {
    if (!autoSyncEnabled || accounts.length === 0) {
      setNextSyncIn(null);
      return;
    }

    let countdown = syncInterval * 60;
    setNextSyncIn(countdown);

    const countdownInterval = setInterval(() => {
      countdown--;
      setNextSyncIn(countdown);

      if (countdown <= 0) {
        handleAutoSync();
        countdown = syncInterval * 60;
      }
    }, 1000);

    return () => clearInterval(countdownInterval);
  }, [autoSyncEnabled, syncInterval, accounts.length]);

  async function handleAutoSync() {
    if (syncing) return;

    try {
      setSyncing(true);
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        console.warn('No active session for auto-sync');
        return;
      }

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/email-sync-leads`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${session.access_token}`,
            'Content-Type': 'application/json',
          }
        }
      );

      if (!response.ok) {
        console.error('Auto sync failed:', response.status, await response.text());
        setLastSyncResult({
          success: false,
          time: new Date().toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' })
        });
        setTimeout(() => setLastSyncResult(null), 10000);
        return;
      }

      const result = await response.json();

      setLastSyncResult({
        success: result.success,
        stats: result.stats,
        time: new Date().toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' })
      });

      setTimeout(() => setLastSyncResult(null), 10000);

      loadAccounts();
    } catch (error) {
      console.error('Auto sync error:', error);
      setLastSyncResult({
        success: false,
        time: new Date().toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' })
      });
      setTimeout(() => setLastSyncResult(null), 10000);
    } finally {
      setSyncing(false);
    }
  }

  function toggleAutoSync(enabled: boolean) {
    setAutoSyncEnabled(enabled);
    localStorage.setItem('emailAutoSyncEnabled', JSON.stringify(enabled));
  }

  function updateSyncInterval(minutes: number) {
    setSyncInterval(minutes);
    localStorage.setItem('emailSyncInterval', minutes.toString());
  }

  function formatTime(seconds: number): string {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  }

  async function loadAccounts() {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('email_ingest_accounts')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      if (data) setAccounts(data);
    } catch (error) {
      console.error('Error loading accounts:', error);
      alert('Error al cargar cuentas de correo');
    } finally {
      setLoading(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    try {
      const { error } = await supabase
        .from('email_ingest_accounts')
        .insert([formData]);

      if (error) throw error;

      alert('Cuenta configurada correctamente');
      setShowForm(false);
      setFormData({
        name: '',
        imap_host: '',
        imap_port: 993,
        imap_user: '',
        imap_password: '',
        imap_tls: true,
        imap_mailbox: 'INBOX',
        is_active: true
      });
      loadAccounts();
    } catch (error) {
      console.error('Error saving account:', error);
      alert('Error al guardar la cuenta');
    }
  }

  async function handleTestConnection() {
    if (!formData.imap_host || !formData.imap_user || !formData.imap_password) {
      alert('Por favor completa los campos requeridos');
      return;
    }

    try {
      setTesting(true);

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/email-test-connection`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            host: formData.imap_host,
            port: formData.imap_port,
            user: formData.imap_user,
            password: formData.imap_password,
            tls: formData.imap_tls
          })
        }
      );

      const result = await response.json();

      if (result.success) {
        alert('Conexión exitosa');
      } else {
        alert(`Error: ${result.error}`);
      }
    } catch (error) {
      console.error('Error testing connection:', error);
      alert('Error al probar la conexión');
    } finally {
      setTesting(false);
    }
  }

  async function handleSyncNow() {
    try {
      setSyncing(true);

      const { data: { session }, error: sessionError } = await supabase.auth.refreshSession();
      if (sessionError || !session) {
        console.error('Error refreshing session:', sessionError);
        throw new Error('No hay sesión activa. Por favor inicia sesión nuevamente.');
      }

      console.log('Using access token:', session.access_token.substring(0, 20) + '...');

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/email-sync-leads`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${session.access_token}`,
            'Content-Type': 'application/json',
          }
        }
      );

      if (!response.ok) {
        const errorText = await response.text();
        console.error('Error response:', response.status, errorText);

        if (response.status === 401) {
          throw new Error('Sesión expirada. Por favor recarga la página e inicia sesión nuevamente.');
        }

        throw new Error(`Error del servidor: ${response.status} - ${errorText}`);
      }

      const result = await response.json();

      if (result.success) {
        alert(
          `Sincronización completada:\n` +
          `- Leídos: ${result.stats.read}\n` +
          `- Creados: ${result.stats.created}\n` +
          `- Duplicados: ${result.stats.duplicates}\n` +
          `- Errores: ${result.stats.errors}`
        );
        loadAccounts();
      } else {
        alert(`Error: ${result.error}`);
      }
    } catch (error) {
      console.error('Error syncing:', error);
      const message = error instanceof Error ? error.message : 'Error desconocido';
      alert(`Error al sincronizar correos: ${message}`);
    } finally {
      setSyncing(false);
    }
  }

  async function handleToggleActive(accountId: string, currentStatus: boolean) {
    try {
      const { error } = await supabase
        .from('email_ingest_accounts')
        .update({ is_active: !currentStatus })
        .eq('id', accountId);

      if (error) throw error;
      loadAccounts();
    } catch (error) {
      console.error('Error toggling account:', error);
      alert('Error al actualizar el estado de la cuenta');
    }
  }

  async function handleDelete(accountId: string) {
    if (!confirm('¿Estás seguro de eliminar esta cuenta? Se perderá el historial asociado.')) {
      return;
    }

    try {
      const { error } = await supabase
        .from('email_ingest_accounts')
        .delete()
        .eq('id', accountId);

      if (error) throw error;
      loadAccounts();
    } catch (error) {
      console.error('Error deleting account:', error);
      alert('Error al eliminar la cuenta');
    }
  }

  if (loading) {
    return (
      <Card>
        <div style={{ padding: '2rem', textAlign: 'center', color: '#718096' }}>
          Cargando configuración...
        </div>
      </Card>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h2 style={{ fontSize: '1.5rem', fontWeight: 600, color: '#202856', marginBottom: '0.5rem' }}>
            Leads por Correo
          </h2>
          <p style={{ fontSize: '0.875rem', color: '#718096' }}>
            Configura cuentas de correo para recibir leads automáticamente
          </p>
        </div>
        <Button onClick={() => setShowForm(!showForm)}>
          {showForm ? 'Cancelar' : '+ Nueva Cuenta'}
        </Button>
      </div>

      {accounts.length > 0 && (
        <Card>
          <div style={{ padding: '1.5rem' }}>
            <h3 style={{ fontSize: '1.125rem', fontWeight: 600, color: '#202856', marginBottom: '1.5rem' }}>
              Sincronización Automática
            </h3>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ flex: 1 }}>
                  <label style={{ fontSize: '0.875rem', fontWeight: 500, color: '#202856', display: 'block', marginBottom: '4px' }}>
                    Estado
                  </label>
                  <p style={{ fontSize: '0.75rem', color: '#718096' }}>
                    {autoSyncEnabled
                      ? 'La sincronización automática está activa'
                      : 'Activa la sincronización automática para buscar correos nuevos periódicamente'}
                  </p>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                  <span style={{ fontSize: '0.875rem', color: '#202856', fontWeight: 500 }}>
                    {autoSyncEnabled ? 'Activada' : 'Desactivada'}
                  </span>
                  <div
                    onClick={() => toggleAutoSync(!autoSyncEnabled)}
                    style={{
                      width: '52px',
                      height: '28px',
                      borderRadius: '14px',
                      background: autoSyncEnabled ? '#65EA1E' : '#E6E8EF',
                      position: 'relative',
                      transition: 'background 0.2s',
                      cursor: 'pointer'
                    }}
                  >
                    <div style={{
                      width: '24px',
                      height: '24px',
                      borderRadius: '50%',
                      background: '#FFFFFF',
                      position: 'absolute',
                      top: '2px',
                      left: autoSyncEnabled ? '26px' : '2px',
                      transition: 'left 0.2s',
                      boxShadow: '0 2px 4px rgba(0,0,0,0.2)'
                    }} />
                  </div>
                </div>
              </div>

              {autoSyncEnabled && (
                <>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 500, color: '#202856', marginBottom: '8px' }}>
                      Intervalo de sincronización
                    </label>
                    <select
                      value={syncInterval}
                      onChange={(e) => updateSyncInterval(parseInt(e.target.value))}
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
                      <option value={1}>Cada 1 minuto</option>
                      <option value={2}>Cada 2 minutos</option>
                      <option value={5}>Cada 5 minutos</option>
                      <option value={10}>Cada 10 minutos</option>
                      <option value={15}>Cada 15 minutos</option>
                      <option value={30}>Cada 30 minutos</option>
                      <option value={60}>Cada 1 hora</option>
                    </select>
                  </div>

                  {nextSyncIn !== null && (
                    <div style={{
                      padding: '1rem',
                      borderRadius: '0.75rem',
                      background: '#F7F8FC',
                      border: '1px solid #E6E8EF',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.75rem'
                    }}>
                      <div style={{
                        width: '40px',
                        height: '40px',
                        borderRadius: '50%',
                        background: syncing ? '#65EA1E' : '#202856',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: '1.25rem',
                        animation: syncing ? 'spin 1s linear infinite' : 'none'
                      }}>
                        {syncing ? '🔄' : '⏱️'}
                      </div>
                      <div style={{ flex: 1 }}>
                        <p style={{ fontSize: '0.875rem', fontWeight: 600, color: '#202856', marginBottom: '2px' }}>
                          {syncing ? 'Sincronizando...' : `Próxima sincronización en ${formatTime(nextSyncIn)}`}
                        </p>
                        <p style={{ fontSize: '0.75rem', color: '#718096' }}>
                          {syncing ? 'Buscando nuevos correos' : 'Se buscarán correos automáticamente'}
                        </p>
                      </div>
                    </div>
                  )}

                  {lastSyncResult && (
                    <div style={{
                      padding: '1rem',
                      borderRadius: '0.75rem',
                      background: lastSyncResult.success ? '#D1FAE5' : '#FEE2E2',
                      border: `1px solid ${lastSyncResult.success ? '#65EA1E' : '#EF4444'}`,
                      animation: 'slideIn 0.3s ease-out'
                    }}>
                      <p style={{ fontSize: '0.875rem', fontWeight: 600, color: lastSyncResult.success ? '#065F46' : '#991B1B', marginBottom: '4px' }}>
                        {lastSyncResult.success ? '✓ Sincronización completada' : '✗ Error en sincronización'}
                      </p>
                      {lastSyncResult.success && lastSyncResult.stats && (
                        <p style={{ fontSize: '0.75rem', color: '#065F46' }}>
                          {lastSyncResult.stats.created > 0 && `${lastSyncResult.stats.created} nuevo${lastSyncResult.stats.created === 1 ? '' : 's'} • `}
                          {lastSyncResult.stats.duplicates > 0 && `${lastSyncResult.stats.duplicates} duplicado${lastSyncResult.stats.duplicates === 1 ? '' : 's'} • `}
                          {lastSyncResult.time}
                        </p>
                      )}
                      {!lastSyncResult.success && (
                        <p style={{ fontSize: '0.75rem', color: '#991B1B' }}>
                          Ocurrió un error al sincronizar • {lastSyncResult.time}
                        </p>
                      )}
                    </div>
                  )}
                </>
              )}
            </div>
          </div>

          <style>{`
            @keyframes spin {
              from { transform: rotate(0deg); }
              to { transform: rotate(360deg); }
            }
            @keyframes slideIn {
              from {
                opacity: 0;
                transform: translateY(-10px);
              }
              to {
                opacity: 1;
                transform: translateY(0);
              }
            }
          `}</style>
        </Card>
      )}

      {showForm && (
        <Card>
          <h3 style={{ fontSize: '1.125rem', fontWeight: 600, color: '#202856', marginBottom: '1.5rem' }}>
            Configurar Cuenta IMAP
          </h3>

          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 500, color: '#202856', marginBottom: '0.5rem' }}>
                Nombre de la cuenta *
              </label>
              <Input
                type="text"
                value={formData.name}
                onChange={e => setFormData({ ...formData, name: e.target.value })}
                placeholder="Ej: Leads Marketing"
                required
              />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 150px', gap: '1rem' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 500, color: '#202856', marginBottom: '0.5rem' }}>
                  Host IMAP *
                </label>
                <Input
                  type="text"
                  value={formData.imap_host}
                  onChange={e => setFormData({ ...formData, imap_host: e.target.value })}
                  placeholder="imap.gmail.com"
                  required
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 500, color: '#202856', marginBottom: '0.5rem' }}>
                  Puerto *
                </label>
                <Input
                  type="number"
                  value={formData.imap_port}
                  onChange={e => setFormData({ ...formData, imap_port: parseInt(e.target.value) })}
                  required
                />
              </div>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 500, color: '#202856', marginBottom: '0.5rem' }}>
                Usuario *
              </label>
              <Input
                type="text"
                value={formData.imap_user}
                onChange={e => setFormData({ ...formData, imap_user: e.target.value })}
                placeholder="usuario@dominio.com"
                required
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 500, color: '#202856', marginBottom: '0.5rem' }}>
                Contraseña *
              </label>
              <Input
                type="password"
                value={formData.imap_password}
                onChange={e => setFormData({ ...formData, imap_password: e.target.value })}
                required
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 500, color: '#202856', marginBottom: '0.5rem' }}>
                Buzón
              </label>
              <Input
                type="text"
                value={formData.imap_mailbox}
                onChange={e => setFormData({ ...formData, imap_mailbox: e.target.value })}
              />
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <input
                type="checkbox"
                id="imap_tls"
                checked={formData.imap_tls}
                onChange={e => setFormData({ ...formData, imap_tls: e.target.checked })}
                style={{ width: '18px', height: '18px' }}
              />
              <label htmlFor="imap_tls" style={{ fontSize: '0.875rem', color: '#202856' }}>
                Usar SSL/TLS
              </label>
            </div>

            <div style={{ display: 'flex', gap: '1rem', marginTop: '0.5rem' }}>
              <Button type="button" onClick={handleTestConnection} disabled={testing} variant="secondary">
                {testing ? 'Probando...' : 'Probar Conexión'}
              </Button>
              <Button type="submit">
                Guardar Cuenta
              </Button>
            </div>
          </form>
        </Card>
      )}

      {accounts.length === 0 ? (
        <Card>
          <div style={{ padding: '2rem', textAlign: 'center' }}>
            <p style={{ color: '#718096', marginBottom: '1rem' }}>
              No hay cuentas configuradas
            </p>
            <Button onClick={() => setShowForm(true)}>
              Configurar primera cuenta
            </Button>
          </div>
        </Card>
      ) : (
        <>
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '-1rem' }}>
            <Button onClick={handleSyncNow} disabled={syncing}>
              {syncing ? 'Sincronizando...' : '🔄 Sincronizar Ahora'}
            </Button>
          </div>

          <div style={{ display: 'grid', gap: '1rem' }}>
            {accounts.map(account => (
              <Card key={account.id}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.5rem' }}>
                      <h3 style={{ fontSize: '1.125rem', fontWeight: 600, color: '#202856' }}>
                        {account.name}
                      </h3>
                      <span style={{
                        padding: '4px 10px',
                        borderRadius: '12px',
                        fontSize: '0.75rem',
                        fontWeight: 600,
                        background: account.is_active ? '#D1FAE5' : '#FEE2E2',
                        color: account.is_active ? '#065F46' : '#991B1B'
                      }}>
                        {account.is_active ? 'Activa' : 'Inactiva'}
                      </span>
                    </div>

                    <div style={{ display: 'grid', gap: '0.5rem', fontSize: '0.875rem', color: '#718096' }}>
                      <div><strong>Host:</strong> {account.imap_host}:{account.imap_port}</div>
                      <div><strong>Usuario:</strong> {account.imap_user}</div>
                      <div><strong>Buzón:</strong> {account.imap_mailbox}</div>
                      {account.last_sync_at && (
                        <div><strong>Última sincronización:</strong> {new Date(account.last_sync_at).toLocaleString('es-MX')}</div>
                      )}
                    </div>
                  </div>

                  <div style={{ display: 'flex', gap: '0.5rem' }}>
                    <Button
                      onClick={() => handleToggleActive(account.id, account.is_active)}
                      variant="secondary"
                      style={{ padding: '0.5rem 1rem' }}
                    >
                      {account.is_active ? 'Desactivar' : 'Activar'}
                    </Button>
                    <Button
                      onClick={() => handleDelete(account.id)}
                      style={{ padding: '0.5rem 1rem', background: '#EF4444' }}
                    >
                      Eliminar
                    </Button>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
