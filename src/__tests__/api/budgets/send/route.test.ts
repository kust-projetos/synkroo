jest.mock('@/lib/auth/session',()=>({validateApiAuth:jest.fn()}))
jest.mock('@/core/modules/manifest',()=>require('../../_setup/route-mocks').manifestMock)
jest.mock('@/core/actions/context',()=>require('../../_setup/route-mocks').contextMock)
import{buildUserContext}from'@/core/actions/context'
jest.mock('@/services/budgets/budget.service',()=>({getBudgetById:jest.fn(),markBudgetSent:jest.fn()}))
jest.mock('@/lib/whatsapp/send', () => ({
  sendWhatsAppMessage: jest.fn(),
}))
jest.mock('@/lib/errors',()=>{const c=class extends Error{status:number;constructor(m:string,s=400){super(m);this.status=s}};return{handleApiError:jest.fn((e:any)=>({status:500,json:async()=>({error:e?.message||'err'})}) as any)}})
import{POST}from'@/app/api/budgets/[id]/send/route'
import{validateApiAuth}from'@/lib/auth/session'
import{getBudgetById,markBudgetSent}from'@/services/budgets/budget.service'
function auth(p:any={id:'u1',clinic_id:'c1',role:'owner'}){(validateApiAuth as jest.Mock).mockResolvedValue({success:true,profile:p});(buildUserContext as jest.Mock).mockResolvedValue({source:'user',clinicId:p.clinic_id,user:{id:p.id,email:'u@x.com',name:'U'},can:()=>true,hasModule:()=>true,audit:{actor:p.id}})}
function authFail(){(validateApiAuth as jest.Mock).mockResolvedValue({success:false,error:{message:'Unauthorized',status:401}});(buildUserContext as jest.Mock).mockRejectedValue(new Error('unauthenticated'))}
const rParams={params:Promise.resolve({id:'b1'})}
beforeEach(()=>jest.clearAllMocks())
describe('POST /api/budgets/[id]/send',()=>{
  it('returns 401',async()=>{authFail();const r=await POST(new Request('http://x',{method:'POST',body:'{}'})as any,rParams);expect(r.status).toBe(401)})
  it('returns 404 if budget missing',async()=>{auth();(getBudgetById as jest.Mock).mockResolvedValue(null);const r=await POST(new Request('http://x',{method:'POST',body:'{}'})as any,rParams);expect(r.status).toBe(404)})
  it('returns 403 if wrong clinic',async()=>{auth();(getBudgetById as jest.Mock).mockResolvedValue({id:'b1',clinic_id:'other'});const r=await POST(new Request('http://x',{method:'POST',body:'{}'})as any,rParams);expect(r.status).toBe(403)})
  it('returns success',async()=>{auth();(getBudgetById as jest.Mock).mockResolvedValue({id:'b1',clinic_id:'c1',title:'Test',total_value:100,final_value:100,discount_percent:0,items:[]});(markBudgetSent as jest.Mock).mockResolvedValue({id:'b1',status:'sent'});const r=await POST(new Request('http://x',{method:'POST',body:'{}'})as any,rParams);const b=await r.json();expect(r.status).toBe(200);expect(b.budget.id).toBe('b1');expect(b.whatsapp_sent).toBe(false)})
})
