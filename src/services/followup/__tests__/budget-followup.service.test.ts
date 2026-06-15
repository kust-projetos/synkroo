/** Tests for Budget Follow-up Service — Drizzle mocks */
jest.mock('@/lib/logger',()=>({dbLogger:{info:jest.fn(),warn:jest.fn(),error:jest.fn(),debug:jest.fn()}}))
let results:any[][]=[],counter=0
const mdb={select:jest.fn(function(this:any){return this}),from:jest.fn(function(this:any){return this}),leftJoin:jest.fn(function(this:any){return this}),where:jest.fn(function(this:any){return this}),orderBy:jest.fn(function(this:any){return this}),update:jest.fn(function(this:any){return this}),set:jest.fn(function(this:any){return this}),then:jest.fn(function(this:any,onF:any){const d=results[counter++]??results[results.length-1]??[];return Promise.resolve(typeof onF==='function'?onF(d):d)})} as any
jest.mock('@/lib/db/client',()=>{let d:any=null;return{getDb:jest.fn(()=>{if(!d)d=mdb;return d})}})
import{findUnconvertedBudgets,sendBudgetFollowup,processBudgetFollowups}from'../budget-followup.service'
function seed(...s:any[][]){counter=0;results=s}
beforeEach(()=>{counter=0;results=[];jest.clearAllMocks()})
const oldDate=new Date(Date.now()-15*86400000)
describe('Budget Follow-up Service',()=>{
  describe('findUnconvertedBudgets',()=>{
    it('finds budgets older than 7 days',async()=>{seed([{budgets:{id:'b1',patientId:'p1',clinicId:'c1',totalValue:'1500',status:'sent',createdAt:oldDate,notes:''},patients:{name:'João',phone:'11999999999'}}]);const r=await findUnconvertedBudgets('c1');expect(r.length).toBe(1);expect(r[0].days_since_created).toBeGreaterThanOrEqual(7)})
    it('parses followup stage from notes',async()=>{seed([{budgets:{id:'b1',patientId:'p1',clinicId:'c1',totalValue:'500',status:'sent',createdAt:oldDate,notes:'[followup-stage-1-date: 2026-03-20]'},patients:{name:'Maria',phone:'11888888888'}}]);const r=await findUnconvertedBudgets('c1');expect(r[0].followup_stage).toBe(1)})
  })
  describe('sendBudgetFollowup',()=>{
    it('returns false if budget not found',async()=>{seed([]);const r=await sendBudgetFollowup('nonexistent','c1');expect(r.success).toBe(false);expect(r.message).toBe('Budget not found')})
    it('returns false if no phone',async()=>{seed([{id:'b1',patientId:'p1',notes:'',patientName:'João',patientPhone:null}]);const r=await sendBudgetFollowup('b1','c1');expect(r.success).toBe(false);expect(r.message).toBe('Patient has no phone number')})
    it('sends followup and updates notes',async()=>{seed([{id:'b1',patientId:'p1',notes:'',patientName:'João',patientPhone:'11999999999'}],[]);const r=await sendBudgetFollowup('b1','c1');expect(r.success).toBe(true);expect(r.stage).toBe(1)})
    it('rejects all stages completed',async()=>{seed([{id:'b1',patientId:'p1',notes:'[followup-stage-2-date:2026-03-22]',patientName:'João',patientPhone:'11999999999'}]);const r=await sendBudgetFollowup('b1','c1');expect(r.success).toBe(false);expect(r.message).toBe('All follow-up stages completed')})
  })
  describe('processBudgetFollowups',()=>{
    it('returns zeros for empty',async()=>{seed([]);const r=await processBudgetFollowups('c1');expect(r.processed).toBe(0);expect(r.errors).toBe(0)})
  })
})
