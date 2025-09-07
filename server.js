// server.js
const express = require('express');
const path = require('path');
const fs = require('fs');
const nodemailer = require('nodemailer');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json({ limit: '1mb' }));
// Servir archivos estáticos (index.html, assets/, gracias.html, etc.)
app.use(express.static(path.join(__dirname)));

// GET /gracias -> devuelve gracias.html
app.get('/gracias', (req, res) => {
    res.sendFile(path.join(__dirname, 'gracias.html'));
});

/**
 * POST /api/confirm-appointment
 * Recibe payload desde Calendly (o cualquier cliente) en body.calendly_payload
 * Guarda registro en data/appointments.json y (opcional) envía correo de confirmación.
 */
app.post('/api/confirm-appointment', async (req, res) => {
    try {
        const payload = req.body.calendly_payload || req.body || null;
        if (!payload) return res.status(400).json({ ok: false, error: 'Missing payload' });

        // Guardar registro localmente
        const dataDir = path.join(__dirname, 'data');
        if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });
        const file = path.join(dataDir, 'appointments.json');
        let list = [];
        if (fs.existsSync(file)) {
            try { list = JSON.parse(fs.readFileSync(file, 'utf8') || '[]'); } catch (e) { list = []; }
        }
        const record = { receivedAt: new Date().toISOString(), payload };
        list.push(record);
        fs.writeFileSync(file, JSON.stringify(list, null, 2), 'utf8');

        // Extraer datos útiles del payload para el correo (lo más probable)
        const invitee = payload?.invitee || payload?.invitee_information || payload?.invitee || null;
        const event = payload?.event || payload?.scheduling || payload?.event || null;

        const inviteeEmail = invitee?.email || invitee?.email_address || null;
        const inviteeName = invitee?.name || (invitee?.first_name ? `${invitee.first_name} ${invitee.last_name || ''}`.trim() : 'Cliente');
        const eventStart = event?.start_time || event?.start_at || (payload?.event?.start_time) || '';
        const eventEnd = event?.end_time || event?.end_at || '';
        const eventUri = event?.uri || event?.event_uri || '';

        // Preparar cuerpo de correo
        const subject = `Confirmación de cita — Agronoré`;
        const textParts = [
            `Hola ${inviteeName},`,
            ``,
            `Gracias por agendar una cita con Agronoré.`,
            eventStart ? `Fecha/hora: ${eventStart}` : null,
            eventUri ? `Detalle del evento: ${eventUri}` : null,
            ``,
            `Si necesitas cambiar la fecha o cancelar, por favor contáctanos: hola@agronare.com`,
            ``,
            `— Agronoré`
        ].filter(Boolean).join('\n');

        // Si no hay configuración SMTP, solo confirmamos almacenamiento
        if (!process.env.SMTP_HOST || !process.env.SMTP_USER) {
            console.log('--- Nueva cita registrada (SMTP no configurado) ---');
            console.log('inviteeEmail:', inviteeEmail);
            console.log('inviteeName:', inviteeName);
            console.log('eventStart:', eventStart);
            console.log('payload (guardado en data/appointments.json)');
            return res.json({ ok: true, saved: true, note: 'SMTP not configured - saved locally' });
        }

        // Configurar transporter (Nodemailer)
        const transporter = nodemailer.createTransport({
            host: process.env.SMTP_HOST,
            port: parseInt(process.env.SMTP_PORT || '587', 10),
            secure: (process.env.SMTP_SECURE === 'true') || false,
            auth: {
                user: process.env.SMTP_USER,
                pass: process.env.SMTP_PASS
            }
        });

        // To: inviteeEmail (si existe) + ADMIN_EMAIL (si configurado)
        const recipients = [];
        if (inviteeEmail) recipients.push(inviteeEmail);
        if (process.env.ADMIN_EMAIL) recipients.push(process.env.ADMIN_EMAIL);

        const mailOptions = {
            from: process.env.FROM_EMAIL || process.env.SMTP_USER,
            to: recipients.join(','),
            subject,
            text: textParts,
            html: `<p>Hola <strong>${inviteeName}</strong>,</p>
             <p>Gracias por agendar una cita con Agronoré.</p>
             ${eventStart ? `<p><strong>Fecha / hora:</strong> ${eventStart}</p>` : ''}
             ${eventUri ? `<p><a href="${eventUri}" target="_blank" rel="noopener">Ver detalles del evento</a></p>` : ''}
             <p>Si necesitas cambiar la fecha o cancelar, por favor contáctanos en <a href="mailto:hola@agronare.com">hola@agronare.com</a>.</p>
             <p>— Agronoré</p>`
        };

        // Enviar correo
        await transporter.sendMail(mailOptions);

        return res.json({ ok: true, saved: true, emailed: true });
    } catch (err) {
        console.error('Error en /api/confirm-appointment:', err);
        return res.status(500).json({ ok: false, error: err.message });
    }
});

app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
    console.log('Serving static files from', path.join(__dirname));
});
