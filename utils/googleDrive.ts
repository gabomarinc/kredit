// Utilidades para Google Drive OAuth y operaciones
import imageCompression from 'browser-image-compression';

/**
 * Comprime una imagen si es necesario (solo para imágenes, no PDFs)
 */
export const compressImageIfNeeded = async (file: File): Promise<File> => {
  // Solo comprimir si es una imagen
  if (!file.type.startsWith('image/')) {
    console.log('📄 Archivo no es imagen, omitiendo compresión:', file.name);
    return file;
  }

  try {
    console.log('🔄 Comprimiendo imagen:', file.name, `(${(file.size / 1024 / 1024).toFixed(2)} MB)`);
    
    const options = {
      maxSizeMB: 1, // Tamaño máximo: 1MB
      maxWidthOrHeight: 1920, // Resolución máxima: 1920px
      useWebWorker: true, // Usar web worker para no bloquear la UI
      fileType: file.type, // Mantener el tipo de archivo original
      initialQuality: 0.8 // Calidad inicial (0.8 = 80% de calidad, buen balance)
    };

    const compressedFile = await imageCompression(file, options);
    
    const originalSize = (file.size / 1024 / 1024).toFixed(2);
    const compressedSize = (compressedFile.size / 1024 / 1024).toFixed(2);
    const reduction = ((1 - compressedFile.size / file.size) * 100).toFixed(1);
    
    console.log(`✅ Imagen comprimida: ${originalSize} MB → ${compressedSize} MB (${reduction}% reducción)`);
    
    return compressedFile;
  } catch (error) {
    console.error('❌ Error comprimiendo imagen:', error);
    // Si falla la compresión, retornar archivo original
    return file;
  }
};

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
    // Si viene marcado como 401, propagarlo para que la capa superior pueda refrescar el token
    if ((error as any)?.status === 401) {
      throw error;
    }
    // Para otros errores, solo devolver null y dejar que la lógica superior decida continuar sin carpeta
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
 * Descarga un archivo de Google Drive usando el access token y lo convierte a Base64
 * Esto permite mostrar archivos privados sin hacerlos públicos
 */
export const downloadFileFromDriveAsBase64 = async (
  accessToken: string,
  fileId: string
): Promise<string | null> => {
  try {
    if (!fileId) {
      return null;
    }

    // Descargar el archivo usando la API de Drive con autenticación
    const response = await fetch(
      `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`,
      {
        headers: {
          'Authorization': `Bearer ${accessToken}`
        }
      }
    );

    if (!response.ok) {
      console.error(`❌ Error descargando archivo ${fileId}:`, response.status, response.statusText);
      // Si es 401, el token puede estar expirado
      if (response.status === 401) {
        const error: any = new Error('Token expired (401)');
        error.status = 401;
        throw error;
      }
      return null;
    }

    // Obtener el tipo MIME del archivo
    const contentType = response.headers.get('content-type') || 'application/octet-stream';
    
    // Convertir la respuesta a blob y luego a Base64
    const blob = await response.blob();
    
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        try {
          const base64String = reader.result as string;
          // FileReader.readAsDataURL ya incluye el prefijo data:...;base64,...
          // Solo necesitamos asegurarnos de que tenga el content-type correcto
          if (base64String.startsWith('data:')) {
            resolve(base64String);
          } else {
            // Si por alguna razón no tiene prefijo, agregarlo
            resolve(`data:${contentType};base64,${base64String}`);
          }
        } catch (e) {
          reject(e);
        }
      };
      reader.onerror = (error) => {
        console.error('❌ Error leyendo blob como Base64:', error);
        reject(error);
      };
      reader.readAsDataURL(blob);
    });
  } catch (error: any) {
    console.error('❌ Error descargando archivo de Drive:', error);
    // Propagar errores 401 para que puedan ser manejados
    if (error.status === 401) {
      throw error;
    }
    return null;
  }
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

    // Comprimir imágenes antes de subir (solo imágenes, no PDFs)
    console.log('🔄 Comprimiendo imágenes antes de subir...');
    const [compressedIdFile, compressedFichaFile, compressedTalonarioFile, compressedSignedAcpFile] = await Promise.all([
      files.idFile ? compressImageIfNeeded(files.idFile) : Promise.resolve(null),
      files.fichaFile ? compressImageIfNeeded(files.fichaFile) : Promise.resolve(null),
      files.talonarioFile ? compressImageIfNeeded(files.talonarioFile) : Promise.resolve(null),
      files.signedAcpFile ? compressImageIfNeeded(files.signedAcpFile) : Promise.resolve(null)
    ]);

    // Subir archivos en paralelo (solo los que existen, ya comprimidos si eran imágenes)
    const uploadPromises: Promise<{ fileId: string; webViewLink: string } | null>[] = [];

    if (compressedIdFile) {
      // Determinar extensión original del archivo
      const originalName = files.idFile?.name || 'ID_Cedula';
      const extension = originalName.split('.').pop() || 'pdf';
      uploadPromises.push(
        uploadFileToDrive(accessToken, compressedIdFile, prospectFolderId, `ID_Cedula.${extension}`)
      );
    } else {
      uploadPromises.push(Promise.resolve(null));
    }

    if (compressedFichaFile) {
      const originalName = files.fichaFile?.name || 'Ficha';
      const extension = originalName.split('.').pop() || 'pdf';
      uploadPromises.push(
        uploadFileToDrive(accessToken, compressedFichaFile, prospectFolderId, `Ficha.${extension}`)
      );
    } else {
      uploadPromises.push(Promise.resolve(null));
    }

    if (compressedTalonarioFile) {
      const originalName = files.talonarioFile?.name || 'Talonario';
      const extension = originalName.split('.').pop() || 'pdf';
      uploadPromises.push(
        uploadFileToDrive(accessToken, compressedTalonarioFile, prospectFolderId, `Talonario.${extension}`)
      );
    } else {
      uploadPromises.push(Promise.resolve(null));
    }

    if (compressedSignedAcpFile) {
      const originalName = files.signedAcpFile?.name || 'ACP_Firmado';
      const extension = originalName.split('.').pop() || 'pdf';
      uploadPromises.push(
        uploadFileToDrive(accessToken, compressedSignedAcpFile, prospectFolderId, `ACP_Firmado.${extension}`)
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

