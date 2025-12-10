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

// Helper para asegurar que la tabla exista antes de operar
const ensureTableExists = async (client: any) => {
  try {
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
    console.warn("Nota: Verificación de tabla omitida o fallida (puede que ya exista o falten permisos DDL).", e);
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
    
    // Aseguramos que la tabla exista (Auto-migración simple)
    await ensureTableExists(client);
    
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
    
    // Aseguramos que la tabla exista antes de consultar
    await ensureTableExists(client);
    
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