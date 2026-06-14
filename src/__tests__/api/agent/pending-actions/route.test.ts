jest.mock('@/lib/auth/session',()=>({validateApiAuth:jest.fn()}))
jest.mock('@/lib/logger',()=>({dbLogger:{info:jest.fn(),warn:jest.fn(),error:jest.fn(),debug:jest.fn()}}))
let results:any[][]=[],counter=0
const mdb={select:jest.fn(function(this:any){return this}),from:jest.fn(function(this:any){return this}),where:jest.fn(function(this:any){return this}),orderBy:jest.fn(function(this:any){return this}),update:jest.fn(function(this:any){return this}),set:jest.fn(function(this:any){return this}),then:jest.fn(function(this:any,onF:any){const d=results[counter++]??results[results.length-1]??[];return Promise.resolve(typeof onF==='function'?onF(d):d)})} as any
jest.mock('@/lib/db/client',()=>{let d:any=null;return{getDb:jest.fn(()=>{if(!d)d=mdb;return d})}})
import{GET,POST}from'@/app/api/agent/pending-actions/route'
import{validateApiAuth}from'@/lib/auth/session'
function auth(p:any={id:'u1',clinic_id:'c1',role:'owner'}){(validateApiAuth as jest.Mock).mockResolvedValue({success:true,profile:p})}
function authFail(){(validateApiAuth as jest.Mock).mockResolvedValue({success:false,error:{message:'Unauthorized',status:401}})}
function seed(...s:any[][]){counter=0;results=s}
beforeEach(()=>{counter=0;results=[];jest.clearAllMocks()})
describe('GET /api/agent/pending-actions',()=>{
  it('returns 401',async()=>{authFail();const r=await GET();expect(r.status).toBe(401)})
  it('returns actions shape',async()=>{auth();seed([]);const r=await GET();const b=await r.json();expect(r.status).toBe(200);expect(b).toHaveProperty('actions')})
})
describe('POST /api/agent/pending-actions',()=>{
  it('returns 401',async()=>{authFail();const r=await POST(new Request('http://x',{method:'POST',body:'{}'})as any);expect(r.status).toBe(401)})
  it('returns 400 without action_id',async()=>{auth();const r=await POST(new Request('http://x',{method:'POST',body:'{}'})as any);expect(r.status).toBe(400)})
  it('returns 404 for missing action',async()=>{auth();seed([]);const r=await POST(new Request('http://x',{method:'POST',body:JSON.stringify({action_id:'missing'})})as any);expect(r.status).toBe(404)})
})
