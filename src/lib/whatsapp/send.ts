/**
 * WhatsApp send helper — neutral lib layer.
 *
 * Thin forwarder to the atendimento channel-service facade (Evolution +
 * failover sidecar + single idempotency claim). Kept as a stable import
 * surface for cross-module consumers (budgets/send, lead-notification,
 * reminders-service).
 */

export interface SendResult {
  success: boolean;
  messageId?: string;
  error?: string;
  /** true quando a duplicata foi suprimida pelo claim de idempotência (A3). */
  deduplicated?: boolean;
}

/**
 * Send a WhatsApp message using the configured provider.
 *
 * `idempotencyKey` (opcional, A3) ancora a operação lógica. RE-REVIEW-A2A3: o
 * claim vive EXCLUSIVAMENTE na facade (`channel-service.runIdempotentSend`) —
 * esta função apenas encaminha a chave, sem claim próprio. Sem a chave, o
 * comportamento é o legado. Nenhum header de idempotência é enviado à
 * Evolution (sem suporte nativo documentado).
 */
export async function sendWhatsAppMessage(
  phone: string, message: string, idempotencyKey?: string,
): Promise<SendResult> {
  const { sendWhatsAppMessage: facadeSend } = await import(
    '@/modules/atendimento/services/channel-service'
  );
  return facadeSend(phone, message, idempotencyKey);
}
