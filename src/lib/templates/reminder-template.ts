/**
 * Reminder template validation — REGRA CANÔNICA (P1A-SOFT-CAST).
 *
 * Dono do domínio: operacional (procedure-reminder-config). Hospedagem física
 * em lib/templates por ser o único seam importável pelos 3 consumidores sem
 * violar o gate boundaries (services→modules só via raiz/public/schema) e sem
 * vazar server-code (getDb/drizzle) para o bundle client ('use client').
 * Pura, sem dependências — client-safe e server-safe.
 *
 * Consumidores (todos DELEGAM via re-export, nunca redefinem):
 * - src/modules/operacional/services/procedure-reminder-config-service.ts
 * - src/services/reminders/procedure-reminder-config.service.ts
 * - src/components/whatsapp/reminder-config-types.ts (UX)
 */

export const SUPPORTED_TEMPLATE_PLACEHOLDERS = [
  'paciente_nome',
  'data',
  'horario',
  'dentista',
  'procedimento',
] as const;

export const REQUIRED_TEMPLATE_PLACEHOLDERS = [
  'paciente_nome',
  'data',
  'horario',
] as const;

export const TEMPLATE_MAX_LENGTH = 1600;

export interface TemplateValidation {
  valid: boolean;
  errors: string[];
  missingPlaceholders: string[];
}

/** Validação canônica: aceita/rejeita idêntico em todas as vias. */
export function validateTemplate(template: string): TemplateValidation {
  const errors: string[] = [];
  const missingPlaceholders: string[] = [];

  if (!template || template.trim().length === 0) {
    errors.push('Template cannot be empty');
    return { valid: false, errors, missingPlaceholders };
  }

  if (template.length > TEMPLATE_MAX_LENGTH) {
    errors.push(`Template exceeds ${TEMPLATE_MAX_LENGTH} character limit`);
  }

  // Chaves desbalanceadas (ex.: "{{nome}" ou "nome}}").
  const openCount = (template.match(/\{\{/g) || []).length;
  const closeCount = (template.match(/\}\}/g) || []).length;
  if (openCount !== closeCount) {
    errors.push('Unbalanced template placeholders');
  }

  // Placeholders: {{...}} com qualquer conteúdo interno (para flagrar padrão
  // inválido, ex. {{foo-bar}}, que o antigo /\{\{(\w+)\}\}/ deixava passar).
  const found = template.match(/\{\{([^{}]*)\}\}/g) || [];
  const placeholders = found.map((m) => m.replace(/\{\{|\}\}/g, ''));
  for (const ph of placeholders) {
    if (!/^[A-Za-z0-9_]+$/.test(ph)) {
      errors.push(`Placeholder inválido: {{${ph}}}`);
    } else if (!(SUPPORTED_TEMPLATE_PLACEHOLDERS as readonly string[]).includes(ph)) {
      errors.push(
        `Placeholder não suportado: {{${ph}}}. Use: ${SUPPORTED_TEMPLATE_PLACEHOLDERS.join(', ')}`,
      );
    }
  }

  // Obrigatórios para disparo de lembrete (regra UX promovida a canônica).
  for (const required of REQUIRED_TEMPLATE_PLACEHOLDERS) {
    if (!template.includes(`{{${required}}}`)) {
      missingPlaceholders.push(required);
    }
  }
  if (missingPlaceholders.length > 0) {
    errors.push(`Missing required placeholders: ${missingPlaceholders.join(', ')}`);
  }

  return { valid: errors.length === 0, errors, missingPlaceholders };
}
