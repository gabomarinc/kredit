// Utilidades para Google Drive OAuth y operaciones

/**
 * Inicia el flujo de OAuth de Google Drive
 * Redirige al usuario a Google para autenticarse
 */
export const initiateGoogleDriveAuth = (): void => {
  // Configuración OAuth de Google Drive
  const CLIENT_ID = import.meta.env.VITE_GOOGLE_DRIVE_CLIENT_ID;
  const REDIRECT_URI = `${window.location.origin}/api/google-drive/callback`;
  
  if (!CLIENT_ID) {
    console.error('❌ VITE_GOOGLE_DRIVE_CLIENT_ID no está configurada');
    throw new Error('Google Drive Client ID no configurada');
  }

  // Scopes necesarios para Google Drive
  const scopes = [
    'https://www.googleapis.com/auth/drive.file', // Crear y administrar archivos en Drive
    'https://www.googleapis.com/auth/drive.metadata.readonly' // Leer metadatos
  ].join(' ');

  // URL de autenticación de Google
  const authUrl = new URL('https://accounts.google.com/o/oauth2/v2/auth');
  authUrl.searchParams.set('client_id', CLIENT_ID);
  authUrl.searchParams.set('redirect_uri', REDIRECT_URI);
  authUrl.searchParams.set('response_type', 'code');
  authUrl.searchParams.set('scope', scopes);
  authUrl.searchParams.set('access_type', 'offline'); // Necesario para obtener refresh_token
  authUrl.searchParams.set('prompt', 'consent'); // Forzar consent para obtener refresh_token
  authUrl.searchParams.set('state', window.location.href); // Guardar URL actual para volver después

  console.log('🔄 Redirigiendo a Google OAuth...');
  window.location.href = authUrl.toString();
};

/**
 * Verifica si el usuario ya está autenticado con Google Drive
 * (check local storage o cookie)
 */
export const isGoogleDriveConnected = (): boolean => {
  // Por ahora retornamos false, ya que la autenticación se hace durante el registro
  // Esto se puede mejorar guardando el estado en localStorage temporalmente
  return false;
};

