/**
 * Treatment Plans Repository
 * DB operations for treatment_plans and treatment_plan_items tables via Drizzle.
 */

import { eq, and, desc } from "drizzle-orm";
import { getDb } from "@/lib/db/client";
import { treatmentPlans, treatmentPlanItems } from "@/lib/db/schema/business";
import { patients } from "@/modules/operacional/schema";

/**
 * Delete a treatment plan and its items.
 * Replaces two Supabase delete calls.
 */
export async function deleteTreatmentPlan(
	treatmentPlanId: string,
): Promise<void> {
	const db = getDb();
	await db
		.delete(treatmentPlanItems)
		.where(eq(treatmentPlanItems.treatmentPlanId, treatmentPlanId));
	await db.delete(treatmentPlans).where(eq(treatmentPlans.id, treatmentPlanId));
}

// ──────────────────────────────────────────────
// Types matching service layer
// ──────────────────────────────────────────────
export interface TreatmentPlanRow {
	id: string;
	clinicId: string;
	patientId: string;
	title: string;
	description: string | null;
	totalSessions: number;
	completedSessions: number;
	status: string;
	startedAt: Date | null;
	expectedCompletionAt: Date | null;
	completedAt: Date | null;
	lastSessionAt: Date | null;
	nextSessionDueAt: Date | null;
	notes: string | null;
	createdBy: string | null;
	createdAt: Date;
	updatedAt: Date;
}

export interface TreatmentPlanItemRow {
	id: string;
	treatmentPlanId: string;
	procedureId: string | null;
	procedureName: string;
	sessionNumber: number;
	appointmentId: string | null;
	status: string;
	scheduledAt: Date | null;
	completedAt: Date | null;
	notes: string | null;
	createdAt: Date;
}

export interface TreatmentPlanWithDetails extends TreatmentPlanRow {
	patient: { id: string; name: string; phone: string } | null;
	items: TreatmentPlanItemRow[];
}

/**
 * Create a treatment plan with items.
 */
export async function createWithItems(data: {
	clinicId: string;
	patientId: string;
	title: string;
	description?: string | null;
	totalSessions: number;
	startedAt?: Date | null;
	expectedCompletionAt?: Date | null;
	notes?: string | null;
	createdBy?: string | null;
	items: Array<{
		procedureId?: string | null;
		procedureName: string;
		sessionNumber: number;
		appointmentId?: string | null;
		status?: string;
		scheduledAt?: Date | null;
		notes?: string | null;
	}>;
}): Promise<{ plan: TreatmentPlanRow; items: TreatmentPlanItemRow[] }> {
	const db = getDb();

	// Insert plan
	const [plan] = (await db
		.insert(treatmentPlans)
		.values({
			clinicId: data.clinicId,
			patientId: data.patientId,
			title: data.title,
			description: data.description ?? null,
			totalSessions: data.totalSessions,
			completedSessions: 0,
			status: "active",
			startedAt: data.startedAt ?? null,
			expectedCompletionAt: data.expectedCompletionAt ?? null,
			notes: data.notes ?? null,
			createdBy: data.createdBy ?? null,
		})
		.returning()) as [TreatmentPlanRow];

	// Insert items
	const items: TreatmentPlanItemRow[] = [];
	if (data.items.length > 0) {
		const inserted = (await db
			.insert(treatmentPlanItems)
			.values(
				data.items.map((item, index) => ({
					treatmentPlanId: plan.id,
					procedureId: item.procedureId ?? null,
					procedureName: item.procedureName,
					sessionNumber: item.sessionNumber || index + 1,
					appointmentId: item.appointmentId ?? null,
					status: item.status ?? "pending",
					scheduledAt: item.scheduledAt ?? null,
					notes: item.notes ?? null,
				})),
			)
			.returning()) as [TreatmentPlanItemRow];
		items.push(...inserted);
	}

	return { plan, items };
}

/**
 * Find treatment plans by patient with items and patient info.
 */
export async function findByPatient(
	patientId: string,
	clinicId: string,
): Promise<TreatmentPlanWithDetails[]> {
	const db = getDb();

	const rows = (await db
		.select({
			id: treatmentPlans.id,
			clinicId: treatmentPlans.clinicId,
			patientId: treatmentPlans.patientId,
			title: treatmentPlans.title,
			description: treatmentPlans.description,
			totalSessions: treatmentPlans.totalSessions,
			completedSessions: treatmentPlans.completedSessions,
			status: treatmentPlans.status,
			startedAt: treatmentPlans.startedAt,
			expectedCompletionAt: treatmentPlans.expectedCompletionAt,
			completedAt: treatmentPlans.completedAt,
			lastSessionAt: treatmentPlans.lastSessionAt,
			nextSessionDueAt: treatmentPlans.nextSessionDueAt,
			notes: treatmentPlans.notes,
			createdBy: treatmentPlans.createdBy,
			createdAt: treatmentPlans.createdAt,
			updatedAt: treatmentPlans.updatedAt,
			patient: {
				id: patients.id,
				name: patients.name,
				phone: patients.phone,
			},
		})
		.from(treatmentPlans)
		.leftJoin(patients, eq(patients.id, treatmentPlans.patientId))
		.where(
			and(
				eq(treatmentPlans.patientId, patientId),
				eq(treatmentPlans.clinicId, clinicId),
			),
		)
		.orderBy(desc(treatmentPlans.createdAt))) as [
		TreatmentPlanRow & {
			patient: { id: string; name: string; phone: string } | null;
		},
	];

	// Fetch items for each plan
	const result: TreatmentPlanWithDetails[] = [];
	for (const row of rows) {
		const items = (await db
			.select()
			.from(treatmentPlanItems)
			.where(eq(treatmentPlanItems.treatmentPlanId, row.id))) as [
			TreatmentPlanItemRow,
		];
		result.push({ ...row, items });
	}

	return result;
}

/**
 * Find a single treatment plan by ID with items and patient info.
 */
export async function findById(
	treatmentPlanId: string,
): Promise<TreatmentPlanWithDetails | null> {
	const db = getDb();

	const [row] = (await db
		.select({
			id: treatmentPlans.id,
			clinicId: treatmentPlans.clinicId,
			patientId: treatmentPlans.patientId,
			title: treatmentPlans.title,
			description: treatmentPlans.description,
			totalSessions: treatmentPlans.totalSessions,
			completedSessions: treatmentPlans.completedSessions,
			status: treatmentPlans.status,
			startedAt: treatmentPlans.startedAt,
			expectedCompletionAt: treatmentPlans.expectedCompletionAt,
			completedAt: treatmentPlans.completedAt,
			lastSessionAt: treatmentPlans.lastSessionAt,
			nextSessionDueAt: treatmentPlans.nextSessionDueAt,
			notes: treatmentPlans.notes,
			createdBy: treatmentPlans.createdBy,
			createdAt: treatmentPlans.createdAt,
			updatedAt: treatmentPlans.updatedAt,
			patient: {
				id: patients.id,
				name: patients.name,
				phone: patients.phone,
			},
		})
		.from(treatmentPlans)
		.leftJoin(patients, eq(patients.id, treatmentPlans.patientId))
		.where(eq(treatmentPlans.id, treatmentPlanId))
		.limit(1)) as [
		| (TreatmentPlanRow & {
				patient: { id: string; name: string; phone: string } | null;
		  })
		| null,
	];

	if (!row) return null;

	const items = (await db
		.select()
		.from(treatmentPlanItems)
		.where(eq(treatmentPlanItems.treatmentPlanId, treatmentPlanId))) as [
		TreatmentPlanItemRow,
	];

	return { ...row, items };
}

/**
 * Update a treatment plan and return the updated row.
 */
export async function update(
	treatmentPlanId: string,
	data: {
		title?: string;
		description?: string | null;
		status?: string;
		totalSessions?: number;
		expectedCompletionAt?: Date | null;
		notes?: string | null;
		completedSessions?: number;
		lastSessionAt?: Date | null;
		completedAt?: Date | null;
	},
): Promise<TreatmentPlanRow | null> {
	const db = getDb();
	const [row] = (await db
		.update(treatmentPlans)
		.set({ ...data, updatedAt: new Date() } as any)
		.where(eq(treatmentPlans.id, treatmentPlanId))
		.returning()) as [TreatmentPlanRow | null];
	return row ?? null;
}

/**
 * Get plan progress (total/completed sessions).
 */
export async function getProgress(
	treatmentPlanId: string,
): Promise<{ totalSessions: number; completedSessions: number } | null> {
	const db = getDb();
	const [row] = (await db
		.select({
			totalSessions: treatmentPlans.totalSessions,
			completedSessions: treatmentPlans.completedSessions,
		})
		.from(treatmentPlans)
		.where(eq(treatmentPlans.id, treatmentPlanId))
		.limit(1)) as [
		{ totalSessions: number | null; completedSessions: number | null } | null,
	];

	if (!row) return null;
	return {
		totalSessions: row.totalSessions ?? 0,
		completedSessions: row.completedSessions ?? 0,
	};
}

/**
 * Update a treatment plan item and return the updated row.
 */
export async function updateItem(
	itemId: string,
	treatmentPlanId: string,
	data: {
		status?: string;
		completedAt?: Date | null;
		scheduledAt?: Date | null;
		notes?: string | null;
	},
): Promise<TreatmentPlanItemRow | null> {
	const db = getDb();
	const [row] = (await db
		.update(treatmentPlanItems)
		.set({ ...data, updatedAt: new Date() } as any)
		.where(and(
			eq(treatmentPlanItems.id, itemId),
			eq(treatmentPlanItems.treatmentPlanId, treatmentPlanId),
		))
		.returning()) as [TreatmentPlanItemRow | null];
	return row ?? null;
}
