# Configuración de Wazzup24

## 🚀 INICIO RÁPIDO

1. **Sincroniza tu canal de WhatsApp** (abre esta URL en tu navegador):
   ```
   https://fjvzzlmnzawtqohxnrib.supabase.co/functions/v1/wazzup-sync-channels
   ```
   ✅ Deberías ver: `{"success":true,"primaryChannel":{...}}`

2. **Inicia sesión en la aplicación**

3. **Ve al Inbox de WhatsApp**

4. **Crea una nueva conversación** con un número de teléfono (formato: 525512345678 o 5512345678)

5. **Envía tu primer mensaje**

---

## ESTADO ACTUAL: Envío Activo + Recepción Manual ⚠️

El sistema está completamente funcional para **ENVÍO** de mensajes. Para **RECIBIR** mensajes automáticamente, necesitas configurar el webhook manualmente en Wazzup24.

### ✅ Lo que funciona:
- Envío de mensajes de texto desde la aplicación
- Envío de archivos multimedia (imágenes, videos, documentos)
- Envío de templates de WhatsApp
- Ver historial de mensajes enviados
- Crear y gestionar conversaciones
- Sincronización manual de mensajes de una conversación
- Webhook funcionando y listo para recibir mensajes

### ⚙️ Configuración necesaria:
- Configurar el webhook manualmente en tu dashboard de Wazzup24

### 🔧 Cómo habilitar recepción automática:

**Opción 1: Usar la interfaz de administración (RECOMENDADO)**
1. Inicia sesión como administrador
2. Ve a **Configuración** en el menú lateral
3. En la sección "Configuración de Webhook WhatsApp":
   - Copia la URL del webhook
   - Haz clic en "Probar Webhook" para verificar que funciona
4. Ve a tu [dashboard de Wazzup24](https://wazzup24.com)
5. Busca la sección de **Webhooks** o **API Settings**
6. Pega la URL del webhook
7. Guarda la configuración
8. Envía un mensaje de prueba desde WhatsApp para verificar

**Opción 2: Configuración manual**
1. El webhook que necesitas configurar es: `https://fjvzzlmnzawtqohxnrib.supabase.co/functions/v1/wazzup-webhook`
2. Configúralo en tu dashboard de Wazzup24
3. Formatos soportados: todos los números usan +521 para México

## 1. Configuración del Canal

Tu canal de WhatsApp está configurado con:
- **Channel ID**: Se obtiene automáticamente al sincronizar canales
- **Plain ID (número)**: 5214429253333
- **Estado**: Activo

Para sincronizar canales disponibles, ejecuta:
```
https://fjvzzlmnzawtqohxnrib.supabase.co/functions/v1/wazzup-sync-channels
```

## 2. Formato de Números de Teléfono

**IMPORTANTE**: El sistema ahora usa EXCLUSIVAMENTE el formato **+521** para todos los números de celular mexicanos.

### Formato actual (2026):
- **Celulares mexicanos**: SIEMPRE `+521` + 10 dígitos
  - Ejemplo: `+5215512345678` (13 dígitos totales)
  - Ejemplo: `+5215520206922` (13 dígitos totales)

### El sistema acepta y convierte automáticamente:
- **10 dígitos**: `5512345678` → `+5215512345678`
- **12 dígitos con +52**: `+525512345678` → `+5215512345678`
- **12 dígitos sin +**: `525512345678` → `+5215512345678`
- **13 dígitos con +521**: `+5215512345678` → `+5215512345678` (sin cambios)

### Ejemplos válidos:
- ✅ `5512345678` → se convierte a `+5215512345678`
- ✅ `+525512345678` → se convierte a `+5215512345678`
- ✅ `+5215512345678` → formato correcto, sin cambios
- ✅ `55 1234 5678` → se limpia y convierte a `+5215512345678`

**Nota**: El sistema automáticamente:
- Elimina espacios, guiones y caracteres especiales
- Convierte todos los números a formato +521
- Actualiza números existentes al formato correcto

## 3. Revisar Logs

### Logs de Envío de Mensajes:
1. Ve a Supabase Edge Functions logs: https://fjvzzlmnzawtqohxnrib.supabase.co/project/fjvzzlmnzawtqohxnrib/logs/edge-functions
2. Filtra por función: `wazzup-send-message`
3. Busca:
   - "=== SENDING MESSAGE ===" - Indica que se está enviando
   - "Formatted chatId:" - debe terminar en `@c.us`
   - "Wazzup API response" - Muestra la respuesta de Wazzup24
   - Status 200/201 = éxito, 400/500 = error

## 4. Prueba el Sistema

### Enviar Mensajes:
1. Inicia sesión en el sistema
2. Ve a **Inbox de WhatsApp**
3. Haz clic en "Nueva Conversación"
4. Ingresa un número de teléfono (formato: 525512345678 o simplemente 5512345678)
5. Escribe un mensaje y presiona "Enviar"
6. Verifica en los logs que el mensaje se envió correctamente
7. Confirma que el mensaje llegó al destinatario en WhatsApp

**NOTA**: La recepción automática de mensajes NO está disponible actualmente.

## 5. Solución de Problemas

### Los mensajes no llegan al destinatario:

1. **Verifica el formato del número**:
   - Formato aceptado: `525512345678` (12 dígitos) o `5215512345678` (13 dígitos) o simplemente `5512345678` (10 dígitos)
   - El sistema normaliza automáticamente el número y agrega `@c.us` al chatId

2. **Revisa los logs** en: https://fjvzzlmnzawtqohxnrib.supabase.co/project/fjvzzlmnzawtqohxnrib/logs/edge-functions
   - Filtra por función: `wazzup-send-message`
   - Busca "Formatted chatId:" - debe terminar en `@c.us` (ej: `525512345678@c.us`)
   - Busca "Wazzup API response" - debe mostrar status 200 o 201 si fue exitoso
   - Si hay error, revisa el mensaje de error de Wazzup24

3. **Verifica tu cuenta de Wazzup24**:
   - Confirma que el canal esté activo
   - Verifica que tengas créditos disponibles
   - Asegúrate de que el número del destinatario tenga WhatsApp activo

### Errores 401 (No autorizado):
- Verifica que `WAZZUP_API_KEY` esté configurada correctamente en Supabase
- Confirma que la API key sea válida en tu cuenta de Wazzup24
- Prueba regenerando tu API key en Wazzup24

### Error 404 o "Channel not found":
- Ejecuta la sincronización de canales:
  ```
  https://fjvzzlmnzawtqohxnrib.supabase.co/functions/v1/wazzup-sync-channels
  ```
- Verifica que el canal aparezca en la tabla `whatsapp_channels` de la base de datos

### Para depurar en tiempo real:
1. Abre los logs de Edge Functions
2. Filtra por función: `wazzup-send-message`
3. Mantén los logs abiertos mientras envías mensajes
4. Verás todos los detalles de cada operación

## 6. URLs Importantes

- **Panel de Wazzup24**: https://wazzup24.com
- **Documentación API**: https://wazzup24.com/help/api-en/
- **Supabase Dashboard**: https://fjvzzlmnzawtqohxnrib.supabase.co
- **Edge Functions Logs**: https://fjvzzlmnzawtqohxnrib.supabase.co/project/fjvzzlmnzawtqohxnrib/logs/edge-functions

## 7. Funciones Disponibles

### Enviar Mensaje
```
POST https://fjvzzlmnzawtqohxnrib.supabase.co/functions/v1/wazzup-send-message
```

### Sincronizar Canales
```
https://fjvzzlmnzawtqohxnrib.supabase.co/functions/v1/wazzup-sync-channels
```

### Sincronizar Templates
```
https://fjvzzlmnzawtqohxnrib.supabase.co/functions/v1/wazzup-sync-templates
```

### Sincronizar Mensajes de una Conversación
```
POST https://fjvzzlmnzawtqohxnrib.supabase.co/functions/v1/wazzup-sync-messages
Body: { "channelId": "...", "chatId": "..." }
```
