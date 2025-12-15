-- Crear tabla para guardar intereses de prospectos en modelos de proyectos
CREATE TABLE IF NOT EXISTS project_model_interests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  prospect_id UUID REFERENCES prospects(id) ON DELETE CASCADE NOT NULL,
  project_model_id UUID REFERENCES project_models(id) ON DELETE CASCADE NOT NULL,
  interested BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW(),
  CONSTRAINT project_model_interests_unique UNIQUE(prospect_id, project_model_id)
);

-- Crear índices para mejorar el rendimiento de las consultas
CREATE INDEX IF NOT EXISTS idx_project_model_interests_prospect_id ON project_model_interests(prospect_id);
CREATE INDEX IF NOT EXISTS idx_project_model_interests_model_id ON project_model_interests(project_model_id);

-- Nota: Si la tabla ya existe pero no tiene la restricción UNIQUE, puedes ejecutar:
-- ALTER TABLE project_model_interests 
-- ADD CONSTRAINT project_model_interests_unique UNIQUE(prospect_id, project_model_id);
