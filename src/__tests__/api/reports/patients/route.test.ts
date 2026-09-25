jest.mock('@/lib/auth/session',()=>({validateApiAuth:jest.fn()}))
const mdb={select:jest.fn(function(this:any){return this}),from:jest.fn(function(this:any){return this}),where:jest.fn(function(this:any){return this}),limit:jest.fn(function(this:any){return this}),offset:jest.fn(function(this:any){return this}),orderBy:jest.fn(function(this:any){return this}),then:jest.fn()} as any
jest.mock('@/lib/db/client',()=>({getDb:jest.fn(()=>mdb)}))
jest.mock('@/lib/errors',()=>{const c=class extends Error{status:number;constructor(m:string,s=400){super(m);this.status=s}};return{ValidationError:c}})
import{GET}from'@/app/api/reports/patients/route'
import{validateApiAuth}from'@/lib/auth/session'
function auth(p:any={id:'u1',clinic_id:'c1',role:'owner'}){(validateApiAuth as jest.Mock).mockResolvedValue({success:true,profile:p})}
function authFail(){(validateApiAuth as jest.Mock).mockResolvedValue({success:false,error:{message:'Unauthorized',status:401}})}
let calls=0
function ok(...results:any[][]){calls=0;mdb.then=jest.fn((fn:any)=>{const d=results[calls]??results[results.length-1]??[];calls++;return Promise.resolve(typeof fn==='function'?fn(d):d)})}
beforeEach(()=>{jest.clearAllMocks();calls=0})
describe('GET /api/reports/patients',()=>{
  it('returns 401',async()=>{authFail();const r=await GET(new Request('http://x')as any);expect(r.status).toBe(401)})
  it('returns shape',async()=>{auth();ok([],[],[],[],[]);const r=await GET(new Request('http://x')as any);const b=await r.json();expect(r.status).toBe(200);expect(b.data).toHaveProperty('period');expect(b.data).toHaveProperty('newPatients');expect(b.data).toHaveProperty('retention');expect(b.data).toHaveProperty('inactiveList')})
})
