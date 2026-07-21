import { useState, useRef } from 'react';
import { supabase } from '../../lib/supabase';
import type { WhatsAppConversation } from '../../types/whatsapp';
import { Button } from '../ui/Button';
import { EmojiPicker } from './EmojiPicker';
import { TemplateSelector } from './TemplateSelector';
import { TemplateManager } from './TemplateManager';

interface MessageComposerProps {
  conversation: WhatsAppConversation;
  onMessageSent: () => void;
}

export function MessageComposer({ conversation, onMessageSent }: MessageComposerProps) {
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [showTemplateSelector, setShowTemplateSelector] = useState(false);
  const [showTemplateManager, setShowTemplateManager] = useState(false);
  const [uploadingFile, setUploadingFile] = useState(false);
  const [filePreview, setFilePreview] = useState<{ file: File; url: string } | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  function handleEmojiSelect(emoji: string) {
    const textarea = textareaRef.current;
    if (!textarea) return;

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const newMessage = message.substring(0, start) + emoji + message.substring(end);

    setMessage(newMessage);

    setTimeout(() => {
      textarea.focus();
      const newCursorPos = start + emoji.length;
      textarea.setSelectionRange(newCursorPos, newCursorPos);
    }, 0);
  }

  async function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 16 * 1024 * 1024) {
      alert('El archivo es muy grande. Máximo 16MB');
      return;
    }

    const url = URL.createObjectURL(file);
    setFilePreview({ file, url });
  }

  function clearFilePreview() {
    if (filePreview?.url) {
      URL.revokeObjectURL(filePreview.url);
    }
    setFilePreview(null);
  }

  async function handleSend() {
    if ((!message.trim() && !filePreview) || sending) return;

    setSending(true);
    setUploadingFile(true);
    try {
      let storagePath: string | undefined;
      let mediaUrl: string | undefined;
      let mediaType = 'text';

      if (filePreview) {
        const fileExt = filePreview.file.name.split('.').pop()?.toLowerCase() || '';
        const timestamp = Date.now();
        const randomId = Math.random().toString(36).substring(2, 15);
        const fileName = `${timestamp}_${randomId}${fileExt ? '.' + fileExt : ''}`;
        storagePath = `${conversation.channel_id}/${conversation.contact_plain}/${fileName}`;

        const { error: uploadError } = await supabase.storage
          .from('whatsapp-media')
          .upload(storagePath, filePreview.file, {
            contentType: filePreview.file.type,
            cacheControl: '3600',
            upsert: false
          });

        if (uploadError) {
          throw new Error(`Error al subir archivo: ${uploadError.message}`);
        }

        const { data: urlData } = await supabase.storage
          .from('whatsapp-media')
          .createSignedUrl(storagePath, 3600);

        if (!urlData?.signedUrl) {
          throw new Error('Error al generar URL del archivo');
        }

        mediaUrl = urlData.signedUrl;

        if (filePreview.file.type.startsWith('image/')) {
          mediaType = 'image';
        } else if (filePreview.file.type.startsWith('video/')) {
          mediaType = 'video';
        } else if (filePreview.file.type.startsWith('audio/')) {
          mediaType = 'audio';
        } else {
          mediaType = 'document';
        }
      }

      const { data: { session } } = await supabase.auth.getSession();

      if (!session?.access_token) {
        alert('Tu sesión ha expirado. Por favor, recarga la página e inicia sesión nuevamente.');
        window.location.reload();
        return;
      }

      console.log('Session details:', {
        hasSession: !!session,
        hasAccessToken: !!session.access_token,
        tokenLength: session.access_token.length,
        tokenPreview: session.access_token.substring(0, 20) + '...',
        expiresAt: session.expires_at,
        now: Math.floor(Date.now() / 1000)
      });

      const apiUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/wazzup-send-message`;

      const rawResponse = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          conversation_id: conversation.id,
          text: message.trim() || undefined,
          media_url: mediaUrl,
          media_type: mediaType,
          storage_path: storagePath,
          mode: filePreview ? 'media' : 'text'
        })
      });

      const responseBody = await rawResponse.text();
      console.log('Raw response status:', rawResponse.status);
      console.log('Raw response body:', responseBody);

      if (!rawResponse.ok) {
        let errorDetails = responseBody;
        try {
          const errorJson = JSON.parse(responseBody);
          errorDetails = JSON.stringify(errorJson, null, 2);
          console.error('Parsed error details:', errorJson);
        } catch {
          console.error('Could not parse error as JSON');
        }

        if (rawResponse.status === 401) {
          alert('Tu sesión ha expirado. Por favor, recarga la página e inicia sesión nuevamente.');
          window.location.reload();
          return;
        }
        throw new Error(`Error ${rawResponse.status}: ${errorDetails}`);
      }

      setMessage('');
      clearFilePreview();
      onMessageSent();
    } catch (error) {
      console.error('Error sending message:', error);
      alert('Error al enviar el mensaje: ' + (error as Error).message);
    } finally {
      setSending(false);
      setUploadingFile(false);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }

  async function handleTemplateSend(templateId: string, variables: Record<string, string>) {
    setSending(true);
    try {
      const templateValues = Object.entries(variables).map(([parameter, value]) => ({
        parameter,
        value
      }));

      const { error } = await supabase.functions.invoke('wazzup-send-message', {
        body: {
          conversation_id: conversation.id,
          mode: 'template',
          templateId,
          templateValues
        }
      });

      if (error) {
        if (error.message?.includes('Unauthorized') || error.message?.includes('401')) {
          alert('Tu sesión ha expirado. Por favor, recarga la página e inicia sesión nuevamente.');
          window.location.reload();
          return;
        }
        throw new Error(error.message || 'Error al enviar plantilla');
      }

      setShowTemplateSelector(false);
      onMessageSent();
    } catch (error) {
      console.error('Error sending template:', error);
      alert('Error al enviar la plantilla: ' + (error as Error).message);
    } finally {
      setSending(false);
    }
  }

  return (
    <div style={{ position: 'relative' }}>
      {filePreview && (
        <div style={{
          padding: '16px 20px',
          borderTop: '1px solid #E6E8EF',
          background: '#F9FAFB',
          display: 'flex',
          alignItems: 'center',
          gap: '12px'
        }}>
          {filePreview.file.type.startsWith('image/') ? (
            <img src={filePreview.url} alt="Preview" style={{ width: '80px', height: '80px', objectFit: 'cover', borderRadius: '8px' }} />
          ) : (
            <div style={{ padding: '16px', background: 'white', borderRadius: '8px', border: '1px solid #E6E8EF' }}>
              <span style={{ fontSize: '32px' }}>
                {filePreview.file.type.startsWith('video/') ? '🎥' :
                 filePreview.file.type.startsWith('audio/') ? '🎵' : '📄'}
              </span>
            </div>
          )}
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 600, fontSize: '14px', color: '#202856' }}>
              {filePreview.file.name}
            </div>
            <div style={{ fontSize: '12px', color: '#718096', marginTop: '2px' }}>
              {(filePreview.file.size / 1024 / 1024).toFixed(2)} MB
            </div>
          </div>
          <button
            onClick={clearFilePreview}
            style={{
              padding: '8px',
              background: 'white',
              border: '1px solid #E6E8EF',
              borderRadius: '8px',
              cursor: 'pointer',
              fontSize: '18px'
            }}
          >
            ✕
          </button>
        </div>
      )}

      <div style={{
        padding: '16px 20px',
        borderTop: '2px solid #E6E8EF',
        background: 'white',
        display: 'flex',
        gap: '12px',
        alignItems: 'flex-end'
      }}>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          <label>
            <input
              type="file"
              accept="image/*,video/*,audio/*,.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx"
              onChange={handleFileSelect}
              disabled={sending}
              style={{ display: 'none' }}
            />
            <button
              type="button"
              disabled={sending}
              onClick={(e) => {
                e.preventDefault();
                (e.currentTarget.previousElementSibling as HTMLInputElement)?.click();
              }}
              style={{
                padding: '10px',
                background: 'transparent',
                border: 'none',
                cursor: sending ? 'not-allowed' : 'pointer',
                fontSize: '24px',
                display: 'flex',
                alignItems: 'center'
              }}
              title="Adjuntar archivo"
            >
              📎
            </button>
          </label>

          <button
            onClick={() => setShowEmojiPicker(!showEmojiPicker)}
            disabled={sending}
            style={{
              padding: '10px',
              background: 'transparent',
              border: 'none',
              cursor: sending ? 'not-allowed' : 'pointer',
              fontSize: '24px',
              display: 'flex',
              alignItems: 'center'
            }}
            title="Emojis"
          >
            😊
          </button>

          <button
            onClick={() => setShowTemplateManager(true)}
            disabled={sending}
            style={{
              padding: '10px',
              background: 'transparent',
              border: 'none',
              cursor: sending ? 'not-allowed' : 'pointer',
              fontSize: '24px',
              display: 'flex',
              alignItems: 'center'
            }}
            title="Plantillas de mensajes"
          >
            📋
          </button>
        </div>

        <textarea
          ref={textareaRef}
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Escribe un mensaje..."
          disabled={sending}
          rows={1}
          style={{
            flex: 1,
            padding: '12px 16px',
            border: '2px solid #E6E8EF',
            borderRadius: '12px',
            fontSize: '14px',
            fontFamily: 'inherit',
            resize: 'none',
            minHeight: '44px',
            maxHeight: '120px',
            outline: 'none',
            transition: 'border-color 0.2s ease'
          }}
          onFocus={(e) => {
            e.currentTarget.style.borderColor = '#017E7B';
          }}
          onBlur={(e) => {
            e.currentTarget.style.borderColor = '#E6E8EF';
          }}
        />
        <Button
          onClick={handleSend}
          disabled={(!message.trim() && !filePreview) || sending}
          style={{
            background: (message.trim() || filePreview) && !sending ? '#65EA1E' : '#E6E8EF',
            color: (message.trim() || filePreview) && !sending ? '#202856' : '#718096',
            padding: '12px 24px',
            fontWeight: 600,
            minWidth: '80px',
            height: '44px'
          }}
        >
          {sending ? uploadingFile ? '📤...' : '...' : 'Enviar'}
        </Button>
      </div>

      {showEmojiPicker && (
        <EmojiPicker
          onSelect={(emoji) => {
            handleEmojiSelect(emoji);
            setShowEmojiPicker(false);
          }}
          onClose={() => setShowEmojiPicker(false)}
        />
      )}

      {showTemplateSelector && (
        <TemplateSelector
          onSelect={handleTemplateSend}
          onClose={() => setShowTemplateSelector(false)}
        />
      )}

      {showTemplateManager && (
        <TemplateManager
          onSelectTemplate={(content) => {
            setMessage(content);
            textareaRef.current?.focus();
          }}
          onClose={() => setShowTemplateManager(false)}
        />
      )}
    </div>
  );
}
