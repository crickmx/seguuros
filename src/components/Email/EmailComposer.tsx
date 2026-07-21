import React, { useState } from 'react';
import { supabase } from '../../lib/supabase';
import { RichTextEditor } from './RichTextEditor';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';

interface EmailComposerProps {
  entityType: 'prospect' | 'client';
  entityId: string;
  defaultToEmail: string;
  defaultSubject?: string;
  onClose: () => void;
  onSuccess?: () => void;
}

interface Attachment {
  file: File;
  file_name: string;
  file_path?: string;
  mime_type: string;
  file_size: number;
  uploading?: boolean;
  uploaded?: boolean;
}

export function EmailComposer({
  entityType,
  entityId,
  defaultToEmail,
  defaultSubject = '',
  onClose,
  onSuccess,
}: EmailComposerProps) {
  const [toEmail, setToEmail] = useState(defaultToEmail);
  const [ccEmail, setCcEmail] = useState('');
  const [subject, setSubject] = useState(defaultSubject);
  const [bodyHtml, setBodyHtml] = useState('');
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    const newAttachments = files.map(file => ({
      file,
      file_name: file.name,
      mime_type: file.type,
      file_size: file.size,
    }));
    setAttachments(prev => [...prev, ...newAttachments]);
  };

  const removeAttachment = (index: number) => {
    setAttachments(prev => prev.filter((_, i) => i !== index));
  };

  const uploadAttachments = async (): Promise<Attachment[]> => {
    const uploadedAttachments: Attachment[] = [];

    for (const attachment of attachments) {
      const timestamp = Date.now();
      const uuid = crypto.randomUUID();
      const filePath = `emails/${entityType}/${entityId}/${timestamp}_${uuid}_${attachment.file_name}`;

      const { error: uploadError } = await supabase.storage
        .from('email-attachments')
        .upload(filePath, attachment.file);

      if (uploadError) {
        throw new Error(`Error al subir ${attachment.file_name}: ${uploadError.message}`);
      }

      uploadedAttachments.push({
        ...attachment,
        file_path: filePath,
      });
    }

    return uploadedAttachments;
  };

  const handleSend = async () => {
    if (!toEmail || !subject || !bodyHtml.trim()) {
      setError('Por favor completa todos los campos requeridos');
      return;
    }

    setSending(true);
    setError(null);

    try {
      let uploadedAttachments: Attachment[] = [];

      if (attachments.length > 0) {
        uploadedAttachments = await uploadAttachments();
      }

      const { data: sessionData, error: sessionError } = await supabase.auth.getSession();

      console.log('Session check:', {
        hasSession: !!sessionData.session,
        error: sessionError,
        tokenLength: sessionData.session?.access_token?.length
      });

      if (!sessionData.session) {
        throw new Error('No hay sesión activa');
      }

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/send-crm-email`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${sessionData.session.access_token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            entity_type: entityType,
            entity_id: entityId,
            to_email: toEmail,
            cc_email: ccEmail || undefined,
            subject,
            body_html: bodyHtml,
            attachments: uploadedAttachments.map(att => ({
              file_name: att.file_name,
              file_path: att.file_path!,
              mime_type: att.mime_type,
              file_size: att.file_size,
            })),
          }),
        }
      );

      console.log('Response status:', response.status);
      console.log('Response headers:', Object.fromEntries(response.headers.entries()));

      let result;
      try {
        result = await response.json();
        console.log('Response body:', result);
      } catch (e) {
        const text = await response.text();
        console.error('Failed to parse JSON response:', text);
        throw new Error(`Error del servidor (${response.status}): ${text}`);
      }

      if (!response.ok || !result.success) {
        throw new Error(result.error || `Error al enviar el correo (${response.status})`);
      }

      onSuccess?.();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al enviar el correo');
    } finally {
      setSending(false);
    }
  };

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
      padding: '1rem',
      zIndex: 1000,
    }}>
      <div style={{
        background: '#FFFFFF',
        borderRadius: '12px',
        width: '100%',
        maxWidth: '800px',
        maxHeight: '90vh',
        overflow: 'auto',
        boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
      }}>
        <div style={{
          padding: '1.5rem',
          borderBottom: '1px solid #E6E8EF',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}>
          <h2 style={{
            fontSize: '1.25rem',
            fontWeight: 600,
            color: '#202856',
            margin: 0,
          }}>
            Enviar correo
          </h2>
          <button
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              fontSize: '1.5rem',
              color: '#718096',
              cursor: 'pointer',
              padding: '0.25rem',
              lineHeight: 1,
            }}
          >
            ×
          </button>
        </div>

        <div style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {error && (
            <div style={{
              padding: '0.75rem 1rem',
              background: '#FEE2E2',
              color: '#991B1B',
              borderRadius: '8px',
              fontSize: '0.875rem',
            }}>
              {error}
            </div>
          )}

          <div>
            <label style={{
              display: 'block',
              fontSize: '0.875rem',
              fontWeight: 500,
              color: '#202856',
              marginBottom: '0.5rem',
            }}>
              Para <span style={{ color: '#EF4444' }}>*</span>
            </label>
            <Input
              type="email"
              value={toEmail}
              onChange={(e) => setToEmail(e.target.value)}
              placeholder="destinatario@ejemplo.com"
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
              CC
            </label>
            <Input
              type="email"
              value={ccEmail}
              onChange={(e) => setCcEmail(e.target.value)}
              placeholder="opcional@ejemplo.com"
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
              Asunto <span style={{ color: '#EF4444' }}>*</span>
            </label>
            <Input
              type="text"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="Asunto del correo"
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
              Mensaje <span style={{ color: '#EF4444' }}>*</span>
            </label>
            <RichTextEditor
              value={bodyHtml}
              onChange={setBodyHtml}
              placeholder="Escribe tu mensaje aquí..."
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
              Adjuntos
            </label>
            <input
              type="file"
              multiple
              onChange={handleFileSelect}
              style={{ display: 'none' }}
              id="file-upload"
              accept=".pdf,.doc,.docx,.xls,.xlsx,.jpg,.jpeg,.png,.gif,.webp,.txt,.csv"
            />
            <label
              htmlFor="file-upload"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.5rem',
                padding: '0.5rem 1rem',
                background: '#F3F4F6',
                border: '1px solid #E6E8EF',
                borderRadius: '6px',
                fontSize: '0.875rem',
                color: '#202856',
                cursor: 'pointer',
                transition: 'all 0.2s',
              }}
            >
              📎 Adjuntar archivo
            </label>

            {attachments.length > 0 && (
              <div style={{ marginTop: '0.75rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                {attachments.map((att, idx) => (
                  <div
                    key={idx}
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      padding: '0.5rem 0.75rem',
                      background: '#F9FAFB',
                      borderRadius: '6px',
                      fontSize: '0.875rem',
                    }}
                  >
                    <span style={{ color: '#202856' }}>
                      {att.file_name} ({(att.file_size / 1024).toFixed(1)} KB)
                    </span>
                    <button
                      type="button"
                      onClick={() => removeAttachment(idx)}
                      style={{
                        background: 'none',
                        border: 'none',
                        color: '#EF4444',
                        cursor: 'pointer',
                        fontSize: '1.25rem',
                        lineHeight: 1,
                        padding: '0 0.25rem',
                      }}
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div style={{
          padding: '1.5rem',
          borderTop: '1px solid #E6E8EF',
          display: 'flex',
          justifyContent: 'flex-end',
          gap: '0.75rem',
        }}>
          <Button
            variant="secondary"
            onClick={onClose}
            disabled={sending}
          >
            Cancelar
          </Button>
          <Button
            variant="primary"
            onClick={handleSend}
            disabled={sending}
          >
            {sending ? 'Enviando...' : 'Enviar correo'}
          </Button>
        </div>
      </div>
    </div>
  );
}