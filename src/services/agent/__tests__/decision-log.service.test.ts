/** Tests for Decision Log Service — Drizzle mocks */
jest.mock('@/lib/logger',()=>({dbLogger:{info:jest.fn(),warn:jest.fn(),error:jest.fn(),debug:jest.fn()}}))
let results:any[][]=[],counter=0
const mdb={select:jest.fn(function(this:any){return this}),from:jest.fn(function(this:any){return this}),where:jest.fn(function(this:any){return this}),orderBy:jest.fn(function(this:any){return this}),limit:jest.fn(function(this:any){return this}),insert:jest.fn(function(this:any){return this}),values:jest.fn(function(this:any){return this}),returning:jest.fn(function(this:any){return this}),then:jest.fn(function(this:any,onF:any){const d=results[counter++]??results[results.length-1]??[];return Promise.resolve(typeof onF==='function'?onF(d):d)})} as any
jest.mock('@/lib/db/client',()=>{let d:any=null;return{getDb:jest.fn(()=>{if(!d)d=mdb;return d})}})
import{decisionLogService}from'../decision-log.service'
function seed(...s:any[][]){counter=0;results=s}
beforeEach(()=>{counter=0;results=[];jest.clearAllMocks()})
describe('Decision Log Service',()=>{
  describe('logDecision',()=>{
    it('inserts and returns id',async()=>{seed([{id:'log-123'}]);const id=await decisionLogService.logDecision({clinicId:'c1',intentClassified:'test',confidenceScore:0.9,actionTaken:'act',riskLevel:'LOW',reasoning:'ok'});expect(id).toBe('log-123')})
    it('returns empty on error',async()=>{seed([]);const id=await decisionLogService.logDecision({clinicId:'c1',intentClassified:'test',confidenceScore:0.9,actionTaken:'act',riskLevel:'LOW',reasoning:'ok'});expect(id).toBe('')})
  })
  describe('getRecentLogs',()=>{
    it('returns logs',async()=>{seed([{id:'d1',clinicId:'c1',createdAt:new Date(),intentClassified:'a',confidenceScore:'0.8',actionTaken:'x',riskLevel:'LOW',reasoning:'r'}]);const logs=await decisionLogService.getRecentLogs('c1');expect(logs.length).toBe(1);expect(logs[0].id).toBe('d1')})
  })
  describe('getLogsByPatient',()=>{
    it('returns patient logs',async()=>{seed([{id:'d2',clinicId:'c1',patientId:'p1',createdAt:new Date(),intentClassified:'b',confidenceScore:'0.7',actionTaken:'y',riskLevel:'MEDIUM',reasoning:'r'}]);const logs=await decisionLogService.getLogsByPatient('p1');expect(logs.length).toBe(1)})
  })
  describe('getEscalationStats',()=>{
    it('returns stats from data',async()=>{seed([{escalationTriggered:true,confidenceScore:'0.9',intentClassified:'agendamento',riskLevel:'LOW'},{escalationTriggered:false,confidenceScore:'0.8',intentClassified:'cancelamento',riskLevel:'HIGH'}]);const s=await decisionLogService.getEscalationStats('c1');expect(s.totalDecisions).toBe(2);expect(s.escalations).toBe(1);expect(s.riskDistribution.HIGH).toBe(1)})
    it('returns empty for no data',async()=>{seed([]);const s=await decisionLogService.getEscalationStats('c1');expect(s.totalDecisions).toBe(0)})
  })
})
