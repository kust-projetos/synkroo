/** Tests for ROI Service — Drizzle mocks */
import { calculateROI, getROIMetrics } from '@/services/analytics/roi.service'

jest.mock('@/lib/logger',()=>({dbLogger:{error:jest.fn(),info:jest.fn()}}))

let counter=0, results:any[][]=[], lastResult:any[]=[]
const mdb = {
  select: jest.fn(function(this:any){return this}),
  from: jest.fn(function(this:any){return this}),
  where: jest.fn(function(this:any){return this}),
  innerJoin: jest.fn(function(this:any){return this}),
  then: jest.fn(function(this:any,onF:any){
    const idx=counter++;const d=results[idx]??lastResult;return Promise.resolve(typeof onF==='function'?onF(d):d)
  }),
} as any
jest.mock('@/lib/db/client',()=>{
  let d:any=null
  return {getDb:jest.fn(()=>{if(!d)d=mdb;return d})}
})

function seed(...seeded:any[][]){counter=0;results=seeded;lastResult=seeded[seeded.length-1]??[]}
beforeEach(()=>{counter=0;results=[];lastResult=[];jest.clearAllMocks();mdb.then.mockClear()})
const cid='c1',ps='2026-03-01T00:00:00.000Z',pe='2026-03-31T23:59:59.999Z'

describe('ROI Service',()=>{
  describe('calculateROI',()=>{
    it('returns zero metrics when no data',async()=>{
      seed([],[],[],[])
      const r=await calculateROI(cid,ps,pe)
      expect(r.savings.messagesHandled).toBe(0)
      expect(r.revenue.appointmentsBooked).toBe(0)
      expect(r.revenue.recoveredNoShows).toBe(0)
      expect(r.roi).toBeLessThan(0)
    })
    it('counts AI-handled messages',async()=>{
      seed([{count:25,patientId:'x'}],[{count:25,patientId:'x'}],[{count:25,patientId:'x'}],[{count:25,patientId:'x'}])
      const r=await calculateROI(cid,ps,pe)
      expect(r.savings.messagesHandled).toBe(25)
      expect(r.savings.totalSaved).toBeGreaterThan(0)
      // AI counts usam 1 query com innerJoin cada (sem round-trip de convIds)
      expect(mdb.innerJoin).toHaveBeenCalledTimes(2)
    })
    it('returns positive recovered no-shows',async()=>{
      seed([{count:3,patientId:'p1'}],[{count:3,patientId:'p2'}],[{count:3,patientId:'p3'}],[{count:3,patientId:'p4'}])
      const r=await calculateROI(cid,ps,pe)
      expect(r.revenue.recoveredNoShows).toBe(3)
    })
    it('ROI is negative when costs exceed revenue',async()=>{
      seed([],[],[],[])
      const r=await calculateROI(cid,ps,pe)
      expect(r.roi).toBeLessThan(0)
      expect(r.netBenefit).toBeLessThan(0)
    })
  })
  describe('getROIMetrics',()=>{
    it('returns comparison for month',async()=>{
      seed([],[],[],[],[],[])
      const r=await getROIMetrics(cid,'month','2026-06-01')
      expect(r).toHaveProperty('comparison')
      expect(r.comparison!.changePercent).toBe(0)
    })
    it('returns comparison for quarter',async()=>{
      seed([],[],[],[],[],[])
      const r=await getROIMetrics(cid,'quarter','2026-06-01')
      expect(r).toHaveProperty('comparison')
    })
  })
})
