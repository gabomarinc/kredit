# 🔍 Guía de Debug para Problemas en Vercel

## Problema: No se guardan datos en Neon

### Paso 1: Verificar Variables de Entorno en Vercel

1. Ve a tu proyecto en Vercel
2. Settings → Environment Variables
3. Verifica que existe `VITE_DATABASE_URL`
4. **IMPORTANTE:** Asegúrate de que esté aplicada a **Production, Preview Y Development**
5. Si la agregaste después del deploy, **debes hacer un nuevo deploy**

### Paso 2: Verificar en la Consola del Navegador

1. Abre tu aplicación en Vercel
2. Abre la consola del navegador (F12 → Console)
3. Busca estos mensajes:

**✅ Si ves esto, está bien:**
```
✅ DATABASE_URL configurada: postgresql://neondb_owner:...
🔄 Intentando conectar a la base de datos...
✅ Conexión establecida
✅ Prospect saved with ID: 123
✅ Datos guardados correctamente en Neon
```

**❌ Si ves esto, hay un problema:**
```
❌ VITE_DATABASE_URL NO está configurada. Verifica las variables de entorno en Vercel.
❌ Pool de base de datos no inicializado.
```

### Paso 3: Verificar el Build en Vercel

1. Ve a Deployments → Último deployment
2. Haz clic en el deployment
3. Revisa los **Build Logs**
4. Busca si hay errores relacionados con variables de entorno

### Paso 4: Verificar la Connection String

La connection string debe:
- ✅ Empezar con `postgresql://`
- ✅ Terminar con `?sslmode=require` o `?sslmode=require&channel_binding=require`
- ✅ NO tener comillas simples `'` al inicio o final
- ✅ Estar completa (no cortada)

### Paso 5: Verificar Permisos en Neon

1. Ve a https://console.neon.tech
2. Verifica que tu proyecto esté **activo** (no suspendido)
3. Verifica que el usuario tenga permisos para:
   - Crear tablas (CREATE TABLE)
   - Insertar datos (INSERT)
   - Leer datos (SELECT)

### Paso 6: Probar la Conexión Manualmente

Puedes probar la conexión desde tu terminal local:

```bash
psql 'postgresql://neondb_owner:npg_Vxu0nzR8MFCc@ep-square-night-a468d4va-pooler.us-east-1.aws.neon.tech/neondb?sslmode=require'
```

Si funciona, la connection string es correcta.

## Soluciones Comunes

### Problema: Variable no se aplica después de agregarla

**Solución:** 
- Haz un **nuevo deploy** después de agregar la variable
- O ve a Deployments → ... → Redeploy

### Problema: Variable solo funciona en Development

**Solución:**
- En Vercel, al agregar la variable, asegúrate de seleccionar:
  - ✅ Production
  - ✅ Preview  
  - ✅ Development

### Problema: "Pool de base de datos no inicializado"

**Solución:**
- Verifica que la variable se llame exactamente `VITE_DATABASE_URL` (con el prefijo `VITE_`)
- Verifica que no tenga espacios al inicio o final
- Haz un nuevo deploy

### Problema: Error de conexión SSL

**Solución:**
- Asegúrate de que la connection string termine con `?sslmode=require`
- Si usas `channel_binding=require`, también está bien

### Problema: Error de permisos

**Solución:**
- En Neon, verifica que el usuario tenga permisos DDL (para crear tablas)
- La aplicación crea la tabla automáticamente la primera vez

## Verificar que Funciona

1. Abre la aplicación en Vercel
2. Abre la consola (F12)
3. Completa el formulario y envía
4. Deberías ver en la consola:
   ```
   ✅ DATABASE_URL configurada
   🔄 Intentando conectar...
   ✅ Conexión establecida
   ✅ Prospect saved with ID: [número]
   ✅ Datos guardados correctamente en Neon
   ```
5. Ve al Dashboard y verifica que aparezca el nuevo prospecto

## Contacto

Si después de seguir estos pasos aún no funciona, comparte:
- Los mensajes de la consola del navegador
- Los Build Logs de Vercel
- Una captura de pantalla de las variables de entorno (ocultando la contraseña)



