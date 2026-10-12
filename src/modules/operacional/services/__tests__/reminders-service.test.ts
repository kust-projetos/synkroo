/**
 * Revisão de segurança — o log do caminho de enfileiramento de lembretes
 * (`processAllReminders`) NUNCA serializa o erro bruto do banco.
 *
 * O insert que cria o lembrete `queued` + o job de outbox carrega telefone e
 * mensagem do paciente. Quando o statement falha, o erro do Drizzle serializa
 * a query e os parâmetros — e o logger só redige por CHAVE
 * (`SENSITIVE_LOG_KEYS`), nunca por valor. Passar o erro cru adiante
 * (`{ error: err }`) vazaria PII. O contexto logado deve trazer apenas o
 * evento/código FIXO e o id do compromisso (identificador interno).
 */

jest.mock('@/lib/logger', () => ({
  dbLogger: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() },
  whatsappLogger: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() },
}));

jest.mock('../../repositories/reminders-repository', () => ({
  createQueuedReminder: jest.fn(),
  findAppointmentWithJoins: jest.fn(),
  markReminderTriggered: jest.fn(),
}));

import { processAllReminders } from '../reminders-service';
import { whatsappLogger } from '@/lib/logger';
import { createQueuedReminder } from '../../repositories/reminders-repository';
import { resetMockDb, mockDb } from '@/test-utils/db-mock';

const mockLogError = whatsappLogger.error as jest.Mock;
const appointmentId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';

describe('reminders-service — log sanitizado do enfileiramento (review item)', () => {
  /** Resultados das queries encadeadas do `getDb()` na ordem dos awaits. */
  const dbResults: unknown[][] = [];

  beforeEach(() => {
    jest.clearAllMocks();
    dbResults.length = 0;
    resetMockDb();
    // Chain do Drizzle “thenable”: cada terminal (`await`) consome o próximo
    // resultado — `where` direto (janela de compromissos) e `where().limit(1)`
    // (lembrete já enviado / telefone do paciente).
    (mockDb.select as jest.Mock).mockImplementation(() => {
      const builder: Record<string, unknown> = {
        from: () => builder,
        where: () => builder,
        limit: () => builder,
        then: (res: (v: unknown) => unknown, rej: (e: unknown) => unknown) =>
          Promise.resolve(dbResults.length > 0 ? dbResults.shift() : []).then(res, rej),
      };
      return builder;
    });
  });

  it('erro do insert do enqueue NÃO vaza telefone/mensagem do paciente no log', async () => {
    // Marcadores montados dinamicamente (gitleaks-safe): só chegariam ao log
    // se o erro bruto fosse serializado.
    const phone = '+55' + '1198765' + '4321';
    const message = 'Lembrete: sua consulta eh amanha';
    // Erro no formato do Drizzle: mensagem + stack com a query e os PARÂMETROS
    // (telefone e mensagem) do statement que falhou.
    const dbError = Object.assign(
      new Error(`insert into appointment_reminders (...) params: "${phone}", "${message}"`),
      {
        query: 'insert into appointment_reminders (...) values ($1, $2)',
        params: [phone, message],
        stack: `DrizzleQueryError: insert ... params: ${phone}, ${message}`,
      },
    );
    (createQueuedReminder as jest.Mock).mockRejectedValue(dbError);

    // (1) compromisso na janela de 24h; (2) lembrete ainda não enviado;
    // (3) telefone do paciente; (4) nada na janela de 2h.
    dbResults.push(
      [{ id: appointmentId, scheduledAt: new Date(), clinicId: 'c1', patientId: 'p1', dentistId: null, procedureId: null }],
      [],
      [{ phone }],
      [],
    );

    const result = await processAllReminders();

    // Comportamento preservado: o erro conta no resultado do cron.
    expect(result).toEqual({ processed: 0, errors: 1 });
    expect(createQueuedReminder).toHaveBeenCalledTimes(1);

    // Uma única chamada de log — evento fixo, sem o erro bruto.
    expect(mockLogError).toHaveBeenCalledTimes(1);
    const [loggedMessage, loggedError, loggedContext] = mockLogError.mock.calls[0];
    expect(loggedMessage).toBe('Reminder enqueue failed');
    expect(loggedError).toBeNull();
    expect(loggedContext).toEqual({ event: 'REMINDER_ENQUEUE_FAILED', appointmentId });

    // Nenhum marcador de PII/erro cru em tudo que foi logado.
    const logged = mockLogError.mock.calls.map((c) => JSON.stringify(c)).join(' ');
    expect(logged).not.toContain(phone);
    expect(logged).not.toContain(message);
    expect(logged).not.toContain('DrizzleQueryError');
    expect(logged).not.toContain('params');
    // O id do compromisso (identificador interno, sem PII) permanece.
    expect(logged).toContain(appointmentId);
  });

  it('caminho de sucesso não loga erro algum', async () => {
    (createQueuedReminder as jest.Mock).mockResolvedValue({ id: 'rem-1' });
    dbResults.push(
      [{ id: appointmentId, scheduledAt: new Date(), clinicId: 'c1', patientId: 'p1', dentistId: null, procedureId: null }],
      [],
      [{ phone: '+5511999990000' }],
      [],
    );

    const result = await processAllReminders();

    expect(result).toEqual({ processed: 1, errors: 0 });
    expect(mockLogError).not.toHaveBeenCalled();
  });
});
