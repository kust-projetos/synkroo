/** Tests for Financial Reports Service — Drizzle mocks */
import { getFinancialReport, getInactivePatients, getUpsellOpportunities } from '../financial-reports.service'
jest.mock('@/lib/logger',()=>({dbLogger:{error:jest.fn(),info:jest.fn()}}))

let results:any[][]=[],counter=0
const mdb={select:jest.fn(function(this:any){return this}),from:jest.fn(function(this:any){return this}),leftJoin:jest.fn(function(this:any){return this}),where:jest.fn(function(this:any){return this}),then:jest.fn(function(this:any,onF:any){const d=results[counter++]??results[results.length-1]??[];return Promise.resolve(typeof onF==='function'?onF(d):d)})} as any
jest.mock('@/lib/db/client',()=>{let d:any=null;return{getDb:jest.fn(()=>{if(!d)d=mdb;return d})}})
function seed(...s:any[][]){counter=0;results=s}
beforeEach(()=>{counter=0;results=[];jest.clearAllMocks()})

describe('Financial Reports',()=>{
  describe('getFinancialReport',()=>{
    it('returns zero for empty data',async()=>{seed([],[],[]);const r=await getFinancialReport('c1','month');expect(r.revenue).toBe(0);expect(r.payments).toBe(0);expect(r.outstanding).toBe(0)})
    it('calculates revenue from accepted budgets',async()=>{seed([{id:'b1',finalValue:'500',createdAt:new Date()}],[{budgetId:'b1',procedureId:'p1',procedureName:'Limpeza',totalPrice:'500'}],[{amount:'300',paidAt:new Date(),budgetId:'b1'}]);const r=await getFinancialReport('c1','month');expect(r.revenue).toBe(500);expect(r.payments).toBeGreaterThan(0);expect(r.byProcedure.length).toBeGreaterThan(0)})
  })
  describe('getInactivePatients',()=>{
    it('returns empty for no patients',async()=>{seed([]);const r=await getInactivePatients('c1');expect(r).toEqual([])})
    it('returns inactive patients sorted',async()=>{const old=new Date(Date.now()-200*86400000);seed([{id:'p1',name:'A',phone:'1',lastVisitAt:old,createdAt:old},{id:'p2',name:'B',phone:'2',lastVisitAt:null,createdAt:new Date()}]);const r=await getInactivePatients('c1');expect(r.length).toBe(2);expect(r[0].daysSinceVisit).toBeGreaterThanOrEqual(r[1].daysSinceVisit)})
  })
  describe('getUpsellOpportunities',()=>{
    it('returns empty for no completed plans',async()=>{seed([],[]);const r=await getUpsellOpportunities('c1');expect(r).toEqual([])})
    it('finds plans without active budgets',async()=>{seed([{id:'tp1',patientId:'p1',title:'Canal',completedAt:new Date(Date.now()-60*86400000),lastSessionAt:null,patientName:'Joao'}],[]);const r=await getUpsellOpportunities('c1');expect(r.length).toBe(1);expect(r[0].patientName).toBe('Joao')})
  })
})
