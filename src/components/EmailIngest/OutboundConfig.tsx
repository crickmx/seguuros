import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { Card } from '../ui/Card';
import { Badge } from '../ui/Badge';

interface OutboundConfig {
  id: string;
  name: string;
  from_email: string;
  from_name: string;
  smtp_host: string;
  smtp_port: number;
  smtp_user: string;
  smtp_password: string;
  smtp_secure: boolean;
  is_active: boolean;
  last_test_at: string | null;
  last_test_status: 'success' | 'failed' | null;
  last_test_error: string | null;
}

export function OutboundConfig() {
  const [configs, setConfigs] = useState<OutboundConfig[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [testingId, setTestingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [form, setForm] = useState({
    name: '',
    from_email: '',
    from_name: '',
    smtp_host: '',
    smtp_port: 587,
    smtp_user: '',
    smtp_password: '',
    smtp_secure: true,
    is_active: true,
  });

  useEffect(() => {
    loadConfigs();
  }, []);

  async function loadConfigs() {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('email_outbound_config')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setConfigs(data || []);
    } catch (err) {
      console.error('Error loading configs:', err);
      setError('Error al cargar configuraciones');
    } finally {
      setLoading(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    try {
      if (editingId) {
        const { error } = await supabase
          .from('email_outbound_config')
          .update(form)
          .eq('id', editingId);

        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('email_outbound_config')
          .insert([form]);

        if (error) throw error;
      }

      resetForm();
      loadConfigs();
    } catch (err) {
      console.error('Error saving config:', err);
      setError('Error al guardar configuración');
    }
  }

  async function handleTest(configId: string) {
    setTestingId(configId);
    setError(null);

    try {
      const { data: sessionData } = await supabase.auth.getSession();
      if (!sessionData.session) {
        throw new Error('No hay sesión activa');
      }

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/test-email-outbound`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${sessionData.session.access_token}`,
            'Content-Type': 'application/json',
            'apikey': import.meta.env.VITE_SUPABASE_ANON_KEY,
          },
          body: JSON.stringify({ config_id: configId }),
        }
      );

      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.error || 'Error al probar conexión');
      }

      loadConfigs();
      alert('Conexión exitosa. Se envió un correo de prueba.');
    } catch (err) {
      console.error('Error testing config:', err);
      setError(err instanceof Error ? err.message : 'Error al probar conexión');
    } finally {
      setTestingId(null);
    }
  }

  async function handleDelete(configId: string) {
    if (!confirm('¿Estás seguro de eliminar esta configuración?')) return;

    try {
      const { error } = await supabase
        .from('email_outbound_config')
        .delete()
        .eq('id', configId);

      if (error) throw error;
      loadConfigs();
    } catch (err) {
      console.error('Error deleting config:', err);
      setError('Error al eliminar configuración');
    }
  }

  async function handleToggleActive(configId: string, currentState: boolean) {
    try {
      const { error } = await supabase
        .from('email_outbound_config')
        .update({ is_active: !currentState })
        .eq('id', configId);

      if (error) throw error;
      loadConfigs();
    } catch (err) {
      console.error('Error toggling active state:', err);
      setError('Error al cambiar estado');
    }
  }

  function handleEdit(config: OutboundConfig) {
    setForm({
      name: config.name,
      from_email: config.from_email,
      from_name: config.from_name,
      smtp_host: config.smtp_host,
      smtp_port: config.smtp_port,
      smtp_user: config.smtp_user,
      smtp_password: config.smtp_password,
      smtp_secure: config.smtp_secure,
      is_active: config.is_active,
    });
    setEditingId(config.id);
    setShowForm(true);
  }

  function resetForm() {
    setForm({
      name: '',
      from_email: '',
      from_name: '',
      smtp_host: '',
      smtp_port: 587,
      smtp_user: '',
      smtp_password: '',
      smtp_secure: true,
      is_active: true,
    });
    setEditingId(null);
    setShowForm(false);
  }

  const formatDate = (dateString: string | null) => {
    if (!dateString) return 'Nunca';
    return new Date(dateString).toLocaleString('es-MX', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <div style={{ maxWidth: '900px' }}>
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: '1.5rem',
      }}>
        <div>
          <h3 style={{
            fontSize: '1.25rem',
            fontWeight: 600,
            color: '#202856',
            marginBottom: '0.25rem',
          }}>
            Configuración de Email Saliente
          </h3>
          <p style={{ fontSize: '0.875rem', color: '#718096', margin: 0 }}>
            Configura la cuenta SMTP para enviar correos desde la plataforma
          </p>
        </div>
        {!showForm && (
          <Button onClick={() => setShowForm(true)}>
            + Nueva configuración
          </Button>
        )}
      </div>

      {error && (
        <div style={{
          padding: '0.75rem 1rem',
          background: '#FEE2E2',
          color: '#991B1B',
          borderRadius: '8px',
          fontSize: '0.875rem',
          marginBottom: '1rem',
        }}>
          {error}
        </div>
      )}

      {showForm && (
        <Card style={{ marginBottom: '1.5rem', padding: '1.5rem' }}>
          <h4 style={{
            fontSize: '1.125rem',
            fontWeight: 600,
            color: '#202856',
            marginBottom: '1.5rem',
          }}>
            {editingId ? 'Editar' : 'Nueva'} Configuración
          </h4>

          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '1rem' }}>
              <div>
                <label style={{
                  display: 'block',
                  fontSize: '0.875rem',
                  fontWeight: 500,
                  color: '#202856',
                  marginBottom: '0.5rem',
                }}>
                  Nombre de configuración <span style={{ color: '#EF4444' }}>*</span>
                </label>
                <Input
                  type="text"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="Ej: Email Principal"
                  required
                />
              </div>

              <div>
                <label style={{
                  display: 'block',
                  fontSize: '0.875rem',
                  fontWeight: 500,
                  color: '#202856',
                  marginBottom: '0.5rem',
                }}>
                  Correo remitente <span style={{ color: '#EF4444' }}>*</span>
                </label>
                <Input
                  type="email"
                  value={form.from_email}
                  onChange={(e) => setForm({ ...form, from_email: e.target.value })}
                  placeholder="ventas@seguuros.com"
                  required
                />
              </div>
            </div>

            <div>
              <label style={{
                display: 'block',
                fontSize: '0.875rem',
                fontWeight: 500,
                color: '#202856',
                marginBottom: '0.5rem',
              }}>
                Nombre del remitente <span style={{ color: '#EF4444' }}>*</span>
              </label>
              <Input
                type="text"
                value={form.from_name}
                onChange={(e) => setForm({ ...form, from_name: e.target.value })}
                placeholder="Seguuros Ventas"
                required
              />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '1rem' }}>
              <div>
                <label style={{
                  display: 'block',
                  fontSize: '0.875rem',
                  fontWeight: 500,
                  color: '#202856',
                  marginBottom: '0.5rem',
                }}>
                  Servidor SMTP <span style={{ color: '#EF4444' }}>*</span>
                </label>
                <Input
                  type="text"
                  value={form.smtp_host}
                  onChange={(e) => setForm({ ...form, smtp_host: e.target.value })}
                  placeholder="smtp.gmail.com"
                  required
                />
              </div>

              <div>
                <label style={{
                  display: 'block',
                  fontSize: '0.875rem',
                  fontWeight: 500,
                  color: '#202856',
                  marginBottom: '0.5rem',
                }}>
                  Puerto <span style={{ color: '#EF4444' }}>*</span>
                </label>
                <Input
                  type="number"
                  value={form.smtp_port}
                  onChange={(e) => setForm({ ...form, smtp_port: parseInt(e.target.value) })}
                  min="1"
                  max="65535"
                  required
                />
              </div>
            </div>

            <div>
              <label style={{
                display: 'block',
                fontSize: '0.875rem',
                fontWeight: 500,
                color: '#202856',
                marginBottom: '0.5rem',
              }}>
                Usuario SMTP <span style={{ color: '#EF4444' }}>*</span>
              </label>
              <Input
                type="text"
                value={form.smtp_user}
                onChange={(e) => setForm({ ...form, smtp_user: e.target.value })}
                placeholder="usuario@ejemplo.com"
                required
              />
            </div>

            <div>
              <label style={{
                display: 'block',
                fontSize: '0.875rem',
                fontWeight: 500,
                color: '#202856',
                marginBottom: '0.5rem',
              }}>
                Contraseña SMTP <span style={{ color: '#EF4444' }}>*</span>
              </label>
              <Input
                type="password"
                value={form.smtp_password}
                onChange={(e) => setForm({ ...form, smtp_password: e.target.value })}
                placeholder="••••••••"
                required
              />
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <input
                type="checkbox"
                id="smtp_secure"
                checked={form.smtp_secure}
                onChange={(e) => setForm({ ...form, smtp_secure: e.target.checked })}
                style={{ width: '18px', height: '18px', cursor: 'pointer' }}
              />
              <label htmlFor="smtp_secure" style={{
                fontSize: '0.875rem',
                color: '#202856',
                cursor: 'pointer',
              }}>
                Usar conexión segura (TLS/SSL)
              </label>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <input
                type="checkbox"
                id="is_active"
                checked={form.is_active}
                onChange={(e) => setForm({ ...form, is_active: e.target.checked })}
                style={{ width: '18px', height: '18px', cursor: 'pointer' }}
              />
              <label htmlFor="is_active" style={{
                fontSize: '0.875rem',
                color: '#202856',
                cursor: 'pointer',
              }}>
                Activar esta configuración
              </label>
            </div>

            <div style={{ display: 'flex', gap: '0.75rem', marginTop: '0.5rem' }}>
              <Button type="submit">
                {editingId ? 'Actualizar' : 'Guardar'} configuración
              </Button>
              <Button type="button" variant="ghost" onClick={resetForm}>
                Cancelar
              </Button>
            </div>
          </form>
        </Card>
      )}

      {loading ? (
        <div style={{ textAlign: 'center', padding: '3rem', color: '#718096' }}>
          Cargando configuraciones...
        </div>
      ) : configs.length === 0 ? (
        <Card>
          <div style={{ textAlign: 'center', padding: '3rem' }}>
            <p style={{ color: '#718096', marginBottom: '1rem', fontSize: '0.875rem' }}>
              No hay configuraciones de email saliente
            </p>
            <Button onClick={() => setShowForm(true)}>
              + Agregar primera configuración
            </Button>
          </div>
        </Card>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {configs.map((config) => (
            <Card key={config.id} style={{ padding: '1.5rem' }}>
              <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'flex-start',
                marginBottom: '1rem',
              }}>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
                    <h4 style={{ fontSize: '1.125rem', fontWeight: 600, color: '#202856', margin: 0 }}>
                      {config.name}
                    </h4>
                    <Badge variant={config.is_active ? 'success' : 'default'}>
                      {config.is_active ? 'Activa' : 'Inactiva'}
                    </Badge>
                  </div>
                  <p style={{ fontSize: '0.875rem', color: '#718096', margin: 0 }}>
                    {config.from_name} &lt;{config.from_email}&gt;
                  </p>
                </div>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <Button
                    variant="ghost"
                    onClick={() => handleTest(config.id)}
                    disabled={testingId === config.id}
                    style={{ fontSize: '0.875rem' }}
                  >
                    {testingId === config.id ? 'Probando...' : '🧪 Probar'}
                  </Button>
                  <Button
                    variant="ghost"
                    onClick={() => handleEdit(config)}
                    style={{ fontSize: '0.875rem' }}
                  >
                    ✏️ Editar
                  </Button>
                  <Button
                    variant="ghost"
                    onClick={() => handleDelete(config.id)}
                    style={{ fontSize: '0.875rem', color: '#EF4444' }}
                  >
                    🗑️ Eliminar
                  </Button>
                </div>
              </div>

              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(2, 1fr)',
                gap: '1rem',
                padding: '1rem',
                background: '#F9FAFB',
                borderRadius: '8px',
              }}>
                <div>
                  <p style={{ fontSize: '0.75rem', color: '#718096', marginBottom: '0.25rem' }}>
                    Servidor SMTP
                  </p>
                  <p style={{ fontSize: '0.875rem', color: '#202856', fontWeight: 500, margin: 0 }}>
                    {config.smtp_host}:{config.smtp_port}
                  </p>
                </div>
                <div>
                  <p style={{ fontSize: '0.75rem', color: '#718096', marginBottom: '0.25rem' }}>
                    Usuario
                  </p>
                  <p style={{ fontSize: '0.875rem', color: '#202856', fontWeight: 500, margin: 0 }}>
                    {config.smtp_user}
                  </p>
                </div>
                <div>
                  <p style={{ fontSize: '0.75rem', color: '#718096', marginBottom: '0.25rem' }}>
                    Última prueba
                  </p>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <p style={{ fontSize: '0.875rem', color: '#202856', margin: 0 }}>
                      {formatDate(config.last_test_at)}
                    </p>
                    {config.last_test_status && (
                      <Badge variant={config.last_test_status === 'success' ? 'success' : 'error'}>
                        {config.last_test_status === 'success' ? '✓' : '✗'}
                      </Badge>
                    )}
                  </div>
                  {config.last_test_error && (
                    <p style={{ fontSize: '0.75rem', color: '#EF4444', margin: '0.25rem 0 0 0' }}>
                      {config.last_test_error}
                    </p>
                  )}
                </div>
                <div>
                  <p style={{ fontSize: '0.75rem', color: '#718096', marginBottom: '0.25rem' }}>
                    Seguridad
                  </p>
                  <p style={{ fontSize: '0.875rem', color: '#202856', fontWeight: 500, margin: 0 }}>
                    {config.smtp_secure ? 'TLS/SSL' : 'Sin cifrado'}
                  </p>
                </div>
              </div>

              <div style={{ marginTop: '1rem', paddingTop: '1rem', borderTop: '1px solid #E6E8EF' }}>
                <Button
                  variant="ghost"
                  onClick={() => handleToggleActive(config.id, config.is_active)}
                  style={{ fontSize: '0.875rem' }}
                >
                  {config.is_active ? '⏸️ Desactivar' : '▶️ Activar'}
                </Button>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}