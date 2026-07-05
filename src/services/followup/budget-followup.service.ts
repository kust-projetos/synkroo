/** Budget Follow-up Service — Drizzle */
import { eq, and, inArray, asc } from 'drizzle-orm'
import { getDb } from '@/lib/db/client'
import { budgets, patients } from '@/lib/db/schema'
import { dbLogger } from '@/lib/logger'

export interface UnconvertedBudget { id:string;patient_id:string|null;patient_name:string;patient_phone:string|null;clinic_id:string;total_value:number;created_at:string;days_since_created:number;followup_stage:number;status:string }
const FOLLOWUP_STAGES=[{day:7,message:'Olá! Tudo bem? Gostaria de saber se teve oportunidade de avaliar o orçamento que enviamos. Podemos ajustar se necessário!'},{day:14,message:'Oi! Estamos passando para saber se ainda tem interesse no tratamento. Temos condições especiais de pagamento que podem ajudar!'}]

export async function findUnconvertedBudgets(clinicId:string):Promise<UnconvertedBudget[]>{
  const db=getDb()
  try{
    const rows=await db.select().from(budgets).leftJoin(patients,eq(budgets.patientId,patients.id)).where(and(eq(budgets.clinicId,clinicId),inArray(budgets.status as any,['sent','pending']))).orderBy(asc(budgets.createdAt))
    const now=new Date();const results:UnconvertedBudget[]=[]
    for(const r of rows){const b=r.budgets;const p=r.patients;const cd=b.createdAt??new Date()
      const days=Math.floor((now.getTime()-cd.getTime())/86400000);let fs=0
      const notes=b.notes||'';const m=notes.match(/\[followup-stage-(\d+)-date/);if(m)fs=parseInt(m[1],10)
      if(days>=FOLLOWUP_STAGES[0].day){results.push({id:b.id,patient_id:b.patientId,patient_name:p?.name||'Desconhecido',patient_phone:p?.phone||null,clinic_id:b.clinicId,total_value:Number(b.totalValue??0),created_at:cd.toISOString(),days_since_created:days,followup_stage:fs,status:b.status||''})}}
    return results.sort((a,b)=>b.days_since_created-a.days_since_created)
  }catch(e){dbLogger.error('Error finding unconverted budgets',e);return[]}
}

export async function sendBudgetFollowup(budgetId:string,clinicId:string):Promise<{success:boolean;message?:string;stage?:number}>{
  const db=getDb()
  try{
    const rows=await db.select({id:budgets.id,patientId:budgets.patientId,notes:budgets.notes,patientName:patients.name,patientPhone:patients.phone}).from(budgets).leftJoin(patients,eq(budgets.patientId,patients.id)).where(and(eq(budgets.id,budgetId),eq(budgets.clinicId,clinicId)))
    const r=rows[0];if(!r)return{success:false,message:'Budget not found'}
    if(!r.patientPhone)return{success:false,message:'Patient has no phone number'}
    let cs=0;const m=(r.notes||'').match(/\[followup-stage-(\d+)-date/);if(m)cs=parseInt(m[1],10)
    const ns=cs+1;if(ns>FOLLOWUP_STAGES.length)return{success:false,message:'All follow-up stages completed'}
    const marker=`[followup-stage-${ns}-date: ${new Date().toISOString().split('T')[0]}]`
    const newNotes=r.notes?`${r.notes}\n${marker}`:marker
    await db.update(budgets).set({notes:newNotes,updatedAt:new Date()}as any).where(eq(budgets.id,budgetId))
    return{success:true,message:FOLLOWUP_STAGES[ns-1].message,stage:ns}
  }catch(e){dbLogger.error('Error sending budget follow-up',e,{budgetId});return{success:false,message:'Internal error'}}
}

export async function processBudgetFollowups(clinicId:string):Promise<{processed:number;errors:number}>{
  const unconverted=await findUnconvertedBudgets(clinicId);let processed=0,errors=0
  for(const b of unconverted){const ns=b.followup_stage+1;if(ns>FOLLOWUP_STAGES.length)continue;if(b.days_since_created<FOLLOWUP_STAGES[ns-1].day)continue
    const r=await sendBudgetFollowup(b.id,clinicId);if(r.success)processed++;else errors++}
  return{processed,errors}
}
