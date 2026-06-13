/**
 * Budget Service
 * Handles dental treatment quotes/budgets management
 */

import { dbLogger } from "@/lib/logger";
import {
	createWithItems,
	findNeedingFollowUp,
	updateFollowUp,
	hardDeleteBudget,
	softDeleteBudget,
	findById,
	findByClinic,
	updateStatus,
	getStatsByClinic,
	findByTreatmentPlan,
	findByIdWithInstallments,
} from "@/repositories/budgets";

export type BudgetStatus =
	| "pending"
	| "sent"
	| "accepted"
	| "rejected"
	| "expired"
	| "converted";

export interface BudgetItem {
	id?: string;
	budget_id?: string;
	procedure_id?: string | null;
	procedure_name: string;
	quantity: number;
	unit_price: number;
	discount_percent: number;
	total_price: number;
	notes?: string | null;
}

export interface Budget {
	id?: string;
	clinic_id: string;
	patient_id: string;
	treatment_plan_id?: string | null;
	appointment_id?: string | null;
	title?: string | null;
	description?: string | null;
	total_value: number;
	discount_percent: number;
	discount_value: number;
	final_value: number;
	status: BudgetStatus;
	valid_until?: string | null;
	sent_at?: string | null;
	responded_at?: string | null;
	converted_at?: string | null;
	conversion_appointment_id?: string | null;
	notes?: string | null;
	follow_up_sequence: number;
	next_follow_up_at?: string | null;
	created_by?: string | null;
	created_at?: string;
	updated_at?: string;
	items?: BudgetItem[];
	installments?: BudgetInstallment[];
	patient?: {
		id: string;
		name: string;
		phone: string;
	};
}

export interface BudgetInstallment {
	id?: string;
	budget_id: string;
	amount: number;
	due_date: string;
	status: string;
	paid_at?: string | null;
	payment_id?: string | null;
	created_at?: string;
	updated_at?: string;
}

export interface CreateBudgetInput {
	clinic_id: string;
	patient_id: string;
	treatment_plan_id?: string;
	appointment_id?: string;
	title?: string;
	description?: string;
	items: Omit<BudgetItem, "id" | "budget_id">[];
	discount_percent?: number;
	discount_value?: number;
	valid_until?: string;
	notes?: string;
	created_by?: string;
}

export interface BudgetListFilters {
	clinic_id: string;
	patient_id?: string;
	status?: BudgetStatus;
	from_date?: string;
	to_date?: string;
}

// ──────────────────────────────────────────────
// Internal: camelCase → snake_case adapter
// ──────────────────────────────────────────────
function toSnakeBudget(row: Record<string, unknown>): Budget {
	const result: Record<string, unknown> = {};
	for (const [k, v] of Object.entries(row)) {
		const snake = k.replace(/[A-Z]/g, (m) => `_${m.toLowerCase()}`);
		if (
			k.match(/At$|Value$|_at$|_value$/i) &&
			(v instanceof Date || (typeof v === "string" && v))
		) {
			result[snake] = v instanceof Date ? v.toISOString() : v;
		} else if (typeof v === "number") {
			result[snake] = v;
		} else {
			result[snake] = v;
		}
	}
	// Parse numeric strings back to numbers
	const numFields = [
		"total_value",
		"discount_percent",
		"discount_value",
		"final_value",
		"quantity",
		"unit_price",
		"total_price",
		"amount",
		"follow_up_sequence",
	];
	for (const f of numFields) {
		if (result[f] !== undefined && result[f] !== null) {
			const n = Number(result[f]);
			result[f] = isNaN(n) ? 0 : n;
		}
	}
	return result as unknown as Budget;
}

function toSnakeItem(row: Record<string, unknown>): BudgetItem {
	const result: Record<string, unknown> = {};
	for (const [k, v] of Object.entries(row)) {
		const snake = k.replace(/[A-Z]/g, (m) => `_${m.toLowerCase()}`);
		result[snake] = v instanceof Date ? v.toISOString() : v;
	}
	const numFields = [
		"quantity",
		"unit_price",
		"discount_percent",
		"total_price",
	];
	for (const f of numFields) {
		if (result[f] !== undefined && result[f] !== null) {
			const n = Number(result[f]);
			result[f] = isNaN(n) ? 0 : n;
		}
	}
	return result as unknown as BudgetItem;
}

/**
 * Calculate budget totals from items
 */
export function calculateBudgetTotals(
	items: Pick<BudgetItem, "quantity" | "unit_price" | "discount_percent">[],
	discountPercent: number = 0,
): { total_value: number; discount_value: number; final_value: number } {
	const total_value = items.reduce((sum, item) => {
		const itemTotal = item.quantity * item.unit_price;
		const itemDiscount = itemTotal * (item.discount_percent / 100);
		return sum + (itemTotal - itemDiscount);
	}, 0);

	const discount_value = total_value * (discountPercent / 100);
	const final_value = total_value - discount_value;

	return {
		total_value: Math.round(total_value * 100) / 100,
		discount_value: Math.round(discount_value * 100) / 100,
		final_value: Math.round(final_value * 100) / 100,
	};
}

/**
 * Create a new budget with items
 */
export async function createBudget(input: CreateBudgetInput): Promise<Budget> {
	const { discount_percent = 0 } = input;
	const totals = calculateBudgetTotals(input.items, discount_percent);

	try {
		const { budget, items } = await createWithItems({
			clinicId: input.clinic_id,
			patientId: input.patient_id,
			treatmentPlanId: input.treatment_plan_id ?? null,
			appointmentId: input.appointment_id ?? null,
			title: input.title ?? null,
			description: input.description ?? null,
			totalValue: String(totals.total_value),
			discountPercent: String(input.discount_percent || 0),
			discountValue: String(totals.discount_value),
			finalValue: String(totals.final_value),
			validUntil: input.valid_until ? new Date(input.valid_until) : undefined,
			notes: input.notes ?? null,
			createdBy: input.created_by ?? null,
			items: input.items.map((item) => ({
				procedureId: item.procedure_id ?? null,
				procedureName: item.procedure_name,
				quantity: item.quantity,
				unitPrice: String(item.unit_price),
				discountPercent: String(item.discount_percent || 0),
				totalPrice: String(item.total_price),
				notes: item.notes ?? null,
			})),
		});

		const budgetSnake = toSnakeBudget(
			budget as unknown as Record<string, unknown>,
		);
		const itemsSnake = items.map((i) =>
			toSnakeItem(i as unknown as Record<string, unknown>),
		);

		return { ...budgetSnake, items: itemsSnake };
	} catch (error) {
		dbLogger.error("Error creating budget", error);
		throw new Error("Failed to create budget");
	}
}

/**
 * Get budget by ID with items
 */
export async function getBudgetById(budgetId: string): Promise<Budget | null> {
	try {
		const budget = await findById(budgetId);
		if (!budget) return null;
		const sn = toSnakeBudget(budget as unknown as Record<string, unknown>);
		const itemsSn = (budget.items || []).map((i) =>
			toSnakeItem(i as unknown as Record<string, unknown>),
		);
		return { ...sn, items: itemsSn };
	} catch (error) {
		dbLogger.error("Error fetching budget", error);
		return null;
	}
}

/**
 * List budgets with filters
 */
export async function listBudgets(
	filters: BudgetListFilters,
): Promise<Budget[]> {
	try {
		const budgets = await findByClinic({
			clinicId: filters.clinic_id,
			patientId: filters.patient_id,
			status: filters.status,
			fromDate: filters.from_date ? new Date(filters.from_date) : undefined,
			toDate: filters.to_date ? new Date(filters.to_date) : undefined,
		});
		return budgets.map((b) => {
			const sn = toSnakeBudget(b as unknown as Record<string, unknown>);
			const itemsSn = (b.items || []).map((i) =>
				toSnakeItem(i as unknown as Record<string, unknown>),
			);
			return { ...sn, items: itemsSn };
		});
	} catch (error) {
		dbLogger.error("Error listing budgets", error);
		return [];
	}
}

/**
 * Update budget status
 */
export async function updateBudgetStatus(
	budgetId: string,
	status: BudgetStatus,
	metadata?: {
		responded_at?: string;
		converted_at?: string;
		conversion_appointment_id?: string;
		sent_at?: string;
	},
): Promise<Budget | null> {
	try {
		const updateData: Parameters<typeof updateStatus>[1] = { status };
		if (metadata?.sent_at) updateData.sentAt = new Date(metadata.sent_at);
		if (metadata?.responded_at)
			updateData.respondedAt = new Date(metadata.responded_at);
		if (metadata?.converted_at)
			updateData.convertedAt = new Date(metadata.converted_at);
		if (metadata?.conversion_appointment_id)
			updateData.conversionAppointmentId = metadata.conversion_appointment_id;

		const row = await updateStatus(budgetId, updateData);
		if (!row) return null;
		return toSnakeBudget(row as unknown as Record<string, unknown>);
	} catch (error) {
		dbLogger.error("Error updating budget status", error);
		return null;
	}
}

/**
 * Mark budget as sent
 */
export async function markBudgetSent(budgetId: string): Promise<Budget | null> {
	return updateBudgetStatus(budgetId, "sent", {
		sent_at: new Date().toISOString(),
	});
}

/**
 * Accept a budget
 */
export async function acceptBudget(budgetId: string): Promise<Budget | null> {
	return updateBudgetStatus(budgetId, "accepted", {
		responded_at: new Date().toISOString(),
	});
}

/**
 * Reject a budget
 */
export async function rejectBudget(budgetId: string): Promise<Budget | null> {
	return updateBudgetStatus(budgetId, "rejected", {
		responded_at: new Date().toISOString(),
	});
}

/**
 * Convert budget to appointment
 */
export async function convertBudgetToAppointment(
	budgetId: string,
	appointmentId: string,
): Promise<Budget | null> {
	return updateBudgetStatus(budgetId, "converted", {
		responded_at: new Date().toISOString(),
		converted_at: new Date().toISOString(),
		conversion_appointment_id: appointmentId,
	});
}

/**
 * Get budgets needing follow-up
 */
export async function getBudgetsNeedingFollowUp(
	clinicId: string,
): Promise<Budget[]> {
	try {
		const plans = await findNeedingFollowUp(clinicId);
		return plans.map((p) => {
			const sn = toSnakeBudget(p as unknown as Record<string, unknown>);
			const itemsSn = (p.items || []).map((i) =>
				toSnakeItem(i as unknown as Record<string, unknown>),
			);
			return { ...sn, items: itemsSn };
		});
	} catch (error) {
		dbLogger.error("Error fetching budgets for follow-up", error);
		return [];
	}
}

/**
 * Schedule next follow-up
 */
export async function scheduleNextFollowUp(
	budgetId: string,
	daysFromNow: number = 3,
): Promise<Budget | null> {
	const nextFollowUp = new Date();
	nextFollowUp.setDate(nextFollowUp.getDate() + daysFromNow);

	try {
		const row = await updateFollowUp(budgetId, {
			followUpSequence: 1,
			nextFollowUpAt: nextFollowUp,
		});
		if (!row) return null;
		return toSnakeBudget(row as unknown as Record<string, unknown>);
	} catch (error) {
		dbLogger.error("Error scheduling follow-up", error);
		return null;
	}
}

/**
 * Delete budget (soft delete by marking as expired or hard delete)
 */
export async function deleteBudget(
	budgetId: string,
	hardDelete: boolean = false,
): Promise<boolean> {
	try {
		if (hardDelete) {
			await hardDeleteBudget(budgetId);
		} else {
			await softDeleteBudget(budgetId);
		}
		return true;
	} catch (error) {
		dbLogger.error("Error deleting budget", error);
		return false;
	}
}

/**
 * Get budget statistics for dashboard
 */
export async function getBudgetStats(clinicId: string): Promise<{
	total: number;
	pending: number;
	sent: number;
	accepted: number;
	rejected: number;
	converted: number;
	total_value: number;
	conversion_rate: number;
}> {
	try {
		const rows = await getStatsByClinic(clinicId);
		const stats = {
			total: rows.length,
			pending: rows.filter((r) => r.status === "pending").length,
			sent: rows.filter((r) => r.status === "sent").length,
			accepted: rows.filter((r) => r.status === "accepted").length,
			rejected: rows.filter((r) => r.status === "rejected").length,
			converted: rows.filter((r) => r.status === "converted").length,
			total_value: rows.reduce(
				(sum, r) => sum + (Number(r.finalValue) || 0),
				0,
			),
			conversion_rate: 0,
		};
		const totalResponded = stats.accepted + stats.rejected + stats.converted;
		stats.conversion_rate =
			totalResponded > 0 ? (stats.converted / totalResponded) * 100 : 0;
		return stats;
	} catch (error) {
		dbLogger.error("Error fetching budget stats", error);
		return {
			total: 0,
			pending: 0,
			sent: 0,
			accepted: 0,
			rejected: 0,
			converted: 0,
			total_value: 0,
			conversion_rate: 0,
		};
	}
}

/**
 * Get budgets by treatment plan ID
 */
export async function getBudgetsByTreatmentPlan(
	treatmentPlanId: string,
): Promise<Budget[]> {
	try {
		const budgets = await findByTreatmentPlan(treatmentPlanId);
		return budgets.map((b) => {
			const sn = toSnakeBudget(b as unknown as Record<string, unknown>);
			const itemsSn = (b.items || []).map((i) =>
				toSnakeItem(i as unknown as Record<string, unknown>),
			);
			return { ...sn, items: itemsSn };
		});
	} catch (error) {
		dbLogger.error("Error fetching budgets by treatment plan", error);
		return [];
	}
}

/**
 * Get budget with installments list
 */
export async function getBudgetWithInstallments(
	budgetId: string,
): Promise<Budget | null> {
	try {
		const budget = await findByIdWithInstallments(budgetId);
		if (!budget) return null;
		const sn = toSnakeBudget(budget as unknown as Record<string, unknown>);
		const itemsSn = (budget.items || []).map((i) =>
			toSnakeItem(i as unknown as Record<string, unknown>),
		);
		const installmentsSn = (budget.installments || []).map(
			(i) =>
				({
					id: i.id,
					budget_id: i.budgetId,
					amount: Number(i.amount) || 0,
					due_date: (i.dueDate as unknown as string) || "",
					status: i.status || "pending",
					paid_at: i.paidAt ? i.paidAt.toISOString() : null,
					payment_id: i.paymentId,
				}) as BudgetInstallment,
		);
		return { ...sn, items: itemsSn, installments: installmentsSn };
	} catch (error) {
		dbLogger.error("Error fetching budget with installments", error);
		return null;
	}
}
