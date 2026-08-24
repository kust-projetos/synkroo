/**
 * Recipient Phone Resolver & Pre-Dispatch Validator (F7.03 / O3-G09)
 *
 * Enforces recipient-first outbox flow:
 * 1. Validates and formats Brazilian (10/11 digits) and international E.164 phone numbers.
 * 2. Rejects dummy/bogus, invalid DDD, invalid mobile digits, or malformed numbers before dispatch.
 * 3. Resolves missing direct phones from patient records with tenant scoping.
 */

import { and, eq } from 'drizzle-orm';
import { getDb } from '@/lib/db/client';
import { patients } from '@/modules/operacional/schema';

export type PhoneValidationError =
  | 'missing_phone'
  | 'invalid_phone_format'
  | 'invalid_ddd'
  | 'invalid_length'
  | 'invalid_mobile_digit'
  | 'dummy_number';

export interface PhoneValidationSuccess {
  ok: true;
  phone: string; // Standard clean digits with country code e.g. 5511987654321
  e164: string; // E.164 format e.g. +5511987654321
  ddd?: string;
  isMobile?: boolean;
}

export interface PhoneValidationFailure {
  ok: false;
  error: PhoneValidationError;
  message: string;
}

export type PhoneValidationResult = PhoneValidationSuccess | PhoneValidationFailure;

export interface ResolvePhoneInput {
  phone?: string | null;
  patientId?: string;
  clinicId?: string;
}

export type PhoneResolutionError =
  | PhoneValidationError
  | 'patient_not_found'
  | 'missing_clinic_context';

export interface PhoneResolutionSuccess extends PhoneValidationSuccess {
  source: 'direct' | 'patient_record';
}

export interface PhoneResolutionFailure {
  ok: false;
  error: PhoneResolutionError;
  message: string;
}

export type PhoneResolutionResult = PhoneResolutionSuccess | PhoneResolutionFailure;

// Valid Brazilian DDDs
const VALID_BRAZILIAN_DDDS = new Set([
  '11', '12', '13', '14', '15', '16', '17', '18', '19', // SP
  '21', '22', '24', // RJ
  '27', '28', // ES
  '31', '32', '33', '34', '35', '37', '38', // MG
  '41', '42', '43', '44', '45', '46', // PR
  '47', '48', '49', // SC
  '51', '53', '54', '55', // RS
  '61', // DF/GO
  '62', '64', // GO
  '63', // TO
  '65', '66', // MT
  '67', // MS
  '68', // AC
  '69', // RO
  '71', '73', '74', '75', '77', // BA
  '79', // SE
  '81', '87', // PE
  '82', // AL
  '83', // PB
  '84', // RN
  '85', '88', // CE
  '86', '89', // PI
  '91', '93', '94', // PA
  '92', '97', // AM
  '95', // RR
  '96', // AP
  '98', '99', // MA
]);

// Dummy repetitive numbers to reject
const DUMMY_SEQUENCES = [
  '00000000',
  '11111111',
  '22222222',
  '33333333',
  '44444444',
  '55555555',
  '66666666',
  '77777777',
  '88888888',
  '99999999',
  '12345678',
];

/**
 * Validates and formats a raw phone number.
 */
export function validateAndFormatPhone(rawPhone: string | null | undefined): PhoneValidationResult {
  if (!rawPhone || typeof rawPhone !== 'string' || rawPhone.trim().length === 0) {
    return {
      ok: false,
      error: 'missing_phone',
      message: 'Telefone do destinatário é obrigatório.',
    };
  }

  const trimmed = rawPhone.trim();
  const digitsOnly = trimmed.replace(/\D/g, '');

  if (digitsOnly.length < 8 || digitsOnly.length > 15) {
    return {
      ok: false,
      error: 'invalid_length',
      message: `Tamanho de telefone inválido (${digitsOnly.length} dígitos).`,
    };
  }

  // Check for dummy sequence in digits
  for (const seq of DUMMY_SEQUENCES) {
    if (digitsOnly.includes(seq)) {
      return {
        ok: false,
        error: 'dummy_number',
        message: 'Número de telefone fictício ou repetitivo inválido.',
      };
    }
  }

  // Check if international (starts with '+' or country code other than 55 and length > 11)
  const isExplicitInternational = trimmed.startsWith('+') && !digitsOnly.startsWith('55');
  if (isExplicitInternational) {
    return {
      ok: true,
      phone: digitsOnly,
      e164: `+${digitsOnly}`,
    };
  }

  // Brazilian number parsing
  let brDigits = digitsOnly;
  if (brDigits.startsWith('55') && (brDigits.length === 12 || brDigits.length === 13)) {
    brDigits = brDigits.slice(2);
  }

  if (brDigits.length !== 10 && brDigits.length !== 11) {
    // If not a standard BR 10/11 digit format, treat as international if starting with non-55
    if (digitsOnly.length >= 10 && !digitsOnly.startsWith('55')) {
      return {
        ok: true,
        phone: digitsOnly,
        e164: `+${digitsOnly}`,
      };
    }

    return {
      ok: false,
      error: 'invalid_length',
      message: `Número brasileiro deve ter 10 (fixo) ou 11 (celular) dígitos com DDD. Recebido: ${brDigits.length}.`,
    };
  }

  const ddd = brDigits.slice(0, 2);
  if (!VALID_BRAZILIAN_DDDS.has(ddd)) {
    return {
      ok: false,
      error: 'invalid_ddd',
      message: `DDD brasileiro '${ddd}' inválido.`,
    };
  }

  const numberPart = brDigits.slice(2);
  const isMobile = brDigits.length === 11;

  if (isMobile) {
    const firstDigit = numberPart[0];
    if (firstDigit !== '9') {
      return {
        ok: false,
        error: 'invalid_mobile_digit',
        message: `Celular brasileiro deve iniciar com 9. Recebido: '${firstDigit}'.`,
      };
    }
  }

  const formattedPhone = `55${brDigits}`;
  const e164 = `+55${brDigits}`;

  return {
    ok: true,
    phone: formattedPhone,
    e164,
    ddd,
    isMobile,
  };
}

/**
 * Asynchronously resolves and validates recipient phone number, falling back to patient record if needed.
 */
export async function resolveRecipientPhone(
  input: ResolvePhoneInput,
): Promise<PhoneResolutionResult> {
  // 1. If direct phone provided, validate it first
  if (input.phone && input.phone.trim().length > 0) {
    const valid = validateAndFormatPhone(input.phone);
    if (valid.ok) {
      return {
        ...valid,
        source: 'direct',
      };
    }
    // If phone was provided but is invalid, fail closed
    return valid;
  }

  // 2. Fallback: Query patient record
  if (input.patientId) {
    if (!input.clinicId) {
      return {
        ok: false,
        error: 'missing_clinic_context',
        message: 'clinicId é obrigatório para resolver telefone de paciente.',
      };
    }

    try {
      const db = getDb();
      const [patient] = await db
        .select({ id: patients.id, phone: patients.phone })
        .from(patients)
        .where(and(eq(patients.id, input.patientId), eq(patients.clinicId, input.clinicId)))
        .limit(1);

      if (!patient) {
        return {
          ok: false,
          error: 'patient_not_found',
          message: `Paciente '${input.patientId}' não encontrado na clínica.`,
        };
      }

      if (!patient.phone) {
        return {
          ok: false,
          error: 'missing_phone',
          message: 'Paciente cadastrado não possui número de telefone.',
        };
      }

      const valid = validateAndFormatPhone(patient.phone);
      if (!valid.ok) {
        return valid;
      }

      return {
        ...valid,
        source: 'patient_record',
      };
    } catch (err) {
      return {
        ok: false,
        error: 'missing_phone',
        message: `Falha ao buscar telefone do paciente: ${(err as Error)?.message}`,
      };
    }
  }

  return {
    ok: false,
    error: 'missing_phone',
    message: 'Nenhum telefone direto ou identificador de paciente fornecido.',
  };
}
