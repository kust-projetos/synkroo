/**
 * Pipeline Stages Service
 * CRUD operations for pipeline stages per clinic
 * All operations enforce RLS via createTypedClient()
 */

import { createTypedClient } from "@/lib/supabase/typed";
import { dbLogger } from "@/lib/logger";
import { insertDefaultStages } from "@/repositories/pipeline";

export interface PipelineStage {
	id: string;
	clinic_id: string;
	name: string;
	color: string;
	sort_order: number;
	is_default: boolean;
	is_system: boolean;
	system_key: string | null;
	created_at: string;
	updated_at: string;
}

/**
 * Get the default stage ID for a clinic
 */
export async function getDefaultStageId(
	clinicId: string,
): Promise<string | null> {
	const supabase = await createTypedClient();
	const { data, error } = await supabase
		.from("pipeline_stages")
		.select("id")
		.eq("clinic_id", clinicId)
		.eq("is_default", true)
		.single();

	if (error || !data) {
		return null;
	}
	return data.id;
}

/**
 * Get all pipeline stages for a clinic ordered by sort_order
 * Excludes is_default stages from user-visible list
 */
export async function getPipelineStages(
	clinicId: string,
): Promise<PipelineStage[]> {
	const supabase = await createTypedClient();
	const { data, error } = await supabase
		.from("pipeline_stages")
		.select("*")
		.eq("clinic_id", clinicId)
		.eq("is_default", false)
		.order("sort_order", { ascending: true });

	if (error) {
		dbLogger.error("Error fetching pipeline stages", error);
		throw error;
	}
	return (data || []) as PipelineStage[];
}

/**
 * Create a new pipeline stage
 * Auto-assigns sort_order if not provided, rejects if name conflicts
 */
export async function createPipelineStage(params: {
	clinicId: string;
	name: string;
	color: string;
	sortOrder?: number;
}): Promise<PipelineStage> {
	const supabase = await createTypedClient();

	// Check for name conflict
	const { data: existing } = await supabase
		.from("pipeline_stages")
		.select("id")
		.eq("clinic_id", params.clinicId)
		.eq("name", params.name)
		.single();

	if (existing) {
		throw new Error(`Stage with name "${params.name}" already exists`);
	}

	let sortOrder = params.sortOrder;
	if (sortOrder === undefined) {
		const { data: lastStage } = await supabase
			.from("pipeline_stages")
			.select("sort_order")
			.eq("clinic_id", params.clinicId)
			.order("sort_order", { ascending: false })
			.limit(1);

		sortOrder = (lastStage?.[0]?.sort_order ?? -1) + 1;
	}

	const { data, error } = await supabase
		.from("pipeline_stages")
		.insert({
			clinic_id: params.clinicId,
			name: params.name,
			color: params.color,
			sort_order: sortOrder,
			is_default: false,
			is_system: false,
		})
		.select()
		.single();

	if (error) {
		dbLogger.error("Error creating pipeline stage", error);
		throw error;
	}

	dbLogger.info("Pipeline stage created", {
		stageId: data.id,
		name: params.name,
	});
	return data as PipelineStage;
}

/**
 * Update a pipeline stage
 * Rejects update if stage is_default = true
 */
export async function updatePipelineStage(
	stageId: string,
	params: { name?: string; color?: string; sort_order?: number },
): Promise<PipelineStage> {
	const supabase = await createTypedClient();

	// Check if stage is default (cannot update)
	const { data: stage } = await supabase
		.from("pipeline_stages")
		.select("is_default, clinic_id")
		.eq("id", stageId)
		.single();

	if (!stage) {
		throw new Error("Stage not found");
	}

	if (stage.is_default) {
		throw new Error("Cannot update default stage");
	}

	const { data, error } = await supabase
		.from("pipeline_stages")
		.update({ ...params, updated_at: new Date().toISOString() })
		.eq("id", stageId)
		.select()
		.single();

	if (error) {
		dbLogger.error("Error updating pipeline stage", error);
		throw error;
	}
	return data as PipelineStage;
}

/**
 * Delete a pipeline stage
 * If leads exist in stage, moves them to default stage first, then deletes
 * Throws error if leads exist and no default stage is configured
 */
export async function deletePipelineStage(stageId: string): Promise<void> {
	const supabase = await createTypedClient();

	// Get stage info
	const { data: stage, error: fetchError } = await supabase
		.from("pipeline_stages")
		.select("id, clinic_id, is_default, name")
		.eq("id", stageId)
		.single();

	if (fetchError || !stage) {
		throw new Error("Stage not found");
	}

	if (stage.is_default) {
		throw new Error("Cannot delete default stage");
	}

	// Check if leads exist in this stage
	const { count } = await supabase
		.from("leads")
		.select("*", { count: "exact", head: true })
		.eq("stage_id", stageId);

	if (count && count > 0) {
		// Get default stage for this clinic
		const defaultStageId = await getDefaultStageId(stage.clinic_id);

		if (!defaultStageId) {
			throw new Error(
				"Cannot delete stage with leads and no default stage configured",
			);
		}

		// Move leads to default stage before deleting
		const { error: updateError } = await supabase
			.from("leads")
			.update({ stage_id: defaultStageId })
			.eq("stage_id", stageId);

		if (updateError) {
			dbLogger.error("Error moving leads to default stage", updateError);
			throw new Error("Failed to reassign leads before deleting stage");
		}

		dbLogger.info("Moved leads to default stage before deletion", {
			stageId,
			defaultStageId,
			leadsCount: count,
		});
	}

	// Delete the stage
	const { error: deleteError } = await supabase
		.from("pipeline_stages")
		.delete()
		.eq("id", stageId);

	if (deleteError) {
		dbLogger.error("Error deleting pipeline stage", deleteError);
		throw deleteError;
	}

	dbLogger.info("Pipeline stage deleted", { stageId, name: stage.name });
}

/**
 * Reorder stages: update sort_order for multiple stages
 * Validates ALL stage IDs belong to the user's clinic before applying
 * Throws error if any stage_id does not belong to clinic
 */
export async function reorderPipelineStages(
	stageOrders: { id: string; sort_order: number }[],
	clinicId: string,
): Promise<void> {
	if (!Array.isArray(stageOrders) || stageOrders.length === 0) {
		throw new Error("stages array required");
	}

	const supabase = await createTypedClient();

	// Extract stage IDs
	const stageIds = stageOrders.map((s) => s.id);

	// Validate all stages belong to this clinic
	const { data: validStages, error: fetchError } = await supabase
		.from("pipeline_stages")
		.select("id")
		.in("id", stageIds)
		.eq("clinic_id", clinicId);

	if (fetchError) {
		dbLogger.error("Error validating stages", fetchError);
		throw new Error("Failed to validate stage ownership");
	}

	const validIds = new Set(
		(validStages || []).map((s: { id: string }) => s.id),
	);
	const invalidIds = stageIds.filter((id) => !validIds.has(id));

	if (invalidIds.length > 0) {
		throw new Error(
			`Stage IDs do not belong to clinic: ${invalidIds.join(", ")}`,
		);
	}

	// Apply reorder
	const updates = stageOrders.map(({ id, sort_order }) =>
		supabase
			.from("pipeline_stages")
			.update({ sort_order, updated_at: new Date().toISOString() })
			.eq("id", id),
	);

	const results = await Promise.all(updates);
	const errors = results.filter((r) => r.error);

	if (errors.length > 0) {
		dbLogger.error("Error reordering stages", errors);
		throw new Error("Failed to reorder stages");
	}

	dbLogger.info("Stages reordered", { count: stageOrders.length });
}

/**
 * Seed default odontologia pipeline for a new clinic
 * Creates 7 default stages with first one marked is_default=true
 */
export async function seedDefaultPipelineStages(
	clinicId: string,
): Promise<void> {
	const defaults = [
		{
			name: "Novo",
			color: "#3B82F6",
			sort_order: 0,
			is_system: false,
			system_key: null,
			is_default: true,
		},
		{
			name: "Contatado",
			color: "#8B5CF6",
			sort_order: 1,
			is_system: false,
			system_key: null,
			is_default: false,
		},
		{
			name: "Qualificado",
			color: "#10B981",
			sort_order: 2,
			is_system: false,
			system_key: null,
			is_default: false,
		},
		{
			name: "Proposta",
			color: "#F59E0B",
			sort_order: 3,
			is_system: false,
			system_key: null,
			is_default: false,
		},
		{
			name: "Negociação",
			color: "#EF4444",
			sort_order: 4,
			is_system: false,
			system_key: null,
			is_default: false,
		},
		{
			name: "Convertido",
			color: "#22C55E",
			sort_order: 5,
			is_system: true,
			system_key: "converted",
			is_default: false,
		},
		{
			name: "Perdido",
			color: "#6B7280",
			sort_order: 6,
			is_system: true,
			system_key: "lost",
			is_default: false,
		},
	];

	await insertDefaultStages(
		clinicId,
		defaults.map((s) => ({
			name: s.name,
			color: s.color,
			sortOrder: s.sort_order,
			isSystem: s.is_system,
			systemKey: s.system_key,
			isDefault: s.is_default,
		})),
	);

	dbLogger.info("Default odontologia pipeline stages seeded", { clinicId });
}
