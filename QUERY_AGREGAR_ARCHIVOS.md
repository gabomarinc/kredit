# Query para agregar columnas de archivos a la tabla prospects

Ejecuta este query en tu base de datos Neon para agregar las columnas de archivos:

```sql
-- Agregar columnas para los archivos del prospecto
ALTER TABLE prospects 
ADD COLUMN IF NOT EXISTS id_file_base64 TEXT,
ADD COLUMN IF NOT EXISTS ficha_file_base64 TEXT,
ADD COLUMN IF NOT EXISTS talonario_file_base64 TEXT,
ADD COLUMN IF NOT EXISTS signed_acp_file_base64 TEXT;
```

**Nota:** Los archivos se guardarán como Base64 (texto) para poder almacenar tanto imágenes como PDFs.

