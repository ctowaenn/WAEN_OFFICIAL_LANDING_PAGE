/**
 * Smoke test local para POST /api/subscribe (sin Vercel CLI).
 * Sin variables Brevo en entorno: espera HTTP 503 y JSON con ok: false.
 * Con env configurada: puede devolver 200 {"ok":true} si Brevo acepta el DOI.
 */
/* eslint-disable no-console */
const http = require('http');
const path = require('path');

const handler = require(path.join(__dirname, '..', 'api', 'subscribe.js'));

const samplePayload = JSON.stringify({
  NOMBRE: 'E2E Test',
  EMAIL: 'e2e.verify+' + Date.now() + '@example.com',
  locale: 'es',
  PRENDA_INTERES: ['Identity and character'],
  ACEPTA_MARKETING: '1',
  email_address_check: '',
});

const server = http.createServer(async (req, res) => {
  if (req.url === '/api/subscribe' && req.method === 'POST') {
    await handler(req, res);
    return;
  }
  res.statusCode = 404;
  res.end('not found');
});

server.listen(0, '127.0.0.1', async () => {
  const { port } = server.address();
  const url = `http://127.0.0.1:${port}/api/subscribe`;
  try {
    const r = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: samplePayload,
    });
    const text = await r.text();
    console.log('POST /api/subscribe →', r.status, text.slice(0, 500));
    let data;
    try {
      data = JSON.parse(text);
    } catch {
      data = null;
    }
    if (r.status === 503 && data && data.ok === false) {
      console.log('OK smoke: env Brevo no configurada (503 esperado en dev).');
      process.exitCode = 0;
    } else if (r.status === 200 && data && data.ok === true) {
      console.log('OK smoke: Brevo DOI aceptó el envío (revisa email de confirmación).');
      process.exitCode = 0;
    } else {
      console.warn('Revisa respuesta: no es 503 esperado ni 200 ok:true.');
      process.exitCode = 1;
    }
  } catch (e) {
    console.error(e);
    process.exitCode = 1;
  } finally {
    server.close();
  }
});
