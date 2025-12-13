# Guía de Despliegue en Vercel

## Preparación

El proyecto ya está configurado para desplegarse en Vercel. Los siguientes archivos han sido preparados:

- ✅ `vercel.json` - Configuración de Vercel
- ✅ `utils/db.ts` - Actualizado para usar variables de entorno
- ✅ `vite.config.ts` - Configurado para producción

## Pasos para Desplegar

### 1. Conectar Repositorio a Vercel

1. Ve a [vercel.com](https://vercel.com) e inicia sesión
2. Haz clic en "Add New Project"
3. Importa tu repositorio desde GitHub, GitLab o Bitbucket
4. Vercel detectará automáticamente que es un proyecto Vite

### 2. Configurar Variables de Entorno

**IMPORTANTE:** En Vercel, debes configurar las variables de entorno con el prefijo `VITE_` para que sean accesibles en el cliente.

1. En el dashboard de Vercel, ve a tu proyecto
2. Settings → Environment Variables
3. Agrega las siguientes variables:

#### Variable Requerida:

- **`VITE_DATABASE_URL`**
  - Valor: Tu connection string de Neon Database
  - Formato: `postgresql://usuario:password@host/database?sslmode=require`
  - Cómo obtenerla:
    1. Ve a tu dashboard de Neon: https://console.neon.tech
    2. Selecciona tu proyecto
    3. Ve a "Connection Details"
    4. Copia la connection string (usa la versión con pooler si está disponible)
  - **Aplica a:** Production, Preview, Development

#### Variable Opcional:

- **`GEMINI_API_KEY`**
  - Valor: Tu API key de Gemini (si usas esta funcionalidad)
  - **Aplica a:** Production, Preview, Development

### 3. Deploy

1. Vercel desplegará automáticamente cuando hagas push a la rama principal
2. O puedes hacer un deploy manual desde el dashboard
3. Espera a que el build termine (generalmente 1-2 minutos)

### 4. Verificar el Deploy

1. Una vez completado, Vercel te dará una URL (ej: `tu-proyecto.vercel.app`)
2. Visita la URL y verifica que la aplicación funcione
3. Prueba crear un prospecto para verificar la conexión con Neon

## Solución de Problemas

### Error: "DATABASE_URL no está configurada"

- Verifica que hayas agregado `VITE_DATABASE_URL` (con el prefijo `VITE_`) en las variables de entorno de Vercel
- Asegúrate de que la variable esté aplicada al entorno correcto (Production/Preview/Development)
- Haz un nuevo deploy después de agregar la variable

### Error de conexión a la base de datos

- Verifica que tu connection string de Neon sea correcta
- Asegúrate de que tu base de datos Neon tenga SSL habilitado (`?sslmode=require`)
- Verifica que tu proyecto Neon esté activo y no suspendido
- Revisa los logs de Vercel para más detalles del error

### La aplicación funciona pero no guarda datos

- Verifica los logs del navegador (F12 → Console) para ver errores
- Verifica que la tabla `prospects` exista en tu base de datos Neon
- La aplicación creará la tabla automáticamente si tiene permisos

## Notas Importantes

- **Seguridad:** Nunca commitees tu connection string o API keys al repositorio
- **Variables de entorno:** Solo las variables con prefijo `VITE_` son accesibles en el cliente
- **Base de datos:** La aplicación usa `@neondatabase/serverless` que funciona directamente en el navegador
- **SSL:** Asegúrate de que tu connection string incluya `?sslmode=require` para conexiones seguras

## Estructura de la Base de Datos

La aplicación creará automáticamente la siguiente tabla si no existe:

```sql
CREATE TABLE IF NOT EXISTS prospects (
  id SERIAL PRIMARY KEY,
  full_name TEXT,
  email TEXT,
  phone TEXT,
  monthly_income NUMERIC,
  property_type TEXT,
  bedrooms INTEGER,
  bathrooms INTEGER,
  interested_zones TEXT[],
  calculation_result JSONB,
  status TEXT DEFAULT 'Nuevo',
  created_at TIMESTAMP DEFAULT NOW()
);
```

Asegúrate de que tu usuario de Neon tenga permisos para crear tablas.


