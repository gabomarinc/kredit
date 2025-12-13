// API Route para refrescar el access token de Google Drive
// Vercel Serverless Function

export default async function handler(req: any, res: any) {
  // Solo permitir método POST
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { refreshToken } = req.body;

  if (!refreshToken) {
    return res.status(400).json({ error: 'refreshToken is required' });
  }

  try {
    const CLIENT_ID = process.env.GOOGLE_DRIVE_CLIENT_ID;
    const CLIENT_SECRET = process.env.GOOGLE_DRIVE_CLIENT_SECRET;

    if (!CLIENT_ID || !CLIENT_SECRET) {
      console.error('❌ Credenciales de Google Drive no configuradas');
      return res.status(500).json({ error: 'Google Drive credentials not configured' });
    }

    // Renovar el access token
    const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        client_id: CLIENT_ID,
        client_secret: CLIENT_SECRET,
        refresh_token: refreshToken,
        grant_type: 'refresh_token',
      }),
    });

    if (!tokenResponse.ok) {
      const errorData = await tokenResponse.text();
      console.error('❌ Error renovando token:', errorData);
      return res.status(500).json({ error: 'Failed to refresh token' });
    }

    const tokens = await tokenResponse.json();
    
    return res.status(200).json({
      accessToken: tokens.access_token
    });
  } catch (error) {
    console.error('❌ Error en refresh token:', error);
    return res.status(500).json({ error: error instanceof Error ? error.message : 'Unknown error' });
  }
}

