import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';

interface MessageTemplate {
  id: string;
  name: string;
  content: string;
  category: string;
  is_default: boolean;
  created_by: string | null;
}

interface TemplateManagerProps {
  onSelectTemplate?: (content: string) => void;
  onClose: () => void;
}

export function TemplateManager({ onSelectTemplate, onClose }: TemplateManagerProps) {
  const { profile } = useAuth();
  const [templates, setTemplates] = useState<MessageTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<MessageTemplate | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    content: '',
    category: 'general'
  });

  useEffect(() => {
    loadTemplates();
  }, []);

  async function loadTemplates() {
    try {
      const { data, error } = await supabase
        .from('wa_message_templates')
        .select('*')
        .order('is_default', { ascending: false })
        .order('created_at', { ascending: false });

      if (error) throw error;
      setTemplates(data || []);
    } catch (error) {
      console.error('Error loading templates:', error);
    } finally {
      setLoading(false);
    }
  }

  async function handleSave() {
    try {
      if (editingTemplate) {
        const { error } = await supabase
          .from('wa_message_templates')
          .update({
            name: formData.name,
            content: formData.content,
            category: formData.category,
            updated_at: new Date().toISOString()
          })
          .eq('id', editingTemplate.id);

        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('wa_message_templates')
          .insert({
            name: formData.name,
            content: formData.content,
            category: formData.category,
            created_by: profile?.id
          });

        if (error) throw error;
      }

      setFormData({ name: '', content: '', category: 'general' });
      setEditingTemplate(null);
      setShowForm(false);
      loadTemplates();
    } catch (error) {
      console.error('Error saving template:', error);
    }
  }

  async function handleDelete(templateId: string) {
    if (!confirm('¿Estás seguro de eliminar esta plantilla?')) return;

    try {
      const { error } = await supabase
        .from('wa_message_templates')
        .delete()
        .eq('id', templateId);

      if (error) throw error;
      loadTemplates();
    } catch (error) {
      console.error('Error deleting template:', error);
    }
  }

  function handleEdit(template: MessageTemplate) {
    setEditingTemplate(template);
    setFormData({
      name: template.name,
      content: template.content,
      category: template.category
    });
    setShowForm(true);
  }

  function handleUseTemplate(template: MessageTemplate) {
    if (onSelectTemplate) {
      onSelectTemplate(template.content);
      onClose();
    }
  }

  const categories = [
    { value: 'general', label: 'General' },
    { value: 'greeting', label: 'Saludo' },
    { value: 'follow_up', label: 'Seguimiento' },
    { value: 'closing', label: 'Cierre' },
    { value: 'quote', label: 'Cotización' }
  ];

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        background: 'rgba(0, 0, 0, 0.5)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 2000,
        padding: '20px',
      }}
      onClick={onClose}
    >
      <div
        style={{
          background: 'var(--background)',
          borderRadius: '12px',
          width: '100%',
          maxWidth: '700px',
          maxHeight: '85vh',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          boxShadow: '0 20px 60px rgba(0, 0, 0, 0.3)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div
          style={{
            padding: '20px',
            borderBottom: '1px solid var(--border)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <h2 style={{ fontSize: '18px', fontWeight: 600, color: 'var(--text-primary)', margin: 0 }}>
            Plantillas de Mensajes
          </h2>
          <button
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              fontSize: '24px',
              cursor: 'pointer',
              color: 'var(--text-secondary)',
              padding: '4px 8px',
              lineHeight: 1,
            }}
          >
            ×
          </button>
        </div>

        <div style={{ flex: 1, overflow: 'auto', padding: '20px' }}>
          {!showForm ? (
            <>
              <div style={{ marginBottom: '20px' }}>
                <Button onClick={() => { setShowForm(true); setEditingTemplate(null); }}>
                  + Nueva Plantilla
                </Button>
              </div>

              {loading ? (
                <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-secondary)' }}>
                  Cargando plantillas...
                </div>
              ) : templates.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-secondary)' }}>
                  No hay plantillas disponibles
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  {templates.map((template) => (
                    <div
                      key={template.id}
                      style={{
                        padding: '16px',
                        border: '1px solid var(--border)',
                        borderRadius: '8px',
                        background: 'var(--surface)',
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
                        <div style={{ flex: 1 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                            <h3 style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-primary)', margin: 0 }}>
                              {template.name}
                            </h3>
                            <span
                              style={{
                                fontSize: '10px',
                                padding: '2px 6px',
                                borderRadius: '4px',
                                background: template.is_default ? '#E0F2F1' : '#F3F4F6',
                                color: template.is_default ? '#017E7B' : '#6B7280',
                                fontWeight: 600,
                              }}
                            >
                              {categories.find(c => c.value === template.category)?.label || template.category}
                            </span>
                          </div>
                          <p style={{ fontSize: '13px', color: 'var(--text-secondary)', margin: 0 }}>
                            {template.content}
                          </p>
                        </div>
                      </div>
                      <div style={{ display: 'flex', gap: '8px', marginTop: '12px' }}>
                        <button
                          onClick={() => handleUseTemplate(template)}
                          style={{
                            padding: '6px 12px',
                            fontSize: '13px',
                            background: '#017E7B',
                            color: 'white',
                            border: 'none',
                            borderRadius: '6px',
                            cursor: 'pointer',
                            fontWeight: 500,
                          }}
                        >
                          Usar
                        </button>
                        {!template.is_default && (
                          <>
                            <button
                              onClick={() => handleEdit(template)}
                              style={{
                                padding: '6px 12px',
                                fontSize: '13px',
                                background: 'transparent',
                                color: 'var(--text-secondary)',
                                border: '1px solid var(--border)',
                                borderRadius: '6px',
                                cursor: 'pointer',
                              }}
                            >
                              Editar
                            </button>
                            <button
                              onClick={() => handleDelete(template.id)}
                              style={{
                                padding: '6px 12px',
                                fontSize: '13px',
                                background: 'transparent',
                                color: '#EF4444',
                                border: '1px solid #EF4444',
                                borderRadius: '6px',
                                cursor: 'pointer',
                              }}
                            >
                              Eliminar
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <h3 style={{ fontSize: '16px', fontWeight: 600, color: 'var(--text-primary)', margin: 0 }}>
                {editingTemplate ? 'Editar Plantilla' : 'Nueva Plantilla'}
              </h3>

              <div>
                <label style={{ display: 'block', marginBottom: '8px', fontSize: '14px', fontWeight: 500, color: 'var(--text-primary)' }}>
                  Nombre de la plantilla
                </label>
                <Input
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="Ej: Saludo inicial"
                />
              </div>

              <div>
                <label style={{ display: 'block', marginBottom: '8px', fontSize: '14px', fontWeight: 500, color: 'var(--text-primary)' }}>
                  Categoría
                </label>
                <select
                  value={formData.category}
                  onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    fontSize: '14px',
                    border: '1px solid var(--border)',
                    borderRadius: '8px',
                    background: 'var(--background)',
                    color: 'var(--text-primary)',
                  }}
                >
                  {categories.map(cat => (
                    <option key={cat.value} value={cat.value}>{cat.label}</option>
                  ))}
                </select>
              </div>

              <div>
                <label style={{ display: 'block', marginBottom: '8px', fontSize: '14px', fontWeight: 500, color: 'var(--text-primary)' }}>
                  Contenido del mensaje
                </label>
                <textarea
                  value={formData.content}
                  onChange={(e) => setFormData({ ...formData, content: e.target.value })}
                  placeholder="Escribe el contenido de tu plantilla..."
                  rows={4}
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    fontSize: '14px',
                    border: '1px solid var(--border)',
                    borderRadius: '8px',
                    background: 'var(--background)',
                    color: 'var(--text-primary)',
                    fontFamily: 'inherit',
                    resize: 'vertical',
                  }}
                />
              </div>

              <div style={{ display: 'flex', gap: '12px', marginTop: '8px' }}>
                <Button
                  onClick={handleSave}
                  disabled={!formData.name.trim() || !formData.content.trim()}
                >
                  {editingTemplate ? 'Guardar Cambios' : 'Crear Plantilla'}
                </Button>
                <button
                  onClick={() => {
                    setShowForm(false);
                    setEditingTemplate(null);
                    setFormData({ name: '', content: '', category: 'general' });
                  }}
                  style={{
                    padding: '10px 20px',
                    fontSize: '14px',
                    background: 'transparent',
                    color: 'var(--text-secondary)',
                    border: '1px solid var(--border)',
                    borderRadius: '8px',
                    cursor: 'pointer',
                    fontWeight: 500,
                  }}
                >
                  Cancelar
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
