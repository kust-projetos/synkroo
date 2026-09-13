import { createHash, timingSafeEqual } from 'node:crypto';
import { and, eq, sql } from 'drizzle-orm';
import { getDb } from '@/lib/db/client';
import { channelInstallations } from '@/modules/atendimento/schema/integrations';

export type ChannelInstallation = {
  installationId: string;
  clinicId: string;
};

export type WidgetInstallation = ChannelInstallation & {
  allowedOrigins: string[];
};

type ResolveInput = {
  installationId: string
  providedSecret: string
  provider?: string
};

function hashSecret(secret: string): Buffer {
  return createHash('sha256').update(secret).digest();
}

function logSanitizedError(context: string): void {
  // Intentionally omits raw error message/stack: DB failures may embed
  // connection strings, table names, or query fragments. Fail closed with
  // a stable, non-sensitive context marker only.
  console.error(`[${context}] DB lookup failed`);
}

function matchesSecret(provided: string, storedHash: string): boolean {
  if (!provided || !storedHash || typeof storedHash !== 'string') {
    return false;
  }
  const providedHash = hashSecret(provided);
  let expectedHash: Buffer;
  try {
    expectedHash = Buffer.from(storedHash, 'hex');
  } catch {
    return false;
  }
  return expectedHash.length === providedHash.length && timingSafeEqual(providedHash, expectedHash);
}

export async function resolveChannelInstallation(input: ResolveInput): Promise<ChannelInstallation | null> {
  if (!input.installationId || !input.providedSecret) return null;
  try {
    const [row] = await getDb()
      .select({ installationId: channelInstallations.installationId, clinicId: channelInstallations.clinicId, secretHash: channelInstallations.secretHash })
      .from(channelInstallations)
      .where(and(
        eq(channelInstallations.installationId, input.installationId),
        eq(channelInstallations.enabled, true),
        ...(input.provider ? [eq(channelInstallations.provider, input.provider)] : []),
      ))
      .limit(1);
    if (!row || !row.secretHash || !matchesSecret(input.providedSecret, row.secretHash)) return null;
    return { installationId: row.installationId, clinicId: row.clinicId };
  } catch {
    logSanitizedError('resolveChannelInstallation');
    return null;
  }
}

/** Resolve an enabled installation when authentication was verified externally. */
export async function resolveEnabledChannelInstallation(input: {
  installationId: string;
  provider: string;
}): Promise<ChannelInstallation | null> {
  if (!input.installationId || !input.provider) return null;
  try {
    const [row] = await getDb()
      .select({ installationId: channelInstallations.installationId, clinicId: channelInstallations.clinicId })
      .from(channelInstallations)
      .where(and(
        eq(channelInstallations.installationId, input.installationId),
        eq(channelInstallations.provider, input.provider),
        eq(channelInstallations.enabled, true),
      ))
      .limit(1);
    return row ? { installationId: row.installationId, clinicId: row.clinicId } : null;
  } catch {
    logSanitizedError('resolveEnabledChannelInstallation');
    return null;
  }
}

export function isAllowedWidgetOrigin(origin: string): boolean {
  if (!origin) return false;
  try {
    const parsed = new URL(origin);
    return parsed.protocol === 'https:' && parsed.origin === origin;
  } catch {
    return false;
  }
}

/** Public widget lookup. The opaque installation ID is not a clinic selector. */
export async function resolveWidgetInstallation(
  installationId: string,
  origin: string,
): Promise<WidgetInstallation | null> {
  if (!installationId || !isAllowedWidgetOrigin(origin)) return null;
  try {
    const [row] = await getDb()
      .select({
        installationId: channelInstallations.installationId,
        clinicId: channelInstallations.clinicId,
        allowedOrigins: channelInstallations.allowedOrigins,
      })
      .from(channelInstallations)
      .where(and(
        eq(channelInstallations.installationId, installationId),
        eq(channelInstallations.provider, 'widget'),
        eq(channelInstallations.enabled, true),
      ))
      .limit(1);
    if (!row) return null;
    const allowedOrigins = Array.isArray(row.allowedOrigins) ? row.allowedOrigins : [];
    if (!allowedOrigins.includes(origin)) return null;
    return { installationId: row.installationId, clinicId: row.clinicId, allowedOrigins };
  } catch {
    logSanitizedError('resolveWidgetInstallation');
    return null;
  }
}

/** Meta resolves its installation from the signed app webhook and phone ID. */
export async function resolveMetaInstallation(phoneNumberId: string): Promise<ChannelInstallation | null> {
  if (!phoneNumberId) return null;
  try {
    const [installation] = await getDb().select({
      installationId: channelInstallations.installationId,
      clinicId: channelInstallations.clinicId,
    })
      .from(channelInstallations)
      .where(and(
        eq(channelInstallations.installationId, phoneNumberId),
        eq(channelInstallations.provider, 'meta'),
        eq(channelInstallations.enabled, true),
      ))
      .limit(1);
    if (installation) return installation;

    const rows = await getDb().execute(
      // The phone number ID is provider metadata, never a tenant selector from the body.
      // It is resolved against server-side clinic settings after HMAC validation.
      sql`SELECT id AS clinic_id FROM clinics WHERE settings->>'whatsapp_phone_number_id' = ${phoneNumberId} LIMIT 1`,
    ) as any;
    const clinicId = rows?.rows?.[0]?.clinic_id;
    return clinicId ? { installationId: phoneNumberId, clinicId } : null;
  } catch {
    logSanitizedError('resolveMetaInstallation');
    return null;
  }
}

export function hashChannelSecret(secret: string): string {
  return hashSecret(secret).toString('hex');
}
