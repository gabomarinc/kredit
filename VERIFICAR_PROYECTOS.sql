-- Query para verificar que los proyectos se están guardando correctamente
-- Los proyectos se guardan en la tabla 'projects' (no 'properties')

-- 1. Verificar que la tabla 'projects' existe
SELECT 
  table_name,
  column_name,
  data_type,
  is_nullable
FROM information_schema.columns
WHERE table_name = 'projects'
ORDER BY ordinal_position;

-- 2. Ver todos los proyectos guardados
SELECT 
  id,
  company_id,
  name,
  description,
  zone,
  address,
  status,
  created_at,
  updated_at
FROM projects
ORDER BY created_at DESC;

-- 3. Ver proyectos con sus modelos asociados
SELECT 
  p.id as project_id,
  p.name as project_name,
  p.zone,
  p.status,
  pm.id as model_id,
  pm.name as model_name,
  pm.price,
  pm.units_total,
  pm.units_available
FROM projects p
LEFT JOIN project_models pm ON p.id = pm.project_id
ORDER BY p.created_at DESC, pm.created_at;

-- 4. Contar proyectos por empresa
SELECT 
  c.name as company_name,
  COUNT(p.id) as total_projects,
  COUNT(pm.id) as total_models
FROM companies c
LEFT JOIN projects p ON c.id = p.company_id
LEFT JOIN project_models pm ON p.id = pm.project_id
GROUP BY c.id, c.name
ORDER BY total_projects DESC;

-- 5. Verificar proyecto específico "PH Miraview"
SELECT 
  p.*,
  json_agg(
    json_build_object(
      'id', pm.id,
      'name', pm.name,
      'price', pm.price,
      'units_total', pm.units_total,
      'units_available', pm.units_available
    )
  ) as models
FROM projects p
LEFT JOIN project_models pm ON p.id = pm.project_id
WHERE p.name ILIKE '%Miraview%'
GROUP BY p.id;

