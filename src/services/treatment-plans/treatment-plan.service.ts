/**
 * Treatment Plan Service
 * Handles dental treatment plans with progress tracking
 */

import { dbLogger } from "@/lib/logger";
import {
	createWithItems,
	findByPatient as findPlansByPatient,
	findById as findPlanById,
	update as updatePlan,
	updateItem as updatePlanItem,
	getProgress,
	deleteTreatmentPlan as deleteTreatmentPlanDb,
} from "@/repositories/treatment-plans";

export type TreatmentPlanStatus =
	| "active"
	| "completed"
	| "cancelled"
	| "paused";
export type TreatmentPlanItemStatus =
	| "pending"
	| "in_progress"
	| "completed"
	| "cancelled";

export interface TreatmentPlanItem {
	id?: string;
	treatment_plan_id?: string;
	procedure_id?: string | null;
	procedure_name: string;
	session_number: number;
	appointment_id?: string | null;
	status: TreatmentPlanItemStatus;
	scheduled_at?: string | null;
	completed_at?: string | null;
	notes?: string | null;
	created_at?: string;
}

export interface TreatmentPlan {
	id?: string;
	clinic_id: string;
	patient_id: string;
	title: string;
	description?: string | null;
	total_sessions: number;
	completed_sessions: number;
	status: TreatmentPlanStatus;
	started_at?: string | null;
	expected_completion_at?: string | null;
	completed_at?: string | null;
	last_session_at?: string | null;
	next_session_due_at?: string | null;
	notes?: string | null;
	created_by?: string | null;
	created_at?: string;
	updated_at?: string;
	items?: TreatmentPlanItem[];
	patient?: {
		id: string;
		name: string;
		phone: string;
	};
}

export interface CreateTreatmentPlanInput {
	clinic_id: string;
	patient_id: string;
	title: string;
	description?: string;
	total_sessions: number;
	started_at?: string;
	expected_completion_at?: string;
	notes?: string;
	created_by?: string;
	items: Omit<TreatmentPlanItem, "id" | "treatment_plan_id" | "created_at">[];
}

export interface UpdateTreatmentPlanInput {
	title?: string;
	description?: string;
	status?: TreatmentPlanStatus;
	total_sessions?: number;
	expected_completion_at?: string;
	notes?: string;
}

export interface TreatmentPlanProgress {
	totalSessions: number;
	completedSessions: number;
	percent: number;
}

// ──────────────────────────────────────────────
// Internal: snake_case adapter for repo response
// ──────────────────────────────────────────────
function toSnake<T extends object>(row: Record<string, unknown>): T {
	const result: Record<string, unknown> = {};
	for (const [k, v] of Object.entries(row)) {
		const snake = k.replace(/[A-Z]/g, (m) => `_${m.toLowerCase()}`);
		result[snake] = v instanceof Date ? v.toISOString() : v;
	}
	return result as T;
}

function itemToSnake(row: Record<string, unknown>): TreatmentPlanItem {
	const result: Record<string, unknown> = {};
	for (const [k, v] of Object.entries(row)) {
		const snake = k.replace(/[A-Z]/g, (m) => `_${m.toLowerCase()}`);
		result[snake] = v instanceof Date ? v.toISOString() : v;
	}
	return result as unknown as TreatmentPlanItem;
}

/**
 * Create a new treatment plan with items
 */
export async function createTreatmentPlan(
	input: CreateTreatmentPlanInput,
): Promise<TreatmentPlan> {
	try {
		const { plan, items } = await createWithItems({
			clinicId: input.clinic_id,
			patientId: input.patient_id,
			title: input.title,
			description: input.description,
			totalSessions: input.total_sessions,
			startedAt: input.started_at ? new Date(input.started_at) : undefined,
			expectedCompletionAt: input.expected_completion_at
				? new Date(input.expected_completion_at)
				: undefined,
			notes: input.notes,
			createdBy: input.created_by,
			items: input.items.map((item) => ({
				procedureId: item.procedure_id,
				procedureName: item.procedure_name,
				sessionNumber: item.session_number,
				appointmentId: item.appointment_id,
				status: item.status,
				scheduledAt: item.scheduled_at
					? new Date(item.scheduled_at)
					: undefined,
				notes: item.notes,
			})),
		});

		const planSnake = toSnake<TreatmentPlan>(
			plan as unknown as Record<string, unknown>,
		);
		const itemsSnake = items.map((i) =>
			itemToSnake(i as unknown as Record<string, unknown>),
		);

		return { ...planSnake, items: itemsSnake };
	} catch (error) {
		dbLogger.error("Error creating treatment plan", error);
		throw new Error("Failed to create treatment plan");
	}
}

/**
 * Get treatment plans by patient with progress
 */
export async function getTreatmentPlansByPatient(
	patientId: string,
	clinicId: string,
): Promise<TreatmentPlan[]> {
	try {
		const plans = await findPlansByPatient(patientId, clinicId);
		return plans.map((p) => {
			const planSnake = toSnake<TreatmentPlan>(
				p as unknown as Record<string, unknown>,
			);
			const itemsSnake = p.items.map((i) =>
				itemToSnake(i as unknown as Record<string, unknown>),
			);
			return { ...planSnake, items: itemsSnake };
		});
	} catch (error) {
		dbLogger.error("Error fetching treatment plans", error);
		return [];
	}
}

/**
 * Get single treatment plan by ID with items
 */
export async function getTreatmentPlanById(
	treatmentPlanId: string,
): Promise<TreatmentPlan | null> {
	try {
		const plan = await findPlanById(treatmentPlanId);
		if (!plan) return null;
		const planSnake = toSnake<TreatmentPlan>(
			plan as unknown as Record<string, unknown>,
		);
		const itemsSnake = plan.items.map((i) =>
			itemToSnake(i as unknown as Record<string, unknown>),
		);
		return { ...planSnake, items: itemsSnake };
	} catch (error) {
		dbLogger.error("Error fetching treatment plan", error);
		return null;
	}
}

/**
 * Update treatment plan
 */
export async function updateTreatmentPlan(
	treatmentPlanId: string,
	input: UpdateTreatmentPlanInput,
): Promise<TreatmentPlan | null> {
	try {
		const updateData: Parameters<typeof updatePlan>[1] = {};
		if (input.title !== undefined) updateData.title = input.title;
		if (input.description !== undefined)
			updateData.description = input.description;
		if (input.status !== undefined) {
			updateData.status = input.status;
			if (input.status === "completed") {
				updateData.completedAt = new Date();
			}
		}
		if (input.total_sessions !== undefined)
			updateData.totalSessions = input.total_sessions;
		if (input.expected_completion_at !== undefined)
			updateData.expectedCompletionAt = new Date(input.expected_completion_at);
		if (input.notes !== undefined) updateData.notes = input.notes;

		const row = await updatePlan(treatmentPlanId, updateData);
		if (!row) return null;
		return toSnake<TreatmentPlan>(row as unknown as Record<string, unknown>);
	} catch (error) {
		dbLogger.error("Error updating treatment plan", error);
		return null;
	}
}

/**
 * Update session/progress for a treatment plan item
 */
export async function updateSessionProgress(
	treatmentPlanItemId: string,
): Promise<TreatmentPlanItem | null> {
	const now = new Date();

	// Update the item
	const item = await updatePlanItem(treatmentPlanItemId, {
		status: "completed",
		completedAt: now,
	});
	if (!item) {
		dbLogger.error("Error updating treatment plan item", null);
		return null;
	}

	// Get current progress
	const plan = await getProgress(item.treatmentPlanId);
	if (!plan) {
		return itemToSnake(item as unknown as Record<string, unknown>);
	}

	// Update completed sessions count
	const newCompleted = plan.completedSessions + 1;
	await updatePlan(item.treatmentPlanId, {
		completedSessions: newCompleted,
		lastSessionAt: now,
	});

	// Check if all sessions are complete
	if (newCompleted >= plan.totalSessions) {
		await updatePlan(item.treatmentPlanId, {
			status: "completed",
			completedAt: now,
		});
	}

	return itemToSnake(item as unknown as Record<string, unknown>);
}

/**
 * Get treatment plan progress aggregate
 */
export async function getTreatmentPlanProgress(
	treatmentPlanId: string,
): Promise<TreatmentPlanProgress> {
	const row = await getProgress(treatmentPlanId);
	if (!row) {
		return { totalSessions: 0, completedSessions: 0, percent: 0 };
	}
	const { totalSessions, completedSessions } = row;
	const percent =
		totalSessions > 0
			? Math.round((completedSessions / totalSessions) * 100)
			: 0;
	return { totalSessions, completedSessions, percent };
}

/**
 * Delete treatment plan (cascades to items)
 */
export async function deleteTreatmentPlan(
	treatmentPlanId: string,
): Promise<boolean> {
	try {
		await deleteTreatmentPlanDb(treatmentPlanId);
		return true;
	} catch (error) {
		dbLogger.error("Error deleting treatment plan", error);
		return false;
	}
}
