/**
 * Pipeline Repository
 * DB operations for pipeline_stages table via Drizzle.
 */

import { getDb } from "@/lib/db/client";
import { pipelineStages } from "@/lib/db/schema/crm";

export type StageDefaults = Array<{
	name: string;
	color: string;
	sortOrder: number;
	isSystem: boolean;
	systemKey: string | null;
	isDefault: boolean;
}>;

/**
 * Insert default pipeline stages for a new clinic.
 */
export async function insertDefaultStages(
	clinicId: string,
	stages: StageDefaults,
): Promise<void> {
	const db = getDb();
	await db.insert(pipelineStages).values(
		stages.map(
			(s) =>
				({
					clinicId,
					name: s.name,
					color: s.color,
					position: s.sortOrder,
					isDefault: s.isDefault,
					isSystem: s.isSystem,
					systemKey: s.systemKey,
				}) as any,
		),
	);
}
