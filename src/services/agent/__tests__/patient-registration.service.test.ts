/** Tests for Patient Registration Service — Drizzle mocks */
jest.mock('@/lib/logger',()=>({dbLogger:{info:jest.fn(),warn:jest.fn(),error:jest.fn(),debug:jest.fn()}}))
let results:any[][]=[],counter=0
const mdb={select:jest.fn(function(this:any){return this}),from:jest.fn(function(this:any){return this}),where:jest.fn(function(this:any){return this}),limit:jest.fn(function(this:any){return this}),insert:jest.fn(function(this:any){return this}),values:jest.fn(function(this:any){return this}),returning:jest.fn(function(this:any){return this}),update:jest.fn(function(this:any){return this}),set:jest.fn(function(this:any){return this}),then:jest.fn(function(this:any,onF:any){const d=results[counter++]??results[results.length-1]??[];return Promise.resolve(typeof onF==='function'?onF(d):d)})} as any
jest.mock('@/lib/db/client',()=>{let d:any=null;return{getDb:jest.fn(()=>{if(!d)d=mdb;return d})}})
import{extractNameFromMessage,extractEmail,findPatientByPhone,createMinimalPatient,processRegistrationFlow,markRegistrationComplete,updatePatientInfo}from'../patient-registration.service'
function seed(...s:any[][]){counter=0;results=s}
beforeEach(()=>{counter=0;results=[];jest.clearAllMocks()})
describe('Patient Registration Service',()=>{
  describe('extractNameFromMessage (pure)',()=>{
    it('extracts "Meu nome é"',()=>{expect(extractNameFromMessage('Meu nome é João Silva')).toBe('João Silva')})
    it('extracts "Me chamo"',()=>{expect(extractNameFromMessage('Me chamo Maria')).toBe('Maria')})
    it('extracts "Sou a"',()=>{expect(extractNameFromMessage('Sou a Ana')).toBe('Ana')})
    it('returns null for no match',()=>{expect(extractNameFromMessage('Olá')).toBeNull()})
  })
  describe('extractEmail',()=>{
    it('extracts email',()=>{expect(extractEmail('meu email é a@b.com')).toBe('a@b.com')})
  })
  describe('findPatientByPhone',()=>{
    it('finds patient',async()=>{seed([{id:'p1',name:'João'}]);const r=await findPatientByPhone('119','c1');expect(r).toEqual({id:'p1',name:'João'})})
    it('returns null for none',async()=>{seed([]);const r=await findPatientByPhone('119','c1');expect(r).toBeNull()})
  })
  describe('createMinimalPatient',()=>{
    it('creates patient',async()=>{seed([{id:'p2',name:'Maria'}]);const r=await createMinimalPatient({clinicId:'c1',name:'Maria',phone:'119'});expect(r).toEqual({id:'p2',name:'Maria'})})
  })
  describe('markRegistrationComplete',()=>{
    it('removes incomplete tag',async()=>{seed([{tags:['Novo','Cadastro Incompleto']}],[]);const r=await markRegistrationComplete('p1');expect(r).toBe(true)})
  })
  describe('updatePatientInfo',()=>{
    it('updates info',async()=>{seed([]);const r=await updatePatientInfo('p1',{name:'Novo'});expect(r).toBe(true)})
  })
  describe('processRegistrationFlow',()=>{
    it('returns existing patient',async()=>{seed([{id:'p1',name:'João'}]);const r=await processRegistrationFlow({phone:'119',clinicId:'c1',message:'Oi',conversationId:'cv1'});expect(r.isNewPatient).toBe(false);expect(r.patientId).toBe('p1')})
    it('returns ask_name for new patient',async()=>{seed([],[]);const r=await processRegistrationFlow({phone:'119',clinicId:'c1',message:'Oi',conversationId:'cv1'});expect(r.nextAction).toBe('ask_name')})
    it('creates patient with extracted name',async()=>{seed([],[]);const r=await processRegistrationFlow({phone:'119',clinicId:'c1',message:'Meu nome é Pedro',conversationId:'cv1'});expect(r.isNewPatient).toBe(true)})
  })
})
