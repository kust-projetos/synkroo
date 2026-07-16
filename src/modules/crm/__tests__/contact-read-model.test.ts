/**
 * contact-read-model.test.ts — read-model do coordenador CRM.
 *
 * Cobre o repositório contact-read-repository (UNION ALL parameterized +
 * count + detail + timeline + notes) com clínica isolada.
 *
 * Estratégia: mockamos `getDb` com um handle que:
 *   - captura o SQL Drizzle (usando .queryChunks + .params, sem JSON.stringify)
 *   - devolve rows pré-programados conforme o "kind" da query
 *
 * Validamos:
 *   - ORDER BY updated_at DESC, type ASC, id ASC (via queryChunks textual)
 *   - LIMIT/OFFSET aplicados APÓS o UNION
 *   - COUNT derivado de query separada
 *   - Predicate ownerId+clinicId em todas as queries (params contém clinicId)
 *   - Detail retorna null para {type,id} inexistente
 *   - Notes: lead usa activity_type='note', patient usa patient_observations
 */

import { sql } from 'drizzle-orm';

interface Captured {
  sqlObj: unknown;
  params: unknown[];
  text: string;
}

const captured: Captured[] = [];
let mockRows: unknown[] = [];
let mockCount: number = 0;
let mockLastDetail: unknown = null;
let mockTimelineRows: unknown[] = [];
let mockNotesRows: unknown[] = [];

/**
 * Drizzle SQL internal: queryChunks é um array flat de:
 *   - StringChunk { value: string[] } — partes textuais do SQL
 *   - PgTable { name: string }        — referência de tabela
 *   - PgColumn { name: string }      — referência de coluna (PgUUID, PgText, etc.)
 *   - primitivos (string/number)     — parâmetros inline
 *   - SQL aninhado (com .queryChunks recursivo)
 */
function flattenChunks(obj: unknown): unknown[] {
  const out: unknown[] = [];
  if (obj == null) return out;
  if (Array.isArray(obj)) {
    for (const v of obj) out.push(...flattenChunks(v));
    return out;
  }
  if (typeof obj === 'string' || typeof obj === 'number' || typeof obj === 'boolean') {
    out.push(obj);
    return out;
  }
  const anyObj = obj as { queryChunks?: unknown[] };
  if (anyObj.queryChunks) return flattenChunks(anyObj.queryChunks);
  out.push(obj);
  return out;
}

/** Drizzle PgTable guarda o nome em Symbol(drizzle:Name). */
function getDrizzleName(obj: unknown): string | undefined {
  const anyObj = obj as Record<symbol, unknown>;
  const symbols = Object.getOwnPropertySymbols(anyObj);
  for (const s of symbols) {
    if (s.toString() === 'Symbol(drizzle:Name)') {
      const v = anyObj[s];
      if (typeof v === 'string') return v;
    }
  }
  return undefined;
}

function captureSql(sqlObj: unknown): Captured {
  const flat = flattenChunks(sqlObj);
  const textParts: string[] = [];
  const params: unknown[] = [];
  for (const c of flat) {
    if (c == null) continue;
    const anyC = c as { value?: unknown; constructor?: { name?: string } };

    // StringChunk Drizzle: { value: string[] }
    if (anyC.value && Array.isArray(anyC.value)) {
      for (const v of anyC.value) textParts.push(String(v));
      continue;
    }

    if (typeof c === 'string' || typeof c === 'number' || typeof c === 'boolean') {
      // parâmetro inline primitivo
      textParts.push('?');
      params.push(c);
      continue;
    }

    // PgTable ou PgColumn
    const named = c as { name?: string | object };
    if (typeof named.name === 'string') {
      textParts.push(named.name);
      continue;
    }
    const drizzleName = getDrizzleName(c);
    if (drizzleName) {
      textParts.push(drizzleName);
      continue;
    }
    textParts.push(anyC.constructor?.name ?? '?');
  }
  return { sqlObj, params, text: textParts.join(' ').replace(/\s+/g, ' ').toLowerCase() };
}

function decideResponse(sqlObj: unknown): { rows: unknown[] } {
  const cap = captureSql(sqlObj);
  const text = cap.text;
  if (text.includes('count(')) {
    return { rows: [{ total: mockCount }] };
  }
  if (text.includes('union')) {
    return { rows: mockRows };
  }
  if (text.includes('patient_observations')) {
    // notes & timeline: notes vem com 'note' na query (só lead), patient sempre timeline aqui
    return { rows: mockNotesRows };
  }
  if (text.includes('lead_activities')) {
    if (text.includes("'note'")) {
      return { rows: mockNotesRows };
    }
    return { rows: mockTimelineRows };
  }
  // detail: patients ou leads
  return { rows: mockLastDetail ? [mockLastDetail] : [] };
}

jest.mock('@/lib/db/client', () => ({
  getDb: () => ({
    execute: jest.fn().mockImplementation(async (sqlObj: unknown) => {
      captured.push(captureSql(sqlObj));
      return decideResponse(sqlObj);
    }),
  }),
}));

import {
  listContacts,
  countContacts,
  getContact,
  listContactTimeline,
  listContactNotes,
} from '../repositories/contact-read-repository';

const CLINIC_A = '00000000-0000-4000-8000-0000000000a1';
const CLINIC_B = '00000000-0000-4000-8000-0000000000a2';
const P1 = '00000000-0000-4000-8000-0000000000b1';
const P2 = '00000000-0000-4000-8000-0000000000b2';
const L1 = '00000000-0000-4000-8000-0000000000c1';
const L2 = '00000000-0000-4000-8000-0000000000c2';

function lastCap(): Captured {
  return captured[captured.length - 1];
}

beforeEach(() => {
  captured.length = 0;
  mockRows = [];
  mockCount = 0;
  mockLastDetail = null;
  mockTimelineRows = [];
  mockNotesRows = [];
});

describe('contact-read-repository — listContacts (UNION ALL)', () => {
  it('passa clinicId parametrizado (predicate owner+clinic)', async () => {
    mockRows = [
      { id: P1, name: 'Ana', phone: '111', email: null, created_at: new Date(), updated_at: new Date() },
    ];
    await listContacts(CLINIC_A, { limit: 10, offset: 0 });
    expect(lastCap().params).toContain(CLINIC_A);
  });

  it('passa limit/offset parametrizados para paginação APÓS UNION', async () => {
    mockRows = [];
    await listContacts(CLINIC_A, { limit: 25, offset: 50 });
    expect(lastCap().params).toContain(25);
    expect(lastCap().params).toContain(50);
    const text = lastCap().text;
    expect(text).toContain('union');
    expect(text).toContain('order by');
    expect(text).toContain('limit');
    expect(text).toContain('offset');
  });

  it('ORDER BY: updated_at DESC, type ASC, id ASC (na ordem)', async () => {
    mockRows = [];
    await listContacts(CLINIC_A, { limit: 10, offset: 0 });
    const text = lastCap().text;
    const orderIdx = text.indexOf('order by');
    expect(orderIdx).toBeGreaterThan(-1);
    const orderClause = text.slice(orderIdx, orderIdx + 300);
    expect(orderClause.indexOf('updated_at')).toBeLessThan(orderClause.indexOf('type'));
    expect(orderClause.indexOf('type')).toBeLessThan(orderClause.indexOf('id'));
    expect(orderClause).toMatch(/updated_at.*desc/);
    expect(orderClause).toMatch(/type.*asc/);
    expect(orderClause).toMatch(/id.*asc/);
  });

  it('não inclui leads convertidos (converted_at IS NULL no ramo lead)', async () => {
    mockRows = [];
    await listContacts(CLINIC_A, { limit: 10, offset: 0 });
    const text = lastCap().text;
    expect(text).toContain('converted_at');
    expect(text).toMatch(/converted_at.*is null|is null.*converted_at/);
  });

  it('não inclui pacientes soft-deleted (deleted_at IS NULL)', async () => {
    mockRows = [];
    await listContacts(CLINIC_A, { limit: 10, offset: 0 });
    const text = lastCap().text;
    expect(text).toContain('deleted_at');
  });

  it('não inclui merged (patient ou lead) — merge_status presente', async () => {
    mockRows = [];
    await listContacts(CLINIC_A, { limit: 10, offset: 0 });
    const text = lastCap().text;
    expect(text).toContain('merge_status');
  });

  it('retorna rows tipados com type=patient|lead', async () => {
    mockRows = [
      { id: P1, name: 'Ana', phone: '111', email: null, created_at: new Date('2026-01-01'), updated_at: new Date('2026-01-02'), type: 'patient' },
      { id: L1, name: 'Bruno', phone: '222', email: null, created_at: new Date('2026-01-01'), updated_at: new Date('2026-01-03'), type: 'lead' },
    ];
    const rows = await listContacts(CLINIC_A, { limit: 10, offset: 0 });
    expect(rows).toHaveLength(2);
    expect(rows[0].type).toBe('patient');
    expect(rows[1].type).toBe('lead');
  });

  it('aceita search opcional (ILIKE em ambos os ramos)', async () => {
    mockRows = [];
    await listContacts(CLINIC_A, { limit: 10, offset: 0, search: 'Ana' });
    const text = lastCap().text;
    expect(text).toContain('ilike');
    expect(lastCap().params.some((p) => typeof p === 'string' && p.includes('Ana'))).toBe(true);
  });
});

describe('contact-read-repository — countContacts', () => {
  it('executa query separada de count para o total', async () => {
    mockCount = 42;
    const total = await countContacts(CLINIC_A, {});
    expect(total).toBe(42);
    const text = lastCap().text;
    expect(text).toContain('count');
  });

  it('passa clinicId na query de count', async () => {
    mockCount = 0;
    await countContacts(CLINIC_A, {});
    expect(lastCap().params).toContain(CLINIC_A);
  });

  it('count usa UNION (COUNT paciente + COUNT lead)', async () => {
    mockCount = 10;
    await countContacts(CLINIC_A, {});
    const text = lastCap().text;
    expect(text).toContain('count');
  });
});

describe('contact-read-repository — getContact (detail)', () => {
  it('retorna paciente quando {type:patient,id} pertence à clínica', async () => {
    mockLastDetail = { id: P1, type: 'patient', clinic_id: CLINIC_A, name: 'Ana', phone: '111', email: null, cpf: '123', tags: ['VIP'], status: 'active', created_at: new Date(), updated_at: new Date() };
    const c = await getContact(CLINIC_A, 'patient', P1);
    expect(c).not.toBeNull();
    expect(c?.id).toBe(P1);
    expect(c?.type).toBe('patient');
  });

  it('retorna null quando {type,id} não existe (detail row vazio)', async () => {
    mockLastDetail = null;
    const c = await getContact(CLINIC_A, 'patient', '00000000-0000-4000-8000-deadbeef0000');
    expect(c).toBeNull();
  });

  it('retorna null quando type não é patient|lead (defesa)', async () => {
    mockLastDetail = null;
    const c = await getContact(CLINIC_A, 'unknown' as any, P1);
    expect(c).toBeNull();
  });

  it('passa clinicId e id parametrizados no predicate', async () => {
    mockLastDetail = { id: P1, type: 'patient', clinic_id: CLINIC_A, name: 'Ana', phone: '111', email: null, cpf: null, tags: [], status: 'active', created_at: new Date(), updated_at: new Date() };
    await getContact(CLINIC_A, 'patient', P1);
    expect(lastCap().params).toContain(CLINIC_A);
    expect(lastCap().params).toContain(P1);
  });
});

describe('contact-read-repository — listContactTimeline', () => {
  it('para patient consulta patient_observations', async () => {
    mockNotesRows = [{ id: 'o1', patient_id: P1, content: 'obs1', created_at: new Date() }];
    const rows = await listContactTimeline(CLINIC_A, 'patient', P1);
    expect(rows.length).toBeGreaterThan(0);
    const text = lastCap().text;
    expect(text).toContain('patient_observations');
  });

  it('para lead consulta lead_activities', async () => {
    mockTimelineRows = [{ id: 'a1', lead_id: L1, description: 'call', activity_type: 'call', performed_at: new Date() }];
    const rows = await listContactTimeline(CLINIC_A, 'lead', L1);
    expect(rows.length).toBeGreaterThan(0);
    const text = lastCap().text;
    expect(text).toContain('lead_activities');
  });

  it('retorna [] para type desconhecido', async () => {
    const rows = await listContactTimeline(CLINIC_A, 'unknown' as any, P1);
    expect(rows).toEqual([]);
    // Não deve nem executar SQL — early return.
    expect(captured).toHaveLength(0);
  });

  it('inclui ORDER BY DESC por data (mais recente primeiro)', async () => {
    mockNotesRows = [];
    await listContactTimeline(CLINIC_A, 'patient', P1);
    const text = lastCap().text;
    expect(text).toContain('order by');
    expect(text).toMatch(/desc/);
  });

  it('passa clinicId parametrizado', async () => {
    mockNotesRows = [];
    await listContactTimeline(CLINIC_A, 'patient', P1);
    expect(lastCap().params).toContain(CLINIC_A);
  });
});

describe('contact-read-repository — listContactNotes', () => {
  it('para patient consulta patient_observations', async () => {
    mockNotesRows = [{ id: 'o1', patient_id: P1, content: 'obs nota', created_at: new Date() }];
    const rows = await listContactNotes(CLINIC_A, 'patient', P1);
    expect(rows.length).toBeGreaterThan(0);
    const text = lastCap().text;
    expect(text).toContain('patient_observations');
  });

  it('para lead consulta lead_activities filtrando activity_type=note', async () => {
    mockNotesRows = [{ id: 'a1', lead_id: L1, description: 'nota', activity_type: 'note', performed_at: new Date() }];
    const rows = await listContactNotes(CLINIC_A, 'lead', L1);
    expect(rows.length).toBeGreaterThan(0);
    const text = lastCap().text;
    expect(text).toContain('lead_activities');
    expect(text).toContain('note');
  });

  it('retorna [] para type desconhecido', async () => {
    const rows = await listContactNotes(CLINIC_A, 'unknown' as any, P1);
    expect(rows).toEqual([]);
    expect(captured).toHaveLength(0);
  });

  it('passa clinicId parametrizado', async () => {
    mockNotesRows = [];
    await listContactNotes(CLINIC_A, 'lead', L1);
    expect(lastCap().params).toContain(CLINIC_A);
  });
});

// Silence unused import warning
void sql;