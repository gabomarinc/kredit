import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY);

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { prospect, recipientEmail } = req.body;

    if (!prospect || !recipientEmail) {
      return res.status(400).json({ error: 'Faltan datos requeridos (prospect o recipientEmail)' });
    }

    // Validar formato de email básico
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(recipientEmail)) {
      return res.status(400).json({ error: 'Email de destinatario inválido' });
    }

    // Formatear datos para el email
    const {
      name,
      email,
      phone,
      income,
      propertyType,
      zone,
      status,
      result
    } = prospect;

    // Construir HTML del correo
    const htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Nuevo Prospecto Recibido</title>
      </head>
      <body style="font-family: 'Satoshi', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #2C3E50; background-color: #FAFDFC; margin: 0; padding: 0;">
        <div style="max-width: 600px; margin: 40px auto; background: white; border-radius: 24px; overflow: hidden; box-shadow: 0 20px 60px -15px rgba(0,0,0,0.05); border: 1px solid #E5E7EB;">
          
          <!-- Header -->
          <div style="background: linear-gradient(135deg, #1A1A1A 0%, #2C3E50 100%); padding: 32px; text-align: center;">
            <h1 style="color: white; font-size: 24px; font-weight: 800; margin: 0;">¡Nuevo Prospecto! 🎉</h1>
            <p style="color: rgba(255,255,255,0.8); margin-top: 8px; font-size: 14px;">Se ha registrado un nuevo cliente potencial en tu plataforma</p>
          </div>
          
          <!-- Content -->
          <div style="padding: 32px;">
            
            <!-- Perfil Principal -->
            <div style="text-align: center; margin-bottom: 32px;">
              <div style="width: 64px; height: 64px; background: #F3F4F6; color: #4B5563; border-radius: 50%; display: inline-flex; align-items: center; justify-content: center; font-size: 24px; font-weight: bold; margin-bottom: 16px;">
                ${name.charAt(0).toUpperCase()}
              </div>
              <h2 style="margin: 0; color: #111827; font-size: 20px;">${name}</h2>
              <p style="margin: 4px 0 0; color: #6B7280; font-size: 14px;">${email} • ${phone || 'Sin teléfono'}</p>
            </div>

            <!-- Detalles Grid -->
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-bottom: 32px;">
              <div style="background: #F9FAFB; padding: 16px; border-radius: 12px;">
                <p style="margin: 0; font-size: 12px; color: #6B7280; text-transform: uppercase; font-weight: 600;">Ingreso Mensual</p>
                <p style="margin: 4px 0 0; font-size: 16px; font-weight: 700; color: #111827;">$${Number(income).toLocaleString('en-US')}</p>
              </div>
              <div style="background: #F9FAFB; padding: 16px; border-radius: 12px;">
                <p style="margin: 0; font-size: 12px; color: #6B7280; text-transform: uppercase; font-weight: 600;">Presupuesto Max</p>
                <p style="margin: 4px 0 0; font-size: 16px; font-weight: 700; color: #059669;">~$${result?.maxPropertyPrice ? Number(result.maxPropertyPrice).toLocaleString('en-US') : '0'}</p>
              </div>
              <div style="background: #F9FAFB; padding: 16px; border-radius: 12px;">
                <p style="margin: 0; font-size: 12px; color: #6B7280; text-transform: uppercase; font-weight: 600;">Tipo Propiedad</p>
                <p style="margin: 4px 0 0; font-size: 16px; font-weight: 600; color: #374151;">${propertyType || 'No especificado'}</p>
              </div>
              <div style="background: #F9FAFB; padding: 16px; border-radius: 12px;">
                <p style="margin: 0; font-size: 12px; color: #6B7280; text-transform: uppercase; font-weight: 600;">Zona Interés</p>
                <p style="margin: 4px 0 0; font-size: 16px; font-weight: 600; color: #374151;">${Array.isArray(zone) ? zone.join(', ') : zone || 'No especificada'}</p>
              </div>
            </div>

            <!-- Botón de Acción -->
            <div style="text-align: center;">
              <a href="${req.headers.origin || 'https://kr-dit.vercel.app'}" style="display: inline-block; background: #111827; color: white; text-decoration: none; padding: 14px 28px; border-radius: 12px; font-weight: 600; font-size: 14px;">
                Ver Prospecto en Dashboard
              </a>
            </div>

          </div>
          
          <!-- Footer -->
          <div style="background: #F9FAFB; padding: 24px; text-align: center; border-top: 1px solid #E5E7EB;">
            <p style="font-size: 12px; color: #9CA3AF; margin: 0;">
              Enviado automáticamente por Krêdit
            </p>
          </div>
        </div>
      </body>
      </html>
    `;

    // Enviar email
    const data = await resend.emails.send({
      from: 'Krêdit <notificaciones@konsul.digital>', // Dominio verificado
      to: recipientEmail,
      subject: `Nuevo Prospecto: ${name} - Krêdit`,
      html: htmlContent
    });

    return res.status(200).json({ success: true, data });

  } catch (error) {
    console.error('❌ Error enviando notificación de prospecto:', error);
    return res.status(500).json({ error: 'Error interno del servidor al enviar correo' });
  }
}
