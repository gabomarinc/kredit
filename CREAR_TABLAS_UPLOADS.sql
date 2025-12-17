-- ============================================
-- CREAR TABLAS PARA SISTEMA DE UPLOADS/CAMPAÑAS
-- ============================================
-- Este script crea las tablas necesarias para el sistema de campañas de WhatsApp
-- Tabla: uploads (campañas subidas)
-- Tabla: uploads_prospects (prospectos de cada campaña)

-- Tabla de campañas/uploads
CREATE TABLE IF NOT EXISTS uploads (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID REFERENCES companies(id) ON DELETE CASCADE NOT NULL,
    name TEXT NOT NULL,
    status TEXT DEFAULT 'active' CHECK (status IN ('active', 'archived')),
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Tabla de prospectos de campañas/uploads
CREATE TABLE IF NOT EXISTS uploads_prospects (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    campaign_id UUID REFERENCES uploads(id) ON DELETE CASCADE NOT NULL,
    name TEXT,
    phone TEXT,
    email TEXT,
    data JSONB, -- Datos completos del Excel/CSV
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'failed')),
    sent_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Índices para optimizar consultas
CREATE INDEX IF NOT EXISTS idx_uploads_company ON uploads(company_id);
CREATE INDEX IF NOT EXISTS idx_uploads_prospects_campaign ON uploads_prospects(campaign_id);
CREATE INDEX IF NOT EXISTS idx_uploads_prospects_status ON uploads_prospects(status);

-- Comentarios en las tablas
COMMENT ON TABLE uploads IS 'Campañas/uploads de prospectos importados desde Excel/CSV';
COMMENT ON TABLE uploads_prospects IS 'Prospectos individuales de cada campaña/upload';

