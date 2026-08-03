const REDACTED = '[REDACTED]'
const PII_FIELDS = new Set(['phone', 'patientPhone', 'email', 'patientEmail', 'cpf'])

export function redactPII(value: any): any {
  if (Array.isArray(value)) return value.map(redactPII)
  if (!value || typeof value !== 'object') return value
  return Object.fromEntries(Object.entries(value).map(([key, item]) => [
    key,
    PII_FIELDS.has(key) ? REDACTED : redactPII(item),
  ]))
}
