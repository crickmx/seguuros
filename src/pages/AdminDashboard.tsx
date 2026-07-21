import { useState, useEffect } from 'react';
import { Routes, Route, Navigate, useNavigate } from 'react-router-dom';
import { Layout } from '../components/Layout';
import { KanbanBoard } from '../components/KanbanBoard';
import { ClientDetail } from '../components/ClientDetail';
import { WhatsAppInbox } from './WhatsAppInbox';
import { WebhookConfig } from '../components/WebhookConfig';
import { AccountConfig } from '../components/EmailIngest/AccountConfig';
import { MessagesHistory } from '../components/EmailIngest/MessagesHistory';
import { OutboundConfig } from '../components/EmailIngest/OutboundConfig';
import { supabase } from '../lib/supabase';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { Badge } from '../components/ui/Badge';
import { Input } from '../components/ui/Input';
import type { Profile, Prospect, Policy, Client } from '../types/database';

export function AdminDashboard() {
  return (
    <Layout>
      <Routes>
        <Route path="/" element={<Navigate to="/admin/dashboard" replace />} />
        <Route path="/dashboard" element={<DashboardView />} />
        <Route path="/users" element={<UsersView />} />
        <Route path="/prospectos" element={<KanbanBoard />} />
        <Route path="/whatsapp" element={<WhatsAppInbox />} />
        <Route path="/clientes" element={<ClientesView />} />
        <Route path="/clientes/:clientId" element={<ClientDetail />} />
        <Route path="/seguimientos" element={<SeguimientosView />} />
        <Route path="/leads-email" element={<EmailLeadsView />} />
        <Route path="/settings" element={<SettingsView />} />
      </Routes>
    </Layout>
  );
}

function DashboardView() {
  const [users, setUsers] = useState<Profile[]>([]);
  const [prospects, setProspects] = useState<Prospect[]>([]);
  const [policies, setPolicies] = useState<Policy[]>([]);

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    const [usersRes, prospectsRes, policiesRes] = await Promise.all([
      supabase.from('profiles').select('*'),
      supabase.from('prospects').select('*'),
      supabase.from('policies').select('*')
    ]);

    if (usersRes.data) setUsers(usersRes.data);
    if (prospectsRes.data) setProspects(prospectsRes.data);
    if (policiesRes.data) setPolicies(policiesRes.data);
  }

  const stats = {
    totalUsers: users.length,
    totalProspects: prospects.length,
    totalClients: users.filter(u => u.role === 'cliente').length,
    totalExecutives: users.filter(u => u.role === 'ejecutivo').length,
    totalPolicies: policies.length,
    activePolicies: policies.filter(p => p.status === 'activa').length,
    nearRenewal: policies.filter(p => p.status === 'por_vencer').length,
    prospectsByStatus: {
      nuevo: prospects.filter(p => p.status === 'nuevo').length,
      contactado: prospects.filter(p => p.status === 'contactado').length,
      cotizado: prospects.filter(p => p.status === 'cotizado').length,
      cerrado: prospects.filter(p => p.status === 'cerrado').length,
      perdido: prospects.filter(p => p.status === 'perdido').length
    }
  };

  return (
    <div>
      <h2 style={{ fontSize: '1.5rem', fontWeight: 600, marginBottom: '1.5rem', color: '#202856' }}>
        Métricas Generales
      </h2>

      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
        gap: '16px',
        marginBottom: '32px'
      }}>
        <StatCard title="Total Usuarios" value={stats.totalUsers} color="#202856" />
        <StatCard title="Ejecutivos" value={stats.totalExecutives} color="#017E7B" />
        <StatCard title="Clientes" value={stats.totalClients} color="#65EA1E" />
        <StatCard title="Leads Activos" value={stats.totalProspects - stats.prospectsByStatus.cerrado - stats.prospectsByStatus.perdido} color="#F59E0B" />
        <StatCard title="Pólizas Activas" value={stats.activePolicies} color="#194988" />
        <StatCard title="Por Renovar" value={stats.nearRenewal} color="#EF4444" />
      </div>

      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
        gap: '16px'
      }}>
        <Card>
          <h3 style={{ fontSize: '1.125rem', fontWeight: 600, marginBottom: '1rem', color: '#202856' }}>
            Pipeline de Ventas
          </h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <PipelineItem label="Nuevos" count={stats.prospectsByStatus.nuevo} color="#65EA1E" />
            <PipelineItem label="Contactados" count={stats.prospectsByStatus.contactado} color="#017E7B" />
            <PipelineItem label="Cotizados" count={stats.prospectsByStatus.cotizado} color="#F59E0B" />
            <PipelineItem label="Cerrados" count={stats.prospectsByStatus.cerrado} color="#194988" />
            <PipelineItem label="Perdidos" count={stats.prospectsByStatus.perdido} color="#EF4444" />
          </div>
        </Card>

        <Card>
          <h3 style={{ fontSize: '1.125rem', fontWeight: 600, marginBottom: '1rem', color: '#202856' }}>
            Resumen de Pólizas
          </h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <PipelineItem label="Activas" count={stats.activePolicies} color="#65EA1E" />
            <PipelineItem label="Por Renovar" count={stats.nearRenewal} color="#F59E0B" />
            <PipelineItem label="Vencidas" count={policies.filter(p => p.status === 'vencida').length} color="#EF4444" />
          </div>
        </Card>
      </div>
    </div>
  );
}

function StatCard({ title, value, color }: { title: string; value: number; color: string }) {
  return (
    <Card>
      <p style={{ fontSize: '0.875rem', color: '#718096', marginBottom: '8px', fontWeight: 500 }}>
        {title}
      </p>
      <p style={{ fontSize: '2.25rem', fontWeight: 700, color, lineHeight: 1 }}>
        {value}
      </p>
    </Card>
  );
}

function PipelineItem({ label, count, color }: { label: string; count: number; color: string }) {
  return (
    <div style={{
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      padding: '12px 16px',
      background: '#F7F8FC',
      borderRadius: '10px'
    }}>
      <span style={{ fontSize: '0.9375rem', color: '#202856', fontWeight: 500 }}>
        {label}
      </span>
      <span style={{ fontSize: '1.25rem', fontWeight: 700, color }}>
        {count}
      </span>
    </div>
  );
}

function UsersView() {
  const [users, setUsers] = useState<Profile[]>([]);
  const [showUserForm, setShowUserForm] = useState(false);
  const [executives, setExecutives] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(false);
  const [newUser, setNewUser] = useState({
    email: '',
    password: '',
    full_name: '',
    phone: '',
    role: 'cliente' as 'admin' | 'ejecutivo' | 'cliente',
    assigned_executive_id: ''
  });
  const [editingUser, setEditingUser] = useState<Profile | null>(null);
  const [editForm, setEditForm] = useState({
    email: '',
    full_name: '',
    phone: '',
    role: 'cliente' as 'admin' | 'ejecutivo' | 'cliente',
    assigned_executive_id: '',
    password: ''
  });

  useEffect(() => {
    loadUsers();
  }, []);

  async function loadUsers() {
    const [usersRes, execRes] = await Promise.all([
      supabase.from('profiles').select('*').order('created_at', { ascending: false }),
      supabase.from('profiles').select('*').eq('role', 'ejecutivo')
    ]);

    if (usersRes.data) setUsers(usersRes.data);
    if (execRes.data) setExecutives(execRes.data);
  }

  async function handleCreateUser(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      const { data: existingUser } = await supabase
        .from('profiles')
        .select('email')
        .eq('email', newUser.email)
        .maybeSingle();

      if (existingUser) {
        alert('Ya existe un usuario con este correo electrónico en el sistema.');
        setLoading(false);
        return;
      }

      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: newUser.email,
        password: newUser.password
      });

      if (authError) {
        if (authError.message.includes('already registered') || authError.message.includes('User already registered')) {
          alert('Este correo ya está registrado en Supabase Auth.\n\nPosibles soluciones:\n1. Usa otro correo electrónico\n2. Si crees que esto es un error, contacta al administrador del sistema');
          setLoading(false);
          return;
        }
        throw authError;
      }

      if (authData.user) {
        const { error: profileError } = await supabase.from('profiles').insert({
          id: authData.user.id,
          email: newUser.email,
          full_name: newUser.full_name,
          phone: newUser.phone,
          role: newUser.role,
          assigned_executive_id: newUser.assigned_executive_id || null
        });

        if (profileError) {
          if (profileError.code === '23505') {
            alert('Error: El usuario ya existe en la base de datos');
          } else {
            throw profileError;
          }
          setLoading(false);
          return;
        }

        setShowUserForm(false);
        setNewUser({ email: '', password: '', full_name: '', phone: '', role: 'cliente', assigned_executive_id: '' });
        loadUsers();
        alert('Usuario creado exitosamente');
      }
    } catch (error: any) {
      console.error('Error creating user:', error);
      alert('Error: ' + error.message);
    } finally {
      setLoading(false);
    }
  }

  function openEditModal(user: Profile) {
    setEditingUser(user);
    setEditForm({
      email: user.email,
      full_name: user.full_name,
      phone: user.phone || '',
      role: user.role,
      assigned_executive_id: user.assigned_executive_id || '',
      password: ''
    });
  }

  function closeEditModal() {
    setEditingUser(null);
    setEditForm({
      email: '',
      full_name: '',
      phone: '',
      role: 'cliente',
      assigned_executive_id: '',
      password: ''
    });
  }

  async function handleUpdateUser(e: React.FormEvent) {
    e.preventDefault();
    if (!editingUser) return;

    setLoading(true);
    try {
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const { data: { session } } = await supabase.auth.getSession();

      if (!session) throw new Error('No session');

      const updates: any = {
        email: editForm.email !== editingUser.email ? editForm.email : undefined,
        full_name: editForm.full_name,
        phone: editForm.phone || null,
        role: editForm.role !== editingUser.role ? editForm.role : undefined,
        assigned_executive_id: editForm.assigned_executive_id || null
      };

      if (editForm.password) {
        updates.password = editForm.password;
      }

      const response = await fetch(`${supabaseUrl}/functions/v1/admin-manage-users`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'apikey': import.meta.env.VITE_SUPABASE_ANON_KEY,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action: 'update_user',
          userId: editingUser.id,
          updates
        })
      });

      const result = await response.json();

      if (!response.ok) throw new Error(result.error);

      alert('Usuario actualizado correctamente');
      closeEditModal();
      loadUsers();
    } catch (error: any) {
      alert('Error: ' + error.message);
    } finally {
      setLoading(false);
    }
  }


  async function handleDeleteUser(user: Profile) {
    if (!confirm(`¿Estás seguro de eliminar a ${user.full_name}? Esta acción no se puede deshacer.`)) return;

    setLoading(true);
    try {
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const { data: { session } } = await supabase.auth.getSession();

      if (!session) throw new Error('No session');

      const response = await fetch(`${supabaseUrl}/functions/v1/admin-manage-users`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'apikey': import.meta.env.VITE_SUPABASE_ANON_KEY,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action: 'delete_user',
          userId: user.id
        })
      });

      const result = await response.json();

      if (!response.ok) throw new Error(result.error);

      alert('Usuario eliminado correctamente');
      loadUsers();
    } catch (error: any) {
      alert('Error: ' + error.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      <Card>
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '1.5rem',
          flexWrap: 'wrap',
          gap: '1rem'
        }}>
          <h2 style={{ fontSize: '1.5rem', fontWeight: 600, color: '#202856' }}>
            Gestión de Usuarios
          </h2>
          <Button
            onClick={() => setShowUserForm(!showUserForm)}
            variant={showUserForm ? 'ghost' : 'primary'}
          >
            {showUserForm ? 'Cancelar' : '+ Crear Usuario'}
          </Button>
        </div>

        {showUserForm && (
          <form onSubmit={handleCreateUser} style={{
            marginBottom: '2rem',
            padding: '1.5rem',
            background: '#F7F8FC',
            borderRadius: '12px'
          }}>
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
              gap: '1rem'
            }}>
              <Input
                label="Nombre completo"
                type="text"
                value={newUser.full_name}
                onChange={(e) => setNewUser({ ...newUser, full_name: e.target.value })}
                required
              />
              <Input
                label="Correo"
                type="email"
                value={newUser.email}
                onChange={(e) => setNewUser({ ...newUser, email: e.target.value })}
                required
              />
              <Input
                label="Contraseña"
                type="password"
                value={newUser.password}
                onChange={(e) => setNewUser({ ...newUser, password: e.target.value })}
                required
                helperText="Mínimo 6 caracteres"
              />
              <Input
                label="Teléfono"
                type="tel"
                value={newUser.phone}
                onChange={(e) => setNewUser({ ...newUser, phone: e.target.value })}
              />
              <div>
                <label style={{
                  display: 'block',
                  fontSize: '0.875rem',
                  fontWeight: 600,
                  marginBottom: '8px',
                  color: '#202856'
                }}>
                  Rol
                </label>
                <select
                  value={newUser.role}
                  onChange={(e) => setNewUser({ ...newUser, role: e.target.value as any })}
                  className="input-premium"
                >
                  <option value="cliente">Cliente</option>
                  <option value="ejecutivo">Ejecutivo</option>
                  <option value="admin">Administrador</option>
                </select>
              </div>
              {newUser.role === 'cliente' && (
                <div>
                  <label style={{
                    display: 'block',
                    fontSize: '0.875rem',
                    fontWeight: 600,
                    marginBottom: '8px',
                    color: '#202856'
                  }}>
                    Ejecutivo asignado
                  </label>
                  <select
                    value={newUser.assigned_executive_id}
                    onChange={(e) => setNewUser({ ...newUser, assigned_executive_id: e.target.value })}
                    className="input-premium"
                  >
                    <option value="">Sin asignar</option>
                    {executives.map(exec => (
                      <option key={exec.id} value={exec.id}>{exec.full_name}</option>
                    ))}
                  </select>
                </div>
              )}
            </div>
            <Button type="submit" variant="primary" disabled={loading} style={{ marginTop: '1rem' }}>
              {loading ? 'Creando...' : 'Crear Usuario'}
            </Button>
          </form>
        )}

        {editingUser && (
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
            <div style={{
              background: '#FFFFFF',
              borderRadius: '16px',
              padding: '2rem',
              maxWidth: '600px',
              width: '100%',
              maxHeight: '90vh',
              overflowY: 'auto'
            }}>
              <h3 style={{
                fontSize: '1.5rem',
                fontWeight: 600,
                color: '#202856',
                marginBottom: '1.5rem'
              }}>
                Editar Usuario
              </h3>
              <form onSubmit={handleUpdateUser}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                  <Input
                    label="Nombre completo"
                    type="text"
                    value={editForm.full_name}
                    onChange={(e) => setEditForm({ ...editForm, full_name: e.target.value })}
                    required
                  />
                  <Input
                    label="Correo"
                    type="email"
                    value={editForm.email}
                    onChange={(e) => setEditForm({ ...editForm, email: e.target.value })}
                    required
                  />
                  <Input
                    label="Teléfono"
                    type="tel"
                    value={editForm.phone}
                    onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })}
                  />
                  <div>
                    <label style={{
                      display: 'block',
                      fontSize: '0.875rem',
                      fontWeight: 600,
                      marginBottom: '8px',
                      color: '#202856'
                    }}>
                      Rol
                    </label>
                    <select
                      value={editForm.role}
                      onChange={(e) => setEditForm({ ...editForm, role: e.target.value as any })}
                      className="input-premium"
                    >
                      <option value="cliente">Cliente</option>
                      <option value="ejecutivo">Ejecutivo</option>
                      <option value="admin">Administrador</option>
                    </select>
                  </div>
                  {editForm.role === 'cliente' && (
                    <div>
                      <label style={{
                        display: 'block',
                        fontSize: '0.875rem',
                        fontWeight: 600,
                        marginBottom: '8px',
                        color: '#202856'
                      }}>
                        Ejecutivo asignado
                      </label>
                      <select
                        value={editForm.assigned_executive_id}
                        onChange={(e) => setEditForm({ ...editForm, assigned_executive_id: e.target.value })}
                        className="input-premium"
                      >
                        <option value="">Sin asignar</option>
                        {executives.map(exec => (
                          <option key={exec.id} value={exec.id}>{exec.full_name}</option>
                        ))}
                      </select>
                    </div>
                  )}
                  <Input
                    label="Nueva Contraseña"
                    type="password"
                    value={editForm.password}
                    onChange={(e) => setEditForm({ ...editForm, password: e.target.value })}
                    helperText="Dejar vacío para no cambiar la contraseña. Mínimo 6 caracteres si se modifica."
                  />
                </div>
                <div style={{
                  display: 'flex',
                  gap: '12px',
                  marginTop: '1.5rem',
                  justifyContent: 'flex-end'
                }}>
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={closeEditModal}
                    disabled={loading}
                  >
                    Cancelar
                  </Button>
                  <Button
                    type="submit"
                    variant="primary"
                    disabled={loading}
                  >
                    {loading ? 'Guardando...' : 'Guardar Cambios'}
                  </Button>
                </div>
              </form>
            </div>
          </div>
        )}

        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: '2px solid #E6E8EF' }}>
                <th style={{
                  padding: '12px',
                  textAlign: 'left',
                  fontSize: '0.875rem',
                  fontWeight: 600,
                  color: '#202856'
                }}>
                  Nombre
                </th>
                <th style={{
                  padding: '12px',
                  textAlign: 'left',
                  fontSize: '0.875rem',
                  fontWeight: 600,
                  color: '#202856'
                }}>
                  Correo
                </th>
                <th style={{
                  padding: '12px',
                  textAlign: 'left',
                  fontSize: '0.875rem',
                  fontWeight: 600,
                  color: '#202856'
                }}>
                  Teléfono
                </th>
                <th style={{
                  padding: '12px',
                  textAlign: 'left',
                  fontSize: '0.875rem',
                  fontWeight: 600,
                  color: '#202856'
                }}>
                  Rol
                </th>
                <th style={{
                  padding: '12px',
                  textAlign: 'left',
                  fontSize: '0.875rem',
                  fontWeight: 600,
                  color: '#202856'
                }}>
                  Acciones
                </th>
              </tr>
            </thead>
            <tbody>
              {users.map(user => (
                <tr key={user.id} style={{ borderBottom: '1px solid #E6E8EF' }}>
                  <td style={{ padding: '12px', fontSize: '0.9375rem', color: '#202856' }}>
                    {user.full_name}
                  </td>
                  <td style={{ padding: '12px', fontSize: '0.875rem', color: '#718096' }}>
                    {user.email}
                  </td>
                  <td style={{ padding: '12px', fontSize: '0.875rem', color: '#718096' }}>
                    {user.phone || '-'}
                  </td>
                  <td style={{ padding: '12px' }}>
                    <Badge variant={user.role === 'admin' ? 'error' : user.role === 'ejecutivo' ? 'info' : 'success'}>
                      {user.role}
                    </Badge>
                  </td>
                  <td style={{ padding: '12px' }}>
                    <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                      <button
                        onClick={() => openEditModal(user)}
                        disabled={loading}
                        style={{
                          padding: '8px 14px',
                          background: '#017E7B',
                          color: '#FFFFFF',
                          border: 'none',
                          borderRadius: '8px',
                          cursor: loading ? 'not-allowed' : 'pointer',
                          fontSize: '0.8125rem',
                          fontWeight: 600,
                          transition: 'all 0.2s ease'
                        }}
                      >
                        Editar
                      </button>
                      <button
                        onClick={() => handleDeleteUser(user)}
                        disabled={loading}
                        style={{
                          padding: '8px 14px',
                          background: '#EF4444',
                          color: '#FFFFFF',
                          border: 'none',
                          borderRadius: '8px',
                          cursor: loading ? 'not-allowed' : 'pointer',
                          fontSize: '0.8125rem',
                          fontWeight: 600,
                          transition: 'all 0.2s ease'
                        }}
                      >
                        Eliminar
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}

function ClientesView() {
  const navigate = useNavigate();
  const [clients, setClients] = useState<Client[]>([]);
  const [policies, setPolicies] = useState<Policy[]>([]);

  useEffect(() => {
    loadClients();
  }, []);

  async function loadClients() {
    const { data } = await supabase
      .from('clients')
      .select('*')
      .order('created_at', { ascending: false });

    if (data) {
      setClients(data);
      const clientIds = data.map(c => c.id);
      if (clientIds.length > 0) {
        const { data: policiesData } = await supabase
          .from('policies')
          .select('*')
          .in('client_id', clientIds);
        if (policiesData) setPolicies(policiesData);
      }
    }
  }

  return (
    <div>
      <h2 style={{ fontSize: '1.5rem', fontWeight: 600, color: '#202856', marginBottom: '1.5rem' }}>
        Clientes
      </h2>
      <div style={{ display: 'grid', gap: '16px' }}>
        {clients.map(client => {
          const clientPolicies = policies.filter(p => p.client_id === client.id);
          return (
            <Card
              key={client.id}
              hover
              style={{ cursor: 'pointer' }}
              onClick={() => navigate(`/admin/clientes/${client.id}`)}
            >
              <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                gap: '1rem',
                flexWrap: 'wrap'
              }}>
                <div>
                  <h3 style={{ fontWeight: 600, marginBottom: '4px', color: '#202856', fontSize: '1.0625rem' }}>
                    {client.full_name}
                  </h3>
                  <p style={{ fontSize: '0.875rem', color: '#718096' }}>{client.email}</p>
                  <p style={{ fontSize: '0.875rem', color: '#718096' }}>{client.phone}</p>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <p style={{ fontSize: '0.8125rem', color: '#718096', marginBottom: '4px' }}>
                    Pólizas activas
                  </p>
                  <p style={{ fontSize: '1.75rem', fontWeight: 700, color: '#202856', lineHeight: 1 }}>
                    {clientPolicies.length}
                  </p>
                  {client.phone && (
                    <a
                      href={`https://wa.me/${client.phone.replace(/\D/g, '')}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={(e) => e.stopPropagation()}
                      style={{
                        display: 'inline-flex',
                        marginTop: '8px',
                        padding: '8px 16px',
                        background: '#65EA1E',
                        color: '#202856',
                        textDecoration: 'none',
                        borderRadius: '10px',
                        fontSize: '0.875rem',
                        fontWeight: 600,
                        alignItems: 'center',
                        gap: '6px',
                        transition: 'all 0.2s ease'
                      }}
                    >
                      <span>💬</span>
                      <span>WhatsApp</span>
                    </a>
                  )}
                </div>
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
}

function SeguimientosView() {
  const [followups, setFollowups] = useState<any[]>([]);

  useEffect(() => {
    loadFollowups();
  }, []);

  async function loadFollowups() {
    const { data } = await supabase
      .from('followups')
      .select(`
        *,
        prospect:prospects(full_name, phone, email)
      `)
      .order('scheduled_date', { ascending: true });

    if (data) setFollowups(data);
  }

  return (
    <div>
      <h2 style={{ fontSize: '1.5rem', fontWeight: 600, color: '#202856', marginBottom: '1.5rem' }}>
        Seguimientos Programados
      </h2>
      <Card>
        {followups.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state-icon">📋</div>
            <p className="empty-state-description">No hay seguimientos programados</p>
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

function SettingsView() {
  const [syncingChannels, setSyncingChannels] = useState(false);
  const [syncingMessages, setSyncingMessages] = useState(false);
  const [syncResult, setSyncResult] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  async function handleSyncChannels() {
    setSyncingChannels(true);
    setSyncResult(null);
    try {
      const { data: { session } } = await supabase.auth.getSession();

      if (!session) {
        throw new Error('No hay sesión activa');
      }

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/wazzup-sync-channels`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${session.access_token}`,
            'Content-Type': 'application/json',
          },
        }
      );

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Error al sincronizar canales');
      }

      setSyncResult({
        type: 'success',
        message: `Canal sincronizado correctamente: ${result.primaryChannel?.plainId || 'OK'}`
      });
    } catch (error: any) {
      console.error('Sync channels error:', error);
      setSyncResult({
        type: 'error',
        message: error.message || 'Error al sincronizar canales'
      });
    } finally {
      setSyncingChannels(false);
    }
  }

  async function handleSyncMessages() {
    setSyncingMessages(true);
    setSyncResult(null);
    try {
      const { data: { session } } = await supabase.auth.getSession();

      if (!session) {
        throw new Error('No hay sesión activa');
      }

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/wazzup-sync-messages`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${session.access_token}`,
            'Content-Type': 'application/json',
          },
        }
      );

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Error al sincronizar mensajes');
      }

      setSyncResult({
        type: 'success',
        message: `Sincronización completada: ${result.synced || 0} mensajes, ${result.errors || 0} errores`
      });
    } catch (error: any) {
      console.error('Sync messages error:', error);
      setSyncResult({
        type: 'error',
        message: error.message || 'Error al sincronizar mensajes'
      });
    } finally {
      setSyncingMessages(false);
    }
  }

  return (
    <div>
      <h2 style={{ fontSize: '1.5rem', fontWeight: 600, color: '#202856', marginBottom: '1.5rem' }}>
        Configuración
      </h2>
      <div style={{ display: 'grid', gap: '16px' }}>
        <WebhookConfig />

        <Card>
          <h3 style={{ fontSize: '1.125rem', fontWeight: 600, marginBottom: '1rem', color: '#202856' }}>
            Sincronización WhatsApp
          </h3>
          <p style={{ fontSize: '0.9375rem', color: '#718096', marginBottom: '1.5rem' }}>
            Sincroniza manualmente canales y mensajes desde Wazzup. Solo usar para backfill o reconciliación.
          </p>

          {syncResult && (
            <div
              style={{
                padding: '12px 16px',
                borderRadius: '10px',
                marginBottom: '1rem',
                background: syncResult.type === 'success' ? '#D1FAE5' : '#FEE2E2',
                border: `1px solid ${syncResult.type === 'success' ? '#65EA1E' : '#EF4444'}`,
                color: syncResult.type === 'success' ? '#065F46' : '#991B1B',
                fontSize: '0.875rem',
                fontWeight: 500
              }}
            >
              {syncResult.message}
            </div>
          )}

          <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
            <Button
              onClick={handleSyncChannels}
              disabled={syncingChannels || syncingMessages}
              variant="primary"
            >
              {syncingChannels ? 'Sincronizando...' : 'Sincronizar Canales'}
            </Button>
            <Button
              onClick={handleSyncMessages}
              disabled={syncingChannels || syncingMessages}
              variant="secondary"
            >
              {syncingMessages ? 'Sincronizando...' : 'Sincronizar Mensajes'}
            </Button>
          </div>

          <div
            style={{
              marginTop: '1rem',
              padding: '12px',
              background: '#FEF3C7',
              border: '1px solid #F59E0B',
              borderRadius: '10px',
              fontSize: '0.8125rem',
              color: '#92400E'
            }}
          >
            <strong>Nota:</strong> La operación normal usa webhooks automáticos. Solo sincroniza manualmente si necesitas recuperar mensajes históricos o resolver inconsistencias.
          </div>
        </Card>

        <Card>
          <h3 style={{ fontSize: '1.125rem', fontWeight: 600, marginBottom: '1rem', color: '#202856' }}>
            Configuración General
          </h3>
          <p style={{ fontSize: '0.9375rem', color: '#718096', marginBottom: '1.5rem' }}>
            Ajusta la configuración general del sistema
          </p>
          <div className="empty-state">
            <div className="empty-state-icon">⚙️</div>
            <p className="empty-state-description">Panel de configuración próximamente</p>
          </div>
        </Card>
        <Card>
          <h3 style={{ fontSize: '1.125rem', fontWeight: 600, marginBottom: '1rem', color: '#202856' }}>
            Notificaciones
          </h3>
          <p style={{ fontSize: '0.9375rem', color: '#718096', marginBottom: '1.5rem' }}>
            Configura tus preferencias de notificaciones
          </p>
          <div className="empty-state">
            <div className="empty-state-icon">🔔</div>
            <p className="empty-state-description">Configuración de notificaciones próximamente</p>
          </div>
        </Card>
      </div>
    </div>
  );
}

function EmailLeadsView() {
  const [activeTab, setActiveTab] = useState<'inbound' | 'outbound' | 'history'>('inbound');

  return (
    <div style={{ padding: '2rem', maxWidth: '1400px', margin: '0 auto' }}>
      <div style={{ marginBottom: '2rem', borderBottom: '2px solid #E6E8EF' }}>
        <div style={{ display: 'flex', gap: '2rem' }}>
          <button
            onClick={() => setActiveTab('inbound')}
            style={{
              padding: '1rem 0',
              background: 'none',
              border: 'none',
              borderBottom: activeTab === 'inbound' ? '3px solid #194988' : '3px solid transparent',
              fontSize: '1rem',
              fontWeight: 600,
              color: activeTab === 'inbound' ? '#194988' : '#718096',
              cursor: 'pointer',
              transition: 'all 0.2s'
            }}
          >
            Recepción de Emails
          </button>
          <button
            onClick={() => setActiveTab('outbound')}
            style={{
              padding: '1rem 0',
              background: 'none',
              border: 'none',
              borderBottom: activeTab === 'outbound' ? '3px solid #194988' : '3px solid transparent',
              fontSize: '1rem',
              fontWeight: 600,
              color: activeTab === 'outbound' ? '#194988' : '#718096',
              cursor: 'pointer',
              transition: 'all 0.2s'
            }}
          >
            Envío de Emails
          </button>
          <button
            onClick={() => setActiveTab('history')}
            style={{
              padding: '1rem 0',
              background: 'none',
              border: 'none',
              borderBottom: activeTab === 'history' ? '3px solid #194988' : '3px solid transparent',
              fontSize: '1rem',
              fontWeight: 600,
              color: activeTab === 'history' ? '#194988' : '#718096',
              cursor: 'pointer',
              transition: 'all 0.2s'
            }}
          >
            Historial
          </button>
        </div>
      </div>

      {activeTab === 'inbound' && <AccountConfig />}
      {activeTab === 'outbound' && <OutboundConfig />}
      {activeTab === 'history' && <MessagesHistory />}
    </div>
  );
}
