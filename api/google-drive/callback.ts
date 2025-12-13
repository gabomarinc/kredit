// API Route para manejar el callback de OAuth de Google Drive
// Vercel Serverless Function

export default async function handler(req: any, res: any) {
  // Solo permitir método GET
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { code, state, error } = req.query;

  // Si hay un error de Google
  if (error) {
    console.error('❌ Error en OAuth de Google:', error);
    return res.redirect(`/?error=oauth_error&message=${encodeURIComponent(error)}`);
  }

  // Si no hay código de autorización
  if (!code) {
    return res.redirect(`/?error=no_code`);
  }

  try {
    // Intercambiar código por tokens
    // En Serverless Functions, usar variables sin prefijo VITE_
    const CLIENT_ID = process.env.GOOGLE_DRIVE_CLIENT_ID;
    const CLIENT_SECRET = process.env.GOOGLE_DRIVE_CLIENT_SECRET;
    const REDIRECT_URI = `${req.headers['x-forwarded-proto'] || 'https'}://${req.headers.host}/api/google-drive/callback`;

    if (!CLIENT_ID || !CLIENT_SECRET) {
      console.error('❌ Credenciales de Google Drive no configuradas');
      return res.redirect(`/?error=config_error`);
    }

    // Intercambiar código por tokens
    const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        client_id: CLIENT_ID,
        client_secret: CLIENT_SECRET,
        code: code as string,
        grant_type: 'authorization_code',
        redirect_uri: REDIRECT_URI,
      }),
    });

    if (!tokenResponse.ok) {
      const errorData = await tokenResponse.text();
      console.error('❌ Error intercambiando código por tokens:', errorData);
      return res.redirect(`/?error=token_exchange_failed`);
    }

    const tokens = await tokenResponse.json();
    const { access_token, refresh_token } = tokens;

    if (!access_token || !refresh_token) {
      console.error('❌ Tokens incompletos en respuesta');
      return res.redirect(`/?error=incomplete_tokens`);
    }

    // Crear carpeta en Google Drive
    const folderName = 'Konsul - Kredit';
    const createFolderResponse = await fetch('https://www.googleapis.com/drive/v3/files', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${access_token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        name: folderName,
        mimeType: 'application/vnd.google-apps.folder',
      }),
    });

    let folderId: string | null = null;
    if (createFolderResponse.ok) {
      const folderData = await createFolderResponse.json();
      folderId = folderData.id;
      console.log('✅ Carpeta creada en Google Drive:', folderId);
    } else {
      // Si falla la creación, intentar buscar la carpeta existente
      const searchResponse = await fetch(
        `https://www.googleapis.com/drive/v3/files?q=name='${encodeURIComponent(folderName)}' and mimeType='application/vnd.google-apps.folder' and trashed=false`,
        {
          headers: {
            'Authorization': `Bearer ${access_token}`,
          },
        }
      );

      if (searchResponse.ok) {
        const searchData = await searchResponse.json();
        if (searchData.files && searchData.files.length > 0) {
          folderId = searchData.files[0].id;
          console.log('✅ Carpeta existente encontrada:', folderId);
        }
      }
    }

    // Guardar tokens y folderId en una página temporal o redirigir con parámetros
    // Como estamos en un flujo de registro, guardamos en localStorage mediante URL params
    const registrationUrl = state ? decodeURIComponent(state as string) : '/';
    const successUrl = new URL(registrationUrl);
    successUrl.searchParams.set('google_drive_auth', 'success');
    successUrl.searchParams.set('access_token', access_token);
    successUrl.searchParams.set('refresh_token', refresh_token);
    if (folderId) {
      successUrl.searchParams.set('folder_id', folderId);
    }

    // Redirigir de vuelta a la aplicación
    return res.redirect(successUrl.toString());
  } catch (error) {
    console.error('❌ Error en callback de Google Drive:', error);
    return res.redirect(`/?error=callback_error&message=${encodeURIComponent(error instanceof Error ? error.message : String(error))}`);
  }
}

