import { createServer } from './server.js';
import { getWhatsAppService } from './whatsapp-service.js';

const port = parseInt(process.env.PORT || '3030', 10);
const server = createServer();

server.listen(port, () => {
  console.warn(`Synkroo WhatsApp Sidecar listening on port ${port}`);
});

// Graceful shutdown
const shutdown = async () => {
  console.warn('Shutting down WhatsApp Sidecar...');
  const wa = getWhatsAppService();
  await wa.disconnect().catch(() => {});
  server.close(() => {
    process.exit(0);
  });
};

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
