import { processarConfirmacaoResposta } from '../processar-confirmacao-resposta';
import { processConfirmationResponse } from '@/services/appointments/confirmation-handler.service';

jest.mock('@/services/appointments/confirmation-handler.service', () => ({
  processConfirmationResponse: jest.fn().mockResolvedValue({ processed: false, action: 'no_action' }),
}));

describe('confirmation response tenant boundary', () => {
  it('does not accept a clinic from the request payload', async () => {
    const parsed = processarConfirmacaoResposta.input.safeParse({
      clinicId: 'victim-clinic',
      patientPhone: '+5511999999999',
      message: 'SIM',
    });

    expect(parsed.success).toBe(false);
    expect(processConfirmationResponse).not.toHaveBeenCalled();
  });
});
