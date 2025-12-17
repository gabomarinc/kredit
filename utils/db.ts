/// <reference types="vite/client" />
import { Pool } from '@neondatabase/serverless';
import { CalculationResult, Prospect, PersonalData, FinancialData, UserPreferences, Project, ProjectModel, Company, CompanyData } from '../types';
import { MOCK_PROSPECTS } from '../constants';
import pako from 'pako';
import { uploadProspectFilesToDrive, refreshAccessToken, downloadFileFromDriveAsBase64 } from './googleDrive';

// Usar variable de entorno para la conexión a Neon
// En Vercel, configurar VITE_DATABASE_URL en las variables de entorno del proyecto
// Nota: En Vite, solo las variables con prefijo VITE_ son accesibles en el cliente
const CONNECTION_STRING = import.meta.env.VITE_DATABASE_URL;

// Debug: Verificar si la variable está disponible (solo primeros caracteres por seguridad)
if (CONNECTION_STRING) {
  console.log('✅ DATABASE_URL configurada:', CONNECTION_STRING.substring(0, 30) + '...');
} else {
  console.error('❌ VITE_DATABASE_URL NO está configurada. Verifica las variables de entorno en Vercel.');
  console.log('Variables disponibles:', Object.keys(import.meta.env).filter(k => k.startsWith('VITE_')));
}

const pool = CONNECTION_STRING ? new Pool({ connectionString: CONNECTION_STRING }) : null;

// Helper para asegurar que las tablas existan antes de operar
const ensureTablesExist = async (client: any) => {
  try {
    // Tabla de empresas/usuarios
    await client.query(`
      CREATE TABLE IF NOT EXISTS companies (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        name TEXT NOT NULL,
        email TEXT UNIQUE NOT NULL,
        password_hash TEXT NOT NULL,
        company_name TEXT,
        logo_url TEXT,
        role TEXT DEFAULT 'Broker' CHECK (role IN ('Promotora', 'Broker')),
        google_drive_access_token TEXT,
        google_drive_refresh_token TEXT,
        google_drive_folder_id TEXT,
        created_at TIMESTAMP DEFAULT NOW()
      )
    `);

    // Tabla de zonas por empresa
    await client.query(`
      CREATE TABLE IF NOT EXISTS company_zones (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        company_id UUID REFERENCES companies(id) ON DELETE CASCADE,
        zone_name TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT NOW(),
        CONSTRAINT company_zones_unique UNIQUE(company_id, zone_name)
      )
    `);

    // Asegurar que la restricción UNIQUE existe (por si la tabla ya existía sin ella)
    try {
      await client.query(`
        DO $$ 
        BEGIN
          IF NOT EXISTS (
            SELECT 1 FROM pg_constraint 
            WHERE conname = 'company_zones_unique'
          ) THEN
            ALTER TABLE company_zones 
            ADD CONSTRAINT company_zones_unique UNIQUE(company_id, zone_name);
          END IF;
        END $$;
      `);
    } catch (e) {
      console.warn('Nota: No se pudo agregar la restricción UNIQUE (puede que ya exista):', e);
    }

    // Tabla de prospectos
    await client.query(`
      CREATE TABLE IF NOT EXISTS prospects (
        id SERIAL PRIMARY KEY,
        company_id UUID REFERENCES companies(id) ON DELETE SET NULL,
        full_name TEXT,
        email TEXT,
        phone TEXT,
        monthly_income NUMERIC,
        property_type TEXT,
        bedrooms INTEGER,
        bathrooms INTEGER,
        interested_zones TEXT[],
        calculation_result JSONB,
        status TEXT DEFAULT 'Nuevo',
        id_file_drive_id TEXT,
        ficha_file_drive_id TEXT,
        talonario_file_drive_id TEXT,
        signed_acp_file_drive_id TEXT,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      )
    `);

    // Agregar columnas de archivos si no existen (para tablas ya creadas)
    // Agregar columnas de archivos si no existen (para tablas ya creadas)
    try {
      await client.query(`ALTER TABLE prospects ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES companies(id) ON DELETE SET NULL`);
      await client.query(`ALTER TABLE prospects ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT NOW()`);

      // Columnas para Google Drive (nuevo sistema)
      await client.query(`ALTER TABLE prospects ADD COLUMN IF NOT EXISTS id_file_drive_id TEXT`);
      await client.query(`ALTER TABLE prospects ADD COLUMN IF NOT EXISTS ficha_file_drive_id TEXT`);
      await client.query(`ALTER TABLE prospects ADD COLUMN IF NOT EXISTS talonario_file_drive_id TEXT`);
      await client.query(`ALTER TABLE prospects ADD COLUMN IF NOT EXISTS signed_acp_file_drive_id TEXT`);
    } catch (e) {
      console.warn('Nota: Error actualizando columnas de prospects:', e);
    }

    // Agregar columna de plan, role y Google Drive a companies si no existe
    // Agregar columna de plan, role y Google Drive a companies si no existe
    try {
      // Postgres 9.6+ soporta IF NOT EXISTS en ADD COLUMN
      await client.query(`ALTER TABLE companies ADD COLUMN IF NOT EXISTS plan TEXT DEFAULT 'Freshie' CHECK (plan IN ('Freshie', 'Wolf of Wallstreet'))`);
      await client.query(`ALTER TABLE companies ADD COLUMN IF NOT EXISTS role TEXT DEFAULT 'Broker' CHECK (role IN ('Promotora', 'Broker'))`);
      await client.query(`ALTER TABLE companies ADD COLUMN IF NOT EXISTS google_drive_access_token TEXT`);
      await client.query(`ALTER TABLE companies ADD COLUMN IF NOT EXISTS google_drive_refresh_token TEXT`);
      await client.query(`ALTER TABLE companies ADD COLUMN IF NOT EXISTS google_drive_folder_id TEXT`);

      // Columnas para Configurar Calculadora (Fase 1)
      await client.query(`ALTER TABLE companies ADD COLUMN IF NOT EXISTS apc_document_drive_id TEXT`);
      await client.query(`ALTER TABLE companies ADD COLUMN IF NOT EXISTS requested_documents JSONB DEFAULT '{"idFile": true, "fichaFile": true, "talonarioFile": true, "signedAcpFile": true}'::jsonb`);
    } catch (e) {
      console.warn('Nota: Error al intentar actualizar columnas de companies:', e);
    }

    // Tabla de propiedades
    await client.query(`
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
        images TEXT[],
        address TEXT,
        features TEXT[],
        status TEXT DEFAULT 'Activa' CHECK (status IN ('Activa', 'Inactiva', 'Vendida', 'Alquilada')),
        high_demand BOOLEAN DEFAULT false,
        demand_visits INTEGER DEFAULT 0,
        price_adjusted BOOLEAN DEFAULT false,
        price_adjustment_percent NUMERIC DEFAULT 0,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      )
    `);

    // Tabla de intereses de prospectos en propiedades
    await client.query(`
      CREATE TABLE IF NOT EXISTS property_interests (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        prospect_id UUID REFERENCES prospects(id) ON DELETE CASCADE NOT NULL,
        property_id UUID REFERENCES properties(id) ON DELETE CASCADE NOT NULL,
        interested BOOLEAN DEFAULT true,
        created_at TIMESTAMP DEFAULT NOW(),
        CONSTRAINT property_interests_unique UNIQUE(prospect_id, property_id)
      )
    `);

    // Asegurar que la restricción UNIQUE existe (por si la tabla ya existía sin ella)
    try {
      await client.query(`
        DO $$ 
        BEGIN
          IF NOT EXISTS (
            SELECT 1 FROM pg_constraint 
            WHERE conname = 'property_interests_unique'
          ) THEN
            ALTER TABLE property_interests 
            ADD CONSTRAINT property_interests_unique UNIQUE(prospect_id, property_id);
          END IF;
        END $$;
      `);
    } catch (e) {
      console.warn('Nota: No se pudo agregar la restricción UNIQUE (puede que ya exista):', e);
    }

    // Tabla de proyectos (para Promotora)
    await client.query(`
      CREATE TABLE IF NOT EXISTS projects (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        company_id UUID REFERENCES companies(id) ON DELETE CASCADE NOT NULL,
        name TEXT NOT NULL,
        description TEXT,
        zone TEXT,
        address TEXT,
        images TEXT[],
        status TEXT DEFAULT 'Activo' CHECK (status IN ('Activo', 'Inactivo')),
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      )
    `);

    // Tabla de modelos dentro de un proyecto
    await client.query(`
      CREATE TABLE IF NOT EXISTS project_models (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        project_id UUID REFERENCES projects(id) ON DELETE CASCADE NOT NULL,
        name TEXT NOT NULL,
        area_m2 NUMERIC,
        bedrooms INTEGER,
        bathrooms NUMERIC,
        amenities TEXT[],
        units_total INTEGER NOT NULL,
        units_available INTEGER NOT NULL,
        price NUMERIC NOT NULL,
        images TEXT[],
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      )
    `);

    // Crear índices si no existen
    try {
      await client.query(`CREATE INDEX IF NOT EXISTS idx_properties_company_id ON properties(company_id)`);
      await client.query(`CREATE INDEX IF NOT EXISTS idx_properties_status ON properties(status)`);
      await client.query(`CREATE INDEX IF NOT EXISTS idx_properties_type ON properties(type)`);
      await client.query(`CREATE INDEX IF NOT EXISTS idx_properties_zone ON properties(zone)`);
      await client.query(`CREATE INDEX IF NOT EXISTS idx_property_interests_prospect_id ON property_interests(prospect_id)`);
      await client.query(`CREATE INDEX IF NOT EXISTS idx_property_interests_property_id ON property_interests(property_id)`);
      await client.query(`CREATE INDEX IF NOT EXISTS idx_property_interests_interested ON property_interests(interested)`);
      await client.query(`CREATE INDEX IF NOT EXISTS idx_projects_company_id ON projects(company_id)`);
      await client.query(`CREATE INDEX IF NOT EXISTS idx_project_models_project_id ON project_models(project_id)`);
      await client.query(`CREATE INDEX IF NOT EXISTS idx_project_model_interests_prospect_id ON project_model_interests(prospect_id)`);
      await client.query(`CREATE INDEX IF NOT EXISTS idx_project_model_interests_model_id ON project_model_interests(project_model_id)`);
    } catch (e) {
      console.warn('Nota: No se pudieron crear índices (pueden que ya existan):', e);
    }

    // Tabla de campañas/uploads
    await client.query(`
      CREATE TABLE IF NOT EXISTS uploads (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        company_id UUID REFERENCES companies(id) ON DELETE CASCADE NOT NULL,
        name TEXT NOT NULL,
        status TEXT DEFAULT 'active' CHECK (status IN ('active', 'archived')),
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      )
    `);

    // Tabla de prospectos de campañas/uploads
    await client.query(`
      CREATE TABLE IF NOT EXISTS uploads_prospects (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        campaign_id UUID REFERENCES uploads(id) ON DELETE CASCADE NOT NULL,
        name TEXT,
        phone TEXT,
        email TEXT,
        data JSONB, -- Datos completos del Excel
        status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'failed')),
        sent_at TIMESTAMP,
        created_at TIMESTAMP DEFAULT NOW()
      )
    `);

    // Índices para uploads
    try {
      await client.query(`CREATE INDEX IF NOT EXISTS idx_uploads_company ON uploads(company_id)`);
      await client.query(`CREATE INDEX IF NOT EXISTS idx_uploads_prospects_campaign ON uploads_prospects(campaign_id)`);
      await client.query(`CREATE INDEX IF NOT EXISTS idx_uploads_prospects_status ON uploads_prospects(status)`);
    } catch (e) {
      console.warn('Nota: Indices de uploads posiblemente ya existen', e);
    }

  } catch (e) {
    console.warn("Nota: Verificación de tablas omitida o fallida (puede que ya existan o falten permisos DDL).", e);
  }
};

// Función helper para convertir File a Base64
const fileToBase64 = (file: File | null): Promise<string | null> => {
  return new Promise((resolve, reject) => {
    if (!file) {
      resolve(null);
      return;
    }

    const reader = new FileReader();
    reader.onloadend = () => {
      const result = reader.result as string;
      resolve(result);
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
};

// Función helper para comprimir JSON (optimización de red)
const compressJSON = (data: any): string => {
  try {
    const jsonString = JSON.stringify(data);
    const compressed = pako.deflate(jsonString);
    // Convertir Uint8Array a string base64
    const binaryString = String.fromCharCode(...compressed);
    const base64 = btoa(binaryString);
    return base64;
  } catch (error) {
    console.error('❌ Error comprimiendo JSON:', error);
    return JSON.stringify(data); // Fallback a JSON sin comprimir
  }
};

// Función helper para descomprimir JSON
const decompressJSON = (data: any): any => {
  if (!data) return {};

  try {
    // Si es un string, intentar parsearlo primero
    let parsed: any = data;
    if (typeof data === 'string') {
      parsed = JSON.parse(data);
    }

    // Si es un objeto con propiedad 'compressed', extraer el valor comprimido
    if (parsed && typeof parsed === 'object' && 'compressed' in parsed) {
      const compressedBase64 = parsed.compressed;
      // Descomprimir el string base64
      const binaryString = atob(compressedBase64);
      const bytes = Uint8Array.from(binaryString, c => c.charCodeAt(0));
      const decompressed = pako.inflate(bytes);
      const jsonString = String.fromCharCode(...decompressed);
      return JSON.parse(jsonString);
    }

    // Si es un string base64 directo (formato antiguo sin wrapper)
    if (typeof parsed === 'string') {
      try {
        const binaryString = atob(parsed);
        const bytes = Uint8Array.from(binaryString, c => c.charCodeAt(0));
        const decompressed = pako.inflate(bytes);
        const jsonString = String.fromCharCode(...decompressed);
        return JSON.parse(jsonString);
      } catch {
        // Si falla, intentar parsear como JSON normal
        return JSON.parse(parsed);
      }
    }

    // Si ya es un objeto JSON (formato muy antiguo sin compresión)
    return parsed;
  } catch (error) {
    console.error('❌ Error descomprimiendo JSON:', error);
    return {};
  }
};

export const saveProspectToDB = async (
  personal: PersonalData,
  financial: FinancialData,
  preferences: UserPreferences,
  result: CalculationResult,
  companyId?: string | null
) => {
  if (!pool) {
    console.error('❌ Pool de base de datos no inicializado. Verifica VITE_DATABASE_URL en Vercel.');
    console.log('Datos que se intentaron guardar:', {
      name: personal.fullName,
      email: personal.email,
      income: financial.familyIncome
    });
    return 'temp-id-' + Date.now();
  }



  try {
    console.log('🔄 Intentando conectar a la base de datos...');
    const client = await pool.connect();
    console.log('✅ Conexión establecida');

    // Aseguramos que las tablas existan (Auto-migración simple)
    await ensureTablesExist(client);

    // 1. Insertamos prospecto inicial SIN archivos base64
    const query = `
      INSERT INTO prospects (
        company_id,
        full_name, 
        email, 
        phone, 
        monthly_income, 
        property_type, 
        bedrooms, 
        bathrooms, 
        interested_zones, 
        calculation_result,
        status,
        created_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, 'Nuevo', NOW())
      RETURNING id
    `;

    const values = [
      companyId || null,
      personal.fullName,
      personal.email,
      personal.phone,
      financial.familyIncome,
      preferences.propertyType,
      preferences.bedrooms,
      preferences.bathrooms,
      preferences.zone,
      JSON.stringify(result)
    ];

    const res = await client.query(query, values);
    const prospectId = res.rows[0].id;
    client.release();

    console.log("✅ Prospect saved with ID:", prospectId);

    // 2. Si hay archivos y companyId, intentar subirlos a Google Drive
    const hasFiles = personal.idFile || personal.fichaFile || personal.talonarioFile || personal.signedAcpFile;

    if (hasFiles && companyId) {
      console.log('🔄 Archivos detectados, intentando subir a Google Drive...');

      try {
        // Obtener credenciales de la empresa
        const credsClient = await pool.connect();
        const credsRes = await credsClient.query(
          'SELECT google_drive_access_token, google_drive_refresh_token, google_drive_folder_id FROM companies WHERE id = $1',
          [companyId]
        );
        credsClient.release();

        if (credsRes.rows.length > 0 && credsRes.rows[0].google_drive_folder_id) {
          const { google_drive_access_token, google_drive_refresh_token, google_drive_folder_id } = credsRes.rows[0];
          let accessToken = google_drive_access_token;

          if (accessToken) {
            // Intentar subir archivos
            let driveFileIds;
            try {
              driveFileIds = await uploadProspectFilesToDrive(
                accessToken,
                google_drive_folder_id,
                personal.fullName,
                prospectId,
                {
                  idFile: personal.idFile,
                  fichaFile: personal.fichaFile,
                  talonarioFile: personal.talonarioFile,
                  signedAcpFile: personal.signedAcpFile
                }
              );
            } catch (error: any) {
              // Manejo de token expirado
              if (error?.status === 401 && google_drive_refresh_token) {
                console.log('🔄 Token expirado al guardar, intentando renovar...');
                const newAccessToken = await refreshAccessToken(google_drive_refresh_token);
                if (newAccessToken) {
                  // Actualizar token en BD
                  const updateClient = await pool.connect();
                  await updateClient.query(
                    'UPDATE companies SET google_drive_access_token = $1 WHERE id = $2',
                    [newAccessToken, companyId]
                  );
                  updateClient.release();

                  // Reintentar subida
                  driveFileIds = await uploadProspectFilesToDrive(
                    newAccessToken,
                    google_drive_folder_id,
                    personal.fullName,
                    prospectId,
                    {
                      idFile: personal.idFile,
                      fichaFile: personal.fichaFile,
                      talonarioFile: personal.talonarioFile,
                      signedAcpFile: personal.signedAcpFile
                    }
                  );
                }
              } else {
                throw error;
              }
            }

            if (driveFileIds) {
              // 3. Actualizar prospecto con IDs de Drive
              console.log('✅ Archivos subidos a Drive, actualizando prospecto...');
              const updateClient = await pool.connect();
              await updateClient.query(`
                UPDATE prospects SET
                  id_file_drive_id = $1,
                  ficha_file_drive_id = $2,
                  talonario_file_drive_id = $3,
                  signed_acp_file_drive_id = $4,
                  updated_at = NOW()
                WHERE id = $5
              `, [
                driveFileIds.idFileUrl || null,
                driveFileIds.fichaFileUrl || null,
                driveFileIds.talonarioFileUrl || null,
                driveFileIds.signedAcpFileUrl || null,
                prospectId
              ]);
              updateClient.release();
            }
          }
        }
      } catch (driveError) {
        console.error('❌ Error subiendo archivos a Drive al guardar prospecto:', driveError);
        // No fallamos la operación principal, el prospecto ya se guardó
      }
    }

    console.log("✅ Proceso completado exitosamente");
    return prospectId;

  } catch (error) {
    console.error('❌ CRITICAL Error saving prospect:', error);
    console.error('Error details:', {
      message: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
      connectionString: CONNECTION_STRING ? 'Configurada' : 'NO CONFIGURADA'
    });
    // No lanzamos error para no interrumpir la experiencia de usuario (Emotional Design)
    return 'temp-id-' + Date.now();
  }
};

// Guardar prospecto inicial (nombre, correo, teléfono, monthly_income, property_type, bedrooms, bathrooms, interested_zones)
export const saveProspectInitial = async (
  personal: { fullName: string; email: string; phone: string },
  financial: { familyIncome: number },
  preferences: { propertyType: string; bedrooms: number | null; bathrooms: number | null; zone: string[] | string },
  companyId?: string | null
): Promise<string | null> => {
  if (!pool) {
    console.error('❌ Pool de base de datos no inicializado.');
    return null;
  }

  try {
    console.log('🔄 Guardando prospecto inicial con todos los datos...');
    const client = await pool.connect();
    await ensureTablesExist(client);

    // Asegurar que zones sea un array
    const zonesArray = Array.isArray(preferences.zone)
      ? preferences.zone
      : (preferences.zone ? [preferences.zone] : []);

    // Preparar valores
    const monthlyIncome = typeof financial.familyIncome === 'number' ? financial.familyIncome : parseFloat(String(financial.familyIncome || 0));
    const propertyType = String(preferences.propertyType || '');
    const bedrooms = preferences.bedrooms !== undefined && preferences.bedrooms !== null ? Number(preferences.bedrooms) : null;
    const bathrooms = preferences.bathrooms !== undefined && preferences.bathrooms !== null ? parseFloat(String(preferences.bathrooms)) : null;

    // Insertar datos básicos + preferencias
    const query = `
      INSERT INTO prospects (
        company_id,
        full_name,
        email,
        phone,
        monthly_income,
        property_type,
        bedrooms,
        bathrooms,
        interested_zones,
        status,
        created_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'Nuevo', NOW())
      RETURNING id
    `;

    const values = [
      companyId || null,
      personal.fullName,
      personal.email,
      personal.phone,
      monthlyIncome,
      propertyType,
      bedrooms,
      bathrooms,
      zonesArray
    ];

    console.log('📤 Guardando prospecto inicial con valores:', {
      full_name: values[1],
      email: values[2],
      phone: values[3],
      monthly_income: values[4],
      property_type: values[5],
      bedrooms: values[6],
      bathrooms: values[7],
      interested_zones: values[8]
    });

    const res = await client.query(query, values);
    client.release();
    console.log('✅ Prospecto inicial guardado con ID:', res.rows[0].id);
    return res.rows[0].id.toString();

  } catch (error) {
    console.error('❌ Error guardando prospecto inicial:', error);
    return null;
  }
};

// Actualizar prospecto existente (solo archivos y calculation_result)
// NUEVO: Los archivos se suben a Google Drive en lugar de guardarse como Base64
export const updateProspectToDB = async (
  prospectId: string,
  personal: PersonalData,
  result: CalculationResult
): Promise<boolean> => {
  if (!pool) {
    console.error('❌ Pool de base de datos no inicializado.');
    return false;
  }

  try {
    console.log('🔄 Actualizando prospecto con archivos y calculation_result:', prospectId);
    console.log('📋 Datos a actualizar:', {
      hasIdFile: !!personal.idFile,
      hasFichaFile: !!personal.fichaFile,
      hasTalonarioFile: !!personal.talonarioFile,
      hasSignedAcpFile: !!personal.signedAcpFile,
      hasResult: !!result
    });

    const client = await pool.connect();
    await ensureTablesExist(client);

    // 1. Obtener información del prospecto (company_id, nombre)
    const prospectResult = await client.query(
      'SELECT company_id, full_name FROM prospects WHERE id = $1',
      [prospectId]
    );

    if (prospectResult.rows.length === 0) {
      console.error('❌ Prospecto no encontrado:', prospectId);
      client.release();
      return false;
    }

    const prospect = prospectResult.rows[0];
    const companyId = prospect.company_id;
    const prospectName = prospect.full_name || 'Prospecto';

    if (!companyId) {
      console.error('❌ El prospecto no tiene company_id asociado');
      client.release();
      return false;
    }

    // 2. Obtener credenciales de Google Drive de la empresa
    const companyResult = await client.query(
      'SELECT google_drive_access_token, google_drive_refresh_token, google_drive_folder_id FROM companies WHERE id = $1',
      [companyId]
    );

    if (companyResult.rows.length === 0 || !companyResult.rows[0].google_drive_folder_id) {
      console.error('❌ Empresa no encontrada o sin configuración de Google Drive');
      client.release();
      return false;
    }

    const company = companyResult.rows[0];
    let accessToken = company.google_drive_access_token;
    const refreshToken = company.google_drive_refresh_token;
    const folderId = company.google_drive_folder_id;

    if (!accessToken || !folderId) {
      console.error('❌ Faltan credenciales de Google Drive para la empresa');
      client.release();
      return false;
    }

    // 3. Si hay archivos para subir, subirlos a Google Drive
    let driveFileIds: {
      idFileUrl?: string | null;
      fichaFileUrl?: string | null;
      talonarioFileUrl?: string | null;
      signedAcpFileUrl?: string | null;
    } = {};

    const hasFilesToUpload = personal.idFile || personal.fichaFile || personal.talonarioFile || personal.signedAcpFile;

    if (hasFilesToUpload) {
      console.log('🔄 Subiendo archivos a Google Drive...');
      console.log('📋 Archivos a subir:', {
        hasIdFile: !!personal.idFile,
        hasFichaFile: !!personal.fichaFile,
        hasTalonarioFile: !!personal.talonarioFile,
        hasSignedAcpFile: !!personal.signedAcpFile,
        accessToken: accessToken ? `${accessToken.substring(0, 20)}...` : 'null',
        folderId: folderId || 'null'
      });

      // Intentar subir archivos (con renovación automática de token si expira)
      let retryWithNewToken = false;
      try {
        driveFileIds = await uploadProspectFilesToDrive(
          accessToken,
          folderId,
          prospectName,
          prospectId,
          {
            idFile: personal.idFile || undefined,
            fichaFile: personal.fichaFile || undefined,
            talonarioFile: personal.talonarioFile || undefined,
            signedAcpFile: personal.signedAcpFile || undefined
          }
        );
        console.log('✅ Archivos subidos a Drive:', driveFileIds);
        console.log('📊 Resumen de subida:', {
          idFileId: driveFileIds.idFileUrl || 'no subido',
          fichaFileId: driveFileIds.fichaFileUrl || 'no subido',
          talonarioFileId: driveFileIds.talonarioFileUrl || 'no subido',
          signedAcpFileId: driveFileIds.signedAcpFileUrl || 'no subido'
        });
      } catch (error: any) {
        console.error('❌ Error subiendo archivos a Drive:', error);
        console.error('Error details:', {
          status: error?.status,
          message: error?.message,
          hasRefreshToken: !!refreshToken
        });

        // Si es error 401 (token expirado) y tenemos refresh token, intentar renovar
        if (refreshToken && (error?.status === 401 || error?.message?.includes('401') || error?.message?.includes('expired') || error?.message?.includes('Token expired'))) {
          console.log('🔄 Token expirado detectado, intentando renovar...');
          try {
            const newAccessToken = await refreshAccessToken(refreshToken);
            if (newAccessToken) {
              console.log('✅ Token renovado exitosamente, actualizando en BD y reintentando subida...');
              // Actualizar token en BD primero
              await client.query(
                'UPDATE companies SET google_drive_access_token = $1 WHERE id = $2',
                [newAccessToken, companyId]
              );
              // Actualizar accessToken local para el reintento
              accessToken = newAccessToken;
              // Reintentar subida con nuevo token
              try {
                driveFileIds = await uploadProspectFilesToDrive(
                  newAccessToken,
                  folderId,
                  prospectName,
                  prospectId,
                  {
                    idFile: personal.idFile || undefined,
                    fichaFile: personal.fichaFile || undefined,
                    talonarioFile: personal.talonarioFile || undefined,
                    signedAcpFile: personal.signedAcpFile || undefined
                  }
                );
                console.log('✅ Archivos subidos a Drive después de renovar token:', driveFileIds);
                retryWithNewToken = true;
              } catch (retryError) {
                console.error('❌ Error en reintento después de renovar token:', retryError);
              }
            } else {
              console.error('❌ No se pudo renovar el token - refreshAccessToken retornó null');
            }
          } catch (refreshError) {
            console.error('❌ Error renovando token:', refreshError);
          }
        } else {
          console.warn('⚠️ Token expirado pero no hay refresh token o el error no es 401');
        }

        // Si no se pudo renovar, continuar sin los archivos
        if (!retryWithNewToken) {
          console.error('❌ NO SE PUDIERON SUBIR ARCHIVOS A DRIVE. Continuando sin archivos.');
          console.error('Esto puede deberse a:');
          console.error('1. Token expirado y refresh token no funcionó');
          console.error('2. Error de permisos en Google Drive');
          console.error('3. Error de red o conexión');
          // No lanzar error, pero sí reportar claramente que no se subieron
        }
      }

      // Verificar si realmente se subieron archivos
      const filesUploaded = !!(driveFileIds.idFileUrl || driveFileIds.fichaFileUrl || driveFileIds.talonarioFileUrl || driveFileIds.signedAcpFileUrl);
      if (hasFilesToUpload && !filesUploaded) {
        console.error('❌ CRÍTICO: Se intentaron subir archivos pero ninguno se subió exitosamente');
      }
    } else {
      console.log('ℹ️ No hay archivos para subir a Drive');
    }

    // 4. Guardar calculation_result en formato JSON directo (sin comprimir para mantener consistencia)
    // Nota: calculation_result es JSONB, guardamos el objeto JSON directamente
    const calculationResultJson = JSON.stringify(result || {});

    const query = `
      UPDATE prospects SET
        calculation_result = $1::jsonb,
        id_file_drive_id = CASE WHEN $2::text IS NOT NULL AND $2::text != '' THEN $2::text ELSE id_file_drive_id END,
        ficha_file_drive_id = CASE WHEN $3::text IS NOT NULL AND $3::text != '' THEN $3::text ELSE ficha_file_drive_id END,
        talonario_file_drive_id = CASE WHEN $4::text IS NOT NULL AND $4::text != '' THEN $4::text ELSE talonario_file_drive_id END,
        signed_acp_file_drive_id = CASE WHEN $5::text IS NOT NULL AND $5::text != '' THEN $5::text ELSE signed_acp_file_drive_id END,
        updated_at = NOW()
      WHERE id = $6
    `;

    const values = [
      calculationResultJson,
      driveFileIds.idFileUrl || null,
      driveFileIds.fichaFileUrl || null,
      driveFileIds.talonarioFileUrl || null,
      driveFileIds.signedAcpFileUrl || null,
      prospectId
    ];

    console.log('📤 Ejecutando UPDATE con valores:', {
      calculation_result: calculationResultJson ? `presente (${calculationResultJson.length} chars, JSON directo)` : 'vacío',
      calculation_result_preview: calculationResultJson ? calculationResultJson.substring(0, 100) + '...' : 'null',
      id_file_drive_id: values[1] || 'null',
      ficha_file_drive_id: values[2] || 'null',
      talonario_file_drive_id: values[3] || 'null',
      signed_acp_file_drive_id: values[4] || 'null',
      prospect_id: values[5]
    });

    try {
      const updateResult = await client.query(query, values);
      client.release();

      if (updateResult.rowCount === 0) {
        console.error('⚠️ UPDATE ejecutado pero ninguna fila fue afectada. Prospecto puede no existir:', prospectId);
        return false;
      }

      console.log('✅ Prospecto actualizado exitosamente. Filas afectadas:', updateResult.rowCount);
      return true;
    } catch (updateError: any) {
      client.release();
      console.error('❌ Error ejecutando UPDATE:', updateError);
      console.error('Query:', query);
      console.error('Values:', values.map((v, i) => `${i}: ${v ? (typeof v === 'string' ? v.substring(0, 50) + '...' : String(v)) : 'null'}`));
      throw updateError; // Re-lanzar para que el catch externo lo maneje
    }

  } catch (error: any) {
    console.error('❌ Error actualizando prospecto:', error);
    console.error('Error details:', {
      message: error?.message,
      code: error?.code,
      detail: error?.detail,
      hint: error?.hint,
      stack: error?.stack
    });
    return false;
  }
};

// Helper function to safely parse potential JSON strings
const safeParseJSON = (input: any) => {
  if (typeof input === 'string') {
    try {
      return JSON.parse(input);
    } catch {
      return {};
    }
  }
  return input || {};
};

export const getProspectsFromDB = async (companyId?: string | null): Promise<Prospect[]> => {
  if (!pool) {
    console.error('❌ Pool de base de datos no inicializado. Retornando array vacío.');
    return [];
  }

  try {
    console.log('🔄 Consultando base de datos...', { companyId });
    const client = await pool.connect();

    // Aseguramos que las tablas existan antes de consultar
    await ensureTablesExist(client);

    // Obtenemos los prospectos filtrados por company_id (si se proporciona)
    // IMPORTANTE: Solo mostrar prospectos de la empresa actual
    let query = `
      SELECT 
        id, company_id, full_name, email, phone, monthly_income, 
        property_type, bedrooms, bathrooms, interested_zones, 
        calculation_result, status, created_at, updated_at
      FROM prospects 
    `;

    const queryParams: any[] = [];

    if (companyId) {
      query += ` WHERE company_id = $1`;
      queryParams.push(companyId);
    } else {
      // Si no hay companyId, solo retornar prospectos sin company_id (por seguridad)
      query += ` WHERE company_id IS NULL`;
    }

    query += ` ORDER BY created_at DESC LIMIT 50`;

    const res = await client.query(query, queryParams);

    client.release();

    console.log(`📊 Registros encontrados en DB: ${res.rows.length}`);

    // Si la tabla está vacía, retornar array vacío en lugar de mockups
    // Solo usar mockups si hay un error de conexión
    if (res.rows.length === 0) {
      console.log('ℹ️ La tabla prospects está vacía. No hay datos guardados aún.');
      return [];
    }

    // Mapeamos los resultados de la DB (snake_case) a nuestro tipo TypeScript (camelCase)
    return res.rows.map((row: any) => ({
      id: String(row.id),
      companyId: row.company_id || null,
      name: row.full_name || '',
      email: row.email || '',
      phone: row.phone || '',
      income: parseFloat(row.monthly_income || 0),
      date: new Date(row.created_at).toISOString(), // Guardar como ISO para filtros de fecha
      dateDisplay: new Date(row.created_at).toLocaleDateString('es-PA', { year: 'numeric', month: 'short', day: 'numeric' }),
      status: (row.status || 'Nuevo') as 'Nuevo' | 'Contactado' | 'En Proceso',
      propertyType: row.property_type || '',
      bedrooms: row.bedrooms || null,
      bathrooms: row.bathrooms || null,
      // Ensure zone is treated safely - puede ser array o string
      zone: Array.isArray(row.interested_zones) && row.interested_zones.length > 0
        ? row.interested_zones
        : (typeof row.interested_zones === 'string' ? [row.interested_zones.replace(/[{}"\\]/g, '')] : []),
      // Ensure result is an object
      result: decompressJSON(row.calculation_result) || {
        maxPropertyPrice: 0,
        monthlyPayment: 0,
        downPaymentPercent: 0,
        downPaymentAmount: 0
      },
      // Archivos en Base64 - NO se cargan por defecto (lazy loading)
      idFileBase64: null,
      fichaFileBase64: null,
      talonarioFileBase64: null,
      signedAcpFileBase64: null
    }));

  } catch (error) {
    console.error('❌ Error consultando prospectos:', error);
    // Retornar array vacío en lugar de mockups para evitar mostrar datos incorrectos
    return [];
  }
};

// Obtener documentos de un prospecto específico (lazy loading)
// NUEVO: Retorna URLs de Google Drive si están disponibles, sino retorna Base64 (backward compatibility)
export const getProspectDocuments = async (prospectId: string): Promise<{
  idFileBase64: string | null;
  fichaFileBase64: string | null;
  talonarioFileBase64: string | null;
  signedAcpFileBase64: string | null;
  idFileDriveUrl?: string | null;
  fichaFileDriveUrl?: string | null;
  talonarioFileDriveUrl?: string | null;
  signedAcpFileDriveUrl?: string | null;
}> => {
  if (!pool) {
    console.error('❌ Pool de base de datos no inicializado.');
    return {
      idFileBase64: null,
      fichaFileBase64: null,
      talonarioFileBase64: null,
      signedAcpFileBase64: null,
      idFileDriveUrl: null,
      fichaFileDriveUrl: null,
      talonarioFileDriveUrl: null,
      signedAcpFileDriveUrl: null
    };
  }

  try {
    const client = await pool.connect();
    await ensureTablesExist(client);

    // IMPORTANTE: la columna id de prospects es UUID, así que siempre usamos el string directamente
    // (antes se intentaba parsear a número para compatibilidad con SERIAL y rompía con UUIDs)
    const res = await client.query(`
      SELECT 
        p.id_file_drive_id,
        p.ficha_file_drive_id,
        p.talonario_file_drive_id,
        p.signed_acp_file_drive_id,
        p.company_id,
        c.google_drive_access_token,
        c.google_drive_refresh_token
      FROM prospects p
      LEFT JOIN companies c ON p.company_id = c.id
      WHERE p.id = $1
    `, [prospectId]);

    if (res.rows.length === 0) {
      client.release();
      return {
        idFileBase64: null,
        fichaFileBase64: null,
        talonarioFileBase64: null,
        signedAcpFileBase64: null,
        idFileDriveUrl: null,
        fichaFileDriveUrl: null,
        talonarioFileDriveUrl: null,
        signedAcpFileDriveUrl: null
      };
    }

    const row = res.rows[0];
    client.release();

    // Si hay IDs de Drive, descargarlos usando el access token de la empresa
    let accessToken = row.google_drive_access_token;
    const refreshToken = row.google_drive_refresh_token;
    const hasDriveIds = !!(row.id_file_drive_id || row.ficha_file_drive_id || row.talonario_file_drive_id || row.signed_acp_file_drive_id);

    // Función helper para descargar archivo de Drive y convertirlo a Base64
    const downloadFileIfNeeded = async (fileId: string | null): Promise<string | null> => {
      // Si no hay ID de Drive, retornar null (ya NO usamos base64 de BD)
      if (!fileId) {
        return null;
      }

      // Si no hay access token, no podemos descargar
      if (!accessToken) {
        console.warn('⚠️ No hay access token para descargar archivo de Drive:', fileId);
        return null;
      }

      try {
        console.log('🔄 Descargando archivo de Drive:', fileId);
        const base64 = await downloadFileFromDriveAsBase64(accessToken, fileId);
        if (base64) {
          console.log('✅ Archivo descargado exitosamente');
          return base64;
        }
        return null;
      } catch (error: any) {
        // Si es error 401 y tenemos refresh token, intentar renovar
        if (error?.status === 401 && refreshToken) {
          console.log('🔄 Token expirado, intentando renovar...');
          try {
            const newAccessToken = await refreshAccessToken(refreshToken);
            if (newAccessToken) {
              console.log('✅ Token renovado, reintentando descarga...');
              // Actualizar token en BD
              const updateClient = await pool.connect();
              await updateClient.query(
                'UPDATE companies SET google_drive_access_token = $1 WHERE id = $2',
                [newAccessToken, row.company_id]
              );
              updateClient.release();

              accessToken = newAccessToken;
              // Reintentar descarga
              const base64 = await downloadFileFromDriveAsBase64(newAccessToken, fileId);
              return base64 || null;
            }
          } catch (refreshError) {
            console.error('❌ Error renovando token:', refreshError);
          }
        }
        console.error('❌ Error descargando archivo de Drive:', error);
        return null;
      }
    };

    // Si hay IDs de Drive, descargarlos
    if (hasDriveIds && accessToken) {
      console.log('🔄 Descargando archivos de Google Drive...');
      const [idFileBase64, fichaFileBase64, talonarioFileBase64, signedAcpFileBase64] = await Promise.all([
        downloadFileIfNeeded(row.id_file_drive_id),
        downloadFileIfNeeded(row.ficha_file_drive_id),
        downloadFileIfNeeded(row.talonario_file_drive_id),
        downloadFileIfNeeded(row.signed_acp_file_drive_id)
      ]);

      return {
        idFileBase64,
        fichaFileBase64,
        talonarioFileBase64,
        signedAcpFileBase64,
        // Mantener URLs de Drive para referencia (aunque preferimos Base64 descargado)
        idFileDriveUrl: row.id_file_drive_id ? `https://drive.google.com/file/d/${row.id_file_drive_id}/view` : null,
        fichaFileDriveUrl: row.ficha_file_drive_id ? `https://drive.google.com/file/d/${row.ficha_file_drive_id}/view` : null,
        talonarioFileDriveUrl: row.talonario_file_drive_id ? `https://drive.google.com/file/d/${row.talonario_file_drive_id}/view` : null,
        signedAcpFileDriveUrl: row.signed_acp_file_drive_id ? `https://drive.google.com/file/d/${row.signed_acp_file_drive_id}/view` : null
      };
    }

    // Si no hay IDs de Drive, usar Base64 antiguo (backward compatibility)
    return {
      idFileBase64: row.id_file_base64 || null,
      fichaFileBase64: row.ficha_file_base64 || null,
      talonarioFileBase64: row.talonario_file_base64 || null,
      signedAcpFileBase64: row.signed_acp_file_base64 || null,
      idFileDriveUrl: null,
      fichaFileDriveUrl: null,
      talonarioFileDriveUrl: null,
      signedAcpFileDriveUrl: null
    };
  } catch (error) {
    console.error('❌ Error obteniendo documentos del prospecto:', error);
    return {
      idFileBase64: null,
      fichaFileBase64: null,
      talonarioFileBase64: null,
      signedAcpFileBase64: null,
      idFileDriveUrl: null,
      fichaFileDriveUrl: null,
      talonarioFileDriveUrl: null,
      signedAcpFileDriveUrl: null
    };
  }
};


// ========== FUNCIONES PARA EMPRESAS/USUARIOS ==========
// Definitions moved to types.ts

// Función simple para hash de contraseña (en producción usar bcrypt)
const simpleHash = (password: string): string => {
  // NOTA: Esto es solo para demo. En producción usar bcrypt o similar
  return btoa(password).split('').reverse().join('');
};

// Guardar nueva empresa/usuario
export const saveCompanyToDB = async (data: CompanyData): Promise<string | null> => {
  if (!pool) {
    console.error('❌ Pool de base de datos no inicializado. No se puede guardar la empresa.');
    return null;
  }

  try {
    console.log('🔄 Guardando nueva empresa en la base de datos...');
    const client = await pool.connect();

    await ensureTablesExist(client);

    // Verificar si el email ya existe
    const checkEmail = await client.query(
      'SELECT id FROM companies WHERE email = $1',
      [data.email]
    );

    if (checkEmail.rows.length > 0) {
      console.warn('⚠️ El email ya está registrado');
      client.release();
      return null;
    }

    // Hash de contraseña (simple, en producción usar bcrypt)
    const passwordHash = simpleHash(data.password);

    // Insertar empresa
    const companyResult = await client.query(`
      INSERT INTO companies (name, email, password_hash, company_name, logo_url, role, google_drive_access_token, google_drive_refresh_token, google_drive_folder_id)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      RETURNING id
    `, [
      data.name,
      data.email,
      passwordHash,
      data.companyName || data.name,
      data.logoUrl || null,
      data.role || 'Broker',
      data.googleDriveAccessToken || null,
      data.googleDriveRefreshToken || null,
      data.googleDriveFolderId || null
    ]);

    const companyId = companyResult.rows[0].id;
    console.log('✅ Empresa guardada con ID:', companyId);
    console.log('📋 Zonas recibidas:', data.zones);
    console.log('📋 Tipo de zonas:', typeof data.zones, Array.isArray(data.zones));

    // Insertar zonas - CRÍTICO: Hacer esto ANTES de liberar el client
    if (data.zones && Array.isArray(data.zones) && data.zones.length > 0) {
      console.log(`🔄 Guardando ${data.zones.length} zonas para company_id: ${companyId}...`);
      console.log('📋 Lista completa de zonas:', JSON.stringify(data.zones));

      let zonesSaved = 0;
      let zonesErrors = 0;

      for (const zoneName of data.zones) {
        if (!zoneName || typeof zoneName !== 'string') {
          console.warn(`⚠️ Zona inválida omitida:`, zoneName);
          continue;
        }

        try {
          console.log(`🔄 Intentando guardar zona: "${zoneName}"`);
          const zoneResult = await client.query(`
            INSERT INTO company_zones (company_id, zone_name)
            VALUES ($1, $2)
            ON CONFLICT ON CONSTRAINT company_zones_unique DO NOTHING
            RETURNING id
          `, [companyId, zoneName.trim()]);

          if (zoneResult.rows.length > 0) {
            zonesSaved++;
            console.log(`✅ Zona guardada exitosamente: "${zoneName}" (ID: ${zoneResult.rows[0].id})`);
          } else {
            console.log(`ℹ️ Zona ya existía (conflicto): "${zoneName}"`);
            zonesSaved++; // Contamos como guardada porque ya existe
          }
        } catch (zoneError) {
          zonesErrors++;
          console.error(`❌ ERROR guardando zona "${zoneName}":`, zoneError);
          console.error('Detalles del error:', {
            message: zoneError instanceof Error ? zoneError.message : String(zoneError),
            code: (zoneError as any)?.code,
            detail: (zoneError as any)?.detail
          });
        }
      }

      console.log(`📊 Resumen: ${zonesSaved} zonas guardadas, ${zonesErrors} errores`);

      // Verificar que realmente se guardaron
      const verifyResult = await client.query(
        'SELECT COUNT(*) as count FROM company_zones WHERE company_id = $1',
        [companyId]
      );
      const actualCount = parseInt(verifyResult.rows[0].count);
      console.log(`🔍 Verificación: ${actualCount} zonas encontradas en DB para company_id ${companyId}`);

      if (actualCount === 0 && zonesSaved > 0) {
        console.error('❌ CRÍTICO: Se reportaron zonas guardadas pero no se encuentran en la DB');
      }
    } else {
      console.warn('⚠️ No hay zonas para guardar:', {
        zones: data.zones,
        isArray: Array.isArray(data.zones),
        length: data.zones?.length
      });
    }

    client.release();
    console.log('✅ Registro completado exitosamente');
    console.log('✅ Retornando companyId:', companyId);
    return companyId;

  } catch (error) {
    console.error('❌ Error guardando empresa:', error);
    console.error('Error details:', {
      message: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined
    });
    // Si hay un error pero la empresa ya se creó, intentar obtener el ID
    try {
      const client = await pool!.connect();
      const result = await client.query('SELECT id FROM companies WHERE email = $1', [data.email]);
      client.release();
      if (result.rows.length > 0) {
        console.log('⚠️ Error después de crear, pero empresa existe. Retornando ID:', result.rows[0].id);
        return result.rows[0].id;
      }
    } catch (e) {
      console.error('Error al verificar empresa existente:', e);
    }
    return null;
  }
};

// Verificar login
export const verifyLogin = async (email: string, password: string): Promise<Company | null> => {
  if (!pool) {
    console.error('❌ Pool de base de datos no inicializado.');
    return null;
  }

  try {
    console.log('🔄 Verificando credenciales...');
    const client = await pool.connect();

    await ensureTablesExist(client);

    // Buscar empresa por email
    const companyResult = await client.query(
      'SELECT * FROM companies WHERE email = $1',
      [email]
    );

    if (companyResult.rows.length === 0) {
      console.warn('⚠️ Email no encontrado');
      client.release();
      return null;
    }

    const company = companyResult.rows[0];
    const passwordHash = simpleHash(password);

    // Verificar contraseña
    if (company.password_hash !== passwordHash) {
      console.warn('⚠️ Contraseña incorrecta');
      client.release();
      return null;
    }

    // Obtener zonas de la empresa
    const zonesResult = await client.query(
      'SELECT zone_name FROM company_zones WHERE company_id = $1 ORDER BY zone_name',
      [company.id]
    );

    const zones = zonesResult.rows.map(row => row.zone_name);

    client.release();

    console.log('✅ Login exitoso');
    return {
      id: company.id,
      name: company.name,
      email: company.email,
      companyName: company.name, // Asumiendo que name es el nombre de la empresa
      logoUrl: company.logo_url,
      zones: zones,
      plan: (company.plan || 'Freshie') as 'Freshie' | 'Wolf of Wallstreet',
      role: (company.role || 'Broker') as 'Promotora' | 'Broker'
    };

  } catch (error) {
    console.error('❌ Error verificando login:', error);
    return null;
  }
};

// Obtener empresa por ID
export const getCompanyById = async (companyId: string): Promise<Company | null> => {
  if (!pool) {
    return null;
  }

  try {
    const client = await pool.connect();

    const companyResult = await client.query(
      'SELECT * FROM companies WHERE id = $1',
      [companyId]
    );

    if (companyResult.rows.length === 0) {
      client.release();
      return null;
    }

    const company = companyResult.rows[0];

    // Obtener zonas
    const zonesResult = await client.query(
      'SELECT zone_name FROM company_zones WHERE company_id = $1 ORDER BY zone_name',
      [companyId]
    );

    const zones = zonesResult.rows.map(row => row.zone_name);

    client.release();

    // Parsear requested_documents JSONB o usar valores por defecto
    let requestedDocuments = {
      idFile: true,
      fichaFile: true,
      talonarioFile: true,
      signedAcpFile: true
    };

    if (company.requested_documents) {
      try {
        requestedDocuments = typeof company.requested_documents === 'string'
          ? JSON.parse(company.requested_documents)
          : company.requested_documents;
      } catch (e) {
        console.warn('⚠️ Error parseando requested_documents, usando valores por defecto:', e);
      }
    }

    return {
      id: company.id,
      name: company.name,
      email: company.email,
      companyName: company.company_name || company.name,
      logoUrl: company.logo_url,
      zones: zones,
      plan: (company.plan || 'Freshie') as 'Freshie' | 'Wolf of Wallstreet',
      role: (company.role || 'Broker') as 'Promotora' | 'Broker',
      googleDriveAccessToken: company.google_drive_access_token || undefined,
      googleDriveRefreshToken: company.google_drive_refresh_token || undefined,
      googleDriveFolderId: company.google_drive_folder_id || undefined,
      requestedDocuments: requestedDocuments,
      apcDocumentDriveId: company.apc_document_drive_id || undefined
    };

  } catch (error) {
    console.error('❌ Error obteniendo empresa:', error);
    return null;
  }
};

// Actualizar zonas de una empresa
export const updateCompanyZones = async (companyId: string, zones: string[]): Promise<boolean> => {
  if (!pool) {
    console.error('❌ Pool de base de datos no inicializado.');
    return false;
  }

  try {
    console.log('🔄 Actualizando zonas de la empresa...', { companyId, zones });
    const client = await pool.connect();

    // Eliminar todas las zonas actuales
    await client.query('DELETE FROM company_zones WHERE company_id = $1', [companyId]);

    // Insertar las nuevas zonas
    if (zones.length > 0) {
      for (const zoneName of zones) {
        await client.query(`
          INSERT INTO company_zones (company_id, zone_name)
          VALUES ($1, $2)
          ON CONFLICT ON CONSTRAINT company_zones_unique DO NOTHING
        `, [companyId, zoneName]);
      }
    }

    client.release();
    console.log(`✅ ${zones.length} zonas actualizadas en la base de datos`);
    return true;

  } catch (error) {
    console.error('❌ Error actualizando zonas:', error);
    return false;
  }
};

// Actualizar logo de una empresa
export const updateCompanyLogo = async (companyId: string, logoBase64: string): Promise<boolean> => {
  if (!pool) {
    console.error('❌ Pool de base de datos no inicializado.');
    return false;
  }

  try {
    console.log('🔄 Actualizando logo de la empresa...', { companyId });
    const client = await pool.connect();

    await ensureTablesExist(client);

    await client.query(
      'UPDATE companies SET logo_url = $1 WHERE id = $2',
      [logoBase64, companyId]
    );

    client.release();
    console.log('✅ Logo actualizado exitosamente en la base de datos');
    return true;

  } catch (error) {
    console.error('❌ Error actualizando logo:', error);
    return false;
  }
};

// ============================================
// FUNCIONES PARA SISTEMA DE PLANES
// ============================================

// Actualizar plan de una empresa
// Actualizar nombre de la empresa
export const updateCompanyName = async (companyId: string, companyName: string): Promise<boolean> => {
  if (!pool) {
    console.error('❌ Pool de base de datos no inicializado.');
    return false;
  }

  try {
    console.log('🔄 Actualizando nombre de la empresa...', { companyId, companyName });
    const client = await pool.connect();

    await client.query(
      'UPDATE companies SET company_name = $1 WHERE id = $2',
      [companyName, companyId]
    );

    client.release();
    console.log('✅ Nombre de la empresa actualizado en la base de datos');
    return true;

  } catch (error) {
    console.error('❌ Error actualizando nombre de la empresa:', error);
    return false;
  }
};

export const updateCompanyPlan = async (companyId: string, plan: 'Freshie' | 'Wolf of Wallstreet'): Promise<boolean> => {
  if (!pool) {
    console.error('❌ Pool de base de datos no inicializado.');
    return false;
  }

  try {
    const client = await pool.connect();
    await ensureTablesExist(client);

    await client.query(
      'UPDATE companies SET plan = $1 WHERE id = $2',
      [plan, companyId]
    );

    client.release();
    console.log(`✅ Plan actualizado a ${plan} para la empresa ${companyId}`);
    return true;

  } catch (error) {
    console.error('❌ Error actualizando plan:', error);
    return false;
  }
};

// Actualizar configuración de Google Drive de una empresa (tokens y carpeta)
export const updateCompanyGoogleDriveConfig = async (
  companyId: string,
  accessToken: string,
  refreshToken: string,
  folderId?: string | null
): Promise<boolean> => {
  if (!pool) {
    console.error('❌ Pool de base de datos no inicializado.');
    return false;
  }

  try {
    console.log('🔄 Actualizando configuración de Google Drive de la empresa...', {
      companyId,
      hasAccessToken: !!accessToken,
      hasRefreshToken: !!refreshToken,
      hasFolderId: !!folderId
    });

    const client = await pool.connect();
    await ensureTablesExist(client);

    await client.query(
      `
        UPDATE companies SET 
          google_drive_access_token = $1,
          google_drive_refresh_token = $2,
          google_drive_folder_id = $3
        WHERE id = $4
      `,
      [accessToken, refreshToken, folderId || null, companyId]
    );

    client.release();
    console.log('✅ Configuración de Google Drive actualizada para la empresa:', companyId);
    return true;
  } catch (error) {
    console.error('❌ Error actualizando configuración de Google Drive:', error);
    return false;
  }
};

// Actualizar configuración de documentos solicitados
export const updateCompanyRequestedDocuments = async (
  companyId: string,
  requestedDocuments: {
    idFile: boolean;
    fichaFile: boolean;
    talonarioFile: boolean;
    signedAcpFile: boolean;
  }
): Promise<boolean> => {
  if (!pool) {
    console.error('❌ Pool de base de datos no inicializado.');
    return false;
  }

  try {
    console.log('🔄 Actualizando documentos solicitados de la empresa...', {
      companyId,
      requestedDocuments
    });

    const client = await pool.connect();
    await ensureTablesExist(client);

    await client.query(
      'UPDATE companies SET requested_documents = $1::jsonb WHERE id = $2',
      [JSON.stringify(requestedDocuments), companyId]
    );

    client.release();
    console.log('✅ Documentos solicitados actualizados para la empresa:', companyId);
    return true;
  } catch (error) {
    console.error('❌ Error actualizando documentos solicitados:', error);
    return false;
  }
};

// Actualizar documento APC personalizado (ID de Google Drive)
export const updateCompanyApcDocument = async (
  companyId: string,
  apcDocumentDriveId: string | null
): Promise<boolean> => {
  if (!pool) {
    console.error('❌ Pool de base de datos no inicializado.');
    return false;
  }

  try {
    console.log('🔄 Actualizando documento APC de la empresa...', {
      companyId,
      hasApcDocument: !!apcDocumentDriveId
    });

    const client = await pool.connect();
    await ensureTablesExist(client);

    await client.query(
      'UPDATE companies SET apc_document_drive_id = $1 WHERE id = $2',
      [apcDocumentDriveId, companyId]
    );

    client.release();
    console.log('✅ Documento APC actualizado para la empresa:', companyId);
    return true;
  } catch (error) {
    console.error('❌ Error actualizando documento APC:', error);
    return false;
  }
};

// ============================================
// FUNCIONES PARA SISTEMA DE PROPIEDADES
// ============================================

import { Property, PropertyInterest } from '../types';

// Obtener todas las propiedades de una empresa
export const getPropertiesByCompany = async (companyId: string): Promise<Property[]> => {
  if (!pool) {
    return [];
  }

  try {
    const client = await pool.connect();
    await ensureTablesExist(client);

    const res = await client.query(
      'SELECT * FROM properties WHERE company_id = $1 ORDER BY created_at DESC',
      [companyId]
    );

    client.release();

    return res.rows.map((row: any) => ({
      id: row.id,
      companyId: row.company_id,
      title: row.title,
      description: row.description,
      type: row.type as 'Venta' | 'Alquiler',
      price: parseFloat(row.price || 0),
      zone: row.zone,
      bedrooms: row.bedrooms,
      bathrooms: row.bathrooms ? parseFloat(row.bathrooms) : null,
      areaM2: row.area_m2 ? parseFloat(row.area_m2) : null,
      images: Array.isArray(row.images) ? row.images : [],
      address: row.address,
      features: Array.isArray(row.features) ? row.features : [],
      status: row.status as 'Activa' | 'Inactiva' | 'Vendida' | 'Alquilada',
      highDemand: row.high_demand || false,
      demandVisits: row.demand_visits || 0,
      priceAdjusted: row.price_adjusted || false,
      priceAdjustmentPercent: row.price_adjustment_percent ? parseFloat(row.price_adjustment_percent) : 0,
      createdAt: row.created_at ? new Date(row.created_at).toISOString() : undefined,
      updatedAt: row.updated_at ? new Date(row.updated_at).toISOString() : undefined
    }));

  } catch (error) {
    console.error('❌ Error obteniendo propiedades:', error);
    return [];
  }
};

// Obtener todas las imágenes de una propiedad específica (lazy loading)
export const getPropertyImages = async (propertyId: string): Promise<string[]> => {
  if (!pool) {
    return [];
  }

  try {
    const client = await pool.connect();
    await ensureTablesExist(client);

    const res = await client.query(
      'SELECT images FROM properties WHERE id = $1',
      [propertyId]
    );

    client.release();

    if (res.rows.length === 0) {
      return [];
    }

    return Array.isArray(res.rows[0].images) ? res.rows[0].images : [];
  } catch (error) {
    console.error('❌ Error obteniendo imágenes de propiedad:', error);
    return [];
  }
};

// Obtener propiedades disponibles para un prospecto (basado en precio máximo y zona)
export const getAvailablePropertiesForProspect = async (
  companyId: string,
  maxPrice: number,
  interestedZones: string[]
): Promise<Property[]> => {
  if (!pool) {
    return [];
  }

  try {
    const client = await pool.connect();
    await ensureTablesExist(client);

    // Buscar propiedades activas que:
    // 1. Pertenezcan a la empresa
    // 2. Estén en las zonas de interés del prospecto (si hay zonas especificadas)
    // 3. El precio esté dentro del rango (para venta: precio <= maxPrice * 1.1, para alquiler: precio <= maxPrice * 0.3)
    // 4. Estén activas

    let query = `
      SELECT * FROM properties 
      WHERE company_id = $1 
      AND status = 'Activa'
      AND (
        (type = 'Venta' AND price <= $2 * 1.1)
        OR
        (type = 'Alquiler' AND price <= $2 * 0.3)
      )
    `;

    const values: any[] = [companyId, maxPrice];

    // Si hay zonas de interés, filtrar por ellas
    if (interestedZones && interestedZones.length > 0) {
      query += ` AND zone = ANY($3)`;
      values.push(interestedZones);
    }

    query += ` ORDER BY 
      CASE WHEN type = 'Venta' THEN 1 ELSE 2 END,
      price ASC,
      created_at DESC
      LIMIT 20`;

    const res = await client.query(query, values);
    client.release();

    return res.rows.map((row: any) => ({
      id: row.id,
      companyId: row.company_id,
      title: row.title,
      description: row.description,
      type: row.type as 'Venta' | 'Alquiler',
      price: parseFloat(row.price || 0),
      zone: row.zone,
      bedrooms: row.bedrooms,
      bathrooms: row.bathrooms ? parseFloat(row.bathrooms) : null,
      areaM2: row.area_m2 ? parseFloat(row.area_m2) : null,
      images: Array.isArray(row.images) ? row.images : [],
      address: row.address,
      features: Array.isArray(row.features) ? row.features : [],
      status: row.status as 'Activa' | 'Inactiva' | 'Vendida' | 'Alquilada',
      highDemand: row.high_demand || false,
      demandVisits: row.demand_visits || 0,
      priceAdjusted: row.price_adjusted || false,
      priceAdjustmentPercent: row.price_adjustment_percent ? parseFloat(row.price_adjustment_percent) : 0,
      createdAt: row.created_at ? new Date(row.created_at).toISOString() : undefined,
      updatedAt: row.updated_at ? new Date(row.updated_at).toISOString() : undefined
    }));

  } catch (error) {
    console.error('❌ Error obteniendo propiedades disponibles:', error);
    return [];
  }
};

// Crear/Actualizar propiedad
export const saveProperty = async (property: Omit<Property, 'id' | 'createdAt' | 'updatedAt'>): Promise<string | null> => {
  if (!pool) {
    console.error('❌ Pool de base de datos no inicializado.');
    return null;
  }

  try {
    const client = await pool.connect();
    await ensureTablesExist(client);

    const query = `
      INSERT INTO properties (
        company_id, title, description, type, price, zone, bedrooms, bathrooms, area_m2,
        images, address, features, status, high_demand, demand_visits, price_adjusted, price_adjustment_percent
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17)
      RETURNING id
    `;

    const values = [
      property.companyId,
      property.title,
      property.description || null,
      property.type,
      property.price,
      property.zone,
      property.bedrooms || null,
      property.bathrooms || null,
      property.areaM2 || null,
      property.images || [],
      property.address || null,
      property.features || [],
      property.status || 'Activa',
      property.highDemand || false,
      property.demandVisits || 0,
      property.priceAdjusted || false,
      property.priceAdjustmentPercent || 0
    ];

    const res = await client.query(query, values);
    client.release();

    console.log('✅ Propiedad guardada con ID:', res.rows[0].id);
    return res.rows[0].id;

  } catch (error) {
    console.error('❌ Error guardando propiedad:', error);
    return null;
  }
};

// Actualizar propiedad
export const updateProperty = async (propertyId: string, property: Partial<Omit<Property, 'id' | 'companyId' | 'createdAt'>>): Promise<boolean> => {
  if (!pool) {
    console.error('❌ Pool de base de datos no inicializado.');
    return false;
  }

  try {
    const client = await pool.connect();
    await ensureTablesExist(client);

    const updates: string[] = [];
    const values: any[] = [];
    let paramIndex = 1;

    if (property.title !== undefined) {
      updates.push(`title = $${paramIndex++}`);
      values.push(property.title);
    }
    if (property.description !== undefined) {
      updates.push(`description = $${paramIndex++}`);
      values.push(property.description);
    }
    if (property.type !== undefined) {
      updates.push(`type = $${paramIndex++}`);
      values.push(property.type);
    }
    if (property.price !== undefined) {
      updates.push(`price = $${paramIndex++}`);
      values.push(property.price);
    }
    if (property.zone !== undefined) {
      updates.push(`zone = $${paramIndex++}`);
      values.push(property.zone);
    }
    if (property.bedrooms !== undefined) {
      updates.push(`bedrooms = $${paramIndex++}`);
      values.push(property.bedrooms);
    }
    if (property.bathrooms !== undefined) {
      updates.push(`bathrooms = $${paramIndex++}`);
      values.push(property.bathrooms);
    }
    if (property.areaM2 !== undefined) {
      updates.push(`area_m2 = $${paramIndex++}`);
      values.push(property.areaM2);
    }
    if (property.images !== undefined) {
      updates.push(`images = $${paramIndex++}`);
      values.push(property.images);
    }
    if (property.address !== undefined) {
      updates.push(`address = $${paramIndex++}`);
      values.push(property.address);
    }
    if (property.features !== undefined) {
      updates.push(`features = $${paramIndex++}`);
      values.push(property.features);
    }
    if (property.status !== undefined) {
      updates.push(`status = $${paramIndex++}`);
      values.push(property.status);
    }
    if (property.highDemand !== undefined) {
      updates.push(`high_demand = $${paramIndex++}`);
      values.push(property.highDemand);
    }
    if (property.demandVisits !== undefined) {
      updates.push(`demand_visits = $${paramIndex++}`);
      values.push(property.demandVisits);
    }
    if (property.priceAdjusted !== undefined) {
      updates.push(`price_adjusted = $${paramIndex++}`);
      values.push(property.priceAdjusted);
    }
    if (property.priceAdjustmentPercent !== undefined) {
      updates.push(`price_adjustment_percent = $${paramIndex++}`);
      values.push(property.priceAdjustmentPercent);
    }

    if (updates.length === 0) {
      client.release();
      return true; // No hay nada que actualizar
    }

    values.push(propertyId);
    const query = `UPDATE properties SET ${updates.join(', ')}, updated_at = NOW() WHERE id = $${paramIndex}`;

    await client.query(query, values);
    client.release();

    console.log('✅ Propiedad actualizada');
    return true;

  } catch (error) {
    console.error('❌ Error actualizando propiedad:', error);
    return false;
  }
};

// Eliminar propiedad
export const deleteProperty = async (propertyId: string): Promise<boolean> => {
  if (!pool) {
    console.error('❌ Pool de base de datos no inicializado.');
    return false;
  }

  try {
    const client = await pool.connect();
    await ensureTablesExist(client);

    await client.query('DELETE FROM properties WHERE id = $1', [propertyId]);
    client.release();

    console.log('✅ Propiedad eliminada');
    return true;

  } catch (error) {
    console.error('❌ Error eliminando propiedad:', error);
    return false;
  }
};

// Obtener propiedad por ID
export const getPropertyById = async (propertyId: string): Promise<Property | null> => {
  if (!pool) {
    return null;
  }

  try {
    const client = await pool.connect();
    await ensureTablesExist(client);

    const res = await client.query('SELECT * FROM properties WHERE id = $1', [propertyId]);

    if (res.rows.length === 0) {
      client.release();
      return null;
    }

    const row = res.rows[0];
    client.release();

    return {
      id: row.id,
      companyId: row.company_id,
      title: row.title,
      description: row.description,
      type: row.type as 'Venta' | 'Alquiler',
      price: parseFloat(row.price || 0),
      zone: row.zone,
      bedrooms: row.bedrooms,
      bathrooms: row.bathrooms ? parseFloat(row.bathrooms) : null,
      areaM2: row.area_m2 ? parseFloat(row.area_m2) : null,
      images: Array.isArray(row.images) ? row.images : [],
      address: row.address,
      features: Array.isArray(row.features) ? row.features : [],
      status: row.status as 'Activa' | 'Inactiva' | 'Vendida' | 'Alquilada',
      highDemand: row.high_demand || false,
      demandVisits: row.demand_visits || 0,
      priceAdjusted: row.price_adjusted || false,
      priceAdjustmentPercent: row.price_adjustment_percent ? parseFloat(row.price_adjustment_percent) : 0,
      createdAt: row.created_at ? new Date(row.created_at).toISOString() : undefined,
      updatedAt: row.updated_at ? new Date(row.updated_at).toISOString() : undefined
    };

  } catch (error) {
    console.error('❌ Error obteniendo propiedad:', error);
    return null;
  }
};

// ============================================
// FUNCIONES PARA INTERESES EN PROPIEDADES
// ============================================

// Guardar/Actualizar interés de un prospecto en una propiedad
export const savePropertyInterest = async (
  prospectId: string,
  propertyId: string,
  interested: boolean = true
): Promise<boolean> => {
  if (!pool) {
    console.error('❌ Pool de base de datos no inicializado.');
    return false;
  }

  try {
    const client = await pool.connect();
    await ensureTablesExist(client);

    // Usar INSERT ... ON CONFLICT para actualizar si ya existe
    await client.query(`
      INSERT INTO property_interests (prospect_id, property_id, interested)
      VALUES ($1, $2, $3)
      ON CONFLICT (prospect_id, property_id)
      DO UPDATE SET interested = $3, created_at = NOW()
    `, [prospectId, propertyId, interested]);

    client.release();
    console.log(`✅ Interés ${interested ? 'guardado' : 'removido'} para prospecto ${prospectId} en propiedad ${propertyId}`);
    return true;

  } catch (error) {
    console.error('❌ Error guardando interés:', error);
    return false;
  }
};

// Obtener intereses de una empresa (propiedades con prospectos interesados)
export const getPropertyInterestsByCompany = async (companyId: string): Promise<PropertyInterest[]> => {
  if (!pool) {
    return [];
  }

  try {
    const client = await pool.connect();
    await ensureTablesExist(client);

    const res = await client.query(`
      SELECT 
        pi.*,
        p.id as prospect_id_full,
        p.full_name,
        p.email,
        p.phone,
        p.monthly_income,
        p.calculation_result,
        prop.*
      FROM property_interests pi
      INNER JOIN prospects p ON pi.prospect_id = p.id
      INNER JOIN properties prop ON pi.property_id = prop.id
      WHERE prop.company_id = $1 AND pi.interested = true
      ORDER BY pi.created_at DESC
    `, [companyId]);

    client.release();

    return res.rows.map((row: any) => {
      const prospect: Prospect = {
        id: String(row.prospect_id_full),
        name: row.full_name || '',
        email: row.email || '',
        phone: row.phone || '',
        income: parseFloat(row.monthly_income || 0),
        date: new Date().toISOString(),
        dateDisplay: '',
        status: 'Nuevo',
        result: decompressJSON(row.calculation_result) || {
          maxPropertyPrice: 0,
          monthlyPayment: 0,
          downPaymentPercent: 0,
          downPaymentAmount: 0
        },
        zone: []
      };

      const property: Property = {
        id: row.property_id,
        companyId: row.company_id,
        title: row.title,
        description: row.description,
        type: row.type as 'Venta' | 'Alquiler',
        price: parseFloat(row.price || 0),
        zone: row.zone,
        bedrooms: row.bedrooms,
        bathrooms: row.bathrooms ? parseFloat(row.bathrooms) : null,
        areaM2: row.area_m2 ? parseFloat(row.area_m2) : null,
        // Solo primera imagen para lazy loading (optimización de red)
        images: Array.isArray(row.images) && row.images.length > 0 ? [row.images[0]] : [],
        address: row.address,
        features: Array.isArray(row.features) ? row.features : [],
        status: row.status as 'Activa' | 'Inactiva' | 'Vendida' | 'Alquilada',
        highDemand: row.high_demand || false,
        demandVisits: row.demand_visits || 0,
        priceAdjusted: row.price_adjusted || false,
        priceAdjustmentPercent: row.price_adjustment_percent ? parseFloat(row.price_adjustment_percent) : 0,
        createdAt: row.created_at ? new Date(row.created_at).toISOString() : undefined,
        updatedAt: row.updated_at ? new Date(row.updated_at).toISOString() : undefined
      };

      return {
        id: row.id,
        prospectId: String(row.prospect_id),
        propertyId: row.property_id,
        interested: row.interested,
        createdAt: row.created_at ? new Date(row.created_at).toISOString() : undefined,
        prospect,
        property
      };
    });

  } catch (error) {
    console.error('❌ Error obteniendo intereses:', error);
    return [];
  }
};

// Obtener propiedades en las que un prospecto está interesado
export const getPropertyInterestsByProspect = async (prospectId: string): Promise<Property[]> => {
  if (!pool) {
    return [];
  }

  try {
    const client = await pool.connect();
    await ensureTablesExist(client);

    const res = await client.query(`
      SELECT prop.*
      FROM property_interests pi
      INNER JOIN properties prop ON pi.property_id = prop.id
      WHERE pi.prospect_id = $1 AND pi.interested = true
      ORDER BY pi.created_at DESC
    `, [prospectId]);

    client.release();

    return res.rows.map((row: any) => ({
      id: row.id,
      companyId: row.company_id,
      title: row.title,
      description: row.description,
      type: row.type as 'Venta' | 'Alquiler',
      price: parseFloat(row.price || 0),
      zone: row.zone,
      bedrooms: row.bedrooms,
      bathrooms: row.bathrooms ? parseFloat(row.bathrooms) : null,
      areaM2: row.area_m2 ? parseFloat(row.area_m2) : null,
      images: Array.isArray(row.images) ? row.images : [],
      address: row.address,
      features: Array.isArray(row.features) ? row.features : [],
      status: row.status as 'Activa' | 'Inactiva' | 'Vendida' | 'Alquilada',
      highDemand: row.high_demand || false,
      demandVisits: row.demand_visits || 0,
      priceAdjusted: row.price_adjusted || false,
      priceAdjustmentPercent: row.price_adjustment_percent ? parseFloat(row.price_adjustment_percent) : 0,
      createdAt: row.created_at ? new Date(row.created_at).toISOString() : undefined,
      updatedAt: row.updated_at ? new Date(row.updated_at).toISOString() : undefined
    }));

  } catch (error) {
    console.error('❌ Error obteniendo propiedades del prospecto:', error);
    return [];
  }
};

// Obtener modelos de proyectos en los que un prospecto está interesado
export const getProjectModelInterestsByProspect = async (prospectId: string): Promise<Array<{ model: ProjectModel; project: Project }>> => {
  if (!pool) {
    return [];
  }

  try {
    const client = await pool.connect();
    await ensureTablesExist(client);

    const res = await client.query(`
      SELECT 
        pm.*,
        p.id as project_id,
        p.name as project_name,
        p.description as project_description,
        p.zone as project_zone,
        p.address as project_address,
        p.images as project_images,
        p.status as project_status
      FROM project_model_interests pmi
      INNER JOIN project_models pm ON pmi.project_model_id = pm.id
      INNER JOIN projects p ON pm.project_id = p.id
      WHERE pmi.prospect_id = $1 AND pmi.interested = true
      ORDER BY pmi.created_at DESC
    `, [prospectId]);

    client.release();

    return res.rows.map((row: any) => ({
      model: {
        id: row.id,
        name: row.name,
        areaM2: row.area_m2 ? parseFloat(row.area_m2) : undefined,
        bedrooms: row.bedrooms,
        bathrooms: row.bathrooms,
        amenities: Array.isArray(row.amenities) ? row.amenities : [],
        unitsTotal: row.units_total || 0,
        unitsAvailable: row.units_available || 0,
        price: parseFloat(row.price || 0),
        images: Array.isArray(row.images) ? row.images : []
      },
      project: {
        id: row.project_id,
        companyId: row.company_id || '',
        name: row.project_name,
        description: row.project_description,
        zone: row.project_zone,
        address: row.project_address,
        images: Array.isArray(row.project_images) ? row.project_images : [],
        status: row.project_status as 'Activo' | 'Inactivo',
        models: [] // No necesitamos todos los modelos aquí
      }
    }));

  } catch (error) {
    console.error('❌ Error obteniendo modelos de proyectos del prospecto:', error);
    return [];
  }
};

// ========== FUNCIONES PARA PROYECTOS (PROMOTORA) ==========

// Guardar proyecto con sus modelos
export const saveProject = async (project: Omit<Project, 'id' | 'createdAt' | 'updatedAt'>): Promise<string | null> => {
  if (!pool) {
    console.error('❌ Pool de base de datos no inicializado.');
    return null;
  }

  try {
    const client = await pool.connect();
    await ensureTablesExist(client);

    // Insertar proyecto
    const projectQuery = `
      INSERT INTO projects (company_id, name, description, zone, address, images, status)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING id
    `;

    const projectResult = await client.query(projectQuery, [
      project.companyId,
      project.name,
      project.description || null,
      project.zone || null,
      project.address || null,
      project.images || [],
      project.status || 'Activo'
    ]);

    const projectId = projectResult.rows[0].id;

    // Insertar modelos
    if (project.models && project.models.length > 0) {
      for (const model of project.models) {
        const modelQuery = `
          INSERT INTO project_models (
            project_id, name, area_m2, bedrooms, bathrooms, amenities,
            units_total, units_available, price, images
          )
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
        `;

        await client.query(modelQuery, [
          projectId,
          model.name,
          model.areaM2 || null,
          model.bedrooms || null,
          model.bathrooms || null,
          model.amenities || [],
          model.unitsTotal,
          model.unitsAvailable,
          model.price,
          model.images || []
        ]);
      }
    }

    client.release();
    console.log(`✅ Proyecto guardado con ID: ${projectId}`);
    return projectId;

  } catch (error) {
    console.error('❌ Error guardando proyecto:', error);
    return null;
  }
};

// Obtener proyectos de una empresa
// Obtener proyectos disponibles para un prospecto (basado en precio máximo y zonas)
export const getAvailableProjectsForProspect = async (
  companyId: string,
  maxPrice: number,
  interestedZones: string[],
  bedrooms?: number | null,
  bathrooms?: number | null,
  propertyType?: string | null
): Promise<Project[]> => {
  if (!pool) {
    return [];
  }

  try {
    const client = await pool.connect();
    await ensureTablesExist(client);

    // Buscar proyectos activos que:
    // 1. Pertenezcan a la empresa
    // 2. Estén en las zonas de interés del prospecto (si hay zonas especificadas)
    // 3. Tengan al menos un modelo que cumpla TODOS los criterios:
    //    - Precio <= maxPrice
    //    - Unidades disponibles > 0
    //    - Bedrooms coincide (si se especifica)
    //    - Bathrooms coincide (si se especifica)
    // 4. Estén activos

    let query = `
      SELECT 
        p.id,
        p.company_id,
        p.name,
        p.description,
        p.zone,
        p.address,
        p.images,
        p.status,
        p.created_at,
        p.updated_at,
        COALESCE(
          json_agg(
            json_build_object(
              'id', pm.id,
              'name', pm.name,
              'areaM2', pm.area_m2,
              'bedrooms', pm.bedrooms,
              'bathrooms', pm.bathrooms,
              'amenities', pm.amenities,
              'unitsTotal', pm.units_total,
              'unitsAvailable', pm.units_available,
              'price', pm.price,
              'images', pm.images
            ) ORDER BY pm.price ASC
          ) FILTER (WHERE pm.id IS NOT NULL),
          '[]'::json
        ) as models
      FROM projects p
      LEFT JOIN project_models pm ON p.id = pm.project_id
      WHERE p.company_id = $1 
      AND p.status = 'Activo'
      AND EXISTS (
        SELECT 1 FROM project_models pm2 
        WHERE pm2.project_id = p.id 
        AND pm2.price <= $2
        AND pm2.units_available > 0
    `;

    const values: any[] = [companyId, maxPrice];
    let paramIndex = 3;

    // Filtrar por bedrooms si se especifica
    if (bedrooms !== null && bedrooms !== undefined) {
      query += ` AND pm2.bedrooms = $${paramIndex}`;
      values.push(bedrooms);
      paramIndex++;
    }

    // Filtrar por bathrooms si se especifica
    if (bathrooms !== null && bathrooms !== undefined) {
      query += ` AND pm2.bathrooms = $${paramIndex}`;
      values.push(bathrooms);
      paramIndex++;
    }

    query += `      )`;

    // Filtrar modelos en el LEFT JOIN también
    query += ` AND (
      pm.id IS NULL OR (
        pm.price <= $2
        AND pm.units_available > 0
    `;

    // Aplicar mismos filtros al LEFT JOIN
    if (bedrooms !== null && bedrooms !== undefined) {
      query += ` AND pm.bedrooms = $${values.length + 1}`;
      values.push(bedrooms);
    }

    if (bathrooms !== null && bathrooms !== undefined) {
      query += ` AND pm.bathrooms = $${values.length + 1}`;
      values.push(bathrooms);
    }

    query += `      )
    )`;

    // Si hay zonas de interés, filtrar por ellas
    if (interestedZones && interestedZones.length > 0) {
      query += ` AND (p.zone = ANY($${values.length + 1}) OR p.zone IS NULL)`;
      values.push(interestedZones);
    }

    query += ` 
      GROUP BY p.id, p.company_id, p.name, p.description, p.zone, p.address, p.images, p.status, p.created_at, p.updated_at
      HAVING COUNT(pm.id) > 0
      ORDER BY p.created_at DESC
      LIMIT 50`;

    const res = await client.query(query, values);
    client.release();

    // Filtrar modelos dentro de cada proyecto según los criterios
    return res.rows.map((row: any) => {
      const filteredModels = Array.isArray(row.models) ? row.models.filter((m: any) => {
        // Filtrar por precio
        if (parseFloat(m.price || 0) > maxPrice) return false;
        if (m.unitsAvailable <= 0) return false;

        // Filtrar por bedrooms
        if (bedrooms !== null && bedrooms !== undefined && m.bedrooms !== bedrooms) return false;

        // Filtrar por bathrooms
        if (bathrooms !== null && bathrooms !== undefined && m.bathrooms !== bathrooms) return false;

        return true;
      }).map((m: any) => ({
        id: m.id,
        name: m.name,
        areaM2: m.areaM2 ? parseFloat(m.areaM2) : null,
        bedrooms: m.bedrooms,
        bathrooms: m.bathrooms ? parseFloat(m.bathrooms) : null,
        amenities: Array.isArray(m.amenities) ? m.amenities : [],
        unitsTotal: m.unitsTotal || 0,
        unitsAvailable: m.unitsAvailable || 0,
        price: parseFloat(m.price || 0),
        images: Array.isArray(m.images) ? m.images : []
      })) : [];

      return {
        id: row.id,
        companyId: row.company_id,
        name: row.name,
        description: row.description,
        zone: row.zone,
        address: row.address,
        images: Array.isArray(row.images) ? row.images : [],
        status: row.status as 'Activo' | 'Inactivo',
        createdAt: row.created_at ? new Date(row.created_at).toISOString() : undefined,
        updatedAt: row.updated_at ? new Date(row.updated_at).toISOString() : undefined,
        models: filteredModels
      };
    }).filter((project: Project) => project.models.length > 0); // Solo proyectos con modelos que cumplen criterios

  } catch (error) {
    console.error('❌ Error obteniendo proyectos disponibles:', error);
    return [];
  }
};

// Guardar interés de un prospecto en un modelo de proyecto
export const saveProjectModelInterest = async (
  prospectId: string,
  projectModelId: string,
  interested: boolean = true
): Promise<boolean> => {
  if (!pool) {
    console.error('❌ Pool de base de datos no inicializado.');
    return false;
  }

  try {
    const client = await pool.connect();
    await ensureTablesExist(client);

    // Usar INSERT ... ON CONFLICT para actualizar si ya existe
    await client.query(`
      INSERT INTO project_model_interests (prospect_id, project_model_id, interested)
      VALUES ($1, $2, $3)
      ON CONFLICT (prospect_id, project_model_id)
      DO UPDATE SET interested = $3, created_at = NOW()
    `, [prospectId, projectModelId, interested]);

    client.release();
    console.log(`✅ Interés ${interested ? 'guardado' : 'removido'} para prospecto ${prospectId} en modelo ${projectModelId}`);
    return true;

  } catch (error) {
    console.error('❌ Error guardando interés en modelo:', error);
    return false;
  }
};

export const getProjectsByCompany = async (companyId: string): Promise<Project[]> => {
  if (!pool) {
    return [];
  }

  try {
    const client = await pool.connect();
    await ensureTablesExist(client);

    // Obtener proyectos
    const projectsResult = await client.query(
      'SELECT * FROM projects WHERE company_id = $1 ORDER BY created_at DESC',
      [companyId]
    );

    // Para cada proyecto, obtener sus modelos
    const projects: Project[] = [];
    for (const row of projectsResult.rows) {
      const modelsResult = await client.query(
        'SELECT * FROM project_models WHERE project_id = $1 ORDER BY created_at',
        [row.id]
      );

      const models: ProjectModel[] = modelsResult.rows.map((modelRow: any) => ({
        id: modelRow.id,
        name: modelRow.name,
        areaM2: modelRow.area_m2 ? parseFloat(modelRow.area_m2) : null,
        bedrooms: modelRow.bedrooms,
        bathrooms: modelRow.bathrooms ? parseFloat(modelRow.bathrooms) : null,
        amenities: Array.isArray(modelRow.amenities) ? modelRow.amenities : [],
        unitsTotal: modelRow.units_total,
        unitsAvailable: modelRow.units_available,
        price: parseFloat(modelRow.price || 0),
        // Solo primera imagen para lazy loading (optimización de red)
        images: Array.isArray(modelRow.images) && modelRow.images.length > 0 ? [modelRow.images[0]] : []
      }));

      projects.push({
        id: row.id,
        companyId: row.company_id,
        name: row.name,
        description: row.description,
        zone: row.zone || '',
        address: row.address,
        // Solo primera imagen para lazy loading (optimización de red)
        images: Array.isArray(row.images) && row.images.length > 0 ? [row.images[0]] : [],
        status: row.status as 'Activo' | 'Inactivo',
        models: models,
        createdAt: row.created_at ? new Date(row.created_at).toISOString() : undefined,
        updatedAt: row.updated_at ? new Date(row.updated_at).toISOString() : undefined
      });
    }

    client.release();
    return projects;

  } catch (error) {
    console.error('❌ Error obteniendo proyectos:', error);
    return [];
  }
};

// Obtener todas las imágenes de un proyecto específico (lazy loading)
export const getProjectImages = async (projectId: string): Promise<{ projectImages: string[]; modelImages: { modelId: string; images: string[] }[] }> => {
  if (!pool) {
    return { projectImages: [], modelImages: [] };
  }

  try {
    const client = await pool.connect();
    await ensureTablesExist(client);

    // Obtener imágenes del proyecto
    const projectRes = await client.query(
      'SELECT images FROM projects WHERE id = $1',
      [projectId]
    );

    // Obtener imágenes de todos los modelos
    const modelsRes = await client.query(
      'SELECT id, images FROM project_models WHERE project_id = $1',
      [projectId]
    );

    client.release();

    const projectImages = projectRes.rows.length > 0 && Array.isArray(projectRes.rows[0].images)
      ? projectRes.rows[0].images
      : [];

    const modelImages = modelsRes.rows.map((row: any) => ({
      modelId: row.id,
      images: Array.isArray(row.images) ? row.images : []
    }));

    return { projectImages, modelImages };
  } catch (error) {
    console.error('❌ Error obteniendo imágenes de proyecto:', error);
    return { projectImages: [], modelImages: [] };
  }
};

// Actualizar proyecto
export const updateProject = async (projectId: string, project: Omit<Project, 'id' | 'companyId' | 'createdAt' | 'updatedAt'>): Promise<boolean> => {
  if (!pool) {
    console.error('❌ Pool de base de datos no inicializado.');
    return false;
  }

  try {
    const client = await pool.connect();
    await ensureTablesExist(client);

    // Actualizar proyecto
    await client.query(`
      UPDATE projects 
      SET name = $1, description = $2, zone = $3, address = $4, images = $5, status = $6, updated_at = NOW()
      WHERE id = $7
    `, [
      project.name,
      project.description || null,
      project.zone || null,
      project.address || null,
      project.images || [],
      project.status || 'Activo',
      projectId
    ]);

    // Eliminar modelos existentes
    await client.query('DELETE FROM project_models WHERE project_id = $1', [projectId]);

    // Insertar nuevos modelos
    if (project.models && project.models.length > 0) {
      for (const model of project.models) {
        await client.query(`
          INSERT INTO project_models (
            project_id, name, area_m2, bedrooms, bathrooms, amenities,
            units_total, units_available, price, images
          )
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
        `, [
          projectId,
          model.name,
          model.areaM2 || null,
          model.bedrooms || null,
          model.bathrooms || null,
          model.amenities || [],
          model.unitsTotal,
          model.unitsAvailable,
          model.price,
          model.images || []
        ]);
      }
    }

    client.release();
    console.log(`✅ Proyecto actualizado: ${projectId}`);
    return true;

  } catch (error) {
    console.error('❌ Error actualizando proyecto:', error);
    return false;
  }
};

// Eliminar proyecto
export const deleteProject = async (projectId: string): Promise<boolean> => {
  if (!pool) {
    console.error('❌ Pool de base de datos no inicializado.');
    return false;
  }

  try {
    const client = await pool.connect();
    await ensureTablesExist(client);

    // Los modelos se eliminarán automáticamente por CASCADE
    await client.query('DELETE FROM projects WHERE id = $1', [projectId]);

    client.release();
    console.log(`✅ Proyecto eliminado: ${projectId}`);
    return true;

  } catch (error) {
    console.error('❌ Error eliminando proyecto:', error);
    return false;
  }
};

// ========== WHATSBLAST FUNCTIONS ==========

export interface WhatsBlastCampaign {
  id: string;
  name: string;
  createdAt: string;
  total: number;
  sent: number;
  pending: number;
}

export const saveWhatsBlastCampaign = async (companyId: string, name: string, prospects: any[]): Promise<string | null> => {
  if (!pool) return null;
  try {
    const client = await pool.connect();
    await ensureTablesExist(client);

    // 1. Create Campaign
    const campRes = await client.query(`
            INSERT INTO uploads (company_id, name)
            VALUES ($1, $2)
            RETURNING id
        `, [companyId, name]);

    const campaignId = campRes.rows[0].id;

    // 2. Insert Prospects Batch
    // Note: For large batches we should potentially chunk this, but for <1000 rows a single loop/transaction is fine or batch insert.
    // We'll do loop for simplicity and safety for now or construct a large INSERT.
    // Given existing code style, let's loop but use single transaction.

    await client.query('BEGIN');

    for (const p of prospects) {
      const dataJson = JSON.stringify(p);
      await client.query(`
                INSERT INTO uploads_prospects (campaign_id, name, phone, email, data, status)
                VALUES ($1, $2, $3, $4, $5, 'pending')
             `, [
        campaignId,
        p.nombreCompleto || p.nombre || '',
        p.telefono || '',
        p.email || '',
        dataJson
      ]);
    }

    await client.query('COMMIT');
    client.release();
    return campaignId;

  } catch (e) {
    console.error("Error saving campaign:", e);
    return null;
  }
}

export const getWhatsBlastCampaigns = async (companyId: string): Promise<WhatsBlastCampaign[]> => {
  if (!pool) return [];
  try {
    const client = await pool.connect();
    await ensureTablesExist(client);

    const res = await client.query(`
            SELECT 
                c.id, c.name, c.created_at,
                COUNT(p.id) as total,
                COUNT(CASE WHEN p.status = 'sent' THEN 1 END) as sent,
                COUNT(CASE WHEN p.status = 'pending' THEN 1 END) as pending
            FROM uploads c
            LEFT JOIN uploads_prospects p ON p.campaign_id = c.id
            WHERE c.company_id = $1 AND c.status = 'active'
            GROUP BY c.id
            ORDER BY c.created_at DESC
        `, [companyId]);

    client.release();

    return res.rows.map((row: any) => ({
      id: row.id,
      name: row.name,
      createdAt: row.created_at,
      total: parseInt(row.total),
      sent: parseInt(row.sent),
      pending: parseInt(row.pending)
    }));

  } catch (e) {
    console.error("Error getting campaigns:", e);
    return [];
  }
}

export const getCampaignProspects = async (campaignId: string): Promise<any[]> => {
  if (!pool) return [];
  try {
    const client = await pool.connect();
    const res = await client.query(`
            SELECT * FROM uploads_prospects WHERE campaign_id = $1 ORDER BY created_at ASC
        `, [campaignId]);
    client.release();

    return res.rows.map((row: any) => {
      const data = row.data || {};
      return {
        ...data,
        id: row.id, // Override ID with DB UUID
        status: row.status, // Override status
        dbStatus: row.status // Keep separate key if needed
      };
    });
  } catch (e) {
    console.error("Error fetching campaign prospects:", e);
    return [];
  }
}

export const updateWhatsBlastProspectStatus = async (prospectId: string, status: 'sent' | 'pending' | 'failed'): Promise<boolean> => {
  if (!pool) return false;
  try {
    const client = await pool.connect();
    await client.query(`
            UPDATE uploads_prospects 
            SET status = $1, sent_at = ${status === 'sent' ? 'NOW()' : 'NULL'}
            WHERE id = $2
        `, [status, prospectId]);
    client.release();
    return true;
  } catch (e) {
    console.error("Error updating prospect status:", e);
    return false;
  }
}

export const deleteWhatsBlastCampaign = async (campaignId: string, companyId: string): Promise<boolean> => {
  if (!pool) return false;
  try {
    const client = await pool.connect();
    await ensureTablesExist(client);
    
    // Verify that the campaign belongs to the company before deleting
    const verifyRes = await client.query(`
      SELECT id FROM uploads WHERE id = $1 AND company_id = $2
    `, [campaignId, companyId]);
    
    if (verifyRes.rows.length === 0) {
      client.release();
      return false; // Campaign doesn't exist or doesn't belong to company
    }
    
    // Mark campaign as archived (soft delete)
    await client.query(`
      UPDATE uploads 
      SET status = 'archived', updated_at = NOW()
      WHERE id = $1 AND company_id = $2
    `, [campaignId, companyId]);
    
    client.release();
    return true;
  } catch (e) {
    console.error("Error deleting campaign:", e);
    return false;
  }
}