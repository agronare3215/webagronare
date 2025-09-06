// server.js
// Simple Express server to:
// - servir archivos estáticos (index.html + assets/)
// - exponer GET /maps-key -> devuelve { key: "AIza..." }
// - exponer POST /gemini-proxy -> reenvía la petición al endpoint de Generative Language (Gemini)
// Nota: intenta cargar dotenv si está instalado (opcional).

const express = require('express');
const path = require('path');

try {
    // dotenv es opcional; si lo instalas crea un .env con MAPS_API_KEY y GEMINI_API_KEY
    require('dotenv').config();
} catch (e) {
    // no fatal, dotenv no está instalado
}

const app = express();
const PORT = process.env.PORT || 5501;

// Lee keys de variables de entorno
const MAPS_API_KEY = process.env.MAPS_API_KEY || '';
const GEMINI_API_KEY = process.env.GEMINI_API_KEY || '';

// Middlewares
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: false }));

// Servir archivos estáticos desde la raíz del proyecto (index.html y carpeta assets/)
app.use(express.static(path.join(__dirname)));

app.get('/health', (req, res) => {
    res.json({ status: 'ok' });
});

/**
 * GET /maps-key
 * Devuelve { key: 'AIza...' } para que el front pida la key y cargue la librería de Google Maps desde el cliente.
 * Esto evita incrustar la key directamente en index.html.
 */
app.get('/maps-key', (req, res) => {
    if (!MAPS_API_KEY) {
        return res.status(500).json({ error: 'MAPS_API_KEY no configurada en el servidor' });
    }
    // Nota: no loguees la key en producción
    res.json({ key: MAPS_API_KEY });
});

/**
 * POST /gemini-proxy
 * Reenvía la petición al endpoint de Generative Language (Gemini) usando la GEMINI_API_KEY del servidor.
 * El cuerpo que reciba se reenvía tal cual al API (asegúrate que el frontend mande el payload conforme a la API).
 */
app.post('/gemini-proxy', async (req, res) => {
    if (!GEMINI_API_KEY) {
        return res.status(500).json({ error: 'GEMINI_API_KEY no configurada en el servidor' });
    }

    try {
        const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-05-20:generateContent?key=${encodeURIComponent(GEMINI_API_KEY)}`;
        // Usa fetch global (Node 18+). Reenvía el body JSON tal cual.
        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(req.body)
        });

        const text = await response.text();
        // intenta parsear JSON, si no es JSON devuelve texto
        try {
            const json = JSON.parse(text);
            res.status(response.status).json(json);
        } catch (err) {
            res.status(response.status).send(text);
        }
    } catch (err) {
        console.error('Error proxying to Gemini:', err);
        res.status(502).json({ error: 'Error al conectar con la API de Gemini' });
    }
});

// Puerto y arranque
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
    console.log(`Static files served from ${path.join(__dirname)}`);
    console.log(`GET  /maps-key     -> devuelve { key }`);
    console.log(`POST /gemini-proxy -> proxy hacia Generative Language API`);
});
