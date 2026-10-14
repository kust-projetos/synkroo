/**
 * P7 Slice 1 — journey pós-consulta em OBSERVE.
 *
 * Unit puro (sem DB): envelope + tenant, chaves determinísticas, deadlines
 * congelados, derivação do tick (stops, feedback real, deadline/outcome) e
 * garantias estáticas de OBSERVE (zero envio, allowlist P4 e legado intactos).
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import { isPermanentOutboxError } from '@/lib/outbox/errors';
import {
  OUTBOX_OPERATIONS,
  POST_VISIT_JOURNEY_KIND,
  JOURNEY_APPOINTMENT_COMPLETED_VERSION,
  buildJourneyAppointmentCompletedBusinessKey,
  buildJourneySourceEventId,
} from '@/lib/outbox/operations';
import type { OutboxJob } from '@/lib/outbox/outbox-repository';
import {
  JOURNEY_APPOINTMENT_COMPLETED_INVALID_CODE,
  InvalidJourneyAppointmentCompletedError,
  computeJourneyDueAt,
  computeJourneyFeedbackDeadline,
  dispatchJourneyAppointmentCompletedJob,
  parseJourneyAppointmentCompletedPayload,
} from '../dispatch-journey-appointment-completed';
import {
  EXPIRED_NO_FEEDBACK_OUTCOME,
  FEEDBACK_OBSERVED_OUTCOME,
  STOPPED_OUTCOME,
  deriveJourneyStep,
  isRealFeedbackRow,
  tickPostVisitJourney,
  type JourneyInstanceSnapshot,
  type JourneySignals,
} from '../tick-post-visit-journey';
// Isento do gate de boundaries (teste): importa o service do módulo `ia`
// SOMENTE para travar a paridade de versão do envelope encadeado.
import { AI_CONTROL_ENVELOPE_VERSION } from '@/modules/ia/services/dispatch-ai-control-recommend';
import { AI_CONTROL_EXEC_ALLOWLIST } from '@/modules/ia/services/ai-control-executor';

jest.mock('@/lib/outbox/outbox-repository', () => {
  const actual = jest.requireActual('@/lib/outbox/outbox-repository');
  return { ...actual, enqueueOutbox: jest.fn(async () => undefined) };
});

import { enqueueOutbox } from '@/lib/outbox/outbox-repository';

const mockEnqueueOutbox = enqueueOutbox as jest.Mock;

const CLINIC_A = '11111111-1111-4111-8111-111111111111';
const CLINIC_B = '22222222-2222-4222-8222-222222222222';
const APPT_1 = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const APPT_2 = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const OCCURRED = '2026-10-13T12:00:00.000Z';

function envelope(overrides: Record<string, unknown> = {}) {
  return {
    eventId: buildJourneySourceEventId(APPT_1),
    kind: POST_VISIT_JOURNEY_KIND,
    version: JOURNEY_APPOINTMENT_COMPLETED_VERSION,
    occurredAt: OCCURRED,
    appointmentId: APPT_1,
    clinicId: CLINIC_A,
    ...overrides,
  };
}

function job(
  clinicId: string,
  payload: unknown,
  operation: string = OUTBOX_OPERATIONS.JOURNEY_APPOINTMENT_COMPLETED,
): OutboxJob {
  return { clinicId, operation, payload } as OutboxJob;
}

function instance(overrides: Partial<JourneyInstanceSnapshot> = {}): JourneyInstanceSnapshot {
  const occurred = new Date(OCCURRED);
  return {
    id: 'inst-1',
    clinicId: CLINIC_A,
    appointmentId: APPT_1,
    state: 'waiting_due',
    revision: 0,
    dueAt: computeJourneyDueAt(occurred),
    feedbackDeadline: computeJourneyFeedbackDeadline(occurred),
    ...overrides,
  };
}

function signals(overrides: Partial<JourneySignals> = {}): JourneySignals {
  return {
    appointmentExists: true,
    appointmentStatus: 'completed',
    optedOut: false,
    feedback: null,
    ...overrides,
  };
}

beforeEach(() => {
  jest.clearAllMocks();
});

describe('parseJourneyAppointmentCompletedPayload', () => {
  it('aceita envelope válido', () => {
    const parsed = parseJourneyAppointmentCompletedPayload(job(CLINIC_A, envelope()));
    expect(parsed.eventId).toBe(`post_visit:${APPT_1}`);
    expect(parsed.kind).toBe('post_visit');
    expect(parsed.version).toBe(JOURNEY_APPOINTMENT_COMPLETED_VERSION);
  });

  it.each([
    ['operação desconhecida', job(CLINIC_A, envelope(), 'crm.contact.changed')],
    ['eventId ausente', job(CLINIC_A, envelope({ eventId: '' }))],
    ['kind divergente', job(CLINIC_A, envelope({ kind: 'other' }))],
    ['versão divergente', job(CLINIC_A, envelope({ version: 999 }))],
    ['occurredAt inválido', job(CLINIC_A, envelope({ occurredAt: 'not-a-date' }))],
    ['appointmentId ausente', job(CLINIC_A, envelope({ appointmentId: '' }))],
    ['clinicId ausente', job(CLINIC_A, envelope({ clinicId: '' }))],
  ])('rejeita %s como permanente (DLQ, sem retry)', (_label, j) => {
    expect(() => parseJourneyAppointmentCompletedPayload(j)).toThrow(
      InvalidJourneyAppointmentCompletedError,
    );
    try {
      parseJourneyAppointmentCompletedPayload(j);
    } catch (err) {
      expect(isPermanentOutboxError(err)).toBe(true);
    }
    expect(JOURNEY_APPOINTMENT_COMPLETED_INVALID_CODE).toBe(
      'JOURNEY_APPOINTMENT_COMPLETED_INVALID',
    );
  });

  it('tenant descasado (payload B em job A) é permanente, nunca escrita cross-tenant', () => {
    const j = job(CLINIC_A, envelope({ clinicId: CLINIC_B }));
    expect(() => parseJourneyAppointmentCompletedPayload(j)).toThrow(
      InvalidJourneyAppointmentCompletedError,
    );
  });

  it.each([
    ['payload null', null],
    ['payload string', 'not-an-object'],
    ['payload array', [{ eventId: 'x' }]],
  ])('%s é permanente (DLQ imediata, sem retry)', (_label, payload) => {
    expect(() => parseJourneyAppointmentCompletedPayload(job(CLINIC_A, payload))).toThrow(
      InvalidJourneyAppointmentCompletedError,
    );
  });
});

describe('chaves determinísticas (sem aleatoriedade)', () => {
  it('businessKey é JSON da tupla [kind, clinic, appointment]', () => {
    expect(buildJourneyAppointmentCompletedBusinessKey('post_visit', CLINIC_A, APPT_1)).toBe(
      `["post_visit","${CLINIC_A}","${APPT_1}"]`,
    );
  });

  it('sourceEventId é determinístico e distinto por consulta', () => {
    const a = buildJourneySourceEventId(APPT_1);
    expect(a).toBe(buildJourneySourceEventId(APPT_1));
    expect(a).toBe(`post_visit:${APPT_1}`);
    expect(a).not.toBe(buildJourneySourceEventId(APPT_2));
    expect(a).not.toMatch(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}.*[0-9a-f]{8}-/i);
  });
});

describe('deadlines congelados (determinísticos)', () => {
  it('due_at = occurred + 2h exatos', () => {
    const due = computeJourneyDueAt(new Date(OCCURRED));
    expect(due.getTime() - new Date(OCCURRED).getTime()).toBe(2 * 60 * 60 * 1000);
  });

  it('feedback_deadline = occurred + 48h exatos', () => {
    const deadline = computeJourneyFeedbackDeadline(new Date(OCCURRED));
    expect(deadline.getTime() - new Date(OCCURRED).getTime()).toBe(48 * 60 * 60 * 1000);
  });
});

describe('dispatchJourneyAppointmentCompletedJob (consumidor OBSERVE)', () => {
  /** Fake tx que captura inserts e simula `onConflictDoNothing`. */
  function fakeTx() {
    const inserts: Array<{ table: unknown; values: Record<string, unknown> }> = [];
    const tx = {
      inserts,
      insert(table: unknown) {
        return {
          values: (values: Record<string, unknown>) => {
            inserts.push({ table, values });
            return { onConflictDoNothing: jest.fn(async () => undefined) };
          },
        };
      },
    };
    return tx as unknown as { inserts: typeof inserts } & Record<string, unknown>;
  }

  it('hook materializa instância waiting_due com deadlines congelados (AC: materialização)', async () => {
    const hook = await dispatchJourneyAppointmentCompletedJob(job(CLINIC_A, envelope()));
    const tx = fakeTx();
    await (hook as (t: unknown) => Promise<void>)(tx);
    expect(tx.inserts).toHaveLength(1);
    const values = tx.inserts[0]!.values;
    expect(values.clinicId).toBe(CLINIC_A);
    expect(values.appointmentId).toBe(APPT_1);
    expect(values.journeyKind).toBe('post_visit');
    expect(values.sourceEventId).toBe(`post_visit:${APPT_1}`);
    expect(values.definitionVersion).toBe('p7-s1-v1');
    expect(values.state).toBe('waiting_due');
    expect(values.revision).toBe(0);
    expect((values.dueAt as Date).getTime() - new Date(OCCURRED).getTime()).toBe(2 * 60 * 60 * 1000);
    expect((values.feedbackDeadline as Date).getTime() - new Date(OCCURRED).getTime()).toBe(
      48 * 60 * 60 * 1000,
    );
    expect(values.runEventId).toBe(`post_visit:${APPT_1}`);
  });

  it('hook encadeia a run P4 OBSERVE na MESMA transação (AC: run P4)', async () => {
    const hook = await dispatchJourneyAppointmentCompletedJob(job(CLINIC_A, envelope()));
    const tx = fakeTx();
    await (hook as (t: unknown) => Promise<void>)(tx);
    expect(mockEnqueueOutbox).toHaveBeenCalledTimes(1);
    const [usedTx, usedJob] = mockEnqueueOutbox.mock.calls[0] as [unknown, Record<string, unknown>];
    expect(usedTx).toBe(tx);
    expect(usedJob.clinicId).toBe(CLINIC_A);
    expect(usedJob.operation).toBe(OUTBOX_OPERATIONS.AI_CONTROL_RECOMMEND);
    expect(usedJob.businessKey).toBe(`["appointment","${APPT_1}","post_visit:${APPT_1}"]`);
    const payload = usedJob.payload as Record<string, unknown>;
    expect(payload.version).toBe(AI_CONTROL_ENVELOPE_VERSION);
    expect(payload.clinicId).toBe(CLINIC_A);
    expect(payload.type).toBe('appointment.completed');
    expect(payload.subjectId).toBe(APPT_1);
  });

  it('AC replay: segunda liquidação do mesmo envelope produz valores idênticos (1 instância)', async () => {
    const j = job(CLINIC_A, envelope());
    const hook1 = await dispatchJourneyAppointmentCompletedJob(j);
    const hook2 = await dispatchJourneyAppointmentCompletedJob(j);
    const tx1 = fakeTx();
    const tx2 = fakeTx();
    await (hook1 as (t: unknown) => Promise<void>)(tx1);
    await (hook2 as (t: unknown) => Promise<void>)(tx2);
    // Mesma tupla lógica (UNIQUE do banco impõe 1 linha) + mesma chave P4 (UNIQUE do outbox).
    expect(tx1.inserts[0]!.values).toEqual(tx2.inserts[0]!.values);
    const key1 = (mockEnqueueOutbox.mock.calls[0] as [unknown, Record<string, unknown>])[1]
      .businessKey;
    const key2 = (mockEnqueueOutbox.mock.calls[1] as [unknown, Record<string, unknown>])[1]
      .businessKey;
    expect(key1).toBe(key2);
  });

  it('payload de outro tenant nunca gera hook', async () => {
    await expect(
      dispatchJourneyAppointmentCompletedJob(job(CLINIC_A, envelope({ clinicId: CLINIC_B }))),
    ).rejects.toThrow(InvalidJourneyAppointmentCompletedError);
    expect(mockEnqueueOutbox).not.toHaveBeenCalled();
  });
});

describe('isRealFeedbackRow (AC: linha vazia legada NUNCA conta)', () => {
  const expected = { clinicId: CLINIC_A, appointmentId: APPT_1 };
  it('rating não-nulo da mesma consulta+tenant conta', () => {
    expect(
      isRealFeedbackRow({ clinicId: CLINIC_A, appointmentId: APPT_1, rating: 5 }, expected),
    ).toBe(true);
  });

  it.each([
    ['linha nula', null],
    ['linha undefined', undefined],
    ['rating nulo (marcador legado de envio)', { clinicId: CLINIC_A, appointmentId: APPT_1, rating: null }],
    ['rating ausente', { clinicId: CLINIC_A, appointmentId: APPT_1 }],
    ['rating texto', { clinicId: CLINIC_A, appointmentId: APPT_1, rating: 'ótimo' }],
    ['outra consulta', { clinicId: CLINIC_A, appointmentId: APPT_2, rating: 5 }],
    ['outro tenant', { clinicId: CLINIC_B, appointmentId: APPT_1, rating: 5 }],
  ])('%s NÃO conta', (_label, row) => {
    expect(isRealFeedbackRow(row as never, expected)).toBe(false);
  });
});

describe('deriveJourneyStep (máquina de estados pura)', () => {
  const nowDue = new Date(OCCURRED).getTime() + 3 * 60 * 60 * 1000;
  const nowEarly = new Date(OCCURRED).getTime() + 60 * 1000;
  const nowExpired = new Date(OCCURRED).getTime() + 49 * 60 * 60 * 1000;

  it('terminal nunca avança', () => {
    for (const state of ['completed', 'expired', 'stopped']) {
      expect(
        deriveJourneyStep(instance({ state }), signals({ feedback: { rating: 5 } }), nowDue),
      ).toEqual({ advance: false, reason: 'terminal' });
    }
  });

  it('waiting_due antes do vencimento não avança; vencido (até muito depois: restart) avança', () => {
    expect(deriveJourneyStep(instance(), signals(), nowEarly)).toEqual({
      advance: false,
      reason: 'not_due',
    });
    expect(deriveJourneyStep(instance(), signals(), nowDue)).toEqual({
      advance: true,
      to: 'recommended',
      outcome: null,
    });
    // Restart retoma vencido: sem lease, só due_at <= agora importa.
    expect(
      deriveJourneyStep(instance(), signals(), new Date(OCCURRED).getTime() + 30 * 86_400_000),
    ).toEqual({ advance: true, to: 'recommended', outcome: null });
  });

  it('recommended avança para waiting_feedback (sem envio neste slice)', () => {
    expect(deriveJourneyStep(instance({ state: 'recommended' }), signals(), nowDue)).toEqual({
      advance: true,
      to: 'waiting_feedback',
      outcome: null,
    });
  });

  it('waiting_feedback com feedback real conclui (AC: outcome determinístico)', () => {
    expect(
      deriveJourneyStep(
        instance({ state: 'waiting_feedback' }),
        signals({ feedback: { rating: 4 } }),
        nowDue,
      ),
    ).toEqual({ advance: true, to: 'completed', outcome: FEEDBACK_OBSERVED_OUTCOME });
    expect(FEEDBACK_OBSERVED_OUTCOME).toBe('feedback_observed');
  });

  it('waiting_feedback sem feedback dentro da deadline aguarda; após a deadline expira', () => {
    expect(
      deriveJourneyStep(instance({ state: 'waiting_feedback' }), signals(), nowDue),
    ).toEqual({ advance: false, reason: 'awaiting_feedback' });
    expect(
      deriveJourneyStep(instance({ state: 'waiting_feedback' }), signals(), nowExpired),
    ).toEqual({ advance: true, to: 'expired', outcome: EXPIRED_NO_FEEDBACK_OUTCOME });
    expect(EXPIRED_NO_FEEDBACK_OUTCOME).toBe('expired_no_feedback');
  });

  it('AC stop prevalece: stop vence feedback real e avanço normal', () => {
    const withFeedback = signals({ feedback: { rating: 5 } });
    expect(
      deriveJourneyStep(instance({ state: 'waiting_feedback' }), { ...withFeedback, appointmentExists: false, appointmentStatus: null }, nowDue),
    ).toEqual({
      advance: true,
      to: 'stopped',
      outcome: STOPPED_OUTCOME,
      stopReason: 'appointment_deleted',
    });
    expect(
      deriveJourneyStep(instance(), { ...withFeedback, appointmentStatus: 'cancelled' }, nowDue),
    ).toEqual({
      advance: true,
      to: 'stopped',
      outcome: STOPPED_OUTCOME,
      stopReason: 'appointment_no_longer_completed',
    });
    expect(
      deriveJourneyStep(instance(), { ...withFeedback, optedOut: true }, nowDue),
    ).toEqual({
      advance: true,
      to: 'stopped',
      outcome: STOPPED_OUTCOME,
      stopReason: 'opted_out',
    });
    expect(STOPPED_OUTCOME).toBe('stopped');
  });

  it('derivação é determinística (mesmos inputs ⇒ mesmo passo)', () => {
    const inst = instance({ state: 'waiting_feedback' });
    const sig = signals({ feedback: { rating: 3 } });
    expect(deriveJourneyStep(inst, sig, nowDue)).toEqual(deriveJourneyStep(inst, sig, nowDue));
  });
});

describe('tickPostVisitJourney (lote + fence de revision)', () => {
  const nowDue = new Date(OCCURRED).getTime() + 3 * 60 * 60 * 1000;

  it('AC ticks concorrentes: vencedor avança, perdedor (affected=0) dispensa — 1 avanço', async () => {
    const due = [instance(), instance({ id: 'inst-2', revision: 5 })];
    const saveStep = jest
      .fn<Promise<number>, []>()
      .mockResolvedValueOnce(1)
      .mockResolvedValueOnce(0);
    const result = await tickPostVisitJourney({
      now: () => nowDue,
      loadDueInstances: async () => due,
      loadSignals: async () => signals(),
      saveStep: saveStep as never,
    });
    expect(result).toEqual({
      checked: 2,
      advanced: 1,
      completed: 0,
      expired: 0,
      stopped: 0,
      skipped: 1,
    });
  });

  it('conta completed/expired/stopped e skipped em falha de sinais', async () => {
    const nowExpired = new Date(OCCURRED).getTime() + 49 * 60 * 60 * 1000;
    const due = [
      instance({ id: 'a', state: 'waiting_feedback' }),
      instance({ id: 'b', state: 'waiting_feedback' }),
      instance({ id: 'c', state: 'waiting_feedback' }),
      instance({ id: 'd' }),
    ];
    const byId: Record<string, JourneySignals> = {
      a: signals({ feedback: { rating: 5 } }),
      b: signals(),
      c: signals({ optedOut: true }),
      d: signals(),
    };
    const result = await tickPostVisitJourney({
      now: () => nowExpired,
      loadDueInstances: async () => due,
      loadSignals: async (inst) => {
        if (inst.id === 'd') throw new Error('db indisponível');
        return byId[inst.id]!;
      },
      saveStep: async () => 1,
    });
    expect(result).toEqual({
      checked: 4,
      advanced: 3,
      completed: 1,
      expired: 1,
      stopped: 1,
      skipped: 1,
    });
  });

  it('crash entre leitura e escrita não avança parcial (saveStep lança ⇒ skipped, sem throw)', async () => {
    const result = await tickPostVisitJourney({
      now: () => nowDue,
      loadDueInstances: async () => [instance()],
      loadSignals: async () => signals(),
      saveStep: async () => {
        throw new Error('crash simulado');
      },
    });
    expect(result.advanced).toBe(0);
    expect(result.skipped).toBe(1);
  });
});

describe('tick fairness (P7S1-R10 HIGH): last_tick_at + rotação)', () => {
  const nowDue = new Date(OCCURRED).getTime() + 3 * 60 * 60 * 1000;

  it('marca examined em TODA linha avaliada (avanço, sem transição, falha de sinais, falha de escrita)', async () => {
    const due = [
      instance({ id: 'adv' }),
      instance({ id: 'wait', state: 'waiting_feedback' }),
      instance({ id: 'sigfail' }),
      instance({ id: 'savefail' }),
    ];
    const markExamined = jest.fn(async (_inst: JourneyInstanceSnapshot) => undefined);
    const result = await tickPostVisitJourney({
      now: () => nowDue,
      loadDueInstances: async () => due,
      loadSignals: async (inst) => {
        if (inst.id === 'sigfail') throw new Error('sinais indisponíveis');
        return signals();
      },
      saveStep: async (inst) => {
        if (inst.id === 'savefail') throw new Error('escrita falhou');
        return 1;
      },
      markExamined: markExamined as never,
    });
    expect(result).toEqual({
      checked: 4,
      advanced: 1,
      completed: 0,
      expired: 0,
      stopped: 0,
      skipped: 3,
    });
    // TODA linha avaliada marcada — inclusive sem transição e com falha.
    expect(markExamined).toHaveBeenCalledTimes(4);
    const markedIds = markExamined.mock.calls.map(
      (args) => (args[0] as JourneyInstanceSnapshot).id,
    ).sort();
    expect(markedIds).toEqual(['adv', 'savefail', 'sigfail', 'wait']);
  });

  it('falha de markExamined (best-effort) não altera contadores nem propaga', async () => {
    const result = await tickPostVisitJourney({
      now: () => nowDue,
      loadDueInstances: async () => [instance({ id: 'a' }), instance({ id: 'b', state: 'waiting_feedback' })],
      loadSignals: async () => signals(),
      saveStep: async () => 1,
      markExamined: async () => {
        throw new Error('carimbo indisponível');
      },
    });
    expect(result).toEqual({
      checked: 2,
      advanced: 1,
      completed: 0,
      expired: 0,
      stopped: 0,
      skipped: 1,
    });
  });

  it('rotação N+1/lote N: segunda chamada alcança a restante; falha persistente não bloqueia as demais', async () => {
    // Store stateful que replica o contrato do default: seleção por
    // (last_tick_at NULLS FIRST, due_at, id) + carimbo em toda avaliação.
    const store = new Map<string, { snap: JourneyInstanceSnapshot; lastTickAt: number | null }>();
    const base = new Date(OCCURRED).getTime();
    for (const [id, dueOffsetMin] of [['r1', 0], ['r2', 1], ['r3', 2], ['rest', 3]] as const) {
      const snap = instance({ id, dueAt: new Date(base + dueOffsetMin * 60_000) });
      // dueAt precisa ser Date vencido: OCCURRED+2h é o due; nowDue=+3h ⇒ vencido.
      store.set(id, { snap, lastTickAt: null });
    }
    let clock = 1000;
    const order = () =>
      [...store.values()].sort((a, b) => {
        const la = a.lastTickAt;
        const lb = b.lastTickAt;
        if (la === null && lb === null) {
          const da = a.snap.dueAt instanceof Date ? a.snap.dueAt.getTime() : Date.parse(a.snap.dueAt);
          const db = b.snap.dueAt instanceof Date ? b.snap.dueAt.getTime() : Date.parse(b.snap.dueAt);
          return da - db;
        }
        if (la === null) return -1;
        if (lb === null) return 1;
        if (la !== lb) return la - lb;
        return a.snap.id < b.snap.id ? -1 : 1;
      });
    const servedBatches: string[][] = [];
    const loadDueInstances = jest.fn(async (limit: number) => {
      const batch = order().slice(0, limit).map((row) => row.snap);
      servedBatches.push(batch.map((snap) => snap.id));
      return batch;
    });
    const markExamined = jest.fn(async (inst: JourneyInstanceSnapshot) => {
      store.get(inst.id)!.lastTickAt = clock;
      clock += 1;
    });
    const tick = () =>
      tickPostVisitJourney({
        now: () => nowDue,
        batchSize: 3,
        loadDueInstances: loadDueInstances as never,
        loadSignals: async (inst: JourneyInstanceSnapshot) => {
          // 'r2' tem falha PERSISTENTE de sinais (sempre lança).
          if (inst.id === 'r2') throw new Error('poison persistente');
          return signals();
        },
        saveStep: async () => 1,
        markExamined: markExamined as never,
      });

    const first = await tick();
    expect(first.checked).toBe(3);
    // r1 avança, r2 poison (skipped), r3 avança — 'rest' intocada.
    expect(first).toMatchObject({ advanced: 2, skipped: 1 });
    expect(store.get('rest')!.lastTickAt).toBeNull();
    // Poison foi marcada (vai para o fim da fila) sem bloquear as demais.
    expect(store.get('r2')!.lastTickAt).not.toBeNull();

    const second = await tick();
    expect(second.checked).toBe(3);
    // A restante (nunca examinada) é alcançada na segunda chamada.
    expect(servedBatches[1]).toContain('rest');
    // E o lote continua andando: poison reavaliada segue skipped, sem throw.
    expect(second.skipped).toBeGreaterThanOrEqual(1);
  });

  it('estático: seleção default ordena por last_tick_at NULLS FIRST + saveStep carimba', () => {
    const tickSource = fs.readFileSync(
      path.join(__dirname, '..', 'tick-post-visit-journey.ts'),
      'utf8',
    );
    expect(tickSource).toMatch(/lastTickAt.*ASC NULLS FIRST/);
    expect(tickSource).toMatch(/markExamined/);
    expect(tickSource).toMatch(/lastTickAt: new Date\(\)/);
  });
});

describe('OBSERVE estático: zero envio, allowlist P4 e legado intactos (AC)', () => {
  const dispatchSource = fs.readFileSync(
    path.join(__dirname, '..', 'dispatch-journey-appointment-completed.ts'),
    'utf8',
  );
  const tickSource = fs.readFileSync(
    path.join(__dirname, '..', 'tick-post-visit-journey.ts'),
    'utf8',
  );

  it.each([
    ['envio WhatsApp/Evolution', /evolution|sendByChannel|sendFollowUpMessage|send-message-service/i],
    ['gateway de pagamento', /dispatch-charge-job|payment-gateway/i],
    ['provider IA vivo', /provider-zen|openai|minimax|openrouter/i],
    ['fetch externo', /fetch\s*\(/],
    ['handlers de mutação de domínio', /updateLead|createAppointment|dispatchCharge|markCampaignRecipient/i],
    ['processamento legado de follow-up', /processPostConsultationFollowUps|getAppointmentsNeedingFollowUp/],
  ])('consumidor não importa %s', (_label, pattern) => {
    expect(dispatchSource).not.toMatch(pattern);
  });

  it.each([
    ['envio WhatsApp/Evolution', /evolution|sendByChannel|sendFollowUpMessage/i],
    ['gateway de pagamento', /dispatch-charge-job|payment-gateway/i],
    ['fetch externo', /fetch\s*\(/],
    ['handlers de mutação de domínio', /updateLead|createAppointment|dispatchCharge/i],
  ])('tick não importa %s', (_label, pattern) => {
    expect(tickSource).not.toMatch(pattern);
  });

  it('operação registrada no catálogo do outbox', () => {
    expect(OUTBOX_OPERATIONS.JOURNEY_APPOINTMENT_COMPLETED).toBe('journey.appointment.completed');
  });

  it('allowlist P4 intacta (1 action, só leitura verificável)', () => {
    expect(AI_CONTROL_EXEC_ALLOWLIST).toEqual(['operacional.obterPaciente']);
  });

  it('legado de follow-up intacto (exports e envio preservados, sem alteração)', () => {
    const legacy = fs.readFileSync(
      path.join(__dirname, '..', 'followup-service.ts'),
      'utf8',
    );
    expect(legacy).toMatch(/export async function processPostConsultationFollowUps/);
    expect(legacy).toMatch(/export async function sendFollowUpMessage/);
    expect(legacy).toMatch(/export async function getAppointmentsNeedingFollowUp/);
    expect(legacy).not.toMatch(/followup_journey_instances|journey\.appointment\.completed/);
  });
});
