# Krêdit - Kônsul

Aplicación de gestión: de prospectos inmobiliarios con cálculo de crédito hipotecario.

View your app in AI Studio: https://ai.studio/apps/drive/1PBf2S63H7pbaWkTg9hPSHce_ILPrIPBg

## Run Locally

**Prerequisites:**  Node.js

1. Install dependencies:
   ```bash
   npm install
   ```

2. Crear archivo `.env.local` con las siguientes variables:
   ```env
   VITE_DATABASE_URL=postgresql://usuario:password@host/database?sslmode=require
   GEMINI_API_KEY=tu_api_key_aqui
   ```

3. Run the app:
   ```bash
   npm run dev
   ```

## Deploy en Vercel

### Pasos para desplegar:

1. **Conectar el repositorio a Vercel:**
   - Ve a [vercel.com](https://vercel.com)
   - Importa tu repositorio de GitHub/GitLab/Bitbucket
   - Vercel detectará automáticamente que es un proyecto Vite

2. **Configurar variables de entorno en Vercel:**
   - En el dashboard de Vercel, ve a tu proyecto
   - Settings → Environment Variables
   - Agrega las siguientes variables:
     - `VITE_DATABASE_URL`: Tu connection string de Neon Database
       - Formato: `postgresql://usuario:password@host/database?sslmode=require`
       - Obtén esta URL desde tu dashboard de Neon: https://console.neon.tech
     - `GEMINI_API_KEY`: (Opcional) Tu API key de Gemini si la usas

3. **Deploy:**
   - Vercel desplegará automáticamente en cada push a la rama principal
   - O puedes hacer un deploy manual desde el dashboard

### Notas importantes:

- El archivo `vercel.json` ya está configurado para el proyecto
- La aplicación usa `@neondatabase/serverless` que funciona directamente en el cliente
- Asegúrate de que tu base de datos Neon tenga las conexiones SSL habilitadas
- Las variables de entorno con prefijo `VITE_` son accesibles en el cliente

### Estructura de la base de datos:

La aplicación creará automáticamente la tabla `prospects` si no existe. Asegúrate de que tu usuario de Neon tenga permisos para crear tablas.
