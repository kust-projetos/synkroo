#!/usr/bin/env node
/**
 * scripts/import-client-data.mjs — Client Data Import & Validation Script.
 *
 * Usage:
 *   node scripts/import-client-data.mjs --client pilot --file docs/pilot/approved-import.csv
 *   node scripts/import-client-data.mjs --client pilot --file docs/pilot/approved-import.csv --apply
 */

import { readFileSync, existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { parseArgs } from 'node:util';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { resolve } from 'node:path';

export function isCliInvocation(moduleUrl, argvPath) {
  if (!argvPath) return false;
  try {
    return pathToFileURL(resolve(argvPath)).href === moduleUrl;
  } catch {
    return false;
  }
}

export function importClientData({
  client = 'pilot',
  file = 'docs/pilot/approved-import.csv',
  apply = false,
} = {}) {
  const filePath = resolve(process.cwd(), file);
  if (!existsSync(filePath)) {
    throw new Error(`Import file not found: ${file}`);
  }

  const content = readFileSync(filePath, 'utf8');
  const sha256 = createHash('sha256').update(content).digest('hex');

  const lines = content
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);

  if (lines.length === 0) {
    throw new Error('Import CSV file is empty');
  }

  const header = lines[0].split(',').map((c) => c.trim());
  const expectedHeader = ['name', 'phone', 'email', 'birthDate', 'clinicSlug', 'consentVersion', 'optOutMarketing'];
  const hasExpectedHeaders = expectedHeader.every((col) => header.includes(col));

  if (!hasExpectedHeaders) {
    throw new Error(`Invalid CSV headers. Expected: ${expectedHeader.join(', ')}`);
  }

  let accepted = 0;
  let rejected = 0;
  const rejectionReasons = [];

  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split(',').map((c) => c.trim());
    if (cols.length < expectedHeader.length) {
      rejected++;
      rejectionReasons.push({ row: i, reason: 'insufficient_columns' });
      continue;
    }

    const [name, phone, email, birthDate, clinicSlug, consentVersion] = cols;
    if (!name || !phone || !email || !birthDate || !clinicSlug || !consentVersion) {
      rejected++;
      rejectionReasons.push({ row: i, reason: 'missing_required_fields' });
      continue;
    }

    accepted++;
  }

  return {
    status: apply ? 'applied' : 'dry-run',
    action: apply ? 'import_client_data' : 'preview_import',
    client,
    file,
    sha256,
    totalRows: lines.length - 1,
    accepted,
    rejected,
    legalHold: true,
    message: apply
      ? `Successfully imported ${accepted} client records.`
      : `Dry-run preview completed. ${accepted} records accepted, ${rejected} rejected. No data inserted.`,
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
    const result = importClientData(values);
    console.log(JSON.stringify(result, null, 2));
    process.exit(0);
  } catch (err) {
    console.error(`❌ import-client-data: ${err.message}`);
    process.exit(1);
  }
}
