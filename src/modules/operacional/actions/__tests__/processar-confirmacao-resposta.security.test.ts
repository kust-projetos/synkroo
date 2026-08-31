import { processarConfirmacaoResposta } from '../processar-confirmacao-resposta';

describe('confirmation response tenant boundary', () => {
  it('does not accept a clinic from the request payload', async () => {
    const parsed = processarConfirmacaoResposta.input.safeParse({
      clinicId: 'victim-clinic',
      patientPhone: '+5511999999999',
      message: 'SIM',
    });

    expect(parsed.success).toBe(false);
  });
});
