import { createHash, timingSafeEqual } from 'node:crypto';
import { and, eq } from 'drizzle-orm';
import { getDb } from '@/lib/db/client';
import { channelInstallations } from '@/lib/db/schema';

export type ChannelInstallation = {
  installationId: string;
  clinicId: string;
};

type ResolveInput = {
  installationId: string
  providedSecret: string
  provider?: string
};

function hashSecret(secret: string): Buffer {
  return createHash('sha256').update(secret).digest();
}

function matchesSecret(provided: string, storedHash: string): boolean {
  const providedHash = hashSecret(provided);
  const expectedHash = Buffer.from(storedHash, 'hex');
  return expectedHash.length === providedHash.length && timingSafeEqual(providedHash, expectedHash);
}

export async function resolveChannelInstallation(input: ResolveInput): Promise<ChannelInstallation | null> {
  if (!input.installationId || !input.providedSecret) return null;
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
}

export function hashChannelSecret(secret: string): string {
  return hashSecret(secret).toString('hex');
}
