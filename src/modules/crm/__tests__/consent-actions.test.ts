import { ActionError } from '@/core/actions/types';
import { concederConsentimento } from '../actions/conceder-consentimento';
import { listarConsentimentos } from '../actions/listar-consentimentos';
import { revogarConsentimento } from '../actions/revogar-consentimento';
import {
  grantConsentForContact,
  listConsentsForContact,
  revokeConsentForContact,
} from '../public';

jest.mock('../public', () => ({
  grantConsentForContact: jest.fn(),
  listConsentsForContact: jest.fn(),
  revokeConsentForContact: jest.fn(),
  revokeConsentById: jest.fn(),
}));

const ctx = {
  source: 'user' as const,
  clinicId: '00000000-0000-4000-8000-000000000001',
  user: { id: '00000000-0000-4000-8000-000000000002', email: 'u@example.com', name: 'User' },
  role: 'Administrador',
  can: () => true,
  hasModule: () => true,
  audit: { actor: '00000000-0000-4000-8000-000000000002' },
};

const patientId = '00000000-0000-4000-8000-000000000003';

beforeEach(() => jest.clearAllMocks());

describe('CRM consent actions', () => {
  it('passes the trusted clinic and actor to the grant port', async () => {
    (grantConsentForContact as jest.Mock).mockResolvedValue({ id: 'consent-1', granted: true });
    const input = concederConsentimento.input.parse({
      contactId: patientId,
      contactType: 'patient',
      purpose: 'marketing',
      channel: 'web',
    });
    await expect(concederConsentimento.handler(input, ctx)).resolves.toMatchObject({ granted: true });
    expect(grantConsentForContact).toHaveBeenCalledWith(ctx.clinicId, expect.objectContaining({
      contactId: patientId,
      contactType: 'patient',
      actorUserId: ctx.user.id,
    }));
  });

  it('rejects a forged actor field before the handler', () => {
    expect(() => concederConsentimento.input.parse({
      contactId: patientId,
      contactType: 'patient',
      purpose: 'marketing',
      actor: 'forged',
    })).toThrow();
  });

  it('fails closed when the contact belongs to another clinic', async () => {
    (listConsentsForContact as jest.Mock).mockResolvedValue(null);
    const input = listarConsentimentos.input.parse({ contactId: patientId, contactType: 'patient' });
    await expect(listarConsentimentos.handler(input, ctx)).rejects.toMatchObject({ code: 'not_found' });
    expect(listConsentsForContact).toHaveBeenCalledWith(ctx.clinicId, patientId, 'patient');
  });

  it('revokes by a tenant-scoped contact and never accepts actor from input', async () => {
    (revokeConsentForContact as jest.Mock).mockResolvedValue({ id: 'consent-1', granted: false });
    const input = revogarConsentimento.input.parse({
      contactId: patientId,
      contactType: 'patient',
      purpose: 'marketing',
    });
    await expect(revogarConsentimento.handler(input, ctx)).resolves.toMatchObject({ granted: false });
    expect(revokeConsentForContact).toHaveBeenCalledWith(ctx.clinicId, expect.objectContaining({
      actorUserId: ctx.user.id,
      purpose: 'marketing',
    }));
  });

  it('maps an absent consent to not_found', async () => {
    (revokeConsentForContact as jest.Mock).mockResolvedValue(null);
    const input = revogarConsentimento.input.parse({
      contactId: patientId,
      contactType: 'patient',
      purpose: 'marketing',
    });
    await expect(revogarConsentimento.handler(input, ctx)).rejects.toBeInstanceOf(ActionError);
  });
});
