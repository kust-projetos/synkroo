/** Tests for ROI Service — Drizzle mocks */
import { calculateROI, getROIMetrics } from '@/services/analytics/roi.service'

jest.mock('@/lib/logger',()=>({dbLogger:{error:jest.fn(),info:jest.fn()}}))

let counter=0, results:any[][]=[], lastResult:any[]=[]
/** Modo de falha: a Nª query rejeita (simula erro de DB). */
let failAt=-1
const mdb = {
  select: jest.fn(function(this:any){return this}),
  from: jest.fn(function(this:any){return this}),
  where: jest.fn(function(this:any,arg:any){whereArgs.push(arg);return this}),
  innerJoin: jest.fn(function(this:any){return this}),
  // Thenable de verdade: o `await` do service encadeia nos handlers, então a
  // rejeição precisa passar por `onRejected` (devolver a promise rejeitada sem
  // chamar o handler deixaria o await pendurado).
  then: jest.fn(function(this:any,onF:any,onR:any){
    const idx=counter++
    const pending=failAt===idx
      ?Promise.reject(new Error('db down'))
      :Promise.resolve(results[idx]??lastResult)
    return pending.then(
      d=>(typeof onF==='function'?onF(d):d),
      e=>(typeof onR==='function'?onR(e):Promise.reject(e)),
    )
  }),
} as any
jest.mock('@/lib/db/client',()=>{
  let d:any=null
  return {getDb:jest.fn(()=>{if(!d)d=mdb;return d})}
})

/** Argumentos de `.where()` de cada query, na ordem de execução. */
let whereArgs:any[]=[]
/**
 * Compila a expressão SQL do Drizzle no dialect Postgres — é assim que o teste
 * inspeciona os valores reais que iriam para o banco, já que o mock não
 * executa SQL. Retorna { sql, params }.
 */
function compileWhere(node:any):{sql:string;params:unknown[]}{
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { PgDialect }=require('drizzle-orm/pg-core')
  return new PgDialect().sqlToQuery(node)
}

function seed(...seeded:any[][]){counter=0;whereArgs=[];results=seeded;lastResult=seeded[seeded.length-1]??[]}
beforeEach(()=>{counter=0;results=[];lastResult=[];whereArgs=[];failAt=-1;jest.clearAllMocks();mdb.then.mockClear()})
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

  // ─── Taxonomy regression (P1 analytics) ─────────────────────────────────
  // O proxy de intents usava literais em inglês ('schedule_appointment', 'book',
  // 'reschedule', 'confirm_appointment') que NUNCA são gravados em
  // messages.intent — a coluna recebe a taxonomia pt-BR de
  // modules/atendimento. appointmentsBooked era SEMPRE 0 (receita fabricada).
  describe('proxy de intents usa a taxonomia realmente gravada',()=>{
    it('filtra pela taxonomia pt-BR realmente gravada em messages.intent',async()=>{
      seed([{count:7}],[{count:7}],[{count:7}],[{count:7}])
      await calculateROI(cid,ps,pe)
      // 2ª query do período é o proxy de agendamentos (innerJoin conversations).
      const { params }=compileWhere(whereArgs[1])
      expect(params).toEqual(expect.arrayContaining(['agendamento','reagendamento']))
    })

    // Regra de negócio: `confirmacao` responde a processConfirmationResponse —
    // confirma agendamento JÁ EXISTENTE. Contá-la infla appointmentsBooked e,
    // ao multiplicar por DEFAULT_AVG_TICKET, fabrica receita para consultas que
    // o agente nunca agendou.
    it('exclui `confirmacao`: confirma agendamento existente, não cria um',async()=>{
      seed([{count:7}],[{count:7}],[{count:7}],[{count:7}])
      await calculateROI(cid,ps,pe)
      const { sql, params }=compileWhere(whereArgs[1])
      const all=[sql,...params.map(String)]
      expect(params).not.toContain('confirmacao')
      expect(all).not.toContain('confirmacao')
    })

    it('exclui `cancelamento`: reduz agenda, não cria agendamento',async()=>{
      seed([{count:7}],[{count:7}],[{count:7}],[{count:7}])
      await calculateROI(cid,ps,pe)
      const { sql, params }=compileWhere(whereArgs[1])
      const all=[sql,...params.map(String)]
      expect(all).not.toContain('cancelamento')
    })

    it('não consulta mais os literais em inglês que nunca são gravados',async()=>{
      seed([{count:7}],[{count:7}],[{count:7}],[{count:7}])
      await calculateROI(cid,ps,pe)
      const { sql, params }=compileWhere(whereArgs[1])
      const all=[sql,...params.map(String)]
      for(const ghost of ['schedule_appointment','confirm_appointment','reschedule']){
        expect(all).not.toContain(ghost)
      }
    })

    it('exige direction=outbound (intent é gravado na resposta do agente)',async()=>{
      seed([{count:7}],[{count:7}],[{count:7}],[{count:7}])
      await calculateROI(cid,ps,pe)
      const { sql, params }=compileWhere(whereArgs[1])
      const all=[sql,...params.map(String)]
      expect(all).toContain('outbound')
    })

    it('não usa `as any` nos filtros (typecheck volta a ser a guarda estrutural)',async()=>{
      const { readFileSync } = await import('node:fs')
      const src = readFileSync(
        require.resolve('@/services/analytics/roi.service').replace(/\.ts$/, '.ts'),
        'utf8'
      )
      expect(src).not.toMatch(/messages\.intent as any/)
      expect(src).not.toMatch(/appointments\.status as any/)
    })

    it('aproveita agendamentos reais: booked=2 gera receita de 700',async()=>{
      seed([{count:2}],[{count:2}],[{count:2}],[{count:2}])
      const r=await calculateROI(cid,ps,pe)
      expect(r.savings.messagesHandled).toBe(2)
      expect(r.revenue.appointmentsBooked).toBe(2)
      expect(r.revenue.totalRevenue).toBe(700)
    })
  })

  // ─── Fail-closed (P1 analytics) ─────────────────────────────────────────
  // ROI zerado é indistinguível de "clínica sem atividade" e gera decisão
  // comercial errada — erro de DB precisa propagar.
  describe('fail-closed em erro de DB',()=>{
    it('calculateROI propaga erro de qualquer subquery',async()=>{
      seed([],[],[],[]);failAt=0
      await expect(calculateROI(cid,ps,pe)).rejects.toThrow('db down')
    })
    it('calculateROI propaga erro na contagem de agendamentos',async()=>{
      seed([],[],[],[]);failAt=1
      await expect(calculateROI(cid,ps,pe)).rejects.toThrow('db down')
    })
    it('calculateROI propaga erro na contagem de no-shows recuperados',async()=>{
      seed([],[],[],[]);failAt=2
      await expect(calculateROI(cid,ps,pe)).rejects.toThrow('db down')
    })
    it('getROIMetrics propaga erro em vez de devolver ROI zerado',async()=>{
      seed([],[],[],[],[],[]);failAt=0
      await expect(getROIMetrics(cid,'month','2026-06-01')).rejects.toThrow('db down')
    })
    it('getROIMetrics propaga erro do período anterior (comparISON não fabricável)',async()=>{
      seed([],[],[],[],[],[]);failAt=3
      await expect(getROIMetrics(cid,'month','2026-06-01')).rejects.toThrow('db down')
    })
    it('não devolve objeto com roi=0 quando o DB falha',async()=>{
      seed([],[],[],[],[],[]);failAt=0
      const outcome=await getROIMetrics(cid,'month','2026-06-01').then(v=>({ok:true,v}),e=>({ok:false,e}))
      expect(outcome.ok).toBe(false)
    })
  })
})
