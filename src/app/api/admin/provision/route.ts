/**
 * POST /api/admin/provision — REQ-CORE-06
 *
 * Operador autenticado provisiona novo cliente:
 * cria instância (clinic), owner, RBAC e módulos.
 *
 * Protegido por: middleware (auth) + permissão master:provision.
 * Audita toda operação.
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getToken } from 'next-auth/jwt';
import { createUserWithClinic, findUserByEmail } from '@/repositories/auth';
import { getDb } from '@/lib/db/client';
import { users } from '@/lib/db/schema/core';
import { eq } from 'drizzle-orm';
import { writeActionLog } from '@/core/actions/audit-writer';
import { apiSuccess, apiFailure, generateRequestId } from '@/lib/api/response';

const provisionSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  name: z.string().min(2),
  clinicName: z.string().min(2),
});

export async function POST(request: NextRequest) {
  const requestId = generateRequestId();

  try {
    // Auth: only authenticated operators with master access
    const token = await getToken({ req: request, secret: process.env.AUTH_SECRET });
    if (!token?.id) {
      return apiFailure('UNAUTHORIZED', 'Authentication required', requestId, 401);
    }

    // Check operator has master access
    const db = getDb();
    const [operator] = await db
      .select({ isMaster: users.isMaster, email: users.email })
      .from(users)
      .where(eq(users.id, token.id as string))
      .limit(1);

    if (!operator?.isMaster) {
      await writeActionLog({
        clinicId: null,
        principalType: 'user',
        actor: token.id as string,
        actionName: 'admin.provision',
        module: 'core',
        inputRedacted: {},
        result: 'error',
        errorCode: 'forbidden',
      });
      return apiFailure('FORBIDDEN', 'Only operators can provision new clients', requestId, 403);
    }

    // Parse input
    const parsed = provisionSchema.safeParse(await request.json());
    if (!parsed.success) {
      return apiFailure('BAD_REQUEST', 'Invalid input', requestId, 400);
    }
    const { email, password, name, clinicName } = parsed.data;

    // Check for existing user
    const existing = await findUserByEmail(email);
    if (existing) {
      return apiFailure('CONFLICT', 'An account with this email already exists', requestId, 409);
    }

    // Create clinic + owner + RBAC in a transaction (reuse existing signup logic)
    const profile = await createUserWithClinic({ email, password, name, clinicName });

    // Audit the provisioning
    await writeActionLog({
      clinicId: profile.clinicId,
      principalType: 'user',
      actor: token.id as string,
      actionName: 'admin.provision',
      module: 'core',
      inputRedacted: { clinicName, ownerEmail: email },
      result: 'ok',
    });

    return apiSuccess(
      {
        clinicId: profile.clinicId,
        ownerId: profile.id,
        ownerEmail: profile.email,
        clinicName,
      },
      undefined,
      201,
    );
  } catch (error) {
    console.error('Provision error:', error);
    return apiFailure('INTERNAL_ERROR', 'Failed to provision client', requestId, 500);
  }
}
