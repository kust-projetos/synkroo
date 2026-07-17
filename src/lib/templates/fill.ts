/**
 * Template fill helper — neutral lib layer (pure function).
 *
 * Fills {{placeholder}} values in WhatsApp message templates.
 * No module/service dependencies — fully portable.
 *
 * Consumers: procedure-reminder-config (cross-module via lib).
 */

export interface TemplateLike {
  body: string;
}

/** Fill template placeholders with values (pure — no side effects). */
export function fillTemplate(template: TemplateLike, values: Record<string, string>): string {
  let message = template.body;

  const numberedPh = message.match(/\{\{(\d+)\}\}/g);
  if (numberedPh) {
    const valueArr = Object.values(values);
    for (let i = 0; i < numberedPh.length; i++) {
      message = message.replace(numberedPh[i], valueArr[i] || `{{${i + 1}}}`);
    }
  }

  for (const [key, value] of Object.entries(values)) {
    message = message.replace(new RegExp(`\\{\\{${key}\\}\\}`, 'g'), value);
  }

  return message;
}
