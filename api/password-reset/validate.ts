import { validatePasswordResetToken } from '../../utils/db';

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { token } = req.body;

    if (!token) {
      return res.status(400).json({ error: 'Token es requerido' });
    }

    // Validar token
    const companyId = await validatePasswordResetToken(token);

    if (!companyId) {
      return res.status(400).json({ 
        valid: false,
        error: 'Token inválido o expirado' 
      });
    }

    return res.status(200).json({ 
      valid: true,
      message: 'Token válido' 
    });

  } catch (error) {
    console.error('❌ Error validando token:', error);
    return res.status(500).json({ 
      valid: false,
      error: 'Error al validar token' 
    });
  }
}

