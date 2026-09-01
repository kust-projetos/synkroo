import http from 'node:http';
import { isAuthorized } from './auth.js';
import { getWhatsAppService } from './whatsapp-service.js';

export function createServer() {
  const startTime = Date.now();
  const wa = getWhatsAppService();

  return http.createServer(async (req, res) => {
    const url = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`);

    // CORS & Content-Type
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');

    if (req.method === 'OPTIONS') {
      res.statusCode = 204;
      res.end();
      return;
    }

    // Healthcheck (public)
    if (req.method === 'GET' && url.pathname === '/health') {
      res.statusCode = 200;
      res.end(JSON.stringify({
        status: wa.isConnected ? 'ok' : 'degraded',
        isConnected: wa.isConnected,
        uptime: Math.floor((Date.now() - startTime) / 1000),
      }));
      return;
    }

    // Authenticated routes
    if (!isAuthorized(req)) {
      res.statusCode = 401;
      res.end(JSON.stringify({ success: false, error: 'Unauthorized' }));
      return;
    }

    // GET /api/v1/session/status
    if (req.method === 'GET' && url.pathname === '/api/v1/session/status') {
      res.statusCode = 200;
      res.end(JSON.stringify(wa.getSession()));
      return;
    }

    // GET /api/v1/session/qrcode
    if (req.method === 'GET' && url.pathname === '/api/v1/session/qrcode') {
      const qr = wa.getQRCode();
      res.statusCode = 200;
      res.end(JSON.stringify({
        qrcode: qr,
        qrcode_available: !wa.isConnected && qr !== null,
      }));
      return;
    }

    // POST /api/v1/messages/send
    if (req.method === 'POST' && url.pathname === '/api/v1/messages/send') {
      let body = '';
      req.on('data', chunk => { body += chunk; });
      req.on('end', async () => {
        try {
          const parsed = JSON.parse(body || '{}');
          if (!parsed.phone || !parsed.message) {
            res.statusCode = 400;
            res.end(JSON.stringify({ success: false, error: 'Missing phone or message parameter' }));
            return;
          }

          const result = await wa.sendMessage(parsed.phone, parsed.message);
          res.statusCode = result.success ? 200 : 503;
          res.end(JSON.stringify(result));
        } catch (err: unknown) {
          const msg = err instanceof Error ? err.message : 'Invalid JSON body';
          res.statusCode = 400;
          res.end(JSON.stringify({ success: false, error: msg }));
        }
      });
      return;
    }

    res.statusCode = 404;
    res.end(JSON.stringify({ success: false, error: 'Route not found' }));
  });
}
