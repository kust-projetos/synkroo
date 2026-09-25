jest.mock('@/lib/auth/session',()=>({validateApiAuth:jest.fn()}))
const mdb={select:jest.fn(function(this:any){return this}),from:jest.fn(function(this:any){return this}),leftJoin:jest.fn(function(this:any){return this}),where:jest.fn(function(this:any){return this}),orderBy:jest.fn(function(this:any){return this}),then:jest.fn((fn:any)=>Promise.resolve(fn([])))} as any
jest.mock('@/lib/db/client',()=>({getDb:jest.fn(()=>mdb)}))
import{GET}from'@/app/api/reports/export/route'
import{validateApiAuth}from'@/lib/auth/session'
function auth(p:any={id:'u1',clinic_id:'c1',role:'owner',name:'Test',email:'a@b.com'}){(validateApiAuth as jest.Mock).mockResolvedValue({success:true,profile:p})}
function authFail(){(validateApiAuth as jest.Mock).mockResolvedValue({success:false,error:{message:'Unauthorized',status:401}})}
beforeEach(()=>jest.clearAllMocks())
describe('GET /api/reports/export',()=>{
  it('returns 401',async()=>{authFail();const r=await GET(new Request('http://x')as any);expect(r.status).toBe(401)})
  it('returns 400 for invalid type',async()=>{auth();const r=await GET(new Request('http://x?type=invalid')as any);const b=await r.json();expect(r.status).toBe(400);expect(b.error.message).toContain('Invalid')})
  it('returns CSV for appointments',async()=>{auth();const r=await GET(new Request('http://x?type=appointments')as any);expect(r.headers.get('Content-Type')).toContain('text/csv')})
  it('returns CSV for patients',async()=>{auth();const r=await GET(new Request('http://x?type=patients')as any);expect(r.headers.get('Content-Type')).toContain('text/csv')})
  it('returns CSV for leads',async()=>{auth();const r=await GET(new Request('http://x?type=leads')as any);expect(r.headers.get('Content-Type')).toContain('text/csv')})
  it('returns CSV for conversations',async()=>{auth();const r=await GET(new Request('http://x?type=conversations')as any);expect(r.headers.get('Content-Type')).toContain('text/csv')})
  it('returns JSON payload for format=json',async()=>{auth();const r=await GET(new Request('http://x?type=appointments&format=json')as any);expect(r.status).toBe(200);const b=await r.json();expect(b.data.data).toBeDefined();expect(b.data.headers).toBeDefined();expect(b.data.filename).toContain('agendamentos')})
  it('returns JSON payload for format=pdf',async()=>{auth();const r=await GET(new Request('http://x?type=leads&format=pdf')as any);expect(r.status).toBe(200);const b=await r.json();expect(b.data.data).toBeDefined();expect(b.data.headers).toBeDefined();expect(b.data.filename).toContain('leads')})
})
