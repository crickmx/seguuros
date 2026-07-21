import { useState } from 'react';
import { Button } from './ui/Button';
import { Card } from './ui/Card';
import { supabase } from '../lib/supabase';

export function WebhookConfig() {
  const [configuring, setConfiguring] = useState(false);
  const [testing, setTesting] = useState(false);
  const [result, setResult] = useState<{ type: 'success' | 'error' | 'info'; message: string } | null>(null);

  const webhookUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/wazzup-webhook`;

  async function handleConfigureWebhook() {
    setConfiguring(true);
    setResult(null);
    try {
      const { data: { session } } = await supabase.auth.getSession();

      if (!session) {
        throw new Error('No hay sesión activa');
      }

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/wazzup-configure-webhook`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${session.access_token}`,
            'Content-Type': 'application/json',
          },
        }
      );

      await response.json();

      if (!response.ok) {
        setResult({
          type: 'info',
          message: 'La configuración automática no está disponible. Debes configurar el webhook manualmente en el dashboard de Wazzup24.'
        });
      } else {
        setResult({
          type: 'success',
          message: 'Webhook configurado correctamente.'
        });
      }
    } catch (error: any) {
      console.error('Configure webhook error:', error);
      setResult({
        type: 'error',
        message: error.message || 'Error al configurar webhook'
      });
    } finally {
      setConfiguring(false);
    }
  }

  async function handleTestWebhook() {
    setTesting(true);
    setResult(null);
    try {
      const response = await fetch(webhookUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          test: true,
          messages: []
        })
      });

      await response.json();

      if (!response.ok) {
        throw new Error('El webhook no responde correctamente');
      }

      setResult({
        type: 'success',
        message: 'El webhook está funcionando correctamente y recibe peticiones.'
      });
    } catch (error: any) {
      console.error('Test webhook error:', error);
      setResult({
        type: 'error',
        message: error.message || 'Error al probar webhook'
      });
    } finally {
      setTesting(false);
    }
  }

  function copyToClipboard() {
    navigator.clipboard.writeText(webhookUrl);
    setResult({
      type: 'success',
      message: 'URL copiada al portapapeles'
    });
    setTimeout(() => setResult(null), 3000);
  }

  return (
    <Card>
      <h3 style={{ fontSize: '1.125rem', fontWeight: 600, marginBottom: '1rem', color: '#202856' }}>
        Configuración de Webhook WhatsApp
      </h3>
      <p style={{ fontSize: '0.9375rem', color: '#718096', marginBottom: '1.5rem' }}>
        Para recibir mensajes automáticamente, configura el webhook en tu dashboard de Wazzup24.
      </p>

      {result && (
        <div
          style={{
            padding: '12px 16px',
            borderRadius: '10px',
            marginBottom: '1rem',
            background: result.type === 'success' ? '#D1FAE5' : result.type === 'error' ? '#FEE2E2' : '#DBEAFE',
            border: `1px solid ${result.type === 'success' ? '#65EA1E' : result.type === 'error' ? '#EF4444' : '#3B82F6'}`,
            color: result.type === 'success' ? '#065F46' : result.type === 'error' ? '#991B1B' : '#1E40AF',
            fontSize: '0.875rem',
            fontWeight: 500
          }}
        >
          {result.message}
        </div>
      )}

      <div style={{
        background: '#F7F8FC',
        padding: '16px',
        borderRadius: '10px',
        marginBottom: '1.5rem'
      }}>
        <label style={{
          display: 'block',
          fontSize: '0.8125rem',
          fontWeight: 600,
          marginBottom: '8px',
          color: '#202856'
        }}>
          URL del Webhook:
        </label>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
          <input
            type="text"
            value={webhookUrl}
            readOnly
            style={{
              flex: 1,
              minWidth: '250px',
              padding: '10px 12px',
              border: '1px solid #E6E8EF',
              borderRadius: '8px',
              fontSize: '0.875rem',
              fontFamily: 'monospace',
              background: '#FFFFFF',
              color: '#202856'
            }}
          />
          <Button onClick={copyToClipboard} variant="secondary" style={{ whiteSpace: 'nowrap' }}>
            Copiar
          </Button>
        </div>
      </div>

      <div style={{
        background: '#FEF3C7',
        border: '1px solid #F59E0B',
        borderRadius: '10px',
        padding: '16px',
        marginBottom: '1.5rem',
        fontSize: '0.875rem',
        color: '#92400E'
      }}>
        <strong style={{ display: 'block', marginBottom: '8px' }}>Como configurar el webhook:</strong>
        <ol style={{ marginLeft: '1.25rem', display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <li>Inicia sesión en tu cuenta de <a href="https://wazzup24.com" target="_blank" rel="noopener noreferrer" style={{ color: '#017E7B', fontWeight: 600, textDecoration: 'underline' }}>Wazzup24</a></li>
          <li>Ve a la sección de <strong>Configuración</strong> o <strong>API Settings</strong></li>
          <li>Busca la opción de <strong>Webhooks</strong> o <strong>Notificaciones</strong></li>
          <li>Pega la URL del webhook mostrada arriba</li>
          <li>Guarda la configuración</li>
          <li>Prueba el webhook usando el botón de abajo</li>
        </ol>
      </div>

      <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
        <Button
          onClick={handleConfigureWebhook}
          disabled={configuring || testing}
          variant="primary"
        >
          {configuring ? 'Configurando...' : 'Intentar Configuración Automática'}
        </Button>
        <Button
          onClick={handleTestWebhook}
          disabled={configuring || testing}
          variant="secondary"
        >
          {testing ? 'Probando...' : 'Probar Webhook'}
        </Button>
      </div>

      <div style={{
        marginTop: '1.5rem',
        padding: '16px',
        background: '#DBEAFE',
        border: '1px solid #3B82F6',
        borderRadius: '10px',
        fontSize: '0.8125rem',
        color: '#1E40AF'
      }}>
        <strong style={{ display: 'block', marginBottom: '8px' }}>Estado actual:</strong>
        <p style={{ marginBottom: '8px' }}>
          Puedes ENVIAR mensajes desde la plataforma.
        </p>
        <p style={{ marginBottom: '8px' }}>
          Para RECIBIR mensajes automáticamente, necesitas configurar el webhook manualmente en Wazzup24.
        </p>
        <p>
          Si tienes problemas, contacta al soporte de Wazzup24 y proporciona la URL del webhook.
        </p>
      </div>
    </Card>
  );
}
