-- ============================================
-- SOLUCIÓN AL ERROR DE FOREIGN KEY
-- Si te da error, ejecuta primero estas queries de verificación
-- ============================================

-- 1. Verificar qué tipo de dato tiene prospects.id
SELECT 
  column_name,
  data_type,
  udt_name
FROM information_schema.columns
WHERE table_name = 'prospects' AND column_name = 'id';

-- 2. Verificar qué tipo de dato tiene properties.id  
SELECT 
  column_name,
  data_type,
  udt_name
FROM information_schema.columns
WHERE table_name = 'properties' AND column_name = 'id';

-- 3. Si la tabla property_interests existe con errores, eliminarla:
-- DROP TABLE IF EXISTS property_interests CASCADE;

-- 4. Crear la tabla property_interests con los tipos correctos
CREATE TABLE property_interests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  prospect_id INTEGER REFERENCES prospects(id) ON DELETE CASCADE NOT NULL,
  property_id UUID REFERENCES properties(id) ON DELETE CASCADE NOT NULL,
  interested BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW(),
  CONSTRAINT property_interests_unique UNIQUE(prospect_id, property_id)
);

-- 5. Crear índices
CREATE INDEX idx_property_interests_prospect_id ON property_interests(prospect_id);
CREATE INDEX idx_property_interests_property_id ON property_interests(property_id);
CREATE INDEX idx_property_interests_interested ON property_interests(interested);

-- 6. Verificar que se creó correctamente
SELECT 
  table_name,
  column_name,
  data_type,
  is_nullable
FROM information_schema.columns
WHERE table_name = 'property_interests'
ORDER BY ordinal_position;

