/**
 * Budgets Repository
 * DB operations for budgets and budget_items tables via Drizzle.
 */

import { eq, and, lte, gte, desc } from "drizzle-orm";
import { getDb } from "@/lib/db/client";
import {
	budgets,
	budgetItems,
	budgetInstallments,
} from "@/lib/db/schema/business";
import { patients } from "@/modules/operacional/schema";

/**
 * Hard-delete budget and its items.
 */
export async function hardDeleteBudget(budgetId: string): Promise<void> {
	const db = getDb();
	await db.delete(budgetItems).where(eq(budgetItems.budgetId, budgetId));
	await db.delete(budgets).where(eq(budgets.id, budgetId));
}

/**
 * Soft-delete budget: mark as expired.
 */
export async function softDeleteBudget(budgetId: string): Promise<void> {
	const db = getDb();
	await db
		.update(budgets)
		.set({ status: "expired", updatedAt: new Date() } as any)
		.where(eq(budgets.id, budgetId));
}

// ──────────────────────────────────────────────
// Types
// ──────────────────────────────────────────────
export interface BudgetRow {
	id: string;
	clinicId: string;
	patientId: string | null;
	treatmentPlanId: string | null;
	appointmentId: string | null;
	title: string | null;
	description: string | null;
	totalValue: string | null;
	discountPercent: string | null;
	discountValue: string | null;
	finalValue: string | null;
	status: string | null;
	validUntil: Date | null;
	sentAt: Date | null;
	respondedAt: Date | null;
	convertedAt: Date | null;
	conversionAppointmentId: string | null;
	notes: string | null;
	followUpSequence: number | null;
	nextFollowUpAt: Date | null;
	createdBy: string | null;
	createdAt: Date | null;
	updatedAt: Date | null;
}

export interface BudgetItemRow {
	id: string;
	budgetId: string;
	procedureId: string | null;
	procedureName: string;
	quantity: number;
	unitPrice: string | null;
	discountPercent: string | null;
	totalPrice: string | null;
	notes: string | null;
	createdAt: Date;
}

export interface BudgetInstallmentRow {
	id: string;
	budgetId: string;
	amount: string | null;
	dueDate: string | null;
	status: string | null;
	paidAt: Date | null;
	paymentId: string | null;
	createdAt: Date;
}

export interface BudgetWithDetails extends BudgetRow {
	patient: { id: string; name: string; phone: string } | null;
	items: BudgetItemRow[];
}

/**
 * Create budget with items.
 */
export async function createWithItems(data: {
	clinicId: string;
	patientId: string;
	treatmentPlanId?: string | null;
	appointmentId?: string | null;
	title?: string | null;
	description?: string | null;
	totalValue: string;
	discountPercent?: string;
	discountValue?: string;
	finalValue: string;
	validUntil?: Date | null;
	notes?: string | null;
	createdBy?: string | null;
	items: Array<{
		procedureId?: string | null;
		procedureName: string;
		quantity: number;
		unitPrice: string;
		discountPercent?: string;
		totalPrice: string;
		notes?: string | null;
	}>;
}): Promise<{ budget: BudgetRow; items: BudgetItemRow[] }> {
	const db = getDb();

	const [budget] = await db
		.insert(budgets)
		.values({
			clinicId: data.clinicId,
			patientId: data.patientId,
			treatmentPlanId: data.treatmentPlanId ?? null,
			appointmentId: data.appointmentId ?? null,
			title: data.title ?? null,
			description: data.description ?? null,
			totalValue: data.totalValue,
			discountPercent: data.discountPercent ?? "0",
			discountValue: data.discountValue ?? "0",
			finalValue: data.finalValue,
			status: "pending",
			validUntil: data.validUntil ?? null,
			notes: data.notes ?? null,
			createdBy: data.createdBy ?? null,
		})
		.returning();
	if (!budget) throw new Error('Failed to create budget');

	const items: BudgetItemRow[] = [];
	if (data.items.length > 0) {
		const inserted = (await db
			.insert(budgetItems)
			.values(
				data.items.map((item) => ({
					budgetId: budget.id,
					procedureId: item.procedureId ?? null,
					procedureName: item.procedureName,
					quantity: item.quantity,
					unitPrice: item.unitPrice,
					discountPercent: item.discountPercent ?? "0",
					totalPrice: item.totalPrice,
					notes: item.notes ?? null,
				})),
			)
			.returning()) as unknown as BudgetItemRow[];
		items.push(...inserted);
	}

	return { budget, items };
}

/**
 * Find budgets needing follow-up (status=sent, next_follow_up_at <= now).
 */
export async function findNeedingFollowUp(
	clinicId: string,
): Promise<BudgetWithDetails[]> {
	const db = getDb();
	const now = new Date();

	const rows = (await db
		.select({
			id: budgets.id,
			clinicId: budgets.clinicId,
			patientId: budgets.patientId,
			treatmentPlanId: budgets.treatmentPlanId,
			appointmentId: budgets.appointmentId,
			title: budgets.title,
			description: budgets.description,
			totalValue: budgets.totalValue,
			discountPercent: budgets.discountPercent,
			discountValue: budgets.discountValue,
			finalValue: budgets.finalValue,
			status: budgets.status,
			validUntil: budgets.validUntil,
			sentAt: budgets.sentAt,
			respondedAt: budgets.respondedAt,
			convertedAt: budgets.convertedAt,
			conversionAppointmentId: budgets.conversionAppointmentId,
			notes: budgets.notes,
			followUpSequence: budgets.followUpSequence,
			nextFollowUpAt: budgets.nextFollowUpAt,
			createdBy: budgets.createdBy,
			createdAt: budgets.createdAt,
			updatedAt: budgets.updatedAt,
			patient: {
				id: patients.id,
				name: patients.name,
				phone: patients.phone,
			},
		})
		.from(budgets)
		.leftJoin(patients, eq(patients.id, budgets.patientId))
		.where(
			and(
				eq(budgets.clinicId, clinicId),
				eq(budgets.status, "sent"),
				lte(budgets.nextFollowUpAt, now),
			),
		)) as unknown as [
		BudgetRow & { patient: { id: string; name: string; phone: string } | null },
	];

	const result: BudgetWithDetails[] = [];
	for (const row of rows) {
		const items = (await db
			.select()
			.from(budgetItems)
			.where(eq(budgetItems.budgetId, row.id))) as unknown as BudgetItemRow[];
		result.push({ ...row, items });
	}

	return result;
}

/**
 * Update follow-up fields for a budget.
 */
export async function updateFollowUp(
	budgetId: string,
	data: {
		followUpSequence?: number;
		nextFollowUpAt?: Date | null;
	},
): Promise<BudgetRow | null> {
	const db = getDb();
	const [row] = await db
		.update(budgets)
		.set({ ...data, updatedAt: new Date() } as any)
		.where(eq(budgets.id, budgetId))
		.returning();
	return row ?? null;
}

/**
 * Find a single budget by ID with items and patient.
 */
export async function findById(
	budgetId: string,
): Promise<BudgetWithDetails | null> {
	const db = getDb();

	const [row] = (await db
		.select({
			id: budgets.id,
			clinicId: budgets.clinicId,
			patientId: budgets.patientId,
			treatmentPlanId: budgets.treatmentPlanId,
			appointmentId: budgets.appointmentId,
			title: budgets.title,
			description: budgets.description,
			totalValue: budgets.totalValue,
			discountPercent: budgets.discountPercent,
			discountValue: budgets.discountValue,
			finalValue: budgets.finalValue,
			status: budgets.status,
			validUntil: budgets.validUntil,
			sentAt: budgets.sentAt,
			respondedAt: budgets.respondedAt,
			convertedAt: budgets.convertedAt,
			conversionAppointmentId: budgets.conversionAppointmentId,
			notes: budgets.notes,
			followUpSequence: budgets.followUpSequence,
			nextFollowUpAt: budgets.nextFollowUpAt,
			createdBy: budgets.createdBy,
			createdAt: budgets.createdAt,
			updatedAt: budgets.updatedAt,
			patient: { id: patients.id, name: patients.name, phone: patients.phone },
		})
		.from(budgets)
		.leftJoin(patients, eq(patients.id, budgets.patientId))
		.where(eq(budgets.id, budgetId))
		.limit(1)) as unknown as [
		| (BudgetRow & {
				patient: { id: string; name: string; phone: string } | null;
		  })
		| null,
	];

	if (!row) return null;

	const items = (await db
		.select()
		.from(budgetItems)
		.where(eq(budgetItems.budgetId, budgetId))) as unknown as BudgetItemRow[];

	return { ...row, items };
}

/**
 * Find budgets by clinic with optional filters, with items and patient.
 */
export async function findByClinic(params: {
	clinicId: string;
	patientId?: string;
	status?: string;
	fromDate?: Date;
	toDate?: Date;
}): Promise<BudgetWithDetails[]> {
	const db = getDb();

	const conditions = [eq(budgets.clinicId, params.clinicId)];
	if (params.patientId)
		conditions.push(eq(budgets.patientId, params.patientId));
	if (params.status) conditions.push(eq(budgets.status, params.status));
	if (params.fromDate) conditions.push(gte(budgets.createdAt, params.fromDate));
	if (params.toDate) conditions.push(lte(budgets.createdAt, params.toDate));

	const rows = (await db
		.select({
			id: budgets.id,
			clinicId: budgets.clinicId,
			patientId: budgets.patientId,
			treatmentPlanId: budgets.treatmentPlanId,
			appointmentId: budgets.appointmentId,
			title: budgets.title,
			description: budgets.description,
			totalValue: budgets.totalValue,
			discountPercent: budgets.discountPercent,
			discountValue: budgets.discountValue,
			finalValue: budgets.finalValue,
			status: budgets.status,
			validUntil: budgets.validUntil,
			sentAt: budgets.sentAt,
			respondedAt: budgets.respondedAt,
			convertedAt: budgets.convertedAt,
			conversionAppointmentId: budgets.conversionAppointmentId,
			notes: budgets.notes,
			followUpSequence: budgets.followUpSequence,
			nextFollowUpAt: budgets.nextFollowUpAt,
			createdBy: budgets.createdBy,
			createdAt: budgets.createdAt,
			updatedAt: budgets.updatedAt,
			patient: { id: patients.id, name: patients.name, phone: patients.phone },
		})
		.from(budgets)
		.leftJoin(patients, eq(patients.id, budgets.patientId))
		.where(and(...conditions))
		.orderBy(desc(budgets.createdAt))) as unknown as [
		BudgetRow & { patient: { id: string; name: string; phone: string } | null },
	];

	const result: BudgetWithDetails[] = [];
	for (const row of rows) {
		const items = (await db
			.select()
			.from(budgetItems)
			.where(eq(budgetItems.budgetId, row.id))) as unknown as BudgetItemRow[];
		result.push({ ...row, items });
	}

	return result;
}

/**
 * Update budget status and optional metadata fields.
 */
export async function updateStatus(
	budgetId: string,
	data: {
		status: string;
		sentAt?: Date | null;
		respondedAt?: Date | null;
		convertedAt?: Date | null;
		conversionAppointmentId?: string | null;
	},
): Promise<BudgetRow | null> {
	const db = getDb();
	const [row] = await db
		.update(budgets)
		.set({ ...data, updatedAt: new Date() } as any)
		.where(eq(budgets.id, budgetId))
		.returning();
	return row ?? null;
}

/**
 * Get budget statistics for a clinic.
 */
export async function getStatsByClinic(
	clinicId: string,
): Promise<Array<{ status: string; finalValue: string | null }>> {
	const db = getDb();
	return (await db
		.select({ status: budgets.status, finalValue: budgets.finalValue })
		.from(budgets)
		.where(eq(budgets.clinicId, clinicId))) as Array<{
		status: string;
		finalValue: string | null;
	}>;
}

/**
 * Find budgets by treatment plan ID with items and patient.
 */
export async function findByTreatmentPlan(
	treatmentPlanId: string,
): Promise<BudgetWithDetails[]> {
	const db = getDb();

	const rows = (await db
		.select({
			id: budgets.id,
			clinicId: budgets.clinicId,
			patientId: budgets.patientId,
			treatmentPlanId: budgets.treatmentPlanId,
			appointmentId: budgets.appointmentId,
			title: budgets.title,
			description: budgets.description,
			totalValue: budgets.totalValue,
			discountPercent: budgets.discountPercent,
			discountValue: budgets.discountValue,
			finalValue: budgets.finalValue,
			status: budgets.status,
			validUntil: budgets.validUntil,
			sentAt: budgets.sentAt,
			respondedAt: budgets.respondedAt,
			convertedAt: budgets.convertedAt,
			conversionAppointmentId: budgets.conversionAppointmentId,
			notes: budgets.notes,
			followUpSequence: budgets.followUpSequence,
			nextFollowUpAt: budgets.nextFollowUpAt,
			createdBy: budgets.createdBy,
			createdAt: budgets.createdAt,
			updatedAt: budgets.updatedAt,
			patient: { id: patients.id, name: patients.name, phone: patients.phone },
		})
		.from(budgets)
		.leftJoin(patients, eq(patients.id, budgets.patientId))
		.where(eq(budgets.treatmentPlanId, treatmentPlanId))) as unknown as [
		BudgetRow & { patient: { id: string; name: string; phone: string } | null },
	];

	const result: BudgetWithDetails[] = [];
	for (const row of rows) {
		const items = (await db
			.select()
			.from(budgetItems)
			.where(eq(budgetItems.budgetId, row.id))) as unknown as BudgetItemRow[];
		result.push({ ...row, items });
	}

	return result;
}

/**
 * Find budget by ID with items and installments.
 */
export async function findByIdWithInstallments(
	budgetId: string,
): Promise<
	(BudgetWithDetails & { installments: BudgetInstallmentRow[] }) | null
> {
	const db = getDb();

	const [row] = (await db
		.select({
			id: budgets.id,
			clinicId: budgets.clinicId,
			patientId: budgets.patientId,
			treatmentPlanId: budgets.treatmentPlanId,
			appointmentId: budgets.appointmentId,
			title: budgets.title,
			description: budgets.description,
			totalValue: budgets.totalValue,
			discountPercent: budgets.discountPercent,
			discountValue: budgets.discountValue,
			finalValue: budgets.finalValue,
			status: budgets.status,
			validUntil: budgets.validUntil,
			sentAt: budgets.sentAt,
			respondedAt: budgets.respondedAt,
			convertedAt: budgets.convertedAt,
			conversionAppointmentId: budgets.conversionAppointmentId,
			notes: budgets.notes,
			followUpSequence: budgets.followUpSequence,
			nextFollowUpAt: budgets.nextFollowUpAt,
			createdBy: budgets.createdBy,
			createdAt: budgets.createdAt,
			updatedAt: budgets.updatedAt,
			patient: { id: patients.id, name: patients.name, phone: patients.phone },
		})
		.from(budgets)
		.leftJoin(patients, eq(patients.id, budgets.patientId))
		.where(eq(budgets.id, budgetId))
		.limit(1)) as unknown as [
		| (BudgetRow & {
				patient: { id: string; name: string; phone: string } | null;
		  })
		| null,
	];

	if (!row) return null;

	const items = (await db
		.select()
		.from(budgetItems)
		.where(eq(budgetItems.budgetId, budgetId))) as unknown as BudgetItemRow[];

	const installments = (await db
		.select()
		.from(budgetInstallments)
		.where(eq(budgetInstallments.budgetId, budgetId))) as unknown as [
		BudgetInstallmentRow,
	];

	return { ...row, items, installments };
}
