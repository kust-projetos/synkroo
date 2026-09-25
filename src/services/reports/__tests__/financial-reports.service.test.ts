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
  describe('precisão monetária (centavos exatos)',()=>{
    it('0.10 + 0.20 soma exatamente 0.30 (sem 0.30000000000000004)',async()=>{
      seed([{id:'b1',finalValue:'0.10',createdAt:new Date()},{id:'b2',finalValue:'0.20',createdAt:new Date()}],[],[]);
      const r=await getFinancialReport('c1','month');
      expect(r.revenue).toBe(0.3);expect(r.payments).toBe(0);expect(r.outstanding).toBe(0.3)
    })
    it('rateio com desconto global conserva o pagamento (itens 100+100, final 180, pay 180 → quotas somam 18000 cents)',async()=>{
      seed(
        [{id:'b1',finalValue:'180',createdAt:new Date()}],
        [
          {budgetId:'b1',procedureId:'p1',procedureName:'A',totalPrice:'100'},
          {budgetId:'b1',procedureId:'p2',procedureName:'B',totalPrice:'100'},
        ],
        [{amount:'180',paidAt:new Date(),budgetId:'b1'}]
      );
      const r=await getFinancialReport('c1','month');
      expect(r.payments).toBe(180);
      const sumCents=r.byProcedure.reduce((a,b)=>a+Math.round(b.payments*100),0);
      expect(r.byProcedure).toHaveLength(2);
      expect(sumCents).toBe(18000);
      expect(r.byProcedure.map(b=>Math.round(b.payments*100)).sort((a,b)=>b-a)).toEqual([9000,9000])
    })
    it('rateio de pagamento negativo soma EXATAMENTE ao valor negativo (simétrico)',async()=>{
      seed(
        [{id:'b1',finalValue:'200',createdAt:new Date()}],
        [
          {budgetId:'b1',procedureId:'p1',procedureName:'A',totalPrice:'100'},
          {budgetId:'b1',procedureId:'p2',procedureName:'B',totalPrice:'100'},
        ],
        [{amount:'-50',paidAt:new Date(),budgetId:'b1'}]
      );
      const r=await getFinancialReport('c1','month');
      expect(r.payments).toBe(-50);
      const sumCents=r.byProcedure.reduce((a,b)=>a+Math.round(b.payments*100),0);
      expect(sumCents).toBe(-5000);
    })
    it('W=0 leaves no allocation rows (unattributable by procedure) — pesos zerados não alocam nada e não quebram',async()=>{
      seed(
        [{id:'b1',finalValue:'0',createdAt:new Date()}],
        [
          {budgetId:'b1',procedureId:'p1',procedureName:'A',totalPrice:'0'},
          {budgetId:'b1',procedureId:'p2',procedureName:'B',totalPrice:'0'},
        ],
        [{amount:'50',paidAt:new Date(),budgetId:'b1'}]
      );
      const r=await getFinancialReport('c1','month');
      expect(r.payments).toBe(50);
      const sumCents=r.byProcedure.reduce((a,b)=>a+Math.round(b.payments*100),0);
      expect(sumCents).toBe(0);
    })
    it('pesos mistos (+100/−99): negativo clampa a 0, alocação 100% no peso positivo',async()=>{
      seed(
        [{id:'b1',finalValue:'100',createdAt:new Date()}],
        [
          {budgetId:'b1',procedureId:'p1',procedureName:'A',totalPrice:'100'},
          {budgetId:'b1',procedureId:'p2',procedureName:'B',totalPrice:'-99'},
        ],
        [{amount:'50',paidAt:new Date(),budgetId:'b1'}]
      );
      const r=await getFinancialReport('c1','month');
      expect(r.payments).toBe(50);
      const byId=new Map(r.byProcedure.map(b=>[b.procedureId,Math.round(b.payments*100)]));
      expect(byId.get('p1')).toBe(5000);
      expect(byId.get('p2')).toBe(0);
      const sumCents=r.byProcedure.reduce((a,b)=>a+Math.round(b.payments*100),0);
      expect(sumCents).toBe(5000);
    })
    it('resto de distribuição: pay 1.00 em 3 itens iguais → 34/33/33 cents',async()=>{
      seed(
        [{id:'b1',finalValue:'3.00',createdAt:new Date()}],
        [
          {budgetId:'b1',procedureId:'p1',procedureName:'A',totalPrice:'1.00'},
          {budgetId:'b1',procedureId:'p2',procedureName:'B',totalPrice:'1.00'},
          {budgetId:'b1',procedureId:'p3',procedureName:'C',totalPrice:'1.00'},
        ],
        [{amount:'1.00',paidAt:new Date(),budgetId:'b1'}]
      );
      const r=await getFinancialReport('c1','month');
      expect(r.payments).toBe(1);
      const cents=r.byProcedure.map(b=>Math.round(b.payments*100)).sort((a,b)=>b-a);
      expect(cents).toEqual([34,33,33]);
    })
    it('rateio proporcional soma EXATAMENTE ao pagamento (0.10 em 3 itens iguais → 0.04+0.03+0.03)',async()=>{
      seed(
        [{id:'b1',finalValue:'0.30',createdAt:new Date()}],
        [
          {budgetId:'b1',procedureId:'p1',procedureName:'A',totalPrice:'0.10'},
          {budgetId:'b1',procedureId:'p2',procedureName:'B',totalPrice:'0.10'},
          {budgetId:'b1',procedureId:'p3',procedureName:'C',totalPrice:'0.10'},
        ],
        [{amount:'0.10',paidAt:new Date(),budgetId:'b1'}]
      );
      const r=await getFinancialReport('c1','month');
      expect(r.payments).toBe(0.1);
      // Soma exata verificada em centavos inteiros: float daria 3+3+3=9
      const sumCents=r.byProcedure.reduce((a,b)=>a+Math.round(b.payments*100),0);
      expect(r.byProcedure).toHaveLength(3);
      expect(sumCents).toBe(10);
      expect(r.byProcedure.map(b=>b.payments).sort((a,b)=>b-a)).toEqual([0.04,0.03,0.03])
    })
  })
})
