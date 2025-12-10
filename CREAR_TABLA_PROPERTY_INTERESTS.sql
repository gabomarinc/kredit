-- ============================================
-- CREAR TABLA property_interests
-- Esta tabla hace el link entre prospectos y propiedades
-- Ejecutar en Neon SQL Editor
-- ============================================

-- Primero, verificar el tipo de dato de prospects.id
SELECT 
  column_name,
  data_type,
  udt_name
FROM information_schema.columns
WHERE table_name = 'prospects' AND column_name = 'id';

-- Verificar el tipo de dato de properties.id
SELECT 
  column_name,
  data_type,
  udt_name
FROM information_schema.columns
WHERE table_name = 'properties' AND column_name = 'id';

-- Crear tabla de intereses de prospectos en propiedades
-- NOTA: prospect_id debe coincidir con el tipo de prospects.id (probablemente INTEGER/SERIAL)
--       property_id debe coincidir con el tipo de properties.id (probablemente UUID)
CREATE TABLE IF NOT EXISTS property_interests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  prospect_id INTEGER REFERENCES prospects(id) ON DELETE CASCADE NOT NULL,
  property_id UUID REFERENCES properties(id) ON DELETE CASCADE NOT NULL,
  interested BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW(),
  CONSTRAINT property_interests_unique UNIQUE(prospect_id, property_id)
);

-- Si la tabla ya existe pero tiene errores, podemos eliminarla y recrearla:
-- DROP TABLE IF EXISTS property_interests CASCADE;

-- Crear índices para mejor rendimiento
CREATE INDEX IF NOT EXISTS idx_property_interests_prospect_id ON property_interests(prospect_id);
CREATE INDEX IF NOT EXISTS idx_property_interests_property_id ON property_interests(property_id);
CREATE INDEX IF NOT EXISTS idx_property_interests_interested ON property_interests(interested);

-- Verificar que la tabla se creó correctamente
SELECT 
  table_name,
  column_name,
  data_type,
  is_nullable
FROM information_schema.columns
WHERE table_name = 'property_interests'
ORDER BY ordinal_position;

