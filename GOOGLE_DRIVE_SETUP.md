# Configuración de Google Drive OAuth

## ¿Cómo funciona?

### Credenciales de la Aplicación (Vercel) - UNA SOLA VEZ
Estas credenciales identifican **tu aplicación Krêdit** ante Google. Son compartidas para TODOS los clientes:
- `GOOGLE_DRIVE_CLIENT_ID` - ID de tu aplicación OAuth
- `GOOGLE_DRIVE_CLIENT_SECRET` - Secret de tu aplicación OAuth  
- `VITE_GOOGLE_DRIVE_CLIENT_ID` - Mismo ID pero accesible en el frontend

### Tokens por Cliente (Base de Datos) - UNO POR EMPRESA
Cuando cada empresa se registra y se autentica con Google, obtiene sus propios tokens:
- `google_drive_access_token` - Token de acceso de esa empresa
- `google_drive_refresh_token` - Token para renovar acceso
- `google_drive_folder_id` - ID de su carpeta "Konsul - Kredit"

**IMPORTANTE:** Los tokens son únicos por empresa y permiten acceder SOLO al Google Drive de esa empresa.

---

## Pasos para Configurar

### 1. Crear Proyecto en Google Cloud Console

1. Ve a [Google Cloud Console](https://console.cloud.google.com/)
2. Crea un nuevo proyecto (o selecciona uno existente)
3. Nombre sugerido: "Krêdit Drive Integration"

### 2. Habilitar Google Drive API

1. En el menú lateral: **APIs & Services** > **Library**
2. Busca "Google Drive API"
3. Haz clic en **Enable**

### 3. Configurar OAuth Consent Screen

**IMPORTANTE:** Estás en "Google Auth Platform", pero necesitas ir a "APIs & Services". Sigue estos pasos:

1. **Salir de Google Auth Platform:**
   - En la parte superior izquierda, haz clic en el menú hamburguesa (☰) o en "Google Cloud"
   - O usa el buscador en la parte superior y escribe: `OAuth consent screen`
   - Selecciona la opción que dice "OAuth consent screen" (debe estar bajo "APIs & Services")

2. **Alternativa rápida - Usar el buscador:**
   - En la barra de búsqueda superior de Google Cloud Console, escribe: `OAuth consent screen`
   - Haz clic en el resultado que dice "OAuth consent screen" (bajo APIs & Services)

3. **IMPORTANTE - Google ha cambiado la interfaz completamente:**
   
   **El problema:** Google ha migrado a "Google Auth Platform" y la interfaz es diferente.
   
   **SOLUCIÓN - Opción 1: Usar URL directa (RECOMENDADO):**
   
   Copia y pega esta URL exacta en tu navegador (reemplaza `kredit-481110` con tu Project ID si es diferente):
   ```
   https://console.cloud.google.com/apis/credentials/consent?project=kredit-481110
   ```
   
   Esto te llevará a la página clásica donde puedes configurar todo.
   
   **SOLUCIÓN - Opción 2: Desde Google Auth Platform (nueva interfaz):**
   
   Si estás en "OAuth Overview" (Google Auth Platform):
   1. En el menú lateral izquierdo, haz clic en **"Data Access"**
   2. Verás un botón azul que dice **"Add or remove scopes"** - ¡Haz clic ahí!
   3. Esto abrirá un diálogo donde puedes buscar y agregar los scopes
   
   **SOLUCIÓN - Opción 3: Crear OAuth client primero:**
   
   Si la nueva interfaz requiere crear un cliente primero:
   1. Haz clic en **"Create OAuth client"** en la página "OAuth Overview"
   2. Esto puede abrir un wizard que te guíe por la configuración incluyendo scopes

4. **Una vez en la página correcta de OAuth consent screen:**
   - Si es la primera vez, selecciona **"External"** y haz clic en **"Create"**
   - Si ya existe, haz clic en **"EDIT APP"** o el botón de editar

5. **Completa la información básica:**
   - **App name:** Krêdit
   - **User support email:** tu email
   - **Developer contact:** tu email
   - Haz clic en **"Save and Continue"**

6. **Paso 2 - Agregar Scopes (permisos) - NUEVA INTERFAZ:**
   
   **Si estás en "Data Access" (Google Auth Platform):**
   - Haz clic en el botón azul **"Add or remove scopes"**
   - Se abrirá un diálogo o modal
   - En el buscador, escribe: `drive.file`
   - Busca y selecciona: `https://www.googleapis.com/auth/drive.file`
   - Busca también: `drive.metadata.readonly`
   - Selecciona: `https://www.googleapis.com/auth/drive.metadata.readonly`
   - Haz clic en **"Add"** o **"Update"** y luego **"Save"**
   
   **Si estás en la página clásica de OAuth consent screen:**
   - Después de "Save and Continue", deberías ver una pantalla con pestañas
   - Haz clic en la pestaña **"Scopes"**
   - Haz clic en **"Add or Remove Scopes"** o **"ADD SCOPES"**
   - En el buscador, escribe: `drive.file`
   - Selecciona: `https://www.googleapis.com/auth/drive.file`
   - Busca también: `drive.metadata.readonly`
   - Selecciona: `https://www.googleapis.com/auth/drive.metadata.readonly`
   - Haz clic en **"Update"** y luego **"Save and Continue"**

7. **Paso 3 - Test users (si estás en modo de prueba):**
   - En la siguiente pantalla, haz clic en la pestaña **"Test users"**
   - Haz clic en **"+ ADD USERS"**
   - Agrega tu email y los emails de tus clientes
   - Haz clic en **"Save and Continue"**

8. **Paso 4 - Resumen:**
   - Revisa la información y haz clic en **"Back to Dashboard"**

### 4. Crear Credenciales OAuth 2.0

1. Ve a **APIs & Services** > **Credentials**
2. Haz clic en **+ CREATE CREDENTIALS** > **OAuth client ID**
3. Tipo de aplicación: **Web application**
4. **Name:** Krêdit Web Client
5. **Authorized redirect URIs:**
   - `https://tu-dominio.vercel.app/api/google-drive/callback`
   - `http://localhost:5173/api/google-drive/callback` (para desarrollo local)
6. Haz clic en **Create**
7. Copia el **Client ID** y **Client Secret**

### 5. Configurar Variables de Entorno en Vercel

1. Ve a tu proyecto en [Vercel Dashboard](https://vercel.com/dashboard)
2. **Settings** > **Environment Variables**
3. Agrega estas variables (usa los valores que copiaste):

**Variable 1:**
- **Key:** `GOOGLE_DRIVE_CLIENT_ID`
- **Value:** `[tu-client-id]` (copia el Client ID del modal de Google Cloud)
- **Environment:** Selecciona **Production, Preview, Development**

**Variable 2:**
- **Key:** `GOOGLE_DRIVE_CLIENT_SECRET`
- **Value:** `[tu-client-secret]` (copia el Client Secret del modal de Google Cloud)
- **Environment:** Selecciona **Production, Preview, Development**

**Variable 3:**
- **Key:** `VITE_GOOGLE_DRIVE_CLIENT_ID`
- **Value:** `[tu-client-id]` (el mismo Client ID de la Variable 1)
- **Environment:** Selecciona **Production, Preview, Development**

**IMPORTANTE:** 
- El mismo `CLIENT_ID` va en `GOOGLE_DRIVE_CLIENT_ID` y `VITE_GOOGLE_DRIVE_CLIENT_ID`
- `VITE_` es necesario para que el frontend pueda acceder a la variable

### 6. Redeploy en Vercel

Después de agregar las variables, haz un nuevo deploy:
```bash
git push
```

O desde el dashboard de Vercel: **Deployments** > **Redeploy**

---

## Cómo Funciona el Flujo

### Registro de Nueva Empresa:

1. Empresa A se registra en Krêdit
2. En el paso 3 del wizard, hace clic en "Conectar Google Drive"
3. Es redirigida a Google (usando tu `CLIENT_ID`)
4. Empresa A autoriza acceso a su Google Drive
5. Google redirige de vuelta con un código
6. Tu API route intercambia el código por tokens
7. Se crea la carpeta "Konsul - Kredit" en el Drive de Empresa A
8. Los tokens y folder_id se guardan en la BD para esa empresa
9. El registro continúa normalmente

### Subida de Archivos (Futuro):

1. Cuando un prospecto sube documentos
2. El sistema busca los tokens de esa empresa en la BD
3. Crea una subcarpeta con el nombre del prospecto
4. Sube los archivos a esa subcarpeta
5. Todo usando los tokens de ESA empresa específica

---

## Seguridad

- ✅ `CLIENT_SECRET` nunca se expone al frontend (solo en serverless function)
- ✅ Cada empresa solo puede acceder a SU propio Drive
- ✅ Los tokens se guardan encriptados en la BD (considerar encriptación adicional)
- ✅ Los tokens expiran y se renuevan automáticamente con `refresh_token`

---

## Troubleshooting

### Error: "redirect_uri_mismatch"
- Verifica que la URL en Vercel coincida exactamente con la configurada en Google Cloud Console
- Incluye `https://` y la ruta completa `/api/google-drive/callback`

### Error: "invalid_client"
- Verifica que `GOOGLE_DRIVE_CLIENT_ID` y `GOOGLE_DRIVE_CLIENT_SECRET` estén correctos
- Asegúrate de hacer redeploy después de agregar variables de entorno

### La carpeta no se crea
- Verifica los logs de Vercel Function Logs
- Asegúrate de que los scopes estén correctamente configurados

### Los tokens no se guardan
- Verifica la conexión a la BD
- Revisa los logs del componente Register.tsx en la consola del navegador

