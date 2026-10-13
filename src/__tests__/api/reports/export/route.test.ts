jest.mock('@/lib/auth/session',()=>({validateApiAuth:jest.fn()}))
const mdb={select:jest.fn(function(this:any){return this}),from:jest.fn(function(this:any){return this}),leftJoin:jest.fn(function(this:any){return this}),where:jest.fn(function(this:any){return this}),orderBy:jest.fn(function(this:any){return this}),then:jest.fn((fn:any)=>Promise.resolve(fn([])))} as any
jest.mock('@/lib/db/client',()=>({getDb:jest.fn(()=>mdb)}))
import{GET}from'@/app/api/reports/export/route'
import{validateApiAuth}from'@/lib/auth/session'
function auth(p:any={id:'u1',clinic_id:'c1',role:'owner',name:'Test',email:'a@b.com'}){(validateApiAuth as jest.Mock).mockResolvedValue({success:true,profile:p})}
function authFail(){(validateApiAuth as jest.Mock).mockResolvedValue({success:false,error:{message:'Unauthorized',status:401}})}
beforeEach(()=>{jest.clearAllMocks();mdb.select.mockClear()})
describe('GET /api/reports/export',()=>{
  it('returns 401',async()=>{authFail();const r=await GET(new Request('http://x')as any);expect(r.status).toBe(401)})
  it('returns 400 for invalid type',async()=>{auth();const r=await GET(new Request('http://x?type=invalid')as any);const b=await r.json();expect(r.status).toBe(400);expect(b.error.message).toContain('Invalid')})
  it('returns CSV for appointments',async()=>{auth();const r=await GET(new Request('http://x?type=appointments')as any);expect(r.headers.get('Content-Type')).toContain('text/csv')})
  it('returns CSV for patients',async()=>{auth();const r=await GET(new Request('http://x?type=patients')as any);expect(r.headers.get('Content-Type')).toContain('text/csv')})
  it('returns CSV for leads',async()=>{auth();const r=await GET(new Request('http://x?type=leads')as any);expect(r.headers.get('Content-Type')).toContain('text/csv')})
  it('returns CSV for conversations',async()=>{auth();const r=await GET(new Request('http://x?type=conversations')as any);expect(r.headers.get('Content-Type')).toContain('text/csv')})
  it('returns JSON payload for format=json',async()=>{auth();const r=await GET(new Request('http://x?type=appointments&format=json')as any);expect(r.status).toBe(200);const b=await r.json();expect(b.data.data).toBeDefined();expect(b.data.headers).toBeDefined();expect(b.data.filename).toContain('agendamentos')})
  it('returns JSON payload for format=pdf',async()=>{auth();const r=await GET(new Request('http://x?type=leads&format=pdf')as any);expect(r.status).toBe(200);const b=await r.json();expect(b.data.data).toBeDefined();expect(b.data.headers).toBeDefined();expect(b.data.filename).toContain('leads')})
  // Enum de appointments.status: filtro invalido precisa falhar ANTES da query
  // (antes retornava 200 com zero linhas, indistinguivel de "sem agendamentos").
  it('returns 400 for invalid appointment status enum',async()=>{auth();mdb.select.mockClear();const r=await GET(new Request('http://x?type=appointments&status=pending')as any);const b=await r.json();expect(r.status).toBe(400);expect(b.error.code).toBe('INVALID_INPUT');expect(b.error.message).toContain('pending');expect(mdb.select).not.toHaveBeenCalled()})
  it('returns 400 for partially invalid appointment status enum',async()=>{auth();mdb.select.mockClear();const r=await GET(new Request('http://x?type=appointments&status=confirmed,bogus')as any);expect(r.status).toBe(400);expect(mdb.select).not.toHaveBeenCalled()})
  it('accepts valid appointment status enum (comma list)',async()=>{auth();const r=await GET(new Request('http://x?type=appointments&status=scheduled,confirmed')as any);expect(r.status).toBe(200)})
  it('accepts legacy-looking value only when canonical (no_show)',async()=>{auth();const r=await GET(new Request('http://x?type=appointments&status=no_show')as any);expect(r.status).toBe(200)})
  // leads.status e text livre no schema: sem taxonomia canonica, nao valida.
  it('does not enforce enum on leads.status (text column)',async()=>{auth();const r=await GET(new Request('http://x?type=leads&status=whatever')as any);expect(r.status).toBe(200)})
})
