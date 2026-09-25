jest.mock('@/lib/auth/session', () => ({ validateApiAuth: jest.fn() }))
const mockDb = { select: jest.fn(function(this:any){return this}), from: jest.fn(function(this:any){return this}), where: jest.fn(function(this:any){return this}), then: jest.fn(), update: jest.fn(function(this:any){return this}), set: jest.fn(function(this:any){return this}) } as any
jest.mock('@/lib/db/client', () => ({ getDb: jest.fn(() => mockDb) }))
jest.mock('@/lib/errors', () => { const cls = class extends Error { status:number; constructor(m:string,s=400){super(m);this.status=s} }; return { ValidationError: cls, NotFoundError: cls, DatabaseError: cls } })

import { GET, PUT } from '@/app/api/clinics/settings/route'
import { validateApiAuth } from '@/lib/auth/session'

function mockAuth(profile:any={id:'u1',clinic_id:'c1',role:'owner'}){(validateApiAuth as jest.Mock).mockResolvedValue({success:true,profile})}
function mockAuthFail(){(validateApiAuth as jest.Mock).mockResolvedValue({success:false,error:{message:'Unauthorized',status:401}})}
function ok(d:any){mockDb.then=jest.fn((fn:any)=>Promise.resolve(typeof fn==='function'?fn(d):d))}

beforeEach(()=>jest.clearAllMocks())

describe('GET /api/clinics/settings',()=>{
  it('returns 401 without auth',async()=>{mockAuthFail();const r=await GET();expect(r.status).toBe(401)})
  it('returns settings shape',async()=>{mockAuth();ok([{id:'c1',name:'Demo',phone:'11',email:'a@b.com',settings:{}}]);const r=await GET();const b=await r.json();expect(r.status).toBe(200);expect(b.data.settings).toHaveProperty('id');expect(b.data.settings).toHaveProperty('name')})
})

describe('PUT /api/clinics/settings',()=>{
  it('returns 401 without auth',async()=>{mockAuthFail();const r=await PUT(new Request('http://x',{method:'PUT',body:JSON.stringify({name:'X'})}) as any);expect(r.status).toBe(401)})
  it('updates clinic settings',async()=>{mockAuth();ok([{id:'c1'}]);const r=await PUT(new Request('http://x',{method:'PUT',body:JSON.stringify({name:'New'})}) as any);const b=await r.json();expect(r.status).toBe(200);expect(b.data.success).toBe(true)})
})
