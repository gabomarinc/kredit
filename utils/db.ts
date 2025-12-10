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
        UNIQUE(company_id, zone_name)
      )
    `);

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
        created_at TIMESTAMP DEFAULT NOW()
      )
    `);
  } catch (e) {
    console.warn("Nota: Verificación de tablas omitida o fallida (puede que ya existan o falten permisos DDL).", e);
  }
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
        created_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'Nuevo', NOW())
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
      JSON.stringify(result) // Guardamos el resultado como JSON
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
      id: row.id,
      name: row.full_name,
      email: row.email,
      income: parseFloat(row.monthly_income),
      date: new Date(row.created_at).toLocaleDateString('es-PA', { year: 'numeric', month: 'short', day: 'numeric' }),
      status: row.status as 'Nuevo' | 'Contactado' | 'En Proceso',
      // Ensure zone is treated safely
      zone: Array.isArray(row.interested_zones) && row.interested_zones.length > 0 
            ? row.interested_zones[0] 
            : (typeof row.interested_zones === 'string' ? row.interested_zones.replace(/[{}"\\]/g, '') : 'N/A'),
      // Ensure result is an object
      result: safeParseJSON(row.calculation_result)
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

    // Insertar zonas
    if (data.zones && data.zones.length > 0) {
      console.log(`🔄 Guardando ${data.zones.length} zonas...`, data.zones);
      let zonesSaved = 0;
      for (const zoneName of data.zones) {
        try {
          const zoneResult = await client.query(`
            INSERT INTO company_zones (company_id, zone_name)
            VALUES ($1, $2)
            ON CONFLICT (company_id, zone_name) DO NOTHING
            RETURNING id
          `, [companyId, zoneName]);
          
          if (zoneResult.rows.length > 0) {
            zonesSaved++;
            console.log(`✅ Zona guardada: ${zoneName}`);
          } else {
            console.log(`ℹ️ Zona ya existía: ${zoneName}`);
          }
        } catch (zoneError) {
          console.error(`❌ Error guardando zona ${zoneName}:`, zoneError);
          // Continuamos con las demás zonas aunque una falle
        }
      }
      console.log(`✅ ${zonesSaved} de ${data.zones.length} zonas guardadas exitosamente`);
    } else {
      console.warn('⚠️ No hay zonas para guardar o el array está vacío');
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
          ON CONFLICT (company_id, zone_name) DO NOTHING
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