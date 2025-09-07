// server.js
require('dotenv').config();
const path = require('path');
const express = require('express');
const fs = require('fs-extra');
const { v4: uuidv4 } = require('uuid');
const sgMail = require('@sendgrid/mail');
const nodemailer = require('nodemailer');
const generatePdf = require('./generate_pdf'); // módulo que exporta generatePdfBuffer(html, options)
const app = express();

const PORT = process.env.PORT || 3000;
const MAPS_KEY = process.env.GOOGLE_MAPS_KEY || '';
const SENDGRID_KEY = process.env.SENDGRID_API_KEY || '';
const SMTP_URL = process.env.SMTP_URL || ''; // optional: smtp://user:pass@smtp.host:port
const FROM_EMAIL = process.env.FROM_EMAIL || 'no-reply@agronare.com';

if (SENDGRID_KEY) {
    sgMail.setApiKey(SENDGRID_KEY);
}

// ensure folder for comprobantes
const COMPROBANTES_DIR = path.join(__dirname, 'comprobantes');
fs.ensureDirSync(COMPROBANTES_DIR);

// middlewares
app.use(express.json({ limit: '5mb' }));
app.use(express.urlencoded({ extended: true }));
// Serve static (index.html, assets)
app.use(express.static(path.join(__dirname, 'public')));

// route: maps key (secure-ish)
app.get('/maps-key', (req, res) => {
    if (!MAPS_KEY) return res.status(404).json({ ok: false, error: 'No maps key configured' });
    // Opcionalmente: añadir checks de origen
    res.json({ ok: true, key: MAPS_KEY });
});

// GET /gracias -> sirve gracias.html (busca en public/ o raíz)
app.get('/gracias', (req, res) => {
    // si lo guardaste en public/
    const p = path.join(__dirname, 'public', 'gracias.html');
    if (fs.existsSync(p)) return res.sendFile(p);
    // fallback: busca en raíz
    const p2 = path.join(__dirname, 'gracias.html');
    if (fs.existsSync(p2)) return res.sendFile(p2);
    return res.status(404).send('gracias.html no encontrado en el servidor.');
});

// Servir comprobantes (archivos PDF generados)
app.use('/comprobantes', express.static(COMPROBANTES_DIR, { index: false }));

/**
 * POST /api/send-confirmation
 * body: { name, email, phone, date, notes }  (JSON)
 *
 * Genera PDF y lo envía por correo. Devuelve { ok:true, url: '/comprobantes/xxx.pdf' }
 */
app.post('/api/send-confirmation', async (req, res) => {
    try {
        const { name, email, phone, date, notes } = req.body || {};
        if (!email || !name) return res.status(400).json({ ok: false, error: 'name and email required' });

        // build simple HTML template for PDF
        const comprobanteId = `AGR-${Date.now()}-${uuidv4().slice(0, 6).toUpperCase()}`;
        const html = `
      <!doctype html>
      <html>
        <head>
          <meta charset="utf-8" />
          <title>Comprobante - ${comprobanteId}</title>
          <style>
            body { font-family: Arial, Helvetica, sans-serif; color:#08263b; padding:24px; }
            .head { display:flex; align-items:center; gap:16px; }
            .logo { width:86px; height:86px; border-radius:12px; background:#f0fff4; display:flex; align-items:center; justify-content:center; }
            h1{ margin:0; font-size:18px }
            .box{ margin-top:16px; border-radius:10px; padding:14px; border:1px solid #e6eef0; }
            .row{ display:flex; justify-content:space-between; margin-top:10px; font-size:14px }
            .notes{ margin-top:12px; font-size:13px; color:#334155 }
            footer{ margin-top:28px; font-size:12px; color:#6b7280 }
          </style>
        </head>
        <body>
          <div class="head">
            <div class="logo"><strong style="color:#16a34a">AGR</strong></div>
            <div>
              <h1>Comprobante Agronoré — ${comprobanteId}</h1>
              <div style="color:#475569;font-size:13px">Generado: ${new Date().toLocaleString()}</div>
            </div>
          </div>

          <div class="box">
            <div class="row"><strong>Nombre</strong><span>${escapeHtml(name)}</span></div>
            <div class="row"><strong>Correo</strong><span>${escapeHtml(email)}</span></div>
            <div class="row"><strong>Teléfono</strong><span>${escapeHtml(phone || '—')}</span></div>
            <div class="row"><strong>Fecha propuesta</strong><span>${escapeHtml(date || '—')}</span></div>
            <div class="notes"><strong>Notas:</strong><div>${escapeHtml(notes || '—')}</div></div>
          </div>

          <footer>Gracias por confiar en Agronoré — agronore.com</footer>
        </body>
      </html>
    `;

        // generate PDF buffer
        const pdfBuffer = await generatePdf(html, { format: 'A4', margin: { top: '14mm', bottom: '14mm' } });

        // save to file
        const filename = `${Date.now()}-${comprobanteId}.pdf`;
        const filePath = path.join(COMPROBANTES_DIR, filename);
        await fs.writeFile(filePath, pdfBuffer);

        // prepare mail
        const fileBase64 = pdfBuffer.toString('base64');
        const publicUrl = `/comprobantes/${encodeURIComponent(filename)}`;

        // try send via SendGrid if available
        if (SENDGRID_KEY) {
            const msg = {
                to: email,
                from: FROM_EMAIL,
                subject: `Tu comprobante — ${comprobanteId}`,
                text: `Hola ${name}, adjuntamos tu comprobante (${comprobanteId}).`,
                html: `<p>Hola ${name},</p><p>Adjuntamos tu comprobante <strong>${comprobanteId}</strong>. Puedes descargarlo también desde <a href="${publicUrl}">aquí</a>.</p><p>Saludos,<br>Agronoré</p>`,
                attachments: [
                    {
                        content: fileBase64,
                        filename,
                        type: 'application/pdf',
                        disposition: 'attachment'
                    }
                ]
            };
            await sgMail.send(msg);
        } else if (SMTP_URL) {
            // fallback to nodemailer
            const transporter = nodemailer.createTransport(SMTP_URL);
            await transporter.sendMail({
                from: FROM_EMAIL,
                to: email,
                subject: `Tu comprobante — ${comprobanteId}`,
                text: `Hola ${name}, adjuntamos tu comprobante (${comprobanteId}).`,
                html: `<p>Hola ${name},</p><p>Adjuntamos tu comprobante <strong>${comprobanteId}</strong>. Puedes descargarlo también desde <a href="${publicUrl}">aquí</a>.</p>`,
                attachments: [{ filename, content: pdfBuffer }]
            });
        } else {
            // no mail provider configured -> respond OK but don't send
            console.warn('No email provider configured (SENDGRID_API_KEY or SMTP_URL). Comprobante generado but not sent.');
        }

        // respond with link that cliente (front) can use to open /gracias?file=comprobantes/filename&id=...
        res.json({
            ok: true,
            id: comprobanteId,
            url: publicUrl,
            download: publicUrl,
            name,
            email
        });
    } catch (err) {
        console.error('Error /api/send-confirmation', err);
        res.status(500).json({ ok: false, error: String(err.message || err) });
    }
});

function escapeHtml(str = '') {
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/"/g, '&quot;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/'/g, '&#039;');
}

app.listen(PORT, () => console.log(`Server running on ${PORT} — public served from /public`));
