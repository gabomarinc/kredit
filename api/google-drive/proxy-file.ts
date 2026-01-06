import { Pool } from '@neondatabase/serverless';

export default async function handler(req: any, res: any) {
    // Solo permitir método GET
    if (req.method !== 'GET') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const { fileId, companyId } = req.query;

    if (!fileId || !companyId) {
        return res.status(400).json({ error: 'fileId and companyId are required' });
    }

    // Inicializar pool
    const connectionString = process.env.VITE_DATABASE_URL || process.env.DATABASE_URL;
    if (!connectionString) {
        return res.status(500).json({ error: 'Database configuration missing' });
    }

    const pool = new Pool({ connectionString });

    try {
        const client = await pool.connect();

        // Obtener tokens de la empresa
        const queryResult = await client.query(
            'SELECT google_drive_access_token, google_drive_refresh_token FROM companies WHERE id = $1',
            [companyId]
        );

        client.release(); // Liberar cliente inmediatamente

        if (queryResult.rows.length === 0) {
            return res.status(404).json({ error: 'Company not found' });
        }

        let { google_drive_access_token, google_drive_refresh_token } = queryResult.rows[0];

        // Función auxiliar para obtener archivo
        const fetchFile = async (token: string) => {
            return fetch(`https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`, {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });
        };

        // Intentar obtener archivo
        let response = await fetchFile(google_drive_access_token);

        // Si el token expiró (401), intentar refrescar
        if (response.status === 401 && google_drive_refresh_token) {
            console.log('🔄 Token expirado en proxy, renovando...');

            const refreshResponse = await fetch('https://oauth2.googleapis.com/token', {
                method: 'POST',
                headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                body: new URLSearchParams({
                    client_id: process.env.GOOGLE_DRIVE_CLIENT_ID || process.env.VITE_GOOGLE_DRIVE_CLIENT_ID || '',
                    client_secret: process.env.GOOGLE_DRIVE_CLIENT_SECRET || '',
                    refresh_token: google_drive_refresh_token,
                    grant_type: 'refresh_token',
                }),
            });

            if (refreshResponse.ok) {
                const tokens = await refreshResponse.json();
                const newAccessToken = tokens.access_token;

                // Actualizar token en BD (sin esperar)
                const updateClient = await pool.connect();
                updateClient.query(
                    'UPDATE companies SET google_drive_access_token = $1 WHERE id = $2',
                    [newAccessToken, companyId]
                ).catch(err => console.error('Error updating token in DB:', err))
                    .finally(() => updateClient.release());

                // Reintentar con nuevo token
                response = await fetchFile(newAccessToken);
            } else {
                console.error('❌ Error refrescando token:', await refreshResponse.text());
                return res.status(401).json({ error: 'Failed to refresh token' });
            }
        }

        if (!response.ok) {
            return res.status(response.status).json({ error: `Drive API Error: ${response.statusText}` });
        }

        // Stream del archivo
        const arrayBuffer = await response.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);

        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `inline; filename="document-${fileId}.pdf"`);
        res.send(buffer);

    } catch (error) {
        console.error('❌ Error en proxy-file:', error);
        return res.status(500).json({ error: 'Internal Server Error' });
    } finally {
        await pool.end(); // Cerrar pool al finalizar (serverless behavior)
    }
}
