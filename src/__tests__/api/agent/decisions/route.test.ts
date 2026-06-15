jest.mock('@/lib/auth/session',()=>({validateApiAuth:jest.fn()}))
const mdb={select:jest.fn(function(this:any){return this}),from:jest.fn(function(this:any){return this}),where:jest.fn(function(this:any){return this}),orderBy:jest.fn(function(this:any){return this}),limit:jest.fn(function(this:any){return this}),then:jest.fn()} as any
jest.mock('@/lib/db/client',()=>({getDb:jest.fn(()=>mdb)}))
import{GET}from '@/app/api/agent/decisions/route'
import{validateApiAuth}from '@/lib/auth/session'
function auth(p:any={id:'u1',clinic_id:'c1',role:'owner'}){(validateApiAuth as jest.Mock).mockResolvedValue({success:true,profile:p})}
function authFail(){(validateApiAuth as jest.Mock).mockResolvedValue({success:false,error:{message:'Unauthorized',status:401}})}
function ok(d:any[]){mdb.then=jest.fn((fn:any)=>Promise.resolve(typeof fn==='function'?fn(d):d))}
beforeEach(()=>jest.clearAllMocks())
describe('GET /api/agent/decisions',()=>{
  it('returns 401',async()=>{authFail();const r=await GET(new Request('http://x') as any);expect(r.status).toBe(401)})
  it('returns shape {logs,stats}',async()=>{auth();ok([]);const r=await GET(new Request('http://x') as any);const b=await r.json();expect(r.status).toBe(200);expect(b).toHaveProperty('logs');expect(b).toHaveProperty('stats')})
  it('returns stats with totals',async()=>{auth();ok([{id:'d1',clinicId:'c1',intentClassified:'agendamento',riskLevel:'LOW',escalationTriggered:false,confidenceScore:'0.85',actionTaken:'agendou',reasoning:'...',createdAt:new Date()}]);const r=await GET(new Request('http://x') as any);const b=await r.json();expect(b.stats.totalDecisions).toBe(1)})
})
