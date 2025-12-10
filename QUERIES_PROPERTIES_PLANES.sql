-- ============================================
-- QUERIES PARA IMPLEMENTAR SISTEMA DE PLANES Y PROPIEDADES
-- Ejecutar en Neon SQL Editor
-- ============================================

-- 1. Agregar columna de plan a la tabla companies (si no existe)
ALTER TABLE companies 
ADD COLUMN IF NOT EXISTS plan TEXT DEFAULT 'Freshie' CHECK (plan IN ('Freshie', 'Wolf of Wallstreet'));

-- 2. Crear tabla de propiedades
CREATE TABLE IF NOT EXISTS properties (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID REFERENCES companies(id) ON DELETE CASCADE NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  type TEXT NOT NULL CHECK (type IN ('Venta', 'Alquiler')),
  price NUMERIC NOT NULL,
  zone TEXT NOT NULL,
  bedrooms INTEGER,
  bathrooms NUMERIC,
  area_m2 NUMERIC,
  images TEXT[], -- Array de URLs Base64 de imágenes
  address TEXT,
  features TEXT[], -- Array de características adicionales
  status TEXT DEFAULT 'Activa' CHECK (status IN ('Activa', 'Inactiva', 'Vendida', 'Alquilada')),
  high_demand BOOLEAN DEFAULT false,
  demand_visits INTEGER DEFAULT 0,
  price_adjusted BOOLEAN DEFAULT false,
  price_adjustment_percent NUMERIC DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- 3. Crear tabla de intereses de prospectos en propiedades
CREATE TABLE IF NOT EXISTS property_interests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  prospect_id INTEGER REFERENCES prospects(id) ON DELETE CASCADE NOT NULL,
  property_id UUID REFERENCES properties(id) ON DELETE CASCADE NOT NULL,
  interested BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(prospect_id, property_id) -- Un prospecto solo puede estar interesado una vez por propiedad
);

-- 4. Crear índices para mejor rendimiento
CREATE INDEX IF NOT EXISTS idx_properties_company_id ON properties(company_id);
CREATE INDEX IF NOT EXISTS idx_properties_status ON properties(status);
CREATE INDEX IF NOT EXISTS idx_properties_type ON properties(type);
CREATE INDEX IF NOT EXISTS idx_properties_zone ON properties(zone);
CREATE INDEX IF NOT EXISTS idx_property_interests_prospect_id ON property_interests(prospect_id);
CREATE INDEX IF NOT EXISTS idx_property_interests_property_id ON property_interests(property_id);
CREATE INDEX IF NOT EXISTS idx_property_interests_interested ON property_interests(interested);

-- 5. Función para actualizar updated_at automáticamente
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- 6. Trigger para actualizar updated_at en properties
DROP TRIGGER IF EXISTS update_properties_updated_at ON properties;
CREATE TRIGGER update_properties_updated_at
    BEFORE UPDATE ON properties
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- NOTAS:
-- ============================================
-- - Plan 'Freshie': Plan gratuito (sin acceso a propiedades)
-- - Plan 'Wolf of Wallstreet': Plan premium (con acceso a propiedades)
-- - Las imágenes se almacenan como array de strings Base64
-- - Un prospecto puede estar interesado en múltiples propiedades
-- - La tabla property_interests registra cada interés individual
-- ============================================

