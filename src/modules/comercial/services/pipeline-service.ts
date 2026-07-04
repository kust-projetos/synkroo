/**
 * Comercial module — pipeline service.
 *
 * Thin orchestration layer for pipeline stage operations.
 */

import * as pipelineRepo from '../repositories/pipeline-repository';
import * as leadsRepo from '../repositories/leads-repository';

export async function listarPipeline(clinicId: string) {
  return pipelineRepo.listPipeline(clinicId);
}

export async function moverLeadEtapa(input: {
  leadId: string;
  clinicId: string;
  stageId: string;
}) {
  // Validate stage exists
  const stage = await pipelineRepo.findStageById(input.clinicId, input.stageId);
  if (!stage) throw new Error('Stage not found');

  // Validate lead exists
  const lead = await leadsRepo.findLeadByIdForClinic(input.leadId, input.clinicId);
  if (!lead) throw new Error('Lead not found');

  return pipelineRepo.moveLeadStage(input);
}
