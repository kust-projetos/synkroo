/** Pending Actions Service — Drizzle */
import { eq, and, inArray, gt, lt, desc } from 'drizzle-orm'
import { getDb } from '@/lib/db/client'
import { pendingActions } from '@/lib/db/schema'
import { dbLogger } from '@/lib/logger'

export interface PendingAction {
  id: string; clinic_id: string; conversation_id: string|null; patient_id: string|null
  appointment_id: string|null; action_type: string; risk_score: number; risk_level: string
  status: 'pending'|'executed'|'undone'|'expired'
  snapshot_before: Record<string,unknown>; snapshot_after: Record<string,unknown>
  undo_payload: Record<string,unknown>; confirmation_count: number; max_confirmations: number
  confirmed_at: string|null; undo_deadline: string; undone_at: string|null
  reasoning: string|null; agent_intent: string|null; confidence: number|null; created_at: string; updated_at: string
}
export interface CreatePendingActionParams {
  clinicId:string; conversationId?:string; patientId?:string; appointmentId?:string
  actionType:string; riskScore:number; riskLevel:'LOW'|'MEDIUM'|'HIGH'
  snapshotBefore?:Record<string,unknown>; snapshotAfter?:Record<string,unknown>
  undoPayload?:Record<string,unknown>; undoWindowMinutes?:number; maxConfirmations?:number
  reasoning?:string; agentIntent?:string; confidence?:number
}
const DEFAULT_UNDO_WINDOW_MINUTES=5

function toSnake(r:any):PendingAction{return{
  id:r.id,clinic_id:r.clinicId,conversation_id:r.conversationId??null,patient_id:r.patientId??null,appointment_id:r.appointmentId??null,
  action_type:r.actionType,risk_score:r.riskScore??0,risk_level:r.riskLevel??'LOW',status:r.status,
  snapshot_before:r.snapshotBefore??{},snapshot_after:r.snapshotAfter??{},undo_payload:r.undoPayload??{},
  confirmation_count:r.confirmationCount??0,max_confirmations:r.maxConfirmations??1,confirmed_at:r.confirmedAt?.toISOString?.()??null,
  undo_deadline:r.undoDeadline?.toISOString?.()??r.undoDeadline??'',undone_at:r.undoneAt?.toISOString?.()??null,
  reasoning:r.reasoning??null,agent_intent:r.agentIntent??null,confidence:r.confidence?Number(r.confidence):null,
  created_at:r.createdAt?.toISOString?.()??'',updated_at:r.updatedAt?.toISOString?.()??''
}}

export class PendingActionsService {
  async createAction(p:CreatePendingActionParams):Promise<PendingAction>{
    const db=getDb();const undoWindow=p.undoWindowMinutes??DEFAULT_UNDO_WINDOW_MINUTES;const undoDeadline=new Date(Date.now()+undoWindow*60000)
    const [row]=await db.insert(pendingActions).values({
      clinicId:p.clinicId,conversationId:p.conversationId??null,patientId:p.patientId??null,appointmentId:p.appointmentId??null,
      actionType:p.actionType,riskScore:p.riskScore,riskLevel:p.riskLevel,status:'pending',
      snapshotBefore:p.snapshotBefore??{},snapshotAfter:p.snapshotAfter??{},undoPayload:p.undoPayload??{},
      maxConfirmations:p.maxConfirmations??1,undoDeadline,reasoning:p.reasoning??null,agentIntent:p.agentIntent??null,
      confidence:p.confidence!=null?String(p.confidence):null,
    }as any).returning()
    return toSnake(row)
  }
  async confirmAction(actionId:string):Promise<{confirmed:boolean;requiresMore:boolean}>{
    const db=getDb();const [row]=await db.select({confirmationCount:pendingActions.confirmationCount,maxConfirmations:pendingActions.maxConfirmations}).from(pendingActions).where(eq(pendingActions.id,actionId))
    if(!row)throw new Error('Action not found');const nc=(row.confirmationCount??0)+1;const done=nc>=(row.maxConfirmations??1)
    await db.update(pendingActions).set({confirmationCount:nc,updatedAt:new Date(),...(done?{confirmedAt:new Date()}:{})}as any).where(eq(pendingActions.id,actionId))
    return{confirmed:done,requiresMore:!done}
  }
  async executeAction(actionId:string):Promise<{executed:boolean;undoDeadline:Date}>{
    const db=getDb();const [row]=await db.update(pendingActions).set({status:'executed',updatedAt:new Date()}as any).where(and(eq(pendingActions.id,actionId),eq(pendingActions.status as any,'pending'))).returning({undoDeadline:pendingActions.undoDeadline})
    if(!row)return{executed:false,undoDeadline:new Date(0)}
    return{executed:true,undoDeadline:row.undoDeadline??new Date(0)}
  }
  async undoAction(actionId:string):Promise<{undone:boolean;restored:Record<string,unknown>}>{
    const db=getDb();const [row]=await db.select({status:pendingActions.status,undoDeadline:pendingActions.undoDeadline,undoPayload:pendingActions.undoPayload}).from(pendingActions).where(eq(pendingActions.id,actionId))
    if(!row||row.status!=='executed')return{undone:false,restored:{}}
    if((row.undoDeadline?new Date(row.undoDeadline):new Date(0))<=new Date())return{undone:false,restored:{}}
    await db.update(pendingActions).set({status:'undone',undoneAt:new Date(),updatedAt:new Date()}as any).where(eq(pendingActions.id,actionId))
    return{undone:true,restored:(row.undoPayload as Record<string,unknown>)??{}}
  }
  async expireOldActions():Promise<number>{
    const db=getDb();const rows=await db.update(pendingActions).set({status:'expired',updatedAt:new Date()}as any).where(and(eq(pendingActions.status as any,'executed'),lt(pendingActions.undoDeadline,new Date()))).returning({id:pendingActions.id})
    return rows.length
  }
  async getPendingForConversation(conversationId:string):Promise<PendingAction[]>{
    const db=getDb();const rows=await db.select().from(pendingActions).where(and(eq(pendingActions.conversationId,conversationId),inArray(pendingActions.status as any,['pending','executed']))).orderBy(desc(pendingActions.createdAt))
    return rows.map(toSnake)
  }
  async getUndoableActions(patientId:string):Promise<PendingAction[]>{
    const db=getDb();const rows=await db.select().from(pendingActions).where(and(eq(pendingActions.patientId,patientId),eq(pendingActions.status as any,'executed'),gt(pendingActions.undoDeadline,new Date()))).orderBy(desc(pendingActions.createdAt))
    return rows.map(toSnake)
  }
}
export const pendingActionsService=new PendingActionsService()
