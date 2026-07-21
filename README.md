# Seguuros.com - Plataforma InsurTech

Aplicación web para gestión de seguros con CRM para ejecutivos y cartera digital para clientes.

## Características

### Para Administradores
- Gestión completa de usuarios
- Dashboard con métricas clave
- Creación de cuentas para ejecutivos y clientes
- Vista general de prospectos, clientes y pólizas

### Para Ejecutivos (CRM)
- Gestión de prospectos con seguimiento detallado
- Conversión de prospectos a clientes
- Gestión de clientes asignados
- Creación y seguimiento de pólizas
- Sistema de notas y comentarios
- Integración con WhatsApp

### Para Clientes
- Cartera digital de seguros
- Vista clara de todas las pólizas
- Alertas visuales de pagos próximos
- Alertas de renovaciones
- Acceso directo al ejecutivo asignado
- Interfaz mobile-first

## Tecnologías

- React + TypeScript
- Vite
- Supabase (Base de datos + Autenticación)
- CSS inline (no dependencias adicionales)

## Configuración Inicial

### 1. Crear Usuario Administrador

Para empezar a usar la aplicación, primero necesitas crear un usuario administrador en Supabase.

#### Opción A: Desde Supabase Dashboard

1. Ve a tu proyecto en Supabase Dashboard
2. Navega a Authentication > Users
3. Crea un nuevo usuario con:
   - Email: tu-email@ejemplo.com
   - Password: tu-contraseña-segura
4. Copia el User ID del usuario creado
5. Ve a SQL Editor y ejecuta:

```sql
INSERT INTO profiles (id, email, full_name, phone, role)
VALUES ('USER_ID_AQUI', 'tu-email@ejemplo.com', 'Tu Nombre', '+52123456789', 'admin');
```

#### Opción B: Registro desde la App

1. Abre la aplicación
2. Regístrate con un email y contraseña
3. Ve a Supabase Dashboard > Table Editor > profiles
4. Encuentra tu usuario y cambia el campo `role` de `'cliente'` a `'admin'`

### 2. Crear Usuarios Ejecutivos

Una vez que tengas acceso como admin:

1. Inicia sesión con tu cuenta de administrador
2. En el dashboard, haz clic en "Crear Usuario"
3. Completa el formulario:
   - Nombre completo
   - Correo electrónico
   - Contraseña
   - Teléfono
   - Rol: Ejecutivo
4. El ejecutivo podrá iniciar sesión con esas credenciales

### 3. Crear Clientes

Los ejecutivos pueden crear clientes de dos formas:

#### Opción A: Convertir Prospecto
1. Crear un prospecto con email válido
2. Hacer seguimiento hasta cerrar la venta
3. Usar el botón "Convertir en cliente"
4. El sistema crea automáticamente la cuenta

#### Opción B: Creación directa por Admin
1. El admin puede crear directamente usuarios con rol "Cliente"
2. Asignar un ejecutivo responsable

## Flujo de Trabajo

### Ejecutivo

1. **Crear Prospecto**
   - Agregar información de contacto
   - Registrar producto de interés
   - Anotar origen del lead

2. **Seguimiento**
   - Actualizar estatus del prospecto
   - Agregar notas de seguimiento
   - Contactar vía WhatsApp

3. **Conversión**
   - Convertir prospecto en cliente cuando se cierra la venta
   - Se conserva todo el historial

4. **Gestión de Pólizas**
   - Agregar pólizas al cliente
   - Sistema calcula automáticamente fechas de pago
   - Seguimiento de renovaciones

### Cliente

1. **Login**
   - Iniciar sesión con credenciales

2. **Vista de Cartera**
   - Ver todas las pólizas activas
   - Alertas visuales de pagos próximos
   - Alertas de renovaciones

3. **Detalles de Póliza**
   - Ver información completa
   - Descargar PDF (si está disponible)
   - Contactar ejecutivo directamente

## Desarrollo

```bash
npm install
npm run dev
```

## Build

```bash
npm run build
```

## Base de Datos

La aplicación utiliza Supabase con las siguientes tablas:

- `profiles`: Usuarios extendidos con roles
- `prospects`: Prospectos del CRM
- `notes`: Notas y seguimiento
- `policies`: Pólizas de seguros

Todas las tablas tienen Row Level Security (RLS) configurado para garantizar que cada usuario solo acceda a sus datos autorizados.

## Seguridad

- Autenticación mediante Supabase Auth
- Row Level Security en todas las tablas
- Roles: admin, ejecutivo, cliente
- Permisos específicos por rol
- Los clientes solo ven sus propias pólizas
- Los ejecutivos solo ven sus prospectos y clientes asignados
- Los administradores tienen acceso total

## Próximas Funcionalidades (Post-MVP)

- Pagos en línea
- Firma digital de documentos
- Gestión de siniestros
- IA explicando pólizas en lenguaje simple
- Notificaciones por email/SMS
- Reportes y analytics avanzados
