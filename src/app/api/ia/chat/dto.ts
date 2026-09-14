import type { RunTurnResult } from '@/core/ia-agent/types';

/**
 * Códigos internos liberados no DTO público (allowlist explícita).
 * Todo o resto de `errorCode` fica só no log correlacionado, nunca no HTTP.
 */
const PUBLIC_ERROR_CODES: ReadonlySet<string> = new Set(['rpc_timeout']);

/** Mapeia o resultado interno para o DTO público mínimo do chat. */
export function toPublicChatDto(result: RunTurnResult): Record<string, unknown> {
  const dto: Record<string, unknown> = {
    reply: result.reply,
    turnsUsed: result.turnsUsed,
  };
  if (result.escalated !== undefined) dto.escalated = result.escalated;
  if (result.escalationReason) dto.escalationReason = result.escalationReason;
  if (result.pendingAction) dto.pendingAction = result.pendingAction;
  if (result.errorCode && PUBLIC_ERROR_CODES.has(result.errorCode)) {
    dto.errorCode = result.errorCode;
  }
  return dto;
}
