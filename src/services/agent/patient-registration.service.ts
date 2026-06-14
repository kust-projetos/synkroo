/** Patient Registration Service — Drizzle */
import { eq, and, isNull } from 'drizzle-orm'
import { getDb } from '@/lib/db/client'
import { patients } from '@/lib/db/schema'
import { dbLogger } from '@/lib/logger'

export interface RegistrationState {
  conversation_id:string;phone:string;clinic_id:string
  stage:'detecting'|'requesting_name'|'confirming_name'|'requesting_email'|'complete'
  extracted_name:string|null;patient_id:string|null;created_at:string
}

export async function findPatientByPhone(phone:string,clinicId:string):Promise<{id:string;name:string}|null>{
  const db=getDb()
  try{
    const rows=await db.select({id:patients.id,name:patients.name}).from(patients).where(and(eq(patients.clinicId,clinicId),eq(patients.phone,phone),isNull(patients.deletedAt))).limit(1)
    return rows.length?{id:rows[0].id,name:rows[0].name}:null
  }catch(e){dbLogger.error('Error finding patient by phone',e);return null}
}

export function extractNameFromMessage(message:string):string|null{
  const patterns=[/(?:meu nome [ée]\s+|me chamo\s+|sou [oa]\s+|me chama de\s+)([A-ZÀ-Ú][a-zà-ú]+(?:\s+[A-ZÀ-Ú][a-zà-ú]+)*)/i,/^(?:Oi|Olá|Bom dia|Boa tarde|Boa noite)[,.!]*\s+(?:eu sou|meu nome [ée]|me chamo)\s+([A-ZÀ-Ú][a-zà-ú]+(?:\s+[A-ZÀ-Ú][a-zà-ú]+)*)/i,/^(?:Oi|Olá|Bom dia|Boa tarde|Boa noite)[,.!]*\s+([A-ZÀ-Ú][a-zà-ú]+(?:\s+[A-ZÀ-Ú][a-zà-ú]+)*)/i]
  for(const p of patterns){const m=message.match(p);if(m){const n=m[1].trim();if(n.length>=2&&!/\d/.test(n))return n}}
  return null
}

export async function createMinimalPatient(params:{clinicId:string;name:string;phone:string;source?:string}):Promise<{id:string;name:string}|null>{
  const db=getDb()
  try{
    const [row]=await db.insert(patients).values({clinicId:params.clinicId,name:params.name,phone:params.phone,tags:['Novo','Cadastro Incompleto']}as any).returning({id:patients.id,name:patients.name})
    return row??null
  }catch(e){dbLogger.error('Error creating minimal patient',e);return null}
}

export async function updatePatientInfo(patientId:string,updates:{name?:string;email?:string;cpf?:string;birth_date?:string}):Promise<boolean>{
  const db=getDb()
  try{
    const d:Record<string,unknown>={updatedAt:new Date()};if(updates.name)d.name=updates.name;if(updates.email)d.email=updates.email;if(updates.cpf)d.cpf=updates.cpf;if(updates.birth_date)d.birthDate=updates.birth_date
    await db.update(patients).set(d as any).where(eq(patients.id,patientId));return true
  }catch(e){dbLogger.error('Error updating patient info',e);return false}
}

export async function markRegistrationComplete(patientId:string):Promise<boolean>{
  const db=getDb()
  try{
    const [row]=await db.select({tags:patients.tags}).from(patients).where(eq(patients.id,patientId))
    const tags=(row?.tags as string[])||[];const nt=tags.filter(t=>t!=='Cadastro Incompleto')
    await db.update(patients).set({tags:nt as any,updatedAt:new Date()}as any).where(eq(patients.id,patientId));return true
  }catch(e){dbLogger.error('Error marking registration complete',e);return false}
}

export async function processRegistrationFlow(params:{phone:string;clinicId:string;message:string;conversationId:string}):Promise<{isNewPatient:boolean;patientId:string|null;patientName:string|null;nextAction:'none'|'ask_name'|'confirm_name'|'ask_email'|'registration_complete';suggestedReply?:string}>{
  const{phone,clinicId,message}=params
  const existing=await findPatientByPhone(phone,clinicId)
  if(existing)return{isNewPatient:false,patientId:existing.id,patientName:existing.name,nextAction:'none'}
  const name=extractNameFromMessage(message)
  if(name){const p=await createMinimalPatient({clinicId,name,phone,source:'whatsapp'});if(p)return{isNewPatient:true,patientId:p.id,patientName:p.name,nextAction:'confirm_name',suggestedReply:`Prazer em conhecê-lo, ${name}! Posso confirmar que seu nome está correto?`}}
  return{isNewPatient:true,patientId:null,patientName:null,nextAction:'ask_name',suggestedReply:'Olá! Ainda não tenho seu cadastro. Para te atender melhor, poderia me informar seu nome?'}
}

export function extractEmail(message:string):string|null{const m=message.match(/[\w.-]+@[\w.-]+\.\w{2,}/);return m?m[0]:null}
