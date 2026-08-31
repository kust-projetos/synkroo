/**
 * GET  /api/appointments — list with filters + pagination
 * POST /api/appointments — create appointment
 *
 * Migrated to operacional module action system.
 * Uses operacional.listarConsultas and operacional.agendarConsulta.
 * No direct DB access in this file.
 */

import { NextRequest, NextResponse } from "next/server";
import {
  checkRateLimit,
  getClientIdentifier,
  rateLimitPresets,
} from "@/lib/rate-limit";
import { withModuleRoute } from "@/core/modules/gates";
import { createManifest } from '@/core/modules/manifest';
import { runActionRoute } from "@/modules/operacional/ui/route-adapter";
import { agendarConsulta } from "@/modules/operacional/actions/agendar-consulta";
import { listarConsultas } from "@/modules/operacional/actions/listar-consultas";

const OPERACIONAL_MODULE = "operacional";

async function handleGET(request: NextRequest): Promise<NextResponse> {
  const clientId = getClientIdentifier(request);
  const rateLimit = checkRateLimit(clientId, rateLimitPresets.api);
  if (!rateLimit.allowed) {
    return NextResponse.json(
      { error: "Rate limit exceeded", retryAfter: rateLimit.retryAfter },
      { status: 429, headers: { "Retry-After": String(rateLimit.retryAfter) } },
    );
  }
  const sp = new URL(request.url).searchParams;
  const input = {
    patientId: sp.get("patient_id") ?? undefined,
    dentistId: sp.get("dentist_id") ?? undefined,
    status: sp.get("status") ?? undefined,
    date: sp.get("date") ?? undefined,
    startDate: sp.get("start_date") ?? undefined,
    endDate: sp.get("end_date") ?? undefined,
    dentistIds: sp.getAll("dentist_ids").length
      ? sp.getAll("dentist_ids")
      : undefined,
    page: sp.get("page") ?? undefined,
    limit: sp.get("limit") ?? undefined,
  };
  return runActionRoute(listarConsultas, input);
}

async function handlePOST(request: NextRequest): Promise<NextResponse> {
  const clientId = getClientIdentifier(request);
  const rateLimit = checkRateLimit(clientId, rateLimitPresets.api);
  if (!rateLimit.allowed) {
    return NextResponse.json(
      { error: "Rate limit exceeded", retryAfter: rateLimit.retryAfter },
      { status: 429, headers: { "Retry-After": String(rateLimit.retryAfter) } },
    );
  }
  const body = await request.json();
  // Normalize legacy snake_case payload to canonical camelCase for action input schema
  const normalized: Record<string, unknown> = {};
  if (body.patientId !== undefined) normalized.patientId = body.patientId;
  else if (body.patient_id !== undefined)
    normalized.patientId = body.patient_id;
  if (body.dentistId !== undefined) normalized.dentistId = body.dentistId;
  else if (body.dentist_id !== undefined)
    normalized.dentistId = body.dentist_id;
  if (body.procedureId !== undefined) normalized.procedureId = body.procedureId;
  else if (body.procedure_id !== undefined)
    normalized.procedureId = body.procedure_id;
  if (body.scheduledAt !== undefined) normalized.scheduledAt = body.scheduledAt;
  else if (body.scheduled_at !== undefined)
    normalized.scheduledAt = body.scheduled_at;
  if (body.durationMinutes !== undefined)
    normalized.durationMinutes = body.durationMinutes;
  else if (body.duration_minutes !== undefined)
    normalized.durationMinutes = body.duration_minutes;
  if (body.notes !== undefined) normalized.notes = body.notes;
  return runActionRoute(agendarConsulta, normalized, { okStatus: 201 });
}

const wrappedGET = withModuleRoute(
  OPERACIONAL_MODULE,
  createManifest(),
)(handleGET);
const wrappedPOST = withModuleRoute(
  OPERACIONAL_MODULE,
  createManifest(),
)(handlePOST);

export { wrappedGET as GET, wrappedPOST as POST };
