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

// ============================================
// FUNCIONES PARA SUBIR ARCHIVOS A GOOGLE DRIVE
// ============================================

/**
 * Renueva el access token usando el refresh token
 */
export const refreshAccessToken = async (refreshToken: string): Promise<string | null> => {
  try {
    const CLIENT_ID = import.meta.env.VITE_GOOGLE_DRIVE_CLIENT_ID;
    const CLIENT_SECRET = process.env.GOOGLE_DRIVE_CLIENT_SECRET; // Esto solo funciona en serverless functions
    
    // Si estamos en el cliente, necesitamos hacer esto a través de una API route
    const response = await fetch('/api/google-drive/refresh-token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken })
    });

    if (!response.ok) {
      console.error('❌ Error renovando token:', await response.text());
      return null;
    }

    const data = await response.json();
    return data.accessToken;
  } catch (error) {
    console.error('❌ Error renovando access token:', error);
    return null;
  }
};

/**
 * Crea o busca una subcarpeta para un prospecto dentro de la carpeta principal de la empresa
 */
export const createOrGetProspectFolder = async (
  accessToken: string,
  parentFolderId: string,
  prospectName: string,
  prospectId: string
): Promise<string | null> => {
  try {
    // Nombre de la carpeta: "Nombre Prospecto - ID"
    const folderName = `${prospectName} - ${prospectId}`;

    // Buscar si ya existe la carpeta
    const searchResponse = await fetch(
      `https://www.googleapis.com/drive/v3/files?q=name='${encodeURIComponent(folderName)}' and mimeType='application/vnd.google-apps.folder' and '${parentFolderId}' in parents and trashed=false`,
      {
        headers: {
          'Authorization': `Bearer ${accessToken}`
        }
      }
    );

    if (searchResponse.ok) {
      const searchData = await searchResponse.json();
      if (searchData.files && searchData.files.length > 0) {
        console.log('✅ Carpeta de prospecto encontrada:', searchData.files[0].id);
        return searchData.files[0].id;
      }
    } else if (searchResponse.status === 401) {
      // Token expirado
      const error: any = new Error('Token expired (401)');
      error.status = 401;
      throw error;
    }

    // Si no existe, crear la carpeta
    const createResponse = await fetch('https://www.googleapis.com/drive/v3/files', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        name: folderName,
        mimeType: 'application/vnd.google-apps.folder',
        parents: [parentFolderId]
      })
    });

    if (!createResponse.ok) {
      const errorText = await createResponse.text();
      console.error('❌ Error creando carpeta de prospecto:', errorText);
      const error: any = new Error(`Failed to create folder: ${errorText}`);
      error.status = createResponse.status;
      throw error;
    }

    const folderData = await createResponse.json();
    console.log('✅ Carpeta de prospecto creada:', folderData.id);
    return folderData.id;
  } catch (error) {
    console.error('❌ Error creando/buscando carpeta de prospecto:', error);
    return null;
  }
};

/**
 * Sube un archivo a Google Drive
 */
export const uploadFileToDrive = async (
  accessToken: string,
  file: File,
  folderId: string,
  fileName?: string
): Promise<{ fileId: string; webViewLink: string } | null> => {
  try {
    const name = fileName || file.name;

    // Primero, crear los metadatos del archivo
    const metadata = {
      name: name,
      parents: [folderId]
    };

    // Crear FormData para subir el archivo
    const formData = new FormData();
    formData.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }));
    formData.append('file', file);

    // Subir el archivo usando multipart upload
    const uploadResponse = await fetch(
      'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,webViewLink',
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`
        },
        body: formData
      }
    );

    if (!uploadResponse.ok) {
      const errorText = await uploadResponse.text();
      console.error('❌ Error subiendo archivo a Drive:', errorText);
      // Crear error con información del status para que pueda ser detectado
      const error: any = new Error(`Failed to upload file: ${errorText}`);
      error.status = uploadResponse.status;
      throw error; // Lanzar error en lugar de retornar null para que pueda ser capturado
    }

    const fileData = await uploadResponse.json();
    console.log('✅ Archivo subido a Drive:', fileData.id);
    
    return {
      fileId: fileData.id,
      webViewLink: fileData.webViewLink || `https://drive.google.com/file/d/${fileData.id}/view`
    };
  } catch (error: any) {
    console.error('❌ Error subiendo archivo a Drive:', error);
    // Si el error ya tiene status, propagarlo; sino agregar información
    if (!error.status) {
      error.status = 500;
    }
    throw error; // Propagar el error para que pueda ser manejado
  }
};

/**
 * Obtiene la URL pública de descarga/vista de un archivo en Drive
 * Nota: Esta URL funciona si el archivo tiene permisos públicos o si el usuario está autenticado
 */
export const getFileDownloadUrl = (fileId: string): string => {
  // Usar el endpoint de visualización de Google Drive
  return `https://drive.google.com/uc?export=view&id=${fileId}`;
};

/**
 * Sube todos los archivos de un prospecto a Google Drive
 * Retorna un objeto con las URLs/IDs de los archivos subidos
 */
export const uploadProspectFilesToDrive = async (
  accessToken: string,
  parentFolderId: string,
  prospectName: string,
  prospectId: string,
  files: {
    idFile?: File | null;
    fichaFile?: File | null;
    talonarioFile?: File | null;
    signedAcpFile?: File | null;
  }
): Promise<{
  idFileUrl?: string | null;
  fichaFileUrl?: string | null;
  talonarioFileUrl?: string | null;
  signedAcpFileUrl?: string | null;
}> => {
  try {
    // Crear o obtener la carpeta del prospecto
    const prospectFolderId = await createOrGetProspectFolder(
      accessToken,
      parentFolderId,
      prospectName,
      prospectId
    );

    if (!prospectFolderId) {
      console.error('❌ No se pudo crear/obtener la carpeta del prospecto');
      return {};
    }

    // Subir archivos en paralelo (solo los que existen)
    const uploadPromises: Promise<{ fileId: string; webViewLink: string } | null>[] = [];

    if (files.idFile) {
      uploadPromises.push(
        uploadFileToDrive(accessToken, files.idFile, prospectFolderId, 'ID_Cedula.pdf')
      );
    } else {
      uploadPromises.push(Promise.resolve(null));
    }

    if (files.fichaFile) {
      uploadPromises.push(
        uploadFileToDrive(accessToken, files.fichaFile, prospectFolderId, 'Ficha.pdf')
      );
    } else {
      uploadPromises.push(Promise.resolve(null));
    }

    if (files.talonarioFile) {
      uploadPromises.push(
        uploadFileToDrive(accessToken, files.talonarioFile, prospectFolderId, 'Talonario.pdf')
      );
    } else {
      uploadPromises.push(Promise.resolve(null));
    }

    if (files.signedAcpFile) {
      uploadPromises.push(
        uploadFileToDrive(accessToken, files.signedAcpFile, prospectFolderId, 'ACP_Firmado.pdf')
      );
    } else {
      uploadPromises.push(Promise.resolve(null));
    }

    // Usar allSettled para que si un archivo falla, los otros continúen
    // Pero si todos fallan con 401, lanzar error para refresh token
    const results = await Promise.allSettled(uploadPromises);
    
    // Verificar si hay errores 401 (token expirado)
    const has401Error = results.some(result => 
      result.status === 'rejected' && 
      (result.reason as any)?.status === 401
    );

    if (has401Error) {
      // Si hay error 401, lanzar error para que se pueda manejar el refresh token
      const error: any = new Error('Token expired (401)');
      error.status = 401;
      throw error;
    }

    return {
      idFileUrl: results[0].status === 'fulfilled' ? (results[0].value?.fileId || null) : null,
      fichaFileUrl: results[1].status === 'fulfilled' ? (results[1].value?.fileId || null) : null,
      talonarioFileUrl: results[2].status === 'fulfilled' ? (results[2].value?.fileId || null) : null,
      signedAcpFileUrl: results[3].status === 'fulfilled' ? (results[3].value?.fileId || null) : null
    };
  } catch (error: any) {
    console.error('❌ Error subiendo archivos del prospecto a Drive:', error);
    // Propagar el error para que pueda ser manejado por la función llamadora
    // (especialmente para detectar tokens expirados)
    throw error;
  }
};

