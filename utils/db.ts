import { Pool } from '@neondatabase/serverless';
import { CalculationResult, Prospect, PersonalData, FinancialData, UserPreferences } from '../types';
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
        logo_url TEXT,
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
        END $$;
      `);
    } catch (e) {
      console.warn('Nota: No se pudieron agregar las columnas de archivos (puede que ya existan):', e);
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
  result: CalculationResult
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
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'Nuevo', $10, $11, $12, $13, NOW())
      RETURNING id
    `;

    const values = [
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
      }
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
}

export interface Company {
  id: string;
  name: string;
  email: string;
  companyName: string;
  logoUrl?: string;
  zones: string[];
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
      INSERT INTO companies (name, email, password_hash, logo_url)
      VALUES ($1, $2, $3, $4)
      RETURNING id
    `, [data.name, data.email, passwordHash, data.logoUrl || null]);

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
      zones: zones
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
      zones: zones
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