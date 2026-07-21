import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { Button } from '../ui/Button';

interface Template {
  id: string;
  wazzup_template_id: string;
  name: string;
  language: string;
  category: string;
  status: string;
  components: TemplateComponent[];
}

interface TemplateComponent {
  type: string;
  format?: string;
  text?: string;
  buttons?: Array<{
    type: string;
    text: string;
  }>;
}

interface TemplateSelectorProps {
  onSelect: (templateId: string, variables: Record<string, string>) => void;
  onClose: () => void;
}

export function TemplateSelector({ onSelect, onClose }: TemplateSelectorProps) {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [selectedTemplate, setSelectedTemplate] = useState<Template | null>(null);
  const [variables, setVariables] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadTemplates();
  }, []);

  async function loadTemplates() {
    try {
      const { data, error } = await supabase
        .from('wa_templates')
        .select('*')
        .eq('status', 'APPROVED')
        .order('name');

      if (error) throw error;

      setTemplates(data || []);
    } catch (error) {
      console.error('Error loading templates:', error);
    } finally {
      setLoading(false);
    }
  }

  function extractVariables(template: Template): string[] {
    const vars: string[] = [];

    for (const component of template.components) {
      if (component.text) {
        const matches = component.text.match(/\{\{(\d+)\}\}/g);
        if (matches) {
          matches.forEach(match => {
            const num = match.replace(/\{\{|\}\}/g, '');
            if (!vars.includes(num)) {
              vars.push(num);
            }
          });
        }
      }
    }

    return vars.sort();
  }

  function handleTemplateSelect(template: Template) {
    setSelectedTemplate(template);
    const vars = extractVariables(template);
    const initialVars: Record<string, string> = {};
    vars.forEach(v => initialVars[v] = '');
    setVariables(initialVars);
  }

  function handleSend() {
    if (!selectedTemplate) return;
    onSelect(selectedTemplate.wazzup_template_id, variables);
  }

  function getTemplatePreview(template: Template): string {
    const bodyComponent = template.components.find(c => c.type === 'BODY');
    if (!bodyComponent?.text) return 'Sin vista previa';

    let preview = bodyComponent.text;
    Object.entries(variables).forEach(([key, value]) => {
      preview = preview.replace(`{{${key}}}`, value || `[Var ${key}]`);
    });

    return preview.substring(0, 100) + (preview.length > 100 ? '...' : '');
  }

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
        zIndex: 1000,
        padding: '20px'
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        style={{
          background: 'white',
          borderRadius: '16px',
          maxWidth: '600px',
          width: '100%',
          maxHeight: '80vh',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)'
        }}
      >
        <div
          style={{
            padding: '20px 24px',
            borderBottom: '1px solid #E6E8EF',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center'
          }}
        >
          <h3 style={{ margin: 0, fontSize: '18px', fontWeight: 600, color: '#202856' }}>
            {selectedTemplate ? 'Completar Plantilla' : 'Seleccionar Plantilla'}
          </h3>
          <button
            onClick={onClose}
            style={{
              background: 'transparent',
              border: 'none',
              fontSize: '24px',
              cursor: 'pointer',
              padding: '4px',
              color: '#718096'
            }}
          >
            ✕
          </button>
        </div>

        <div style={{ flex: 1, overflowY: 'auto', padding: '20px 24px' }}>
          {loading ? (
            <div style={{ textAlign: 'center', padding: '40px', color: '#718096' }}>
              Cargando plantillas...
            </div>
          ) : templates.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '40px' }}>
              <div style={{ fontSize: '48px', marginBottom: '16px' }}>📝</div>
              <p style={{ color: '#718096', margin: 0 }}>
                No hay plantillas disponibles. Sincroniza primero.
              </p>
            </div>
          ) : !selectedTemplate ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {templates.map(template => {
                const bodyComponent = template.components.find(c => c.type === 'BODY');
                const preview = bodyComponent?.text?.substring(0, 80) || 'Sin contenido';

                return (
                  <button
                    key={template.id}
                    onClick={() => handleTemplateSelect(template)}
                    style={{
                      padding: '16px',
                      border: '2px solid #E6E8EF',
                      borderRadius: '12px',
                      background: 'white',
                      cursor: 'pointer',
                      textAlign: 'left',
                      transition: 'all 0.2s'
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.borderColor = '#017E7B';
                      e.currentTarget.style.background = '#F9FAFB';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.borderColor = '#E6E8EF';
                      e.currentTarget.style.background = 'white';
                    }}
                  >
                    <div style={{ fontWeight: 600, fontSize: '15px', color: '#202856', marginBottom: '6px' }}>
                      {template.name}
                    </div>
                    <div style={{ fontSize: '13px', color: '#718096', marginBottom: '8px' }}>
                      {preview}
                    </div>
                    <div style={{ display: 'flex', gap: '8px', fontSize: '11px' }}>
                      <span
                        style={{
                          padding: '4px 8px',
                          background: '#E6E8EF',
                          borderRadius: '6px',
                          color: '#202856'
                        }}
                      >
                        {template.category}
                      </span>
                      <span
                        style={{
                          padding: '4px 8px',
                          background: '#E6E8EF',
                          borderRadius: '6px',
                          color: '#202856'
                        }}
                      >
                        {template.language.toUpperCase()}
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
          ) : (
            <div>
              <button
                onClick={() => {
                  setSelectedTemplate(null);
                  setVariables({});
                }}
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: '#017E7B',
                  fontSize: '14px',
                  cursor: 'pointer',
                  marginBottom: '16px',
                  padding: '4px 0',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px'
                }}
              >
                ← Volver a plantillas
              </button>

              <div
                style={{
                  padding: '16px',
                  background: '#F9FAFB',
                  borderRadius: '12px',
                  marginBottom: '20px'
                }}
              >
                <div style={{ fontWeight: 600, fontSize: '15px', color: '#202856', marginBottom: '8px' }}>
                  {selectedTemplate.name}
                </div>
                <div style={{ fontSize: '14px', color: '#718096', lineHeight: '1.6' }}>
                  {getTemplatePreview(selectedTemplate)}
                </div>
              </div>

              {Object.keys(variables).length > 0 && (
                <div>
                  <div style={{ fontWeight: 600, fontSize: '14px', color: '#202856', marginBottom: '12px' }}>
                    Variables de la plantilla:
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    {Object.keys(variables).map(varKey => (
                      <div key={varKey}>
                        <label
                          style={{
                            display: 'block',
                            fontSize: '13px',
                            color: '#718096',
                            marginBottom: '6px',
                            fontWeight: 500
                          }}
                        >
                          Variable {varKey}
                        </label>
                        <input
                          type="text"
                          value={variables[varKey]}
                          onChange={(e) => setVariables({ ...variables, [varKey]: e.target.value })}
                          placeholder={`Valor para {{${varKey}}}`}
                          style={{
                            width: '100%',
                            padding: '10px 12px',
                            border: '2px solid #E6E8EF',
                            borderRadius: '8px',
                            fontSize: '14px',
                            outline: 'none',
                            transition: 'border-color 0.2s'
                          }}
                          onFocus={(e) => e.currentTarget.style.borderColor = '#017E7B'}
                          onBlur={(e) => e.currentTarget.style.borderColor = '#E6E8EF'}
                        />
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {selectedTemplate && (
          <div
            style={{
              padding: '20px 24px',
              borderTop: '1px solid #E6E8EF',
              display: 'flex',
              gap: '12px',
              justifyContent: 'flex-end'
            }}
          >
            <Button
              onClick={() => {
                setSelectedTemplate(null);
                setVariables({});
              }}
              style={{
                background: 'white',
                color: '#718096',
                border: '2px solid #E6E8EF'
              }}
            >
              Cancelar
            </Button>
            <Button
              onClick={handleSend}
              disabled={Object.values(variables).some(v => !v.trim())}
              style={{
                background: Object.values(variables).some(v => !v.trim()) ? '#E6E8EF' : '#65EA1E',
                color: Object.values(variables).some(v => !v.trim()) ? '#718096' : '#202856',
                fontWeight: 600
              }}
            >
              Enviar Plantilla
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
