jest.mock('@/lib/auth/session',()=>({validateApiAuth:jest.fn()}))
jest.mock('@/modules/financeiro/services/budget-service', () => ({
  getBudget: jest.fn(),
  markBudgetSent: jest.fn(),
}))
jest.mock('@/lib/whatsapp/send', () => ({
  sendWhatsAppMessage: jest.fn(),
}))

import{validateApiAuth}from'@/lib/auth/session'
import{getBudget,markBudgetSent}from'@/modules/financeiro/services/budget-service'
import{POST}from'@/app/api/budgets/[id]/send/route'

function auth(p:any={id:'u1',clinic_id:'c1',role:'owner'}){(validateApiAuth as jest.Mock).mockResolvedValue({success:true,profile:p})}
function authFail(){(validateApiAuth as jest.Mock).mockResolvedValue({success:false,error:{message:'Unauthorized',status:401}})}
const rParams={params:Promise.resolve({id:'b1'})}
beforeEach(()=>jest.clearAllMocks())

describe('POST /api/budgets/[id]/send',()=>{
  it('returns 401',async()=>{authFail();const r=await POST(new Request('http://x',{method:'POST',body:'{}'})as any,rParams);expect(r.status).toBe(401)})
  it('returns 404 if budget missing',async()=>{auth();(getBudget as jest.Mock).mockResolvedValue(null);const r=await POST(new Request('http://x',{method:'POST',body:'{}'})as any,rParams);expect(r.status).toBe(404)})
  it('returns 403 if wrong clinic',async()=>{auth();(getBudget as jest.Mock).mockResolvedValue({id:'b1',clinic_id:'other'});const r=await POST(new Request('http://x',{method:'POST',body:'{}'})as any,rParams);expect(r.status).toBe(403)})
  it('returns success',async()=>{
    auth();
    (getBudget as jest.Mock).mockResolvedValue({id:'b1',clinicId:'c1',title:'Test',total_value:100,final_value:100,discount_percent:0,items:[]});
    (markBudgetSent as jest.Mock).mockResolvedValue({id:'b1',status:'sent'});
    const r=await POST(new Request('http://x',{method:'POST',body:'{}'})as any,rParams);
    const b=await r.json();
    expect(r.status).toBe(200);
    // Envelope canônico (R2): { data: { budget, whatsapp_sent, whatsapp_error } }
    expect(b.data.budget.id).toBe('b1');
    expect(b.data.whatsapp_sent).toBe(false);
  })
})
