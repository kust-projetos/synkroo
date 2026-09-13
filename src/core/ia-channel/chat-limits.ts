/**
 * B1 (transporte): teto do `message` aceito no chat do agente.
 *
 * 4.000 chars ≈ ~1k tokens — folga para mensagens longas legítimas (colar
 * texto/relato clínico) sem deixar um payload gigante ir ao DO storage
 * (janela de 20 turnos persistida por conversa) nem ao provider a cada turno.
 * Rejeição explícita (400, sem truncar silenciosamente) para o caller saber
 * que precisa encurtar/dividir a mensagem.
 *
 * Vive fora de `route.ts` porque o App Router só admite exports de rota
 * naquele arquivo (tipos gerados em `.next/types`).
 */
export const IA_CHAT_MAX_MESSAGE_LENGTH = 4000;
