jest.mock('@/lib/auth/session',()=>({validateApiAuth:jest.fn()}))
const mdb={select:jest.fn(function(this:any){return this}),from:jest.fn(function(this:any){return this}),where:jest.fn(function(this:any){return this}),then:jest.fn()} as any
jest.mock('@/lib/db/client',()=>({getDb:jest.fn(()=>mdb)}))
jest.mock('@/services/treatment-plans/treatment-plan.service',()=>({updateSessionProgress:jest.fn(),getTreatmentPlanProgress:jest.fn()}))
jest.mock('@/lib/errors',()=>{const c=class extends Error{status:number;constructor(m:string,s=400){super(m);this.status=s}};return{handleApiError:jest.fn((e:any)=>({status:500,json:async()=>({error:e?.message||'err'})}) as any),ValidationError:c,NotFoundError:c,DatabaseError:c}})
import{POST,GET}from'@/app/api/treatment-plans/[id]/sessions/route'
import{validateApiAuth}from'@/lib/auth/session'
import{updateSessionProgress}from'@/services/treatment-plans/treatment-plan.service'
function auth(p:any={id:'u1',clinic_id:'c1',role:'owner'}){(validateApiAuth as jest.Mock).mockResolvedValue({success:true,profile:p})}
function authFail(){(validateApiAuth as jest.Mock).mockResolvedValue({success:false,error:{message:'Unauthorized',status:401}})}
function ok(d:any[]){mdb.then=jest.fn((fn:any)=>Promise.resolve(typeof fn==='function'?fn(d):d))}
const rParams={params:Promise.resolve({id:'plan1'})}
beforeEach(()=>jest.clearAllMocks())
describe('POST /api/treatment-plans/[id]/sessions',()=>{
  it('returns 401',async()=>{authFail();const r=await POST(new Request('http://x',{method:'POST',body:'{}'})as any,rParams);expect(r.status).toBe(401)})
  it('returns 404 if plan not found',async()=>{auth();ok([]);const r=await POST(new Request('http://x',{method:'POST',body:JSON.stringify({treatment_plan_item_id:'i1'})})as any,rParams);expect(r.status).toBe(404)})
  it('returns 403 if wrong clinic',async()=>{auth();ok([{id:'plan1',clinicId:'other'}]);const r=await POST(new Request('http://x',{method:'POST',body:JSON.stringify({treatment_plan_item_id:'i1'})})as any,rParams);expect(r.status).toBe(403)})
  it('passes the route plan id to session progress',async()=>{
    auth();
    ok([{id:'plan1',clinicId:'c1'}]);
    (updateSessionProgress as jest.Mock).mockResolvedValue({id:'i1'});
    const r=await POST(new Request('http://x',{method:'POST',body:JSON.stringify({treatment_plan_item_id:'i1'})})as any,rParams);
    expect(r.status).toBe(200);
    expect(updateSessionProgress).toHaveBeenCalledWith('i1','plan1');
  });
})
describe('GET /api/treatment-plans/[id]/sessions',()=>{
  it('returns 401',async()=>{authFail();const r=await GET(new Request('http://x')as any,rParams);expect(r.status).toBe(401)})
})
