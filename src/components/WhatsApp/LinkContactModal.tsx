import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import type { WhatsAppConversation } from '../../types/whatsapp';
import { Card } from '../ui/Card';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';

interface LinkContactModalProps {
  conversation: WhatsAppConversation;
  onClose: () => void;
  onLinked: () => void;
}

interface Contact {
  id: string;
  name: string;
  phone: string;
  type: 'client' | 'prospect';
}

type ViewMode = 'search' | 'create-prospect' | 'create-client';

export function LinkContactModal({ conversation, onClose, onLinked }: LinkContactModalProps) {
  const [viewMode, setViewMode] = useState<ViewMode>('search');
  const [searchTerm, setSearchTerm] = useState('');
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedContact, setSelectedContact] = useState<Contact | null>(null);

  const [newContactName, setNewContactName] = useState('');
  const [newContactEmail, setNewContactEmail] = useState('');
  const [newContactProduct, setNewContactProduct] = useState('auto');

  useEffect(() => {
    if (viewMode === 'search' && searchTerm.length >= 2) {
      searchContacts();
    } else {
      setContacts([]);
    }
  }, [searchTerm, viewMode]);

  async function searchContacts() {
    setLoading(true);
    try {
      const searchLower = searchTerm.toLowerCase();

      const { data: clients } = await supabase
        .from('clients')
        .select('id, full_name, phone')
        .or(`full_name.ilike.%${searchLower}%,phone.ilike.%${searchLower}%`)
        .limit(10);

      const { data: prospects } = await supabase
        .from('prospects')
        .select('id, full_name, phone')
        .or(`full_name.ilike.%${searchLower}%,phone.ilike.%${searchLower}%`)
        .limit(10);

      const allContacts: Contact[] = [
        ...(clients || []).map(c => ({
          id: c.id,
          name: c.full_name,
          phone: c.phone || '',
          type: 'client' as const
        })),
        ...(prospects || []).map(p => ({
          id: p.id,
          name: p.full_name,
          phone: p.phone || '',
          type: 'prospect' as const
        }))
      ];

      setContacts(allContacts);
    } catch (error) {
      console.error('Error searching contacts:', error);
    } finally {
      setLoading(false);
    }
  }

  async function handleLinkExisting() {
    if (!selectedContact) return;

    setLoading(true);
    try {
      const updateData: any = {
        [selectedContact.type === 'client' ? 'client_id' : 'prospect_id']: selectedContact.id
      };

      if (selectedContact.type === 'client') {
        updateData.prospect_id = null;
      } else {
        updateData.client_id = null;
      }

      const { error } = await supabase
        .from('wa_conversations')
        .update(updateData)
        .eq('id', conversation.id);

      if (error) throw error;

      alert('Contacto vinculado exitosamente');
      onLinked();
    } catch (error) {
      console.error('Error linking contact:', error);
      alert('Error al vincular contacto');
    } finally {
      setLoading(false);
    }
  }

  async function handleCreateProspect() {
    if (!newContactName.trim()) {
      alert('El nombre es requerido');
      return;
    }

    setLoading(true);
    try {
      const { data: newProspect, error: prospectError } = await supabase
        .from('prospects')
        .insert({
          full_name: newContactName.trim(),
          phone: conversation.contact_plain,
          email: newContactEmail.trim() || null,
          product_interest: newContactProduct,
          origin: 'whatsapp',
          priority: 'media',
          status: 'nuevo',
          comments: 'Creado desde WhatsApp Inbox',
          last_activity_at: new Date().toISOString(),
        })
        .select('id')
        .single();

      if (prospectError) throw prospectError;

      const { error: updateError } = await supabase
        .from('wa_conversations')
        .update({
          prospect_id: newProspect.id,
          client_id: null
        })
        .eq('id', conversation.id);

      if (updateError) throw updateError;

      alert('Prospecto creado y vinculado exitosamente');
      onLinked();
    } catch (error) {
      console.error('Error creating prospect:', error);
      alert('Error al crear prospecto');
    } finally {
      setLoading(false);
    }
  }

  async function handleCreateClient() {
    if (!newContactName.trim()) {
      alert('El nombre es requerido');
      return;
    }

    setLoading(true);
    try {
      const { data: newClient, error: clientError } = await supabase
        .from('clients')
        .insert({
          full_name: newContactName.trim(),
          phone: conversation.contact_phone_e164,
          whatsapp: conversation.contact_plain,
          email: newContactEmail.trim() || null,
          notes: 'Creado desde WhatsApp Inbox',
        })
        .select('id')
        .single();

      if (clientError) throw clientError;

      const { error: updateError } = await supabase
        .from('wa_conversations')
        .update({
          client_id: newClient.id,
          prospect_id: null
        })
        .eq('id', conversation.id);

      if (updateError) throw updateError;

      alert('Cliente creado y vinculado exitosamente');
      onLinked();
    } catch (error) {
      console.error('Error creating client:', error);
      alert('Error al crear cliente');
    } finally {
      setLoading(false);
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
      padding: '20px'
    }}>
      <Card style={{
        maxWidth: '600px',
        width: '100%',
        padding: '24px',
        maxHeight: '90vh',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden'
      }}>
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '20px',
          flexShrink: 0
        }}>
          <h2 style={{
            fontSize: '20px',
            fontWeight: 600,
            color: '#202856',
            margin: 0
          }}>
            {viewMode === 'search' && 'Vincular Contacto'}
            {viewMode === 'create-prospect' && 'Crear Prospecto'}
            {viewMode === 'create-client' && 'Crear Cliente'}
          </h2>
          <button
            onClick={onClose}
            style={{
              background: 'transparent',
              border: 'none',
              fontSize: '28px',
              cursor: 'pointer',
              color: '#718096',
              padding: '0',
              width: '32px',
              height: '32px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}
          >
            ×
          </button>
        </div>

        <div style={{
          background: '#F7F8FC',
          padding: '12px 16px',
          borderRadius: '8px',
          marginBottom: '20px',
          fontSize: '13px',
          color: '#718096',
          flexShrink: 0
        }}>
          <div><strong>Teléfono:</strong> {conversation.contact_phone_e164}</div>
          <div><strong>WhatsApp:</strong> {conversation.contact_plain}</div>
        </div>

        {viewMode === 'search' && (
          <>
            <div style={{ marginBottom: '16px', flexShrink: 0 }}>
              <Input
                type="text"
                placeholder="Buscar por nombre o teléfono..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                autoFocus
              />
            </div>

            <div style={{
              flex: 1,
              overflowY: 'auto',
              minHeight: '200px',
              marginBottom: '20px'
            }}>
              {loading && (
                <div style={{
                  textAlign: 'center',
                  padding: '20px',
                  color: '#718096'
                }}>
                  Buscando...
                </div>
              )}

              {!loading && searchTerm.length < 2 && (
                <div style={{
                  textAlign: 'center',
                  padding: '40px 20px',
                  color: '#718096'
                }}>
                  Escribe al menos 2 caracteres para buscar contactos existentes
                </div>
              )}

              {!loading && searchTerm.length >= 2 && contacts.length === 0 && (
                <div style={{
                  textAlign: 'center',
                  padding: '40px 20px',
                  color: '#718096'
                }}>
                  No se encontraron contactos
                </div>
              )}

              {contacts.map(contact => (
                <button
                  key={`${contact.type}-${contact.id}`}
                  onClick={() => setSelectedContact(contact)}
                  style={{
                    width: '100%',
                    padding: '16px',
                    border: selectedContact?.id === contact.id ? '2px solid #017E7B' : '1px solid #E6E8EF',
                    borderRadius: '12px',
                    background: selectedContact?.id === contact.id ? '#F0FFFE' : 'white',
                    cursor: 'pointer',
                    textAlign: 'left',
                    marginBottom: '8px',
                    transition: 'all 0.2s ease'
                  }}
                >
                  <div style={{
                    fontSize: '14px',
                    fontWeight: 600,
                    color: '#202856',
                    marginBottom: '4px'
                  }}>
                    {contact.name}
                  </div>
                  <div style={{
                    fontSize: '13px',
                    color: '#718096',
                    marginBottom: '4px'
                  }}>
                    {contact.phone}
                  </div>
                  <div style={{
                    fontSize: '11px',
                    color: '#017E7B',
                    textTransform: 'uppercase',
                    fontWeight: 600
                  }}>
                    {contact.type === 'client' ? 'Cliente' : 'Prospecto'}
                  </div>
                </button>
              ))}
            </div>

            <div style={{
              display: 'flex',
              flexDirection: 'column',
              gap: '12px',
              flexShrink: 0
            }}>
              {selectedContact && (
                <Button
                  onClick={handleLinkExisting}
                  disabled={loading}
                  style={{
                    background: '#017E7B',
                    color: 'white',
                    width: '100%'
                  }}
                >
                  {loading ? 'Vinculando...' : 'Vincular Contacto Seleccionado'}
                </Button>
              )}

              <div style={{
                display: 'flex',
                gap: '12px'
              }}>
                <Button
                  onClick={() => setViewMode('create-prospect')}
                  style={{
                    background: '#4F46E5',
                    color: 'white',
                    flex: 1
                  }}
                >
                  Crear Prospecto
                </Button>
                <Button
                  onClick={() => setViewMode('create-client')}
                  style={{
                    background: '#0891B2',
                    color: 'white',
                    flex: 1
                  }}
                >
                  Crear Cliente
                </Button>
              </div>

              <Button
                onClick={onClose}
                style={{
                  background: '#E6E8EF',
                  color: '#202856',
                  width: '100%'
                }}
              >
                Cancelar
              </Button>
            </div>
          </>
        )}

        {viewMode === 'create-prospect' && (
          <>
            <div style={{
              flex: 1,
              overflowY: 'auto',
              marginBottom: '20px'
            }}>
              <div style={{ marginBottom: '16px' }}>
                <label style={{
                  display: 'block',
                  fontSize: '13px',
                  fontWeight: 600,
                  color: '#202856',
                  marginBottom: '8px'
                }}>
                  Nombre completo *
                </label>
                <Input
                  type="text"
                  placeholder="Ej: Juan Pérez"
                  value={newContactName}
                  onChange={(e) => setNewContactName(e.target.value)}
                  autoFocus
                />
              </div>

              <div style={{ marginBottom: '16px' }}>
                <label style={{
                  display: 'block',
                  fontSize: '13px',
                  fontWeight: 600,
                  color: '#202856',
                  marginBottom: '8px'
                }}>
                  Email
                </label>
                <Input
                  type="email"
                  placeholder="email@ejemplo.com"
                  value={newContactEmail}
                  onChange={(e) => setNewContactEmail(e.target.value)}
                />
              </div>

              <div style={{ marginBottom: '16px' }}>
                <label style={{
                  display: 'block',
                  fontSize: '13px',
                  fontWeight: 600,
                  color: '#202856',
                  marginBottom: '8px'
                }}>
                  Producto de interés
                </label>
                <select
                  value={newContactProduct}
                  onChange={(e) => setNewContactProduct(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '12px',
                    border: '1px solid #E6E8EF',
                    borderRadius: '8px',
                    fontSize: '14px',
                    color: '#202856'
                  }}
                >
                  <option value="auto">Auto</option>
                  <option value="casa">Casa</option>
                  <option value="vida">Vida</option>
                  <option value="gastos_medicos">Gastos Médicos</option>
                  <option value="otro">Otro</option>
                </select>
              </div>
            </div>

            <div style={{
              display: 'flex',
              gap: '12px',
              flexShrink: 0
            }}>
              <Button
                onClick={() => {
                  setViewMode('search');
                  setNewContactName('');
                  setNewContactEmail('');
                  setNewContactProduct('auto');
                }}
                style={{
                  background: '#E6E8EF',
                  color: '#202856',
                  flex: 1
                }}
              >
                Volver
              </Button>
              <Button
                onClick={handleCreateProspect}
                disabled={!newContactName.trim() || loading}
                style={{
                  background: newContactName.trim() && !loading ? '#4F46E5' : '#CBD5E0',
                  color: 'white',
                  flex: 1,
                  cursor: newContactName.trim() && !loading ? 'pointer' : 'not-allowed'
                }}
              >
                {loading ? 'Creando...' : 'Crear Prospecto'}
              </Button>
            </div>
          </>
        )}

        {viewMode === 'create-client' && (
          <>
            <div style={{
              flex: 1,
              overflowY: 'auto',
              marginBottom: '20px'
            }}>
              <div style={{ marginBottom: '16px' }}>
                <label style={{
                  display: 'block',
                  fontSize: '13px',
                  fontWeight: 600,
                  color: '#202856',
                  marginBottom: '8px'
                }}>
                  Nombre completo *
                </label>
                <Input
                  type="text"
                  placeholder="Ej: Juan Pérez"
                  value={newContactName}
                  onChange={(e) => setNewContactName(e.target.value)}
                  autoFocus
                />
              </div>

              <div style={{ marginBottom: '16px' }}>
                <label style={{
                  display: 'block',
                  fontSize: '13px',
                  fontWeight: 600,
                  color: '#202856',
                  marginBottom: '8px'
                }}>
                  Email
                </label>
                <Input
                  type="email"
                  placeholder="email@ejemplo.com"
                  value={newContactEmail}
                  onChange={(e) => setNewContactEmail(e.target.value)}
                />
              </div>
            </div>

            <div style={{
              display: 'flex',
              gap: '12px',
              flexShrink: 0
            }}>
              <Button
                onClick={() => {
                  setViewMode('search');
                  setNewContactName('');
                  setNewContactEmail('');
                }}
                style={{
                  background: '#E6E8EF',
                  color: '#202856',
                  flex: 1
                }}
              >
                Volver
              </Button>
              <Button
                onClick={handleCreateClient}
                disabled={!newContactName.trim() || loading}
                style={{
                  background: newContactName.trim() && !loading ? '#0891B2' : '#CBD5E0',
                  color: 'white',
                  flex: 1,
                  cursor: newContactName.trim() && !loading ? 'pointer' : 'not-allowed'
                }}
              >
                {loading ? 'Creando...' : 'Crear Cliente'}
              </Button>
            </div>
          </>
        )}
      </Card>
    </div>
  );
}
