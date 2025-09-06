// server.js
require('dotenv').config();
const express = require('express');
const path = require('path');
const fetch = globalThis.fetch || require('node-fetch');

const app = express();
const PORT = process.env.PORT || 5501;

app.use(express.json({ limit: '200kb' }));
app.use(express.static(path.join(__dirname))); // sirve index.html y assets/

// Endpoint para entregar la Maps API key al cliente de forma segura
app.get('/maps-key', (req, res) => {
    const key = process.env.MAPS_API_KEY || process.env.GOOGLE_MAPS_KEY || '';
    if (!key) {
        return res.status(500).json({ error: 'Maps key no configurada en el servidor.' });
    }
    res.json({ key });
});

// Proxy para Gemini (usa GEMINI_API_KEY en .env)
// Recibe el mismo payload que la API de Generative Language y lo reenvía
app.post('/gemini-proxy', async (req, res) => {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) return res.status(500).json({ error: 'GEMINI_API_KEY no configurada en el servidor.' });

    try {
        const upstreamUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-05-20:generateContent?key=${encodeURIComponent(apiKey)}`;
        const upstreamResp = await fetch(upstreamUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(req.body)
        });

        const text = await upstreamResp.text();
        res.status(upstreamResp.status).type(upstreamResp.headers.get('content-type') || 'application/json').send(text);
    } catch (err) {
        console.error('Error proxying to Gemini:', err);
        res.status(500).json({ error: 'Error al contactar la API de Gemini.' });
    }
});

// SPA fallback
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

app.listen(PORT, () => {
    console.log(`Servidor escuchando en http://localhost:${PORT}`);
});
