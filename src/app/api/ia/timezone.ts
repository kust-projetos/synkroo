const DEFAULT_IA_TIMEZONE = 'America/Sao_Paulo';

export function resolveIaTimezone(configuredTimezone = process.env.IA_DEFAULT_TIMEZONE): string {
  return configuredTimezone?.trim() || DEFAULT_IA_TIMEZONE;
}
