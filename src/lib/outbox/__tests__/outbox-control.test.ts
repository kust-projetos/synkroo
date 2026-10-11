/**
 * Unit — primitivas de controle de manutenção do outbox (sem banco).
 *
 * Cobre o sanitizador de `reason`/`operator` (PII/segredo nunca entram no
 * estado), a resolução do release do consumidor (Cloudflare version metadata
 * onde disponível; desconhecido falha fechado) e a máquina de estados
 * pause/resume com CAS por epoch + drain guard — com db mockado.
 */

type ControlRow = {
  id: number;
  paused: boolean;
  epoch: number;
  reason: string | null;
  operator: string | null;
  releaseId: string | null;
  pausedAt: Date | null;
  resumedAt: Date | null;
  updatedAt: Date | null;
};

const dbState: {
  control: ControlRow | null;
  counts: Record<string, number>;
  sets: unknown[];
  mutationRole: { role_name: string; can_update: boolean };
} = {
  control: null,
  counts: {},
  sets: [],
  mutationRole: { role_name: 'operator', can_update: true },
};

const freshControl = (overrides: Partial<ControlRow> = {}): ControlRow => ({
  id: 1,
  paused: false,
  epoch: 0,
  reason: null,
  operator: null,
  releaseId: null,
  pausedAt: null,
  resumedAt: null,
  updatedAt: null,
  ...overrides,
});

const mockDb: any = {
  select: jest.fn(() => ({
    from: jest.fn(() => ({
      where: jest.fn(() => Object.assign(
        Promise.resolve(dbState.control ? [dbState.control] : []),
        { for: () => Promise.resolve(dbState.control ? [dbState.control] : []) },
      )),
    })),
  })),
  execute: jest.fn(() => Promise.resolve({ rows: [{ ...dbState.counts, ...dbState.mutationRole }] })),
  update: jest.fn(() => ({
    set: jest.fn((values: Record<string, unknown>) => {
      dbState.sets.push(values);
      return {
        where: jest.fn(() => ({
          returning: jest.fn(() => Promise.resolve([{ ...dbState.control, ...values }])),
        })),
      };
    }),
  })),
  transaction: jest.fn((cb: (tx: unknown) => unknown) => cb(mockDb)),
};

jest.mock('@/lib/db/client', () => ({ getDb: () => mockDb }));

import {
  OutboxControlError,
  getOutboxControlStatus,
  pauseOutboxConsumption,
  readControlForClaim,
  resumeOutboxConsumption,
  sanitizeControlText,
  type ResumeOutboxInput,
} from '../control';
import { isArmableRelease, buildClaimMarker, normalizeReleaseId, resolveConsumerRelease } from '../consumer-release';

describe('sanitizeControlText', () => {
  it('devolve null para não-string e para texto vazio', () => {
    expect(sanitizeControlText(undefined)).toBeNull();
    expect(sanitizeControlText(42)).toBeNull();
    expect(sanitizeControlText('   \n\t ')).toBeNull();
  });

  it('preserva texto legítimo de operação', () => {
    expect(sanitizeControlText('  pause for migration 0036 backfill ')).toBe('pause for migration 0036 backfill');
  });

  it('remove caracteres de controle e colapsa espaços', () => {
    expect(sanitizeControlText('a\u0000b\nc\td')).toBe('a b c d');
  });

  it('redige PII e segredos conhecidos', () => {
    const dirty = 'mail maria.silva@example.com cpf 123.456.789-00 tel +55 11 98888-7777 token=example_token_abc123 jwt eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxIn0.abc def';
    const clean = sanitizeControlText(dirty)!;
    expect(clean).not.toContain('maria.silva@example.com');
    expect(clean).not.toContain('123.456.789-00');
    expect(clean).not.toContain('98888-7777');
    expect(clean).not.toContain('example_token_abc123');
    expect(clean).not.toContain('eyJhbGciOiJIUzI1NiJ9');
    expect(clean).toContain('[redacted]');
  });

  it('aplica teto de tamanho', () => {
    expect(sanitizeControlText('ab '.repeat(200))!.length).toBe(200);
    // Run longo (sha/token) é redigido antes do teto.
    expect(sanitizeControlText('x'.repeat(500))).toBe('[redacted]');
  });
});

describe('resolveConsumerRelease', () => {
  it('override explícito vence', () => {
    const cfVersionId = '3f5a1c2b-4d6e-7f80-9a1b-2c3d4e5f6a7b';
    expect(resolveConsumerRelease({
      OUTBOX_RELEASE_ID: 'abcdef0',
      CF_VERSION_METADATA: JSON.stringify({ id: cfVersionId }),
    })).toBe('abcdef0');
  });

  it('usa Cloudflare version metadata quando disponível', () => {
    const cfVersionId = '3f5a1c2b-4d6e-7f80-9a1b-2c3d4e5f6a7b';
    expect(resolveConsumerRelease({ CF_VERSION_METADATA: JSON.stringify({ id: cfVersionId }) })).toBe(cfVersionId);
  });

  it('metadado malformado ou ausente → desconhecido (null)', () => {
    expect(resolveConsumerRelease({ CF_VERSION_METADATA: '{not-json' })).toBeNull();
    expect(resolveConsumerRelease({})).toBeNull();
  });

  it('identidade válida passa intacta — sha completo, UUID e id de versão', () => {
    const sha = 'a'.repeat(64);
    expect(resolveConsumerRelease({ OUTBOX_RELEASE_ID: sha })).toBe(sha);
    expect(resolveConsumerRelease({ OUTBOX_RELEASE_ID: '3f5a1c2b-4d6e-7f80-9a1b-2c3d4e5f6a7b' }))
      .toBe('3f5a1c2b-4d6e-7f80-9a1b-2c3d4e5f6a7b');
    expect(resolveConsumerRelease({ OUTBOX_RELEASE_ID: '3f5a1c2b-4d6e-7f80-9a1b-2c3d4e5f6a7b' }))
      .toBe('3f5a1c2b-4d6e-7f80-9a1b-2c3d4e5f6a7b');
  });

  it('identidade malformada NUNCA vira release (espaço, #, %s, aspas, unicode, >128)', () => {
    for (const bad of [
      'release with spaces',
      'release#1',
      'release%00',
      "release'; DROP TABLE outbox_jobs; --",
      'relëase-ünicode',
      'a'.repeat(129),
      '12345678901',
      'maria.silva',
      '',
      '   ',
    ]) {
      expect(resolveConsumerRelease({ OUTBOX_RELEASE_ID: bad })).toBeNull();
    }
    expect(normalizeReleaseId('  abcdef0  ')).toBe('abcdef0');
    expect(normalizeReleaseId('release#1')).toBeNull();
    expect(normalizeReleaseId(42)).toBeNull();
  });

  it('token de posse amarra release + geração (separador # não ambíguo)', () => {
    expect(buildClaimMarker('abcdef0', 3)).toBe('abcdef0#3');
    expect(buildClaimMarker(null, 0)).toBe('#0');
    expect(buildClaimMarker('', 7)).toBe('#7');
  });

  it('unknown/unknown-case nunca arma o gate', () => {
    expect(isArmableRelease('abcdef0')).toBe(true);
    expect(isArmableRelease('3f5a1c2b-4d6e-7f80-9a1b-2c3d4e5f6a7b')).toBe(true);
    expect(isArmableRelease('a'.repeat(64))).toBe(true);
    expect(isArmableRelease('unknown')).toBe(false);
    expect(isArmableRelease('UNKNOWN')).toBe(false);
    expect(isArmableRelease('  ')).toBe(false);
    expect(isArmableRelease(null)).toBe(false);
  });
});

describe('pause/resume/status (estado singleton)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    dbState.control = freshControl();
    dbState.counts = {};
    dbState.sets = [];
    dbState.mutationRole = { role_name: 'operator', can_update: true };
  });

  it('pause incrementa epoch e grava motivo/operador sanitizados', async () => {
    const paused = await pauseOutboxConsumption({ reason: ' janela de manutenção ', operator: ' operator-a ' });
    expect(paused).toMatchObject({ paused: true, epoch: 1, reason: 'janela de manutenção', operator: 'operator-a' });
    expect(dbState.sets[0]).toMatchObject({ paused: true, epoch: 1 });
  });

  it('pause com razão ausente usa o default e saneia PII', async () => {
    const paused = await pauseOutboxConsumption({ reason: 'contato maria.silva@example.com' });
    expect(paused.reason).toContain('[redacted]');
    const second = await pauseOutboxConsumption({});
    expect(second.reason).toBe('maintenance');
  });

  it('pause duplicado falha fechado com código estático', async () => {
    dbState.control = freshControl({ paused: true, epoch: 3 });
    await expect(pauseOutboxConsumption({})).rejects.toMatchObject({ code: 'OUTBOX_ALREADY_PAUSED' });
  });

  it('runtime role não pode mutar o singleton mesmo se UPDATE escapou nos grants', async () => {
    dbState.mutationRole = { role_name: 'synkroo_app', can_update: true };
    await expect(pauseOutboxConsumption({})).rejects.toMatchObject({ code: 'OUTBOX_CONTROL_ADMIN_REQUIRED' });
    dbState.control = freshControl({ paused: true, epoch: 1 });
    await expect(resumeOutboxConsumption({ expectedEpoch: 1, releaseId: 'abcdef1' }))
      .rejects.toMatchObject({ code: 'OUTBOX_CONTROL_ADMIN_REQUIRED' });
    expect(dbState.sets).toHaveLength(0);
  });

  it('resume exige epoch esperada (CAS), release e estado pausado', async () => {
    dbState.control = freshControl({ paused: true, epoch: 4 });
    await expect(resumeOutboxConsumption({ expectedEpoch: 3, releaseId: 'abcdef1' }))
      .rejects.toMatchObject({ code: 'OUTBOX_EPOCH_MISMATCH' });
    await expect(resumeOutboxConsumption({ expectedEpoch: 4, releaseId: '' }))
      .rejects.toMatchObject({ code: 'OUTBOX_RELEASE_REQUIRED' });
    await expect(resumeOutboxConsumption({ expectedEpoch: 4, releaseId: 'unknown' }))
      .rejects.toMatchObject({ code: 'OUTBOX_RELEASE_UNKNOWN' });

    dbState.control = freshControl({ paused: false, epoch: 4 });
    await expect(resumeOutboxConsumption({ expectedEpoch: 4, releaseId: 'abcdef1' }))
      .rejects.toMatchObject({ code: 'OUTBOX_NOT_PAUSED' });
  });

  it('resume recusa com processing>0 — não existe force (trabalho em voo não é descartado)', async () => {
    dbState.control = freshControl({ paused: true, epoch: 2 });
    dbState.counts = { processing: 3 };
    await expect(resumeOutboxConsumption({ expectedEpoch: 2, releaseId: 'abcdef1' }))
      .rejects.toMatchObject({ code: 'OUTBOX_RESUME_BLOCKED_PROCESSING', details: { processing: 3 } });

    // O antigo `force: true` NÃO existe mais: passá-lo é ignorado (o gate continua
    // fechado). Abandonar lease em voo descartaria um envio já iniciado.
    const stray = { expectedEpoch: 2, releaseId: 'abcdef1', force: true } as unknown as ResumeOutboxInput;
    await expect(resumeOutboxConsumption(stray))
      .rejects.toMatchObject({ code: 'OUTBOX_RESUME_BLOCKED_PROCESSING', details: { processing: 3 } });

    dbState.counts = { processing: 0 };
    const resumed = await resumeOutboxConsumption({ expectedEpoch: 2, releaseId: 'abcdef1' });
    expect(resumed).toMatchObject({ paused: false, epoch: 3, releaseId: 'abcdef1' });
  });

  it('release válido NÃO passa pelo sanitizador de PII (sha completo sobrevive)', async () => {
    dbState.control = freshControl({ paused: true, epoch: 5 });
    dbState.counts = { processing: 0 };
    const sha = 'b'.repeat(64);
    // O sanitizador redigiria runs de 40+ chars: a identidade tem de sair inteira.
    expect(sanitizeControlText(sha)).toBe('[redacted]');
    const resumed = await resumeOutboxConsumption({ expectedEpoch: 5, releaseId: sha, operator: '  op-x ' });
    expect(resumed.releaseId).toBe(sha);
    expect(resumed.operator).toBe('op-x');
  });

  it('release malformado é recusado com código estático, sem tocar o banco', async () => {
    dbState.control = freshControl({ paused: true, epoch: 6 });
    await expect(resumeOutboxConsumption({ expectedEpoch: 6, releaseId: 'release#1' }))
      .rejects.toMatchObject({ code: 'OUTBOX_RELEASE_INVALID' });
    await expect(resumeOutboxConsumption({ expectedEpoch: 6, releaseId: 'rel ease' }))
      .rejects.toMatchObject({ code: 'OUTBOX_RELEASE_INVALID' });
    await expect(resumeOutboxConsumption({ expectedEpoch: 6, releaseId: 'a'.repeat(129) }))
      .rejects.toMatchObject({ code: 'OUTBOX_RELEASE_INVALID' });
    // Nenhuma escrita aconteceu antes da validação.
    expect(dbState.sets).toHaveLength(0);
  });

  it('epoch inválida é recusada antes de tocar o banco', async () => {
    await expect(resumeOutboxConsumption({ expectedEpoch: Number.NaN, releaseId: 'abcdef1' }))
      .rejects.toMatchObject({ code: 'OUTBOX_EPOCH_INVALID' });
    await expect(resumeOutboxConsumption({ expectedEpoch: -1, releaseId: 'abcdef1' }))
      .rejects.toMatchObject({ code: 'OUTBOX_EPOCH_INVALID' });
  });

  it('readControlForClaim falha fechado sem a linha singleton', async () => {
    dbState.control = null;
    await expect(readControlForClaim(mockDb)).rejects.toBeInstanceOf(OutboxControlError);
    dbState.control = freshControl({ paused: true, releaseId: 'abcdef1' });
    await expect(readControlForClaim(mockDb)).resolves.toEqual({ paused: true, releaseId: 'abcdef1' });
  });

  it('status: drained só com processing=0; stale processing é observável e não prova drain', async () => {
    dbState.control = freshControl({ paused: true, epoch: 2, reason: 'janela', releaseId: 'abcdef1' });
    dbState.counts = { pending: 4, processing: 2, delivered: 10, dead_letter: 1, cancelled: 3, stale_processing: 2 };
    const status = await getOutboxControlStatus();
    expect(status.counts).toEqual({ pending: 4, processing: 2, delivered: 10, deadLetter: 1, cancelled: 3, staleProcessing: 2 });
    expect(status.drained).toBe(false);
    expect(status.leaseMs).toBe(5 * 60 * 1000);

    dbState.counts = { pending: 0, processing: 0, delivered: 10, dead_letter: 1, cancelled: 3, stale_processing: 0 };
    expect((await getOutboxControlStatus()).drained).toBe(true);
  });

  it('status falha fechado sem a linha singleton', async () => {
    dbState.control = null;
    await expect(getOutboxControlStatus()).rejects.toMatchObject({ code: 'OUTBOX_CONTROL_UNAVAILABLE' });
  });
});
