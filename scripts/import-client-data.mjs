#!/usr/bin/env node
/**
 * scripts/import-client-data.mjs — Client Data Import & Validation Script.
 *
 * Implements transactional, idempotent, LGPD-compliant client import with:
 * - Strict schema and calendar date validation (email, phone, birthDate, consent, opt-out)
 * - Strict RFC 4180 parsing over the whole content (quoted commas, "" escapes,
 *   CRLF/LF multiline fields; invalid quoting is rejected, never guessed)
 * - Dry-run / preview mode without database connection
 * - Transactional apply mode (PostgreSQL via pg) with legal hold, opt_out_at,
 *   consents, and audit_logs entries (contrato: src/core/schema/infra.ts)
 * - Fail-closed abort on any validation errors or missing credentials
 *
 * Usage:
 *   node scripts/import-client-data.mjs --client pilot --file docs/pilot/approved-import.csv
 *   node scripts/import-client-data.mjs --client pilot --file docs/pilot/approved-import.csv --apply
 */

import { readFileSync, existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { parseArgs } from 'node:util';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';
import pg from 'pg';

const { Client } = pg;

function normalizePath(path) {
  const normalized = path.replaceAll('\\', '/');
  return normalized.startsWith('/') && /^[A-Za-z]:/.test(normalized.slice(1))
    ? normalized.slice(1)
    : normalized;
}

export function isCliInvocation(moduleUrl, argvPath) {
  if (!argvPath) return false;
  return normalizePath(new URL(moduleUrl).pathname) === normalizePath(argvPath);
}

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_REGEX = /^\+?[0-9]{10,15}$/;
const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;
const SLUG_REGEX = /^[a-z0-9-_]+$/i;

/**
 * parseCsvContent — strict RFC 4180 parser over the whole file content.
 *
 * - Quoted fields may contain commas, CRLF/LF line breaks (normalized to \n)
 *   and escaped (`""`) quotes.
 * - A stray `"` inside an unquoted field, any character other than a
 *   delimiter/line-break/EOF right after a closing quote, and an unterminated
 *   quoted field are reported as record errors (fail-closed downstream).
 * - Blank physical lines are skipped without consuming a logical record number.
 * - Returns logical records with their 1-based physical start line, plus
 *   per-record errors numbered by 0-based logical record index (0 = header).
 */
export function parseCsvContent(content) {
  const text = content.replace(/^\uFEFF/, '');
  const records = [];
  const errors = [];

  let fields = [];
  let field = '';
  let inQuotes = false;
  let fieldQuoted = false;
  let quoteClosed = false;
  let fieldHasData = false;
  let recordHasContent = false;
  let line = 1;
  let recordStartLine = 1;
  let errored = false;

  const resetField = () => {
    field = '';
    fieldQuoted = false;
    quoteClosed = false;
    fieldHasData = false;
  };
  const pushField = () => {
    fields.push(fieldQuoted ? field : field.trim());
    if (fieldQuoted || fieldHasData) recordHasContent = true;
    resetField();
  };
  const failRecord = (reason) => {
    errors.push({ record: records.length + errors.length, line: recordStartLine, reason });
    fields = [];
    resetField();
    recordHasContent = false;
    inQuotes = false;
    errored = true;
  };
  const endRecord = () => {
    pushField();
    if (recordHasContent) {
      records.push({ fields, line: recordStartLine });
    }
    fields = [];
    resetField();
    recordHasContent = false;
    recordStartLine = line + 1;
  };

  let i = 0;
  while (i < text.length) {
    const c = text[i];
    if (errored) {
      // Resync: skip until the next physical line break.
      if (c === '\r' || c === '\n') {
        if (c === '\r' && text[i + 1] === '\n') i++;
        line++;
        errored = false;
        recordStartLine = line;
      }
      i++;
      continue;
    }
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          fieldHasData = true;
          i += 2;
          continue;
        }
        inQuotes = false;
        quoteClosed = true;
        i++;
        continue;
      }
      if (c === '\r' || c === '\n') {
        if (quoteClosed) {
          endRecord();
          if (c === '\r' && text[i + 1] === '\n') i++;
          line++;
          i++;
          continue;
        }
        // Line break inside quotes: field content, normalized to \n.
        if (c === '\r' && text[i + 1] === '\n') i++;
        field += '\n';
        fieldHasData = true;
        line++;
        i++;
        continue;
      }
      if (quoteClosed) {
        failRecord(`Invalid quoting: unexpected character ${JSON.stringify(c)} after closing quote`);
        continue;
      }
      field += c;
      fieldHasData = true;
      i++;
      continue;
    }
    if (c === ',') {
      pushField();
      i++;
      continue;
    }
    if (c === '"') {
      if (!fieldHasData && !fieldQuoted) {
        inQuotes = true;
        fieldQuoted = true;
        quoteClosed = false;
        i++;
        continue;
      }
      failRecord('Invalid quoting: stray double quote inside unquoted field');
      continue;
    }
    if (c === '\r' || c === '\n') {
      endRecord();
      if (c === '\r' && text[i + 1] === '\n') i++;
      line++;
      i++;
      continue;
    }
    if (quoteClosed) {
      failRecord(`Invalid quoting: unexpected character ${JSON.stringify(c)} after closing quote`);
      continue;
    }
    field += c;
    fieldHasData = true;
    i++;
  }

  if (inQuotes) {
    failRecord('Unterminated quoted field at end of file');
  } else if (!errored) {
    endRecord();
  }

  return { records, errors };
}

export function parseCsvLine(line) {
  const { records, errors } = parseCsvContent(line);
  if (errors.length > 0) {
    throw new Error(`Invalid CSV quoting: ${errors[0].reason}`);
  }
  if (records.length === 0) return [];
  return records[0].fields;
}

export function isValidCalendarDate(dateStr) {
  if (!DATE_REGEX.test(dateStr)) return false;
  const [y, m, d] = dateStr.split('-').map(Number);
  if (m < 1 || m > 12 || d < 1 || d > 31) return false;
  const dt = new Date(Date.UTC(y, m - 1, d));
  return (
    dt.getUTCFullYear() === y &&
    dt.getUTCMonth() + 1 === m &&
    dt.getUTCDate() === d
  );
}

export function validateRow(cols, rowIndex) {
  if (cols.length !== 7) {
    return { valid: false, reason: `Expected 7 columns, found ${cols.length}` };
  }

  const [name, phone, email, birthDate, clinicSlug, consentVersion, optOutMarketingRaw] = cols;

  if (!name || name.trim().length < 2) {
    return { valid: false, reason: 'Invalid or missing name (min 2 chars)' };
  }

  const cleanPhone = phone.replace(/[\s()-]/g, '');
  if (!PHONE_REGEX.test(cleanPhone)) {
    return { valid: false, reason: `Invalid phone format: ${phone}` };
  }

  if (!EMAIL_REGEX.test(email.trim())) {
    return { valid: false, reason: `Invalid email format: ${email}` };
  }

  if (!isValidCalendarDate(birthDate.trim())) {
    return { valid: false, reason: `Invalid birthDate (expected valid calendar date YYYY-MM-DD): ${birthDate}` };
  }

  if (!SLUG_REGEX.test(clinicSlug.trim())) {
    return { valid: false, reason: `Invalid clinicSlug: ${clinicSlug}` };
  }

  if (!consentVersion || consentVersion.trim().length === 0) {
    return { valid: false, reason: 'Missing consentVersion' };
  }

  const optOutStr = optOutMarketingRaw.trim().toLowerCase();
  if (optOutStr !== 'true' && optOutStr !== 'false') {
    return { valid: false, reason: `Invalid optOutMarketing (expected 'true' or 'false'): ${optOutMarketingRaw}` };
  }

  return {
    valid: true,
    data: {
      name: name.trim(),
      phone: cleanPhone,
      email: email.trim().toLowerCase(),
      birthDate: birthDate.trim(),
      clinicSlug: clinicSlug.trim(),
      consentVersion: consentVersion.trim(),
      optOutMarketing: optOutStr === 'true',
    },
  };
}

export async function importClientData({
  client = 'pilot',
  file = 'docs/pilot/approved-import.csv',
  apply = false,
  dbClient = null,
} = {}) {
  const filePath = resolve(process.cwd(), file);
  if (!existsSync(filePath)) {
    throw new Error(`Import file not found: ${file}`);
  }

  const content = readFileSync(filePath, 'utf8');
  const sha256 = createHash('sha256').update(content).digest('hex');

  // RFC 4180 over the whole content: logical records may span physical lines.
  const { records, errors } = parseCsvContent(content);

  if (records.length === 0) {
    if (errors.length > 0) {
      throw new Error(`Invalid CSV quoting (line ${errors[0].line}): ${errors[0].reason}`);
    }
    throw new Error('Import CSV file is empty');
  }

  const header = records[0].fields;
  const expectedHeader = ['name', 'phone', 'email', 'birthDate', 'clinicSlug', 'consentVersion', 'optOutMarketing'];
  const hasExpectedHeaders =
    header.length === expectedHeader.length &&
    expectedHeader.every((col, idx) => header[idx] === col);

  if (!hasExpectedHeaders) {
    throw new Error(`Invalid CSV headers. Expected: ${expectedHeader.join(',')}`);
  }

  const acceptedRows = [];
  const rejectionReasons = [];

  // Parser errors are fail-closed rejections keyed by logical record number.
  for (const err of errors) {
    if (err.record === 0) {
      throw new Error(`Invalid CSV quoting in header (line ${err.line}): ${err.reason}`);
    }
    rejectionReasons.push({ row: err.record, reason: `Invalid CSV quoting (line ${err.line}): ${err.reason}` });
  }

  for (let k = 1; k < records.length; k++) {
    const validation = validateRow(records[k].fields, k);
    if (!validation.valid) {
      rejectionReasons.push({ row: k, reason: validation.reason });
    } else {
      acceptedRows.push(validation.data);
    }
  }
  rejectionReasons.sort((a, b) => a.row - b.row);

  const rejected = rejectionReasons.length;
  const accepted = acceptedRows.length;
  const totalRows = records.length - 1;

  if (apply) {
    if (rejected > 0) {
      throw new Error(`Cannot apply import: ${rejected} records failed validation. Aborting without database changes.`);
    }

    const connectionString = process.env.DATABASE_URL;
    if (!connectionString && !dbClient) {
      throw new Error('DATABASE_URL environment variable is required to apply import');
    }

    const pgClient = dbClient || new Client({ connectionString });
    let shouldClose = false;
    if (!dbClient) {
      await pgClient.connect();
      shouldClose = true;
    }

    let persistedCount = 0;
    try {
      await pgClient.query('BEGIN');

      // Cache clinic lookups by slug
      const clinicIdMap = new Map();

      for (const row of acceptedRows) {
        let clinicId = clinicIdMap.get(row.clinicSlug);
        if (!clinicId) {
          const res = await pgClient.query(
            'SELECT id FROM clinics WHERE slug = $1 LIMIT 1',
            [row.clinicSlug]
          );
          if (!res.rows[0]) {
            throw new Error(`Clinic with slug '${row.clinicSlug}' not found in database.`);
          }
          clinicId = res.rows[0].id;
          clinicIdMap.set(row.clinicSlug, clinicId);
        }

        const notes = `Imported via import-client-data: client=${client}, consentVersion=${row.consentVersion}`;
        const optOutAt = row.optOutMarketing ? new Date().toISOString() : null;

        const existingRes = await pgClient.query(
          'SELECT id FROM patients WHERE clinic_id = $1 AND phone = $2 LIMIT 1',
          [clinicId, row.phone]
        );

        let patientId;
        if (existingRes.rows[0]) {
          patientId = existingRes.rows[0].id;
          await pgClient.query(
            `UPDATE patients SET
              name = $1,
              email = $2,
              birth_date = $3,
              opt_out_marketing = $4,
              opt_out_at = $5,
              legal_hold = true,
              legal_hold_reason = 'LGPD pilot import retention',
              notes = $6,
              updated_at = NOW()
            WHERE id = $7`,
            [row.name, row.email, row.birthDate, row.optOutMarketing, optOutAt, notes, patientId]
          );
        } else {
          const insertRes = await pgClient.query(
            `INSERT INTO patients (
              clinic_id, name, phone, email, birth_date, opt_out_marketing, opt_out_at, legal_hold, legal_hold_reason, notes, updated_at
            ) VALUES (
              $1, $2, $3, $4, $5, $6, $7, true, 'LGPD pilot import retention', $8, NOW()
            ) RETURNING id`,
            [clinicId, row.name, row.phone, row.email, row.birthDate, row.optOutMarketing, optOutAt, notes]
          );
          patientId = insertRes.rows[0].id;
        }

        // LGPD: record consents
        const existingConsentRes = await pgClient.query(
          'SELECT id FROM consents WHERE clinic_id = $1 AND contact_id = $2 AND contact_type = $3 AND purpose = $4 LIMIT 1',
          [clinicId, patientId, 'patient', 'marketing']
        );

        if (existingConsentRes.rows[0]) {
          await pgClient.query(
            `UPDATE consents SET
              granted = $1,
              revoked_at = $2,
              version = $3,
              notes = $4,
              updated_at = NOW()
            WHERE id = $5`,
            [!row.optOutMarketing, optOutAt, row.consentVersion, notes, existingConsentRes.rows[0].id]
          );
        } else {
          await pgClient.query(
            `INSERT INTO consents (
              clinic_id, contact_id, contact_type, purpose, granted, granted_at, revoked_at, channel, version, actor, notes, updated_at
            ) VALUES (
              $1, $2, 'patient', 'marketing', $3, NOW(), $4, 'import', $5, 'system (import-client-data)', $6, NOW()
            )`,
            [clinicId, patientId, !row.optOutMarketing, optOutAt, row.consentVersion, notes]
          );
        }

        // LGPD: audit log entry in audit_logs (contrato: src/core/schema/infra.ts).
        // new_values carries only redacted import metadata — no PII.
        await pgClient.query(
          `INSERT INTO audit_logs (
            clinic_id, action, entity_type, entity_id, new_values, created_at
          ) VALUES (
            $1, 'operacional.importarPaciente', 'patient', $2, $3, NOW()
          )`,
          [
            clinicId,
            patientId,
            JSON.stringify({
              consentVersion: row.consentVersion,
              optOutMarketing: row.optOutMarketing,
            }),
          ]
        );

        persistedCount++;
      }

      await pgClient.query('COMMIT');
    } catch (err) {
      try {
        await pgClient.query('ROLLBACK');
      } catch {
        // ignore rollback error
      }
      throw err;
    } finally {
      if (shouldClose) {
        await pgClient.end();
      }
    }

    return {
      status: 'applied',
      action: 'import_client_data',
      client,
      file,
      sha256,
      totalRows,
      accepted,
      rejected: 0,
      persisted: persistedCount,
      legalHold: true,
      consentsRecorded: persistedCount,
      auditLogsRecorded: persistedCount,
      message: `Successfully imported and persisted ${persistedCount} client records with LGPD legal hold, consents, and audit logs.`,
    };
  }

  return {
    status: 'dry-run',
    action: 'preview_import',
    client,
    file,
    sha256,
    totalRows,
    accepted,
    rejected,
    legalHold: true,
    message: `Dry-run preview completed. ${accepted} records accepted, ${rejected} rejected. No data inserted.`,
    rejectionReasons: rejectionReasons.length > 0 ? rejectionReasons : undefined,
  };
}

if (isCliInvocation(import.meta.url, process.argv[1])) {
  const { values } = parseArgs({
    options: {
      client: { type: 'string', default: 'pilot' },
      file: { type: 'string', default: 'docs/pilot/approved-import.csv' },
      apply: { type: 'boolean', default: false },
    },
  });

  try {
    const result = await importClientData(values);
    console.log(JSON.stringify(result, null, 2));
    if (result.rejected > 0 && values.apply) {
      process.exit(1);
    }
    process.exit(0);
  } catch (err) {
    console.error(`❌ import-client-data: ${err.message}`);
    process.exit(1);
  }
}
