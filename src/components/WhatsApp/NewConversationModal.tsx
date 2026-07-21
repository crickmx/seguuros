import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { Card } from '../ui/Card';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { normalizePhoneNumber } from '../../utils/phoneUtils';

interface NewConversationModalProps {
  onClose: () => void;
  onConversationCreated: () => void;
}

interface Contact {
  id: string;
  name: string;
  phone: string;
  type: 'client' | 'prospect';
}

export function NewConversationModal({ onClose, onConversationCreated }: NewConversationModalProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedContact, setSelectedContact] = useState<Contact | null>(null);

  useEffect(() => {
    if (searchTerm.length >= 2) {
      searchContacts();
    } else {
      setContacts([]);
    }
  }, [searchTerm]);

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

  async function handleCreateConversation() {
    if (!selectedContact) return;

    setLoading(true);
    try {
      const { e164: phoneE164, plain: phonePlain } = normalizePhoneNumber(selectedContact.phone);

      const existingConversation = await supabase
        .from('wa_conversations')
        .select('id')
        .eq('contact_phone_e164', phoneE164)
        .maybeSingle();

      if (existingConversation.data) {
        alert('Ya existe una conversación con este contacto');
        onConversationCreated();
        return;
      }

      const { data: primaryChannel } = await supabase
        .from('wa_channels')
        .select('channel_id')
        .eq('is_primary', true)
        .maybeSingle();

      if (!primaryChannel) {
        alert('No hay un canal de WhatsApp configurado');
        return;
      }

      const { error } = await supabase
        .from('wa_conversations')
        .insert({
          channel_id: primaryChannel.channel_id,
          contact_phone_e164: phoneE164,
          contact_plain: phonePlain,
          [selectedContact.type === 'client' ? 'client_id' : 'prospect_id']: selectedContact.id,
          inbox_state: 'unassigned',
          unread_admin: 0,
          unread_exec: 0,
          last_message_at: new Date().toISOString()
        });

      if (error) throw error;

      alert('Conversación creada exitosamente');
      onConversationCreated();
    } catch (error) {
      console.error('Error creating conversation:', error);
      alert('Error al crear la conversación');
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
        maxWidth: '500px',
        width: '100%',
        padding: '24px',
        maxHeight: '80vh',
        display: 'flex',
        flexDirection: 'column'
      }}>
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '20px'
        }}>
          <h2 style={{
            fontSize: '20px',
            fontWeight: 600,
            color: '#202856',
            margin: 0
          }}>
            Nueva Conversación
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

        <div style={{ marginBottom: '20px' }}>
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
              Escribe al menos 2 caracteres para buscar
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
          gap: '12px',
          justifyContent: 'flex-end'
        }}>
          <Button
            onClick={onClose}
            style={{
              background: '#E6E8EF',
              color: '#202856'
            }}
          >
            Cancelar
          </Button>
          <Button
            onClick={handleCreateConversation}
            disabled={!selectedContact || loading}
            style={{
              background: selectedContact && !loading ? '#017E7B' : '#CBD5E0',
              color: 'white',
              cursor: selectedContact && !loading ? 'pointer' : 'not-allowed'
            }}
          >
            {loading ? 'Creando...' : 'Crear Conversación'}
          </Button>
        </div>
      </Card>
    </div>
  );
}
