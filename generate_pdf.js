// generate_pdf.js
const puppeteer = require('puppeteer');

module.exports = async function generatePdf(html, options = {}) {
    // options: puppeteer launch options could be passed via env (for serverless)
    const launchOptions = {
        args: ['--no-sandbox', '--disable-setuid-sandbox'],
        ...(process.env.PUPPETEER_EXECUTABLE_PATH ? { executablePath: process.env.PUPPETEER_EXECUTABLE_PATH } : {})
    };

    const browser = await puppeteer.launch(launchOptions);
    try {
        const page = await browser.newPage();
        // set a default viewport (optional)
        await page.setViewport({ width: 1200, height: 800 });
        // set content
        await page.setContent(html, { waitUntil: ['networkidle0'] });
        const pdfBuffer = await page.pdf({
            format: options.format || 'A4',
            printBackground: true,
            margin: options.margin || { top: '10mm', bottom: '10mm', left: '10mm', right: '10mm' },
            preferCSSPageSize: true
        });
        return pdfBuffer;
    } finally {
        try { await browser.close(); } catch (e) { /* ignore */ }
    }
};
