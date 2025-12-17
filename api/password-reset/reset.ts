import { validatePasswordResetToken, resetPasswordWithToken } from '../../utils/db';

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { token, password } = req.body;

    if (!token || !password) {
      return res.status(400).json({ error: 'Token y contraseña son requeridos' });
    }

    // Validar longitud mínima de contraseña
    if (password.length < 6) {
      return res.status(400).json({ error: 'La contraseña debe tener al menos 6 caracteres' });
    }

    // Validar token y resetear contraseña
    const success = await resetPasswordWithToken(token, password);

    if (!success) {
      return res.status(400).json({ error: 'Token inválido o expirado' });
    }

    return res.status(200).json({ 
      success: true, 
      message: 'Contraseña actualizada exitosamente' 
    });

  } catch (error) {
    console.error('❌ Error en reset de contraseña:', error);
    return res.status(500).json({ error: 'Error al resetear contraseña' });
  }
}

