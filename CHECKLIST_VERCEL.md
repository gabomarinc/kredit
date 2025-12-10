# ✅ Checklist para Subir a Vercel

## 📋 Pre-requisitos

- [ ] Tener una cuenta en [Vercel](https://vercel.com) (gratis)
- [ ] Tener una cuenta en [Neon](https://neon.tech) (gratis)
- [ ] Tener tu proyecto en un repositorio Git (GitHub, GitLab o Bitbucket)

## 🔧 Archivos Necesarios (Ya están listos ✅)

- ✅ `vercel.json` - Configuración de Vercel
- ✅ `package.json` - Dependencias del proyecto
- ✅ `.npmrc` - Configuración para resolver conflictos de dependencias
- ✅ `utils/db.ts` - Configurado para usar variables de entorno
- ✅ `vite.config.ts` - Configurado para producción

## 🚀 Pasos para Desplegar

### 1. Preparar el Repositorio

```bash
# Asegúrate de que todos los cambios estén commiteados
git add .
git commit -m "Preparar proyecto para Vercel"
git push
```

### 2. Conectar a Vercel

1. Ve a [vercel.com](https://vercel.com) e inicia sesión
2. Haz clic en **"Add New Project"** o **"Import Project"**
3. Conecta tu repositorio (GitHub/GitLab/Bitbucket)
4. Vercel detectará automáticamente que es un proyecto Vite

### 3. Configurar Variables de Entorno en Vercel

**⚠️ MUY IMPORTANTE:** Debes agregar estas variables ANTES del primer deploy.

1. En la pantalla de configuración del proyecto, ve a **"Environment Variables"**
2. Agrega la siguiente variable:

   **Variable:** `VITE_DATABASE_URL`
   
   **Valor:** Tu connection string de Neon
   
   **Cómo obtenerla:**
   - Ve a https://console.neon.tech
   - Selecciona tu proyecto
   - Ve a "Connection Details" o "Connection String"
   - Copia la connection string completa
   - Formato: `postgresql://usuario:password@host/database?sslmode=require`
   - ⚠️ Usa la versión con **pooler** si está disponible (mejor rendimiento)
   
   **Aplicar a:** ✅ Production, ✅ Preview, ✅ Development

3. (Opcional) Si usas Gemini API:
   
   **Variable:** `GEMINI_API_KEY`
   
   **Valor:** Tu API key de Gemini

### 4. Hacer el Deploy

1. Haz clic en **"Deploy"**
2. Espera 1-2 minutos mientras Vercel:
   - Instala las dependencias
   - Hace el build del proyecto
   - Despliega la aplicación
3. Una vez completado, tendrás una URL como: `tu-proyecto.vercel.app`

### 5. Verificar que Funciona

- [ ] Visita la URL de tu proyecto
- [ ] Verifica que la aplicación carga correctamente
- [ ] Prueba crear un prospecto nuevo
- [ ] Verifica en el Dashboard que los datos se guardan en Neon

## 🔍 Verificación Post-Deploy

### Revisar Logs

1. En Vercel, ve a tu proyecto → **"Deployments"**
2. Haz clic en el último deployment
3. Revisa los **"Build Logs"** para verificar que no hay errores

### Verificar Variables de Entorno

1. Settings → Environment Variables
2. Confirma que `VITE_DATABASE_URL` está configurada
3. Verifica que esté aplicada a todos los entornos necesarios

### Probar la Conexión a Neon

1. Abre la aplicación en el navegador
2. Abre la consola del navegador (F12)
3. No deberías ver el warning: "VITE_DATABASE_URL no está configurada"
4. Crea un prospecto y verifica que se guarda en la base de datos

## ⚠️ Problemas Comunes

### Error: "Cannot find module"

- **Solución:** Verifica que `.npmrc` esté en el repositorio y que Vercel use `--legacy-peer-deps`

### Error: "DATABASE_URL no está configurada"

- **Solución:** 
  - Verifica que la variable se llame `VITE_DATABASE_URL` (con el prefijo `VITE_`)
  - Haz un nuevo deploy después de agregar la variable

### Error de conexión a Neon

- **Solución:**
  - Verifica que la connection string sea correcta
  - Asegúrate de incluir `?sslmode=require`
  - Verifica que tu proyecto Neon esté activo

### Build falla en Vercel

- **Solución:**
  - Revisa los Build Logs en Vercel
  - Verifica que todas las dependencias estén en `package.json`
  - Asegúrate de que `.npmrc` esté commiteado

## 📝 Notas Finales

- ✅ El proyecto está listo para producción
- ✅ No necesitas cambiar nada del código
- ✅ Solo necesitas configurar la variable de entorno `VITE_DATABASE_URL` en Vercel
- ✅ Los deploys futuros serán automáticos cuando hagas push a la rama principal

## 🎉 ¡Listo!

Una vez completados estos pasos, tu aplicación estará en vivo en Vercel y conectada a Neon Database.

