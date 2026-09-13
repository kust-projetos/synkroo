import test from 'node:test';
import assert from 'node:assert/strict';
import { resolve } from 'node:path';
import { writeFileSync, unlinkSync } from 'node:fs';
import {
  validateRow,
  importClientData,
  isCliInvocation,
  isValidCalendarDate,
  parseCsvLine,
  parseCsvContent,
} from '../import-client-data.mjs';

test('isValidCalendarDate strictly verifies real calendar days', () => {
  assert.equal(isValidCalendarDate('2024-02-29'), true); // Leap year
  assert.equal(isValidCalendarDate('2024-02-31'), false); // Impossible day
  assert.equal(isValidCalendarDate('2023-02-29'), false); // Not a leap year
  assert.equal(isValidCalendarDate('2024-04-31'), false); // April has 30 days
  assert.equal(isValidCalendarDate('not-a-date'), false);
});

test('parseCsvLine properly parses quoted fields with internal commas', () => {
  const line = '"Silva, Dr. Lucas",11999998888,lucas@teste.com,1985-05-10,clinica-slug,v1,false';
  const cols = parseCsvLine(line);
  assert.equal(cols.length, 7);
  assert.equal(cols[0], 'Silva, Dr. Lucas');
  assert.equal(cols[1], '11999998888');
  assert.equal(cols[2], 'lucas@teste.com');
  assert.equal(cols[3], '1985-05-10');
  assert.equal(cols[4], 'clinica-slug');
  assert.equal(cols[5], 'v1');
  assert.equal(cols[6], 'false');
});

test('parseCsvLine handles escaped double quotes (RFC 4180 "")', () => {
  const line = '"Diz ""oi"", Ana",11999998888,ana@teste.com,1990-01-01,clinica-slug,v1,false';
  const cols = parseCsvLine(line);
  assert.equal(cols.length, 7);
  assert.equal(cols[0], 'Diz "oi", Ana');
});

test('parseCsvLine keeps empty trailing field', () => {
  const cols = parseCsvLine('a,b,');
  assert.deepEqual(cols, ['a', 'b', '']);
});

test('parseCsvLine throws on invalid quoting', () => {
  assert.throws(() => parseCsvLine('"Paciente"oops,11999990000,a@b.com,1990-01-01,slug,v1,false'), /Invalid CSV quoting/);
  assert.throws(() => parseCsvLine('ab"cd,1,2,3,4,5,6'), /Invalid CSV quoting/);
});

test('parseCsvContent supports LF multiline quoted fields', () => {
  const csv = 'name,phone,email,birthDate,clinicSlug,consentVersion,optOutMarketing\n"Silva\nFilho",11999990000,a@b.com,1990-01-01,slug,v1,false\n';
  const { records, errors } = parseCsvContent(csv);
  assert.equal(errors.length, 0);
  assert.equal(records.length, 2);
  assert.deepEqual(records[1].fields, ['Silva\nFilho', '11999990000', 'a@b.com', '1990-01-01', 'slug', 'v1', 'false']);
  assert.equal(records[1].line, 2);
});

test('parseCsvContent supports CRLF file with CRLF multiline quoted field', () => {
  const csv = 'name,phone,email,birthDate,clinicSlug,consentVersion,optOutMarketing\r\n"Silva\r\nFilho",11999990000,a@b.com,1990-01-01,slug,v1,false\r\nOutro,11999990001,c@d.com,1991-02-02,slug,v1,true\r\n';
  const { records, errors } = parseCsvContent(csv);
  assert.equal(errors.length, 0);
  assert.equal(records.length, 3);
  assert.equal(records[1].fields[0], 'Silva\nFilho');
  assert.equal(records[2].fields[0], 'Outro');
});

test('parseCsvContent rejects invalid quoting but keeps valid records', () => {
  const csv =
    'name,phone,email,birthDate,clinicSlug,consentVersion,optOutMarketing\n' +
    '"Paciente"oops,11999990000,a@b.com,1990-01-01,slug,v1,false\n' +
    'Valido,11999990001,c@d.com,1991-02-02,slug,v1,true\n';
  const { records, errors } = parseCsvContent(csv);
  assert.equal(records.length, 2); // header + valid row
  assert.equal(errors.length, 1);
  assert.equal(errors[0].record, 1);
  assert.match(errors[0].reason, /Invalid quoting/);
  assert.equal(records[1].fields[0], 'Valido');
});

test('parseCsvContent rejects stray quote in unquoted field and unterminated quote', () => {
  const stray = parseCsvContent('h1,h2\nab"cd,1\n');
  assert.equal(stray.records.length, 1);
  assert.equal(stray.errors.length, 1);
  assert.match(stray.errors[0].reason, /stray double quote/);

  const unterminated = parseCsvContent('h1,h2\n"abc,1\n');
  assert.equal(unterminated.records.length, 1);
  assert.equal(unterminated.errors.length, 1);
  assert.match(unterminated.errors[0].reason, /Unterminated/);
});

test('parseCsvContent skips blank lines and accepts final line without newline', () => {
  const csv = 'h1,h2\n\na,1\n\nb,2';
  const { records, errors } = parseCsvContent(csv);
  assert.equal(errors.length, 0);
  assert.equal(records.length, 3);
  assert.deepEqual(records[1].fields, ['a', '1']);
  assert.deepEqual(records[2].fields, ['b', '2']);
});

test('validateRow accepts valid CSV row and normalizes fields', () => {
  const row = [
    'Paciente Teste',
    '+55 11 99999-8888',
    'paciente@teste.com',
    '1990-05-15',
    'clinica-teste',
    'v1',
    'true',
  ];
  const res = validateRow(row, 1);
  assert.equal(res.valid, true);
  assert.equal(res.data.name, 'Paciente Teste');
  assert.equal(res.data.phone, '+5511999998888');
  assert.equal(res.data.email, 'paciente@teste.com');
  assert.equal(res.data.birthDate, '1990-05-15');
  assert.equal(res.data.clinicSlug, 'clinica-teste');
  assert.equal(res.data.consentVersion, 'v1');
  assert.equal(res.data.optOutMarketing, true);
});

test('validateRow rejects impossible calendar dates like 2024-02-31', () => {
  const row = [
    'Paciente Teste',
    '11999998888',
    'paciente@teste.com',
    '2024-02-31',
    'clinica-teste',
    'v1',
    'false',
  ];
  const res = validateRow(row, 1);
  assert.equal(res.valid, false);
  assert.match(res.reason, /Invalid birthDate/);
});

test('validateRow rejects malformed rows', () => {
  // Wrong column count
  assert.equal(validateRow(['a', 'b'], 1).valid, false);

  // Short name
  assert.equal(validateRow(['a', '11999990000', 'a@b.com', '1990-01-01', 'slug', 'v1', 'false'], 1).valid, false);

  // Invalid phone
  assert.equal(validateRow(['Paciente', 'abc', 'a@b.com', '1990-01-01', 'slug', 'v1', 'false'], 1).valid, false);

  // Invalid email
  assert.equal(validateRow(['Paciente', '11999990000', 'not-an-email', '1990-01-01', 'slug', 'v1', 'false'], 1).valid, false);

  // Invalid date
  assert.equal(validateRow(['Paciente', '11999990000', 'a@b.com', '1990-99-99', 'slug', 'v1', 'false'], 1).valid, false);

  // Invalid optOutMarketing
  assert.equal(validateRow(['Paciente', '11999990000', 'a@b.com', '1990-01-01', 'slug', 'v1', 'maybe'], 1).valid, false);
});

test('importClientData dry-run validates approved-import.csv', async () => {
  const result = await importClientData({
    client: 'pilot',
    file: 'docs/pilot/approved-import.csv',
    apply: false,
  });

  assert.equal(result.status, 'dry-run');
  assert.equal(result.action, 'preview_import');
  assert.equal(result.accepted, 10);
  assert.equal(result.rejected, 0);
  assert.equal(result.legalHold, true);
});

test('importClientData dry-run accepts quoted multiline record', async () => {
  const tempCsvPath = resolve(process.cwd(), 'docs/pilot/temp-multiline.csv');
  const content =
    'name,phone,email,birthDate,clinicSlug,consentVersion,optOutMarketing\n' +
    '"Silva\nFilho",11999990001,multi@teste.com,1990-01-01,clinica-teste,v1,false\n';
  writeFileSync(tempCsvPath, content, 'utf8');

  try {
    const result = await importClientData({
      client: 'pilot',
      file: 'docs/pilot/temp-multiline.csv',
      apply: false,
    });
    assert.equal(result.status, 'dry-run');
    assert.equal(result.totalRows, 1);
    assert.equal(result.accepted, 1);
    assert.equal(result.rejected, 0);
  } finally {
    unlinkSync(tempCsvPath);
  }
});

test('importClientData dry-run rejects invalid quoting fail-closed', async () => {
  const tempCsvPath = resolve(process.cwd(), 'docs/pilot/temp-badquote.csv');
  const content =
    'name,phone,email,birthDate,clinicSlug,consentVersion,optOutMarketing\n' +
    '"Paciente"oops,11999990001,bad@teste.com,1990-01-01,clinica-teste,v1,false\n';
  writeFileSync(tempCsvPath, content, 'utf8');

  try {
    const preview = await importClientData({
      client: 'pilot',
      file: 'docs/pilot/temp-badquote.csv',
      apply: false,
    });
    assert.equal(preview.accepted, 0);
    assert.equal(preview.rejected, 1);
    assert.match(preview.rejectionReasons[0].reason, /Invalid CSV quoting/);

    await assert.rejects(
      async () => {
        await importClientData({
          file: 'docs/pilot/temp-badquote.csv',
          apply: true,
          dbClient: { query: async () => ({ rows: [] }) },
        });
      },
      { message: /Cannot apply import: 1 records failed validation/ }
    );
  } finally {
    unlinkSync(tempCsvPath);
  }
});

test('importClientData fails if file is missing', async () => {
  await assert.rejects(
    async () => {
      await importClientData({ file: 'docs/non-existent-file.csv' });
    },
    { message: /Import file not found/ }
  );
});

test('importClientData apply fails closed without DATABASE_URL', async () => {
  const originalEnv = process.env.DATABASE_URL;
  delete process.env.DATABASE_URL;
  try {
    await assert.rejects(
      async () => {
        await importClientData({
          file: 'docs/pilot/approved-import.csv',
          apply: true,
        });
      },
      { message: /DATABASE_URL environment variable is required/ }
    );
  } finally {
    if (originalEnv) process.env.DATABASE_URL = originalEnv;
  }
});

test('importClientData apply fails closed when records fail validation', async () => {
  const tempCsvPath = resolve(process.cwd(), 'docs/pilot/temp-corrupt.csv');
  const corruptContent = `name,phone,email,birthDate,clinicSlug,consentVersion,optOutMarketing\nCorrupt,invalid-phone,bad-email,not-a-date,slug,v1,invalid-bool\n`;
  writeFileSync(tempCsvPath, corruptContent, 'utf8');

  try {
    await assert.rejects(
      async () => {
        await importClientData({
          file: 'docs/pilot/temp-corrupt.csv',
          apply: true,
        });
      },
      { message: /Cannot apply import: 1 records failed validation/ }
    );
  } finally {
    unlinkSync(tempCsvPath);
  }
});

test('importClientData apply executes transactional insert with patients, consents, and audit_logs', async () => {
  const queries = [];
  const fakeDbClient = {
    query: async (text, params) => {
      queries.push({ text, params });
      if (typeof text === 'string' && text.includes('SELECT id FROM clinics')) {
        return { rows: [{ id: 'clinic-uuid-123' }] };
      }
      if (typeof text === 'string' && text.includes('SELECT id FROM patients')) {
        return { rows: [] };
      }
      if (typeof text === 'string' && text.includes('SELECT id FROM consents')) {
        return { rows: [] };
      }
      return { rows: [{ id: 'generated-uuid-456' }] };
    },
  };

  const result = await importClientData({
    client: 'pilot',
    file: 'docs/pilot/approved-import.csv',
    apply: true,
    dbClient: fakeDbClient,
  });

  assert.equal(result.status, 'applied');
  assert.equal(result.action, 'import_client_data');
  assert.equal(result.persisted, 10);
  assert.equal(result.consentsRecorded, 10);
  assert.equal(result.auditLogsRecorded, 10);
  assert.equal(result.rejected, 0);

  // Verify transaction flow: BEGIN -> inserts -> COMMIT
  assert.equal(queries[0].text, 'BEGIN');
  assert.equal(queries[queries.length - 1].text, 'COMMIT');
  const patientInserts = queries.filter((q) => q.text.includes('INSERT INTO patients'));
  assert.equal(patientInserts.length, 10);
  const consentInserts = queries.filter((q) => q.text.includes('INSERT INTO consents'));
  assert.equal(consentInserts.length, 10);
  // Contrato audit_logs (src/core/schema/infra.ts): clinic_id, action,
  // entity_type, entity_id, new_values, created_at — sem PII em new_values.
  const auditInserts = queries.filter((q) => q.text.includes('INSERT INTO audit_logs'));
  assert.equal(auditInserts.length, 10);
  assert.equal(queries.filter((q) => q.text.includes('INSERT INTO action_logs')).length, 0);
  for (const q of auditInserts) {
    assert.match(q.text, /clinic_id/);
    assert.match(q.text, /entity_type/);
    assert.match(q.text, /entity_id/);
    assert.match(q.text, /new_values/);
    assert.match(q.text, /operacional\.importarPaciente/);
    // params: [clinicId, entityId(patientId), newValues(JSON)]
    assert.equal(q.params[0], 'clinic-uuid-123');
    assert.equal(q.params[1], 'generated-uuid-456');
    const newValues = JSON.parse(q.params[2]);
    assert.equal(newValues.consentVersion, 'v1');
    assert.equal(typeof newValues.optOutMarketing, 'boolean');
    assert.ok(!('name' in newValues || 'phone' in newValues || 'email' in newValues), 'new_values must not carry PII');
  }
});

test('importClientData apply is idempotent and updates existing records and consents', async () => {
  const queries = [];
  const existingDbClient = {
    query: async (text, params) => {
      queries.push({ text, params });
      if (typeof text === 'string' && text.includes('SELECT id FROM clinics')) {
        return { rows: [{ id: 'clinic-uuid-123' }] };
      }
      if (typeof text === 'string' && text.includes('SELECT id FROM patients')) {
        return { rows: [{ id: 'existing-patient-id' }] };
      }
      if (typeof text === 'string' && text.includes('SELECT id FROM consents')) {
        return { rows: [{ id: 'existing-consent-id' }] };
      }
      return { rows: [] };
    },
  };

  const result = await importClientData({
    client: 'pilot',
    file: 'docs/pilot/approved-import.csv',
    apply: true,
    dbClient: existingDbClient,
  });

  assert.equal(result.status, 'applied');
  assert.equal(result.persisted, 10);
  const patientUpdates = queries.filter((q) => q.text.includes('UPDATE patients'));
  assert.equal(patientUpdates.length, 10);
  const consentUpdates = queries.filter((q) => q.text.includes('UPDATE consents'));
  assert.equal(consentUpdates.length, 10);
});

test('importClientData apply persists opt_out_at, consent granted/revoked and legal_hold', async () => {
  const tempCsvPath = resolve(process.cwd(), 'docs/pilot/temp-optout.csv');
  const content =
    'name,phone,email,birthDate,clinicSlug,consentVersion,optOutMarketing\n' +
    'Opt Out,11999990001,optout@teste.com,1990-01-01,clinica-teste,v2,true\n' +
    'Opt In,11999990002,optin@teste.com,1991-02-02,clinica-teste,v2,false\n';
  writeFileSync(tempCsvPath, content, 'utf8');

  try {
    const queries = [];
    const fakeDbClient = {
      query: async (text, params) => {
        queries.push({ text, params });
        if (typeof text === 'string' && text.includes('SELECT id FROM clinics')) {
          return { rows: [{ id: 'clinic-uuid-123' }] };
        }
        if (typeof text === 'string' && text.includes('SELECT id FROM patients')) {
          return { rows: [] };
        }
        if (typeof text === 'string' && text.includes('SELECT id FROM consents')) {
          return { rows: [] };
        }
        return { rows: [{ id: 'generated-uuid' }] };
      },
    };

    const result = await importClientData({
      client: 'pilot',
      file: 'docs/pilot/temp-optout.csv',
      apply: true,
      dbClient: fakeDbClient,
    });

    assert.equal(result.status, 'applied');
    assert.equal(result.persisted, 2);

    // — patients: opt_out_at set only when optOutMarketing=true; legal_hold always —
    const patientInserts = queries.filter((q) => q.text.includes('INSERT INTO patients'));
    assert.equal(patientInserts.length, 2);
    for (const q of patientInserts) {
      assert.match(q.text, /legal_hold/);
      assert.match(q.text, /opt_out_at/);
    }
    // params: [clinicId, name, phone, email, birthDate, optOutMarketing(bool), optOutAt, notes]
    const optOutRow = patientInserts.find((q) => q.params[2] === '11999990001');
    const optInRow = patientInserts.find((q) => q.params[2] === '11999990002');
    assert.ok(optOutRow, 'opt-out patient insert found');
    assert.ok(optInRow, 'opt-in patient insert found');
    assert.equal(optOutRow.params[5], true);
    assert.ok(optOutRow.params[6], 'opt_out_at must be set when optOutMarketing=true');
    assert.equal(optInRow.params[5], false);
    assert.equal(optInRow.params[6], null, 'opt_out_at must be null when optOutMarketing=false');

    // — consents: granted = !optOut; revoked_at mirrors opt_out_at —
    const consentInserts = queries.filter((q) => q.text.includes('INSERT INTO consents'));
    assert.equal(consentInserts.length, 2);
    // params: [clinicId, patientId, granted(bool), revoked_at, version, notes]
    const consentOut = consentInserts.find((q) => q.params[3] !== null);
    const consentIn = consentInserts.find((q) => q.params[3] === null);
    assert.ok(consentOut, 'revoked consent found');
    assert.ok(consentIn, 'granted consent found');
    assert.equal(consentOut.params[2], false);
    assert.equal(consentIn.params[2], true);
    assert.equal(consentOut.params[4], 'v2');
    assert.equal(consentIn.params[4], 'v2');

    // — audit: one audit_logs entry per persisted row (contrato infra.ts) —
    const auditInserts = queries.filter((q) => q.text.includes('INSERT INTO audit_logs'));
    assert.equal(auditInserts.length, 2);
    for (const q of auditInserts) {
      assert.match(q.text, /entity_type/);
      const newValues = JSON.parse(q.params[2]);
      assert.equal(newValues.consentVersion, 'v2');
    }
  } finally {
    unlinkSync(tempCsvPath);
  }
});

test('importClientData rolls back transaction on insert failure', async () => {
  const queries = [];
  const failingDbClient = {
    query: async (text, params) => {
      queries.push({ text, params });
      if (typeof text === 'string' && text.includes('SELECT id FROM clinics')) {
        return { rows: [{ id: 'clinic-uuid-123' }] };
      }
      if (typeof text === 'string' && text.includes('SELECT id FROM patients')) {
        return { rows: [] };
      }
      if (typeof text === 'string' && text.includes('INSERT INTO patients')) {
        throw new Error('Disk full simulated error');
      }
      return { rows: [] };
    },
  };

  await assert.rejects(
    async () => {
      await importClientData({
        client: 'pilot',
        file: 'docs/pilot/approved-import.csv',
        apply: true,
        dbClient: failingDbClient,
      });
    },
    { message: /Disk full simulated error/ }
  );

  const rollbackQuery = queries.find((q) => q.text === 'ROLLBACK');
  assert.ok(rollbackQuery, 'Transaction should have been rolled back');
  assert.ok(!queries.some((q) => q.text === 'COMMIT'), 'Failed transaction must never COMMIT');
  assert.equal(
    queries.filter((q) => q.text.includes('INSERT INTO audit_logs')).length,
    0,
    'No audit record may be written when the transaction fails'
  );
});

test('isCliInvocation detects invocation correctly', () => {
  assert.equal(isCliInvocation('file:///D:/projetos/synkroo/scripts/tool.mjs', 'D:\\projetos\\synkroo\\scripts\\tool.mjs'), true);
  assert.equal(isCliInvocation('file:///workspace/scripts/tool.mjs', '/workspace/scripts/tool.mjs'), true);
  assert.equal(isCliInvocation('file:///workspace/scripts/tool.mjs', '/workspace/scripts/other.mjs'), false);
});
