/**
 * Unit & Contract tests for Recipient Phone Resolver & Pre-Dispatch Validation (F7.03)
 */

import {
  validateAndFormatPhone,
  resolveRecipientPhone,
} from '../phone-resolver';

// Mock DB client for patient lookup
const mockGetDb = jest.fn();
jest.mock('@/lib/db/client', () => ({
  getDb: () => mockGetDb(),
}));

describe('Recipient Phone Resolver & Pre-Dispatch Validation (F7.03)', () => {
  const CLINIC_ID = '00000000-0000-0000-0000-00000000000a';
  const PATIENT_ID = '00000000-0000-0000-0000-000000000001';

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('validateAndFormatPhone synchronous validator', () => {
    it('formats 11-digit Brazilian mobile numbers with DDD to standard format', () => {
      const inputs = [
        '11987654321',
        '(11) 98765-4321',
        '+55 (11) 98765-4321',
        '5511987654321',
        '+5511987654321',
      ];

      for (const input of inputs) {
        const res = validateAndFormatPhone(input);
        expect(res.ok).toBe(true);
        if (res.ok) {
          expect(res.phone).toBe('5511987654321');
          expect(res.e164).toBe('+5511987654321');
          expect(res.ddd).toBe('11');
          expect(res.isMobile).toBe(true);
        }
      }
    });

    it('formats 10-digit Brazilian landline numbers with DDD', () => {
      const input = '(11) 3456-7890';
      const res = validateAndFormatPhone(input);
      expect(res.ok).toBe(true);
      if (res.ok) {
        expect(res.phone).toBe('551134567890');
        expect(res.e164).toBe('+551134567890');
        expect(res.ddd).toBe('11');
        expect(res.isMobile).toBe(false);
      }
    });

    it('rejects null, undefined, or empty string with missing_phone', () => {
      const r1 = validateAndFormatPhone(null);
      expect(r1.ok).toBe(false);
      if (!r1.ok) expect(r1.error).toBe('missing_phone');

      const r2 = validateAndFormatPhone(undefined);
      expect(r2.ok).toBe(false);
      if (!r2.ok) expect(r2.error).toBe('missing_phone');

      const r3 = validateAndFormatPhone('');
      expect(r3.ok).toBe(false);
      if (!r3.ok) expect(r3.error).toBe('missing_phone');

      const r4 = validateAndFormatPhone('   ');
      expect(r4.ok).toBe(false);
      if (!r4.ok) expect(r4.error).toBe('missing_phone');
    });

    it('rejects invalid Brazilian DDD (e.g. 00, 01, 10)', () => {
      const res1 = validateAndFormatPhone('00987654321');
      expect(res1.ok).toBe(false);
      if (!res1.ok) expect(res1.error).toBe('invalid_ddd');

      const res2 = validateAndFormatPhone('01987654321');
      expect(res2.ok).toBe(false);
      if (!res2.ok) expect(res2.error).toBe('invalid_ddd');
    });

    it('rejects numbers with invalid length (too short or too long)', () => {
      const resShort = validateAndFormatPhone('119999');
      expect(resShort.ok).toBe(false);
      if (!resShort.ok) expect(resShort.error).toBe('invalid_length');

      const resLong = validateAndFormatPhone('5511999999999999999');
      expect(resLong.ok).toBe(false);
      if (!resLong.ok) expect(resLong.error).toBe('invalid_length');
    });

    it('rejects repetitive/dummy bogus numbers', () => {
      const dummyNumbers = [
        '11999999999', // All same digits in body
        '11000000000',
        '00000000000',
        '12345678901',
      ];

      for (const num of dummyNumbers) {
        const res = validateAndFormatPhone(num);
        expect(res.ok).toBe(false);
        if (!res.ok) {
          expect(['dummy_number', 'invalid_ddd', 'invalid_mobile_digit']).toContain(res.error);
        }
      }
    });

    it('validates and formats international numbers starting with +', () => {
      const usNumber = '+1 (415) 555-2671';
      const res = validateAndFormatPhone(usNumber);
      expect(res.ok).toBe(true);
      if (res.ok) {
        expect(res.e164).toBe('+14155552671');
        expect(res.phone).toBe('14155552671');
      }
    });
  });

  describe('resolveRecipientPhone async resolver with patient fallback', () => {
    it('resolves directly when valid phone is provided in input', async () => {
      const res = await resolveRecipientPhone({
        phone: '(21) 98888-7777',
      });

      expect(res.ok).toBe(true);
      if (res.ok) {
        expect(res.phone).toBe('5521988887777');
        expect(res.source).toBe('direct');
      }
    });

    it('fetches and resolves patient phone from DB when direct phone is missing', async () => {
      const mockSelect = jest.fn().mockReturnValue({
        from: jest.fn().mockReturnValue({
          where: jest.fn().mockReturnValue({
            limit: jest.fn().mockResolvedValue([
              { id: PATIENT_ID, clinicId: CLINIC_ID, phone: '(31) 97777-6666' },
            ]),
          }),
        }),
      });
      mockGetDb.mockReturnValue({ select: mockSelect });

      const res = await resolveRecipientPhone({
        patientId: PATIENT_ID,
        clinicId: CLINIC_ID,
      });

      expect(res.ok).toBe(true);
      if (res.ok) {
        expect(res.phone).toBe('5531977776666');
        expect(res.source).toBe('patient_record');
      }
    });

    it('returns missing_phone when patient has no phone in DB', async () => {
      const mockSelect = jest.fn().mockReturnValue({
        from: jest.fn().mockReturnValue({
          where: jest.fn().mockReturnValue({
            limit: jest.fn().mockResolvedValue([
              { id: PATIENT_ID, clinicId: CLINIC_ID, phone: null },
            ]),
          }),
        }),
      });
      mockGetDb.mockReturnValue({ select: mockSelect });

      const res = await resolveRecipientPhone({
        patientId: PATIENT_ID,
        clinicId: CLINIC_ID,
      });

      expect(res.ok).toBe(false);
      if (!res.ok) {
        expect(res.error).toBe('missing_phone');
      }
    });

    it('returns patient_not_found when patient record does not exist', async () => {
      const mockSelect = jest.fn().mockReturnValue({
        from: jest.fn().mockReturnValue({
          where: jest.fn().mockReturnValue({
            limit: jest.fn().mockResolvedValue([]),
          }),
        }),
      });
      mockGetDb.mockReturnValue({ select: mockSelect });

      const res = await resolveRecipientPhone({
        patientId: PATIENT_ID,
        clinicId: CLINIC_ID,
      });

      expect(res.ok).toBe(false);
      if (!res.ok) {
        expect(res.error).toBe('patient_not_found');
      }
    });
  });
});
