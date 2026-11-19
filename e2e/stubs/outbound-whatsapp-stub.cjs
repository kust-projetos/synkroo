'use strict';

// E2E transport stub. Durable outbound history is written by sendReply after
// this reports success, using the same repository path as a real delivery.
exports.sendWhatsAppMessage = async () => ({
  success: true,
  messageId: 'e2e-outbound-stub',
});
