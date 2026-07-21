# Deploy en Plesk: app.seguuros.com

**Objetivo:** desplegar este repo (`crickmx/seguuros`, rama `main`) en Plesk,
apuntando el subdominio `app.seguuros.com`, con Supabase como único backend
(sin Bolt, sin Netlify).

**Backend Supabase:** proyecto "APP Seguuros" — `fjvzzlmnzawtqohxnrib`
(las 36 migraciones del repo ya coinciden 1:1 con lo corrido ahí, no falta nada).

---

## PASO 1 — DNS en IONOS

En tu cuenta IONOS → Dominios → `seguuros.com` → DNS:

1. Agrega un registro **A**
   - Host: `app`
   - Valor: la IP del servidor Plesk (la misma que usa `movi.digital` —
     en Plesk: Dominios → `movi.digital` → "Hosting & DNS" → ahí aparece la IP)
2. Guarda

No hace falta cambiar nameservers, solo agregar ese registro A.

---

## PASO 2 — Dominio/subdominio en Plesk

**Si `seguuros.com` NO aparece en la lista de Dominios de Plesk:**
1. Plesk → "Dominios" → "Agregar dominio"
2. Nombre: `seguuros.com`
3. Document root: déjalo en la carpeta que Plesk proponga (la vamos a ajustar en el paso 3)

**Si `seguuros.com` ya está en Plesk:**
1. Entra a `seguuros.com` → "Subdominios" → "Agregar subdominio"
2. Nombre: `app`

---

## PASO 3 — Node.js + Git deploy

1. Entra al dominio/subdominio `app.seguuros.com` en Plesk
2. Activa **Node.js** (versión 18 o superior)
3. Ve a la extensión **Git** → "Agregar repositorio"
   - URL: `https://github.com/crickmx/seguuros`
   - Rama de despliegue: `main`
4. Configura la acción automática post-pull (deploy):
   ```
   npm install && npm run build
   ```
5. **Document Root debe apuntar a la carpeta `dist/`** dentro del repo clonado
   (no a la raíz del repo) — igual patrón que se usó para `beta.movi.digital`.

---

## PASO 4 — Variable de entorno (.env)

El repo no trae `.env` (está en `.gitignore` a propósito). Súbelo una sola vez
a la raíz del repo clonado en el servidor (Administrador de archivos de Plesk
o SSH):

```
VITE_SUPABASE_URL=https://fjvzzlmnzawtqohxnrib.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZqdnp6bG1uemF3dHFvaHhucmliIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njg3ODQyMjQsImV4cCI6MjA4NDM2MDIyNH0.ypTuaTeKogs4gGRfvm_y-ygVQE4hb62HWVKcxgf1Ogk
```

Sin este archivo el build compila pero la app truena en el navegador con
`Missing Supabase environment variables`.

---

## PASO 5 — SSL

1. Entra a `app.seguuros.com` en Plesk
2. "Certificados SSL/TLS" → "Let's Encrypt"
3. Marca "Proteger el subdominio" + "Redirigir HTTP a HTTPS"
4. Instalar

---

## PASO 6 — URLs de autenticación en Supabase

1. Supabase Dashboard → proyecto **APP Seguuros** (`fjvzzlmnzawtqohxnrib`)
2. Authentication → URL Configuration
3. Site URL: `https://app.seguuros.com`
4. Redirect URLs: agrega `https://app.seguuros.com/**`
5. Guardar

---

## PASO 7 — Primer deploy y verificación

1. Desde Plesk → Git, dispara el primer "Pull"/deploy manual
2. Revisa el log del deploy — confirma que `npm run build` corrió sin errores
3. Abre `https://app.seguuros.com` — debe cargar la pantalla de login
4. Prueba con un usuario real (admin/ejecutivo/cliente, tabla `profiles`)
5. Confirma el candado HTTPS

---

## Qué ya se limpió en el repo (no lo repitas)

- `dist/` ya no se versiona (era build viejo de Bolt/Netlify) — ahora en `.gitignore`
- `public/.htaccess` agregado para que las rutas de React Router (`/admin/*`,
  `/ejecutivo/*`, `/cliente/*`) no den 404 al recargar
- `.env.example` agregado como referencia de las variables que necesita
