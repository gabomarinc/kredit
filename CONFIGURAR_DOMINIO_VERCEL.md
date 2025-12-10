# Configurar Dominio Personalizado en Vercel

## ⚠️ Problema Actual
Estás intentando agregar un registro **CNAME** para "kredit", pero ya tienes registros **A** y **AAAA** para el mismo nombre. 

**No puedes tener CNAME y A/AAAA al mismo tiempo** para el mismo nombre de dominio.

## ✅ Soluciones

### Opción 1: Usar Registros A/AAAA (Recomendado para dominio raíz)
Si quieres usar `kredit.com` (sin www):

1. **NO agregues el CNAME** - elimina ese intento
2. **Mantén los registros A y AAAA** que ya tienes
3. En Vercel:
   - Ve a tu proyecto → **Settings** → **Domains**
   - Agrega el dominio: `kredit.com`
   - Vercel te mostrará las IPs específicas que debes usar
4. **Actualiza tus registros A y AAAA** con las IPs que Vercel te proporcione:
   - **Tipo A**: `kredit` → IP de Vercel (ej: `76.76.21.21`)
   - **Tipo AAAA**: `kredit` → IPv6 de Vercel (si está disponible)

### Opción 2: Usar CNAME para Subdominio www
Si prefieres usar `www.kredit.com`:

1. **NO toques los registros A/AAAA** existentes para "kredit"
2. **Agrega un nuevo registro CNAME**:
   - **Tipo**: CNAME
   - **Nombre**: `www` (NO "kredit")
   - **Objetivo**: `cname.vercel-dns.com.` (o el que Vercel te indique)
   - **TTL**: 14400
3. En Vercel, agrega el dominio `www.kredit.com`

### Opción 3: Configurar Ambos (Recomendado)
Puedes tener ambos:
- `kredit.com` → Registros A/AAAA
- `www.kredit.com` → Registro CNAME

## 📋 Pasos Detallados en Vercel

1. Ve a tu proyecto en Vercel Dashboard
2. Click en **Settings** → **Domains**
3. Click en **Add Domain**
4. Ingresa tu dominio (`kredit.com` o `www.kredit.com`)
5. Vercel te mostrará **exactamente** qué registros DNS necesitas
6. Copia esos valores y úsalos en tu proveedor DNS

## 🔍 Valores Típicos de Vercel

**Para dominio raíz (A/AAAA):**
- **A**: `76.76.21.21` o IPs que Vercel te indique
- **AAAA**: IPv6 que Vercel te proporcione

**Para subdominio (CNAME):**
- **CNAME**: `cname.vercel-dns.com.` o similar

## ⏱️ Verificación
- Vercel verificará automáticamente después de agregar los registros
- La propagación DNS puede tardar desde minutos hasta 48 horas
- Verás el estado en la sección Domains de Vercel

## 💡 Recomendación
**Usa la Opción 3**: Configura ambos dominios para que funcionen:
- `kredit.com` (con A/AAAA)
- `www.kredit.com` (con CNAME)

Esto es lo más común y profesional.
