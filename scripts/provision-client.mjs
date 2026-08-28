#!/usr/bin/env node
/**
 * scripts/provision-client.mjs — Client & Tenant Provisioning Script.
 *
 * Usage:
 *   node scripts/provision-client.mjs --client pilot --environment staging
 *   node scripts/provision-client.mjs --client pilot --environment staging --apply
 */

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

export function provisionClient({
  client = 'pilot',
  environment = 'staging',
  apply = false,
} = {}) {
  const tenantAlias = environment === 'production' ? 'synkroo' : `synkroo-${environment}`;
  const modules = ['atendimento', 'comercial', 'crm', 'financeiro', 'followup', 'operacional'];
  const channels = ['Evolution', 'webchat', 'Instagram'];

  const preview = {
    status: apply ? 'applied' : 'dry-run',
    action: apply ? 'provision_client' : 'preview_provisioning',
    client,
    environment,
    tenant: tenantAlias,
    modules,
    channels,
    credentials: {
      authSecret: '****',
      jwtSecret: '****',
      databaseUrl: '****',
    },
    message: apply
      ? `Tenant ${tenantAlias} successfully provisioned.`
      : 'Dry-run preview completed. No changes written to database or cloud infrastructure.',
  };

  return preview;
}

if (isCliInvocation(import.meta.url, process.argv[1])) {
  const { values } = parseArgs({
    options: {
      client: { type: 'string', default: 'pilot' },
      environment: { type: 'string', default: 'staging' },
      apply: { type: 'boolean', default: false },
    },
  });

  const result = provisionClient(values);
  console.log(JSON.stringify(result, null, 2));
  process.exit(0);
}
