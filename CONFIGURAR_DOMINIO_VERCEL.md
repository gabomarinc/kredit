# Configurar Subdominio en Vercel: kredit.konsul.digital

## 🎯 Tu Caso Específico
Quieres configurar el subdominio: **`kredit.konsul.digital`**

## ⚠️ Problema Actual
Estás intentando agregar un registro **CNAME** para "kredit", pero ya tienes registros **A** y **AAAA** para el mismo nombre en el dominio `konsul.digital`. 

**No puedes tener CNAME y A/AAAA al mismo tiempo** para el mismo nombre.

## ✅ Solución para Subdominio

Para `kredit.konsul.digital`, necesitas un registro **CNAME**:

### Pasos en tu Proveedor DNS:

1. **Elimina los registros A y AAAA** que tienes para "kredit" (si existen)
2. **Agrega un registro CNAME**:
   - **Tipo**: `CNAME`
   - **Nombre**: `kredit` (solo "kredit", sin el dominio completo)
   - **Objetivo**: El que Vercel te proporcione (generalmente `cname.vercel-dns.com.` o similar)
   - **TTL**: `14400` o el que prefieras

### Pasos en Vercel:

1. Ve a tu proyecto en Vercel Dashboard
2. Click en **Settings** → **Domains**
3. Click en **Add Domain**
4. Ingresa: `kredit.konsul.digital`
5. Vercel te mostrará **exactamente** qué registro CNAME necesitas
6. Copia el valor del "Target" o "Objetivo" que Vercel te muestre
7. Úsalo en tu proveedor DNS

## 📋 Ejemplo de Registro CNAME

```
Tipo: CNAME
Nombre: kredit
Objetivo: cname.vercel-dns.com.  (o el que Vercel te indique)
TTL: 14400
```

**Nota importante**: El objetivo debe terminar con un punto (`.`) al final.

## ⏱️ Verificación

- Vercel verificará automáticamente después de agregar el registro
- La propagación DNS puede tardar desde minutos hasta 48 horas
- Verás el estado en la sección **Domains** de Vercel:
  - ⏳ "Pending" = Esperando verificación
  - ✅ "Valid" = Configurado correctamente
  - ❌ "Invalid" = Revisa el registro DNS

## 🔍 Si Sigue Dando Error

Si después de agregar el CNAME correcto sigue dando error:

1. **Verifica que no existan otros registros** para "kredit" (A, AAAA, o CNAME duplicados)
2. **Espera unos minutos** - a veces hay caché DNS
3. **Verifica el formato**: El objetivo debe terminar con punto (`.`)
4. **Revisa en Vercel** qué valor exacto te está pidiendo

## 💡 Tip

Vercel te mostrará el valor exacto del CNAME cuando agregues el dominio. **Siempre usa ese valor**, no uno genérico.
