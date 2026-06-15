/** Tests for Pending Actions Service — Drizzle mocks */
jest.mock('@/lib/logger',()=>({dbLogger:{info:jest.fn(),warn:jest.fn(),error:jest.fn(),debug:jest.fn()}}))
let results:any[][]=[],counter=0
const mdb={select:jest.fn(function(this:any){return this}),from:jest.fn(function(this:any){return this}),where:jest.fn(function(this:any){return this}),orderBy:jest.fn(function(this:any){return this}),insert:jest.fn(function(this:any){return this}),values:jest.fn(function(this:any){return this}),returning:jest.fn(function(this:any){return this}),update:jest.fn(function(this:any){return this}),set:jest.fn(function(this:any){return this}),then:jest.fn(function(this:any,onF:any){const d=results[counter++]??results[results.length-1]??[];return Promise.resolve(typeof onF==='function'?onF(d):d)})} as any
jest.mock('@/lib/db/client',()=>{let d:any=null;return{getDb:jest.fn(()=>{if(!d)d=mdb;return d})}})
import{pendingActionsService}from'../pending-actions.service'
function seed(...s:any[][]){counter=0;results=s}
beforeEach(()=>{counter=0;results=[];jest.clearAllMocks()})
const baseRow={id:'a1',clinicId:'c1',conversationId:null,patientId:null,appointmentId:null,actionType:'test',riskScore:0,riskLevel:'LOW',status:'pending',snapshotBefore:{},snapshotAfter:{},undoPayload:{},confirmationCount:0,maxConfirmations:1,confirmedAt:null,undoDeadline:new Date(Date.now()+3600000),undoneAt:null,reasoning:null,agentIntent:null,confidence:null,createdAt:new Date(),updatedAt:new Date()}
describe('PendingActionsService',()=>{
  describe('createAction',()=>{
    it('creates action',async()=>{seed([baseRow]);const a=await pendingActionsService.createAction({clinicId:'c1',actionType:'test',riskScore:0,riskLevel:'LOW'});expect(a.id).toBe('a1');expect(a.status).toBe('pending')})
  })
  describe('confirmAction',()=>{
    it('confirms action',async()=>{seed([{confirmationCount:0,maxConfirmations:2}],[]);const r=await pendingActionsService.confirmAction('a1');expect(r.confirmed).toBe(false);expect(r.requiresMore).toBe(true)})
    it('fully confirms on last count',async()=>{seed([{confirmationCount:1,maxConfirmations:2}],[]);const r=await pendingActionsService.confirmAction('a1');expect(r.confirmed).toBe(true);expect(r.requiresMore).toBe(false)})
    it('throws on missing action',async()=>{seed([]);await expect(pendingActionsService.confirmAction('a1')).rejects.toThrow('Action not found')})
  })
  describe('executeAction',()=>{
    it('executes pending action',async()=>{seed([{undoDeadline:new Date(Date.now()+3600000)}]);const r=await pendingActionsService.executeAction('a1');expect(r.executed).toBe(true)})
    it('fails on missing',async()=>{seed([]);const r=await pendingActionsService.executeAction('a1');expect(r.executed).toBe(false)})
  })
  describe('undoAction',()=>{
    it('undos executed action',async()=>{seed([{status:'executed',undoDeadline:new Date(Date.now()+3600000),undoPayload:{x:1}}],[]);const r=await pendingActionsService.undoAction('a1');expect(r.undone).toBe(true);expect(r.restored).toEqual({x:1})})
    it('fails when deadline passed',async()=>{seed([{status:'executed',undoDeadline:new Date(Date.now()-1000),undoPayload:{}}]);const r=await pendingActionsService.undoAction('a1');expect(r.undone).toBe(false)})
  })
  describe('getPendingForConversation',()=>{
    it('returns pending actions',async()=>{seed([baseRow]);const r=await pendingActionsService.getPendingForConversation('conv1');expect(r.length).toBe(1)})
  })
  describe('getUndoableActions',()=>{
    it('returns undoable actions',async()=>{seed([{...baseRow,status:'executed',patientId:'p1',undoDeadline:new Date(Date.now()+3600000)}]);const r=await pendingActionsService.getUndoableActions('p1');expect(r.length).toBe(1)})
  })
  describe('expireOldActions',()=>{
    it('expires old actions',async()=>{seed([{id:'a1'},{id:'a2'}]);const r=await pendingActionsService.expireOldActions();expect(r).toBe(2)})
  })
})
