/// <reference types="vite/client" />
import { Pool } from '@neondatabase/serverless';
import { CalculationResult, Prospect, PersonalData, FinancialData, UserPreferences, Project, ProjectModel } from '../types';
import { MOCK_PROSPECTS } from '../constants';

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
        id_file_base64 TEXT,
        ficha_file_base64 TEXT,
        talonario_file_base64 TEXT,
        signed_acp_file_base64 TEXT,
        created_at TIMESTAMP DEFAULT NOW()
      )
    `);
    
    // Agregar columnas de archivos si no existen (para tablas ya creadas)
    try {
      await client.query(`
        DO $$
        BEGIN
          IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'prospects' AND column_name = 'id_file_base64') THEN
            ALTER TABLE prospects ADD COLUMN id_file_base64 TEXT;
          END IF;
          IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'prospects' AND column_name = 'ficha_file_base64') THEN
            ALTER TABLE prospects ADD COLUMN ficha_file_base64 TEXT;
          END IF;
          IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'prospects' AND column_name = 'talonario_file_base64') THEN
            ALTER TABLE prospects ADD COLUMN talonario_file_base64 TEXT;
          END IF;
          IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'prospects' AND column_name = 'signed_acp_file_base64') THEN
            ALTER TABLE prospects ADD COLUMN signed_acp_file_base64 TEXT;
          END IF;
          IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'prospects' AND column_name = 'company_id') THEN
            ALTER TABLE prospects ADD COLUMN company_id UUID REFERENCES companies(id) ON DELETE SET NULL;
          END IF;
        END $$;
      `);
    } catch (e) {
      console.warn('Nota: No se pudieron agregar las columnas de archivos (puede que ya existan):', e);
    }

    // Agregar columna de plan a companies si no existe
    try {
      await client.query(`
        DO $$
        BEGIN
          IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'companies' AND column_name = 'plan') THEN
            ALTER TABLE companies ADD COLUMN plan TEXT DEFAULT 'Freshie' CHECK (plan IN ('Freshie', 'Wolf of Wallstreet'));
          END IF;
          IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'companies' AND column_name = 'role') THEN
            ALTER TABLE companies ADD COLUMN role TEXT DEFAULT 'Broker' CHECK (role IN ('Promotora', 'Broker'));
          END IF;
        END $$;
      `);
    } catch (e) {
      console.warn('Nota: No se pudo agregar la columna plan (puede que ya exista):', e);
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
    } catch (e) {
      console.warn('Nota: No se pudieron crear índices (pueden que ya existan):', e);
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
    
    // Convertir archivos a Base64
    console.log('🔄 Convirtiendo archivos a Base64...');
    const [idFileBase64, fichaFileBase64, talonarioFileBase64, signedAcpFileBase64] = await Promise.all([
      fileToBase64(personal.idFile),
      fileToBase64(personal.fichaFile),
      fileToBase64(personal.talonarioFile),
      fileToBase64(personal.signedAcpFile)
    ]);
    
    console.log('✅ Archivos convertidos:', {
      hasIdFile: !!idFileBase64,
      hasFichaFile: !!fichaFileBase64,
      hasTalonarioFile: !!talonarioFileBase64,
      hasSignedAcpFile: !!signedAcpFileBase64
    });
    
    // Insertamos en la tabla prospects
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
        id_file_base64,
        ficha_file_base64,
        talonario_file_base64,
        signed_acp_file_base64,
        created_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, 'Nuevo', $11, $12, $13, $14, NOW())
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
      preferences.zone, // Postgres lo guardará como Array text[]
      JSON.stringify(result), // Guardamos el resultado como JSON
      idFileBase64,
      fichaFileBase64,
      talonarioFileBase64,
      signedAcpFileBase64
    ];

    const res = await client.query(query, values);
    client.release();
    console.log("✅ Prospect saved with ID:", res.rows[0].id);
    console.log("✅ Datos guardados correctamente en Neon");
    return res.rows[0].id;

  } catch (error) {
    console.error('❌ CRITICAL Error saving prospect:', error);
    console.error('Error details:', {
      message: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
      connectionString: CONNECTION_STRING ? 'Configurada' : 'NO CONFIGURADA'
    });
    // No lanzamos error para no interrumpir la experiencia de usuario (Emotional Design)
    // El usuario verá la pantalla de éxito aunque la DB fallé.
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

    // Convertir archivos a Base64
    console.log('🔄 Convirtiendo archivos a Base64...');
    const [idFileBase64, fichaFileBase64, talonarioFileBase64, signedAcpFileBase64] = await Promise.all([
      fileToBase64(personal.idFile),
      fileToBase64(personal.fichaFile),
      fileToBase64(personal.talonarioFile),
      fileToBase64(personal.signedAcpFile)
    ]);

    console.log('✅ Archivos convertidos:', {
      hasIdFile: !!idFileBase64,
      hasFichaFile: !!fichaFileBase64,
      hasTalonarioFile: !!talonarioFileBase64,
      hasSignedAcpFile: !!signedAcpFileBase64
    });

    // Actualizar prospecto - SOLO archivos y calculation_result
    // IMPORTANTE: Actualizar calculation_result siempre, y archivos solo si están presentes
    const query = `
      UPDATE prospects SET
        calculation_result = $1,
        id_file_base64 = CASE WHEN $2 IS NOT NULL AND $2 != '' THEN $2 ELSE id_file_base64 END,
        ficha_file_base64 = CASE WHEN $3 IS NOT NULL AND $3 != '' THEN $3 ELSE ficha_file_base64 END,
        talonario_file_base64 = CASE WHEN $4 IS NOT NULL AND $4 != '' THEN $4 ELSE talonario_file_base64 END,
        signed_acp_file_base64 = CASE WHEN $5 IS NOT NULL AND $5 != '' THEN $5 ELSE signed_acp_file_base64 END,
        updated_at = NOW()
      WHERE id = $6
    `;

    const values = [
      JSON.stringify(result || {}),
      idFileBase64 || null,
      fichaFileBase64 || null,
      talonarioFileBase64 || null,
      signedAcpFileBase64 || null,
      prospectId
    ];

    console.log('📤 Ejecutando UPDATE con valores:', {
      calculation_result: values[0] ? 'presente (' + values[0].substring(0, 50) + '...)' : 'vacío',
      id_file: values[1] ? 'presente (' + (values[1] as string).substring(0, 50) + '...)' : 'null',
      ficha_file: values[2] ? 'presente (' + (values[2] as string).substring(0, 50) + '...)' : 'null',
      talonario_file: values[3] ? 'presente (' + (values[3] as string).substring(0, 50) + '...)' : 'null',
      signed_acp_file: values[4] ? 'presente (' + (values[4] as string).substring(0, 50) + '...)' : 'null',
      prospect_id: values[5]
    });

    const updateResult = await client.query(query, values);
    client.release();
    
    console.log('✅ Prospecto actualizado exitosamente. Filas afectadas:', updateResult.rowCount);
    return true;

  } catch (error) {
    console.error('❌ Error actualizando prospecto:', error);
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

export const getProspectsFromDB = async (): Promise<Prospect[]> => {
  if (!pool) {
    console.error('❌ Pool de base de datos no inicializado. Retornando datos mockeados.');
    return MOCK_PROSPECTS;
  }
  
  try {
    console.log('🔄 Consultando base de datos...');
    const client = await pool.connect();
    
    // Aseguramos que las tablas existan antes de consultar
    await ensureTablesExist(client);
    
    // Obtenemos los últimos 50 prospectos
    const res = await client.query(`
      SELECT * FROM prospects 
      ORDER BY created_at DESC 
      LIMIT 50
    `);
    
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
      result: safeParseJSON(row.calculation_result) || {
        maxPropertyPrice: 0,
        monthlyPayment: 0,
        downPaymentPercent: 0,
        downPaymentAmount: 0
      },
      // Archivos en Base64
      idFileBase64: row.id_file_base64 || null,
      fichaFileBase64: row.ficha_file_base64 || null,
      talonarioFileBase64: row.talonario_file_base64 || null,
      signedAcpFileBase64: row.signed_acp_file_base64 || null
    }));

  } catch (error) {
    console.warn('Usando datos de demostración debido a error de conexión:', error);
    // FALLBACK: Si falla la DB, retornamos los datos mockeados para que la UI no se rompa
    return MOCK_PROSPECTS;
  }
};

// ========== FUNCIONES PARA EMPRESAS/USUARIOS ==========

export interface CompanyData {
  name: string;
  email: string;
  password: string;
  companyName: string;
  logoUrl?: string;
  zones: string[];
  role: 'Promotora' | 'Broker';
}

export interface Company {
  id: string;
  name: string;
  email: string;
  companyName: string;
  logoUrl?: string;
  zones: string[];
  plan?: 'Freshie' | 'Wolf of Wallstreet'; // Plan de la empresa
  role?: 'Promotora' | 'Broker';
}

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
      INSERT INTO companies (name, email, password_hash, company_name, logo_url, role)
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING id
    `, [data.name, data.email, passwordHash, data.companyName || data.name, data.logoUrl || null, data.role || 'Broker']);

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

    return {
      id: company.id,
      name: company.name,
      email: company.email,
      companyName: company.name,
      logoUrl: company.logo_url,
      zones: zones,
      plan: (company.plan || 'Freshie') as 'Freshie' | 'Wolf of Wallstreet',
      role: (company.role || 'Broker') as 'Promotora' | 'Broker'
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
        result: safeParseJSON(row.calculation_result) || {
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
  interestedZones: string[]
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
    // 3. Tengan al menos un modelo con precio <= maxPrice * 1.1
    // 4. Estén activos

    let query = `
      SELECT DISTINCT p.*, 
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
        AND pm2.price <= $2 * 1.1
        AND pm2.units_available > 0
      )
    `;

    const values: any[] = [companyId, maxPrice];

    // Si hay zonas de interés, filtrar por ellas
    if (interestedZones && interestedZones.length > 0) {
      query += ` AND (p.zone = ANY($3) OR p.zone IS NULL)`;
      values.push(interestedZones);
    }

    query += ` 
      GROUP BY p.id
      ORDER BY p.created_at DESC
      LIMIT 20`;

    const res = await client.query(query, values);
    client.release();

    return res.rows.map((row: any) => ({
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
      models: Array.isArray(row.models) ? row.models.map((m: any) => ({
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
      })) : []
    }));

  } catch (error) {
    console.error('❌ Error obteniendo proyectos disponibles:', error);
    return [];
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
        images: Array.isArray(modelRow.images) ? modelRow.images : []
      }));

      projects.push({
        id: row.id,
        companyId: row.company_id,
        name: row.name,
        description: row.description,
        zone: row.zone || '',
        address: row.address,
        images: Array.isArray(row.images) ? row.images : [],
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