/** Pipeline Stages Service — Drizzle */
import { eq, and, inArray, asc, desc, sql } from 'drizzle-orm'
import { getDb } from '@/lib/db/client'
import { pipelineStages, leads } from '@/lib/db/schema'
import { dbLogger } from '@/lib/logger'
import { insertDefaultStages } from '@/repositories/pipeline'

export interface PipelineStage { id:string;clinic_id:string;name:string;color:string;sort_order:number;is_default:boolean;is_system:boolean;system_key:string|null;created_at:string;updated_at:string }
function toSnake(r:any):PipelineStage{return{id:r.id,clinic_id:r.clinicId,name:r.name,color:r.color,sort_order:r.position??r.sortOrder??0,is_default:r.isDefault??false,is_system:r.isSystem??false,system_key:r.systemKey??null,created_at:r.createdAt?.toISOString?.()??'',updated_at:r.updatedAt?.toISOString?.()??''}}

export async function getDefaultStageId(clinicId:string):Promise<string|null>{const db=getDb();const [r]=await db.select({id:pipelineStages.id}).from(pipelineStages).where(and(eq(pipelineStages.clinicId,clinicId),eq(pipelineStages.isDefault,true)));return r?.id??null}
export async function getPipelineStages(clinicId:string):Promise<PipelineStage[]>{const db=getDb();const rows=await db.select().from(pipelineStages).where(and(eq(pipelineStages.clinicId,clinicId),eq(pipelineStages.isDefault,false))).orderBy(asc(pipelineStages.position));return rows.map(toSnake)}
export async function createPipelineStage(p:{clinicId:string;name:string;color:string;sortOrder?:number}):Promise<PipelineStage>{const db=getDb();const[e]=await db.select({id:pipelineStages.id}).from(pipelineStages).where(and(eq(pipelineStages.clinicId,p.clinicId),eq(pipelineStages.name,p.name)));if(e)throw new Error(`Stage with name "${p.name}" already exists`)
  let so=p.sortOrder;if(so===undefined){const[l]=await db.select({position:pipelineStages.position}).from(pipelineStages).where(eq(pipelineStages.clinicId,p.clinicId)).orderBy(desc(pipelineStages.position)).limit(1);so=(l?.position??-1)+1}
  const[r]=await db.insert(pipelineStages).values({clinicId:p.clinicId,name:p.name,color:p.color,position:so,isDefault:false,isSystem:false}as any).returning();return toSnake(r)}
export async function updatePipelineStage(stageId:string,p:{name?:string;color?:string;sort_order?:number}):Promise<PipelineStage>{const db=getDb();const[s]=await db.select({isDefault:pipelineStages.isDefault}).from(pipelineStages).where(eq(pipelineStages.id,stageId));if(!s)throw new Error('Stage not found');if(s.isDefault)throw new Error('Cannot update default stage')
  const d:Record<string,unknown>={updatedAt:new Date()};if(p.name)d.name=p.name;if(p.color)d.color=p.color;if(p.sort_order!==undefined)d.position=p.sort_order
  const[r]=await db.update(pipelineStages).set(d as any).where(eq(pipelineStages.id,stageId)).returning();return toSnake(r)}
export async function deletePipelineStage(stageId:string):Promise<void>{const db=getDb();const[s]=await db.select({id:pipelineStages.id,clinicId:pipelineStages.clinicId,isDefault:pipelineStages.isDefault,name:pipelineStages.name}).from(pipelineStages).where(eq(pipelineStages.id,stageId));if(!s)throw new Error('Stage not found');if(s.isDefault)throw new Error('Cannot delete default stage')
  const[lc]=await db.select({count:sql`count(*)::int`}).from(leads).where(eq(leads.stageId,stageId))as any;const cnt=Number((lc as any)?.count??0)
  if(cnt>0){const defId=await getDefaultStageId(s.clinicId);if(!defId)throw new Error('Cannot delete stage with leads and no default stage configured');await db.update(leads).set({stageId:defId}as any).where(eq(leads.stageId,stageId))}
  await db.delete(pipelineStages).where(eq(pipelineStages.id,stageId))}
export async function reorderPipelineStages(orders:{id:string;sort_order:number}[],clinicId:string):Promise<void>{if(!orders.length)throw new Error('stages array required')
  const db=getDb();const ids=orders.map(o=>o.id);const rows=await db.select({id:pipelineStages.id}).from(pipelineStages).where(and(inArray(pipelineStages.id,ids),eq(pipelineStages.clinicId,clinicId)))
  const valid=new Set(rows.map(r=>r.id));const invalid=ids.filter(i=>!valid.has(i));if(invalid.length)throw new Error(`Stage IDs do not belong to clinic: ${invalid.join(', ')}`)
  await Promise.all(orders.map(o=>db.update(pipelineStages).set({position:o.sort_order,updatedAt:new Date()}as any).where(eq(pipelineStages.id,o.id))))}
export async function seedDefaultPipelineStages(clinicId:string):Promise<void>{const defaults=[{name:'Novo',color:'#3B82F6',sortOrder:0,isSystem:false,systemKey:null,isDefault:true},{name:'Contatado',color:'#8B5CF6',sortOrder:1,isSystem:false,systemKey:null,isDefault:false},{name:'Qualificado',color:'#10B981',sortOrder:2,isSystem:false,systemKey:null,isDefault:false},{name:'Proposta',color:'#F59E0B',sortOrder:3,isSystem:false,systemKey:null,isDefault:false},{name:'Negociação',color:'#EF4444',sortOrder:4,isSystem:false,systemKey:null,isDefault:false},{name:'Convertido',color:'#22C55E',sortOrder:5,isSystem:true,systemKey:'converted',isDefault:false},{name:'Perdido',color:'#6B7280',sortOrder:6,isSystem:true,systemKey:'lost',isDefault:false}];await insertDefaultStages(clinicId,defaults)}
