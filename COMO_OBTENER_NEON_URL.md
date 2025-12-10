# 🔗 Cómo Obtener la DATABASE_URL de Neon

## Pasos Detallados

### 1. Acceder a tu Dashboard de Neon

1. Ve a [https://console.neon.tech](https://console.neon.tech)
2. Inicia sesión con tu cuenta
3. Selecciona tu proyecto (o crea uno nuevo si no tienes)

### 2. Encontrar la Connection String

Una vez dentro de tu proyecto, tienes varias opciones:

#### **Opción A: Desde la página principal del proyecto**

1. En la página principal de tu proyecto, busca la sección **"Connection Details"** o **"Connection String"**
2. Verás algo como:
   ```
   postgresql://usuario:password@ep-xxxxx-xxxxx.us-east-1.aws.neon.tech/dbname?sslmode=require
   ```
3. Haz clic en el botón **"Copy"** o **"Copiar"** para copiar la connection string completa

#### **Opción B: Desde la sección "Connection Details"**

1. En el menú lateral, busca **"Connection Details"** o **"Detalles de Conexión"**
2. Verás diferentes opciones de conexión:
   - **Pooled connection** (Recomendado) - Mejor rendimiento
   - **Direct connection** - Conexión directa
3. **Usa la versión "Pooled"** si está disponible (tiene mejor rendimiento)
4. Copia la connection string completa

#### **Opción C: Desde "Settings" o "Configuración"**

1. Ve a **Settings** → **Connection String**
2. Ahí encontrarás la connection string completa
3. Copia el valor completo

### 3. Formato de la Connection String

La connection string debería verse así:

```
postgresql://usuario:password@ep-xxxxx-xxxxx-pooler.us-east-1.aws.neon.tech/neondb?sslmode=require
```

**Componentes importantes:**
- `postgresql://` - Protocolo
- `usuario:password@` - Credenciales
- `ep-xxxxx-xxxxx-pooler` - Host (pooler es mejor)
- `us-east-1.aws.neon.tech` - Región
- `/neondb` - Nombre de la base de datos
- `?sslmode=require` - **MUY IMPORTANTE** - Conexión segura

### 4. Verificar que tiene `?sslmode=require`

⚠️ **IMPORTANTE:** Asegúrate de que la connection string termine con `?sslmode=require`

Si no lo tiene, agrégalo manualmente al final:
```
postgresql://...?sslmode=require
```

### 5. Usar en Vercel

1. Copia la connection string completa
2. Ve a Vercel → Tu Proyecto → Settings → Environment Variables
3. Crea una nueva variable:
   - **Nombre:** `VITE_DATABASE_URL`
   - **Valor:** Pega la connection string completa
   - **Aplicar a:** Production, Preview, Development
4. Guarda y haz un nuevo deploy

## 📸 Ubicaciones Visuales en Neon

### Página Principal del Proyecto
```
┌─────────────────────────────────┐
│  Tu Proyecto Neon               │
├─────────────────────────────────┤
│  Connection Details             │
│  ┌───────────────────────────┐  │
│  │ postgresql://...          │  │
│  │ [Copy]                    │  │
│  └───────────────────────────┘  │
└─────────────────────────────────┘
```

### Menú Lateral
```
Dashboard
Connection Details  ← Aquí
Branches
Settings
```

## 🔒 Seguridad

- ✅ **NUNCA** compartas tu connection string públicamente
- ✅ **NUNCA** la subas a GitHub (ya está en `.gitignore`)
- ✅ Solo úsala en variables de entorno de Vercel
- ✅ Si la comprometes, regenera las credenciales en Neon

## ❓ ¿No encuentras la Connection String?

1. Verifica que estés en el proyecto correcto
2. Busca en la barra de búsqueda: "connection" o "conexión"
3. Revisa la documentación de Neon: https://neon.tech/docs
4. Si creaste el proyecto recientemente, puede tardar unos minutos en aparecer

## 🆘 Problemas Comunes

### "No veo la connection string"
- Asegúrate de estar en el proyecto correcto
- Verifica que el proyecto esté activo (no suspendido)
- Intenta refrescar la página

### "La connection string no funciona"
- Verifica que termine con `?sslmode=require`
- Asegúrate de copiar la versión completa (no cortada)
- Verifica que el proyecto Neon esté activo

### "¿Pooled o Direct?"
- **Usa Pooled** si está disponible (mejor para producción)
- Direct funciona también, pero Pooled es más eficiente

