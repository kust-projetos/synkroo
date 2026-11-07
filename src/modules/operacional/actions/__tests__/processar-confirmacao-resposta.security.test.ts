import { processarConfirmacaoResposta } from '../processar-confirmacao-resposta';

describe('confirmation response tenant boundary', () => {
  it('does not accept a clinic from the request payload', async () => {
    const parsed = processarConfirmacaoResposta.input.safeParse({
      clinicId: 'victim-clinic',
      conversationId: '00000000-0000-0000-0000-000000000001',
      eventId: 'waha:default:evt-1',
    });

    expect(parsed.success).toBe(false);
  });

  it('does not accept model-supplied phone, message, appointment or provider ids', async () => {
    const base = {
      conversationId: '00000000-0000-0000-0000-000000000001',
      eventId: 'waha:default:evt-1',
    };
    expect(processarConfirmacaoResposta.input.safeParse({
      ...base,
      patientPhone: '+5511999999999',
    }).success).toBe(false);
    expect(processarConfirmacaoResposta.input.safeParse({
      ...base,
      appointmentId: '00000000-0000-0000-0000-000000000002',
    }).success).toBe(false);
    expect(processarConfirmacaoResposta.input.safeParse({
      ...base,
      message: 'SIM',
    }).success).toBe(false);
    expect(processarConfirmacaoResposta.input.safeParse({
      ...base,
      senderPhone: '+5511999999999',
    }).success).toBe(false);
    expect(processarConfirmacaoResposta.input.safeParse({
      ...base,
      sender: '+5511999999999',
    }).success).toBe(false);
    expect(processarConfirmacaoResposta.input.safeParse({
      ...base,
      provider: 'waha',
    }).success).toBe(false);
    expect(processarConfirmacaoResposta.input.safeParse({
      ...base,
      content: 'sim',
    }).success).toBe(false);
  });

  it('requires a real inbound event id — text-derived idempotency is rejected', async () => {
    expect(processarConfirmacaoResposta.input.safeParse({
      conversationId: '00000000-0000-0000-0000-000000000001',
    }).success).toBe(false);
    expect(processarConfirmacaoResposta.input.safeParse({
      conversationId: '00000000-0000-0000-0000-000000000001',
      eventId: '',
    }).success).toBe(false);
  });

  it('accepts the trusted shape: conversation + inbound event id only', async () => {
    const parsed = processarConfirmacaoResposta.input.safeParse({
      conversationId: '00000000-0000-0000-0000-000000000001',
      eventId: 'waha:default:evt-1',
    });

    expect(parsed.success).toBe(true);
  });
});
