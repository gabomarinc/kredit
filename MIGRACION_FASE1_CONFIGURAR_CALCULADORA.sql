-- ============================================
-- MIGRACIÓN FASE 1: Configurar Calculadora
-- ============================================
-- Ejecutar este script en tu base de datos Neon/PostgreSQL
-- 
-- Este script agrega:
-- 1. Columna para documento APC personalizado por empresa
-- 2. Columna para configuración de documentos solicitados
-- ============================================

-- 1. Agregar columna para documento APC personalizado (guardado en Google Drive)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'companies' 
    AND column_name = 'apc_document_drive_id'
  ) THEN
    ALTER TABLE companies ADD COLUMN apc_document_drive_id TEXT;
    COMMENT ON COLUMN companies.apc_document_drive_id IS 'ID del documento APC personalizado de la empresa en Google Drive';
  END IF;
END $$;

-- 2. Agregar columna para configuración de documentos solicitados (JSONB)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'companies' 
    AND column_name = 'requested_documents'
  ) THEN
    ALTER TABLE companies ADD COLUMN requested_documents JSONB DEFAULT '{
      "idFile": true,
      "fichaFile": true,
      "talonarioFile": true,
      "signedAcpFile": true
    }'::jsonb;
    COMMENT ON COLUMN companies.requested_documents IS 'Configuración de qué documentos solicitar a los prospectos (checkboxes activos/inactivos)';
  END IF;
END $$;

-- 3. Inicializar valores por defecto para empresas existentes (si no tienen configuración)
UPDATE companies 
SET requested_documents = '{
  "idFile": true,
  "fichaFile": true,
  "talonarioFile": true,
  "signedAcpFile": true
}'::jsonb
WHERE requested_documents IS NULL;

-- Verificar que las columnas se agregaron correctamente
SELECT 
  column_name, 
  data_type, 
  column_default
FROM information_schema.columns 
WHERE table_name = 'companies' 
AND column_name IN ('apc_document_drive_id', 'requested_documents')
ORDER BY column_name;
