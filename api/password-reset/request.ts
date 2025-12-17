import { createPasswordResetToken } from '../../utils/db';
import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY);

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({ error: 'Email es requerido' });
    }

    // Crear token de reset
    const token = await createPasswordResetToken(email);

    if (!token) {
      // No revelar si el email existe o no por seguridad
      return res.status(200).json({ 
        success: true, 
        message: 'Si el email existe, recibirás un enlace para resetear tu contraseña.' 
      });
    }

    // Obtener URL base de la aplicación
    const protocol = req.headers['x-forwarded-proto'] || 'https';
    const host = req.headers.host;
    const baseUrl = `${protocol}://${host}`;
    const resetUrl = `${baseUrl}/reset-password?token=${token}`;

    // Enviar email con Resend
    try {
      await resend.emails.send({
        from: 'Krêdit <noreply@resend.dev>',
        to: email,
        subject: 'Restablecer tu contraseña - Krêdit',
        html: `
          <!DOCTYPE html>
          <html>
          <head>
            <meta charset="utf-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Restablecer Contraseña</title>
          </head>
          <body style="font-family: 'Satoshi', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #2C3E50; background-color: #FAFDFC; margin: 0; padding: 0;">
            <div style="max-width: 600px; margin: 40px auto; background: white; border-radius: 24px; overflow: hidden; box-shadow: 0 20px 60px -15px rgba(0,0,0,0.05);">
              <!-- Header -->
              <div style="background: linear-gradient(135deg, #29BEA5 0%, #1fa890 100%); padding: 40px 30px; text-align: center;">
                <div style="width: 60px; height: 60px; background: rgba(255,255,255,0.2); border-radius: 16px; margin: 0 auto 20px; display: flex; align-items: center; justify-content: center;">
                  <span style="font-size: 32px; font-weight: 900; color: white;">ê</span>
                </div>
                <h1 style="color: white; font-size: 28px; font-weight: 900; margin: 0;">Restablecer Contraseña</h1>
              </div>
              
              <!-- Content -->
              <div style="padding: 40px 30px;">
                <p style="font-size: 16px; color: #2C3E50; margin-bottom: 24px;">
                  Hola,
                </p>
                <p style="font-size: 16px; color: #2C3E50; margin-bottom: 24px;">
                  Recibimos una solicitud para restablecer la contraseña de tu cuenta en Krêdit.
                </p>
                <p style="font-size: 16px; color: #2C3E50; margin-bottom: 32px;">
                  Haz clic en el botón siguiente para crear una nueva contraseña:
                </p>
                
                <!-- Button -->
                <div style="text-align: center; margin: 32px 0;">
                  <a href="${resetUrl}" style="display: inline-block; background: linear-gradient(135deg, #29BEA5 0%, #1fa890 100%); color: white; text-decoration: none; padding: 16px 32px; border-radius: 12px; font-weight: 700; font-size: 16px; box-shadow: 0 4px 12px rgba(41, 190, 165, 0.3);">
                    Restablecer Contraseña
                  </a>
                </div>
                
                <p style="font-size: 14px; color: #6B7280; margin-top: 32px; margin-bottom: 0;">
                  O copia y pega este enlace en tu navegador:
                </p>
                <p style="font-size: 12px; color: #9CA3AF; word-break: break-all; margin-top: 8px; margin-bottom: 0;">
                  ${resetUrl}
                </p>
                
                <div style="margin-top: 32px; padding-top: 24px; border-top: 1px solid #E5E7EB;">
                  <p style="font-size: 12px; color: #9CA3AF; margin: 0;">
                    Este enlace expirará en 1 hora. Si no solicitaste este cambio, puedes ignorar este email.
                  </p>
                </div>
              </div>
              
              <!-- Footer -->
              <div style="background: #F9FAFB; padding: 24px 30px; text-align: center; border-top: 1px solid #E5E7EB;">
                <p style="font-size: 12px; color: #6B7280; margin: 0;">
                  © ${new Date().getFullYear()} Krêdit. Todos los derechos reservados.
                </p>
              </div>
            </div>
          </body>
          </html>
        `
      });

      console.log('✅ Email de reset enviado exitosamente');
    } catch (emailError) {
      console.error('❌ Error enviando email:', emailError);
      // Aún así retornamos éxito para no revelar información
    }

    return res.status(200).json({ 
      success: true, 
      message: 'Si el email existe, recibirás un enlace para resetear tu contraseña.' 
    });

  } catch (error) {
    console.error('❌ Error en request de reset:', error);
    return res.status(200).json({ 
      success: true, 
      message: 'Si el email existe, recibirás un enlace para resetear tu contraseña.' 
    });
  }
}

