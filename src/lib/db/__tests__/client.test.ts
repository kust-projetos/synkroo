/** @jest-environment node */

// Unmock o client para testar a lógica real de seleção de connection string.
// jest.setup.ts mocka @/lib/db/client para todos os outros testes.
jest.unmock('@/lib/db/client');

import { Pool } from 'pg';
import { setDbConnectionString, resolveConnectionString, getDb, closeDb } from '../client';

describe('DB client — connection string resolution', () => {
  afterEach(async () => {
    // Reset internal state between tests
    setDbConnectionString(null);
    delete (globalThis as { __SYNKROO_HYPERDRIVE?: string }).__SYNKROO_HYPERDRIVE;
    delete (process.env as any).DATABASE_URL;
    await closeDb();
  });

  it('uses HYPERDRIVE connection string when set (Workers runtime)', () => {
    setDbConnectionString('postgres://hyperdrive:secret@hyperdrive.internal:5432/synkroo');
    const url = resolveConnectionString();
    expect(url).toBe('postgres://hyperdrive:secret@hyperdrive.internal:5432/synkroo');
  });

  it('uses the middleware-provided Hyperdrive connection', () => {
    (globalThis as { __SYNKROO_HYPERDRIVE?: string }).__SYNKROO_HYPERDRIVE =
      'postgres://global:secret@hyperdrive.internal:5432/synkroo';

    expect(resolveConnectionString()).toBe(
      'postgres://global:secret@hyperdrive.internal:5432/synkroo',
    );
  });

  it('refreshes the Hyperdrive connection when the runtime rotates it', () => {
    const runtime = globalThis as { __SYNKROO_HYPERDRIVE?: string };
    runtime.__SYNKROO_HYPERDRIVE = 'postgres://first:secret@hyperdrive.internal:5432/synkroo';
    expect(resolveConnectionString()).toContain('first:secret');

    runtime.__SYNKROO_HYPERDRIVE = 'postgres://second:secret@hyperdrive.internal:5432/synkroo';
    expect(resolveConnectionString()).toContain('second:secret');
  });

  it('falls back to DATABASE_URL when hyperdrive is not set (dev/local)', () => {
    process.env.DATABASE_URL = 'postgres://local:dev@localhost:55432/synkroo';
    const url = resolveConnectionString();
    expect(url).toBe('postgres://local:dev@localhost:55432/synkroo');
  });

  it('throws explicit error when neither hyperdrive nor DATABASE_URL is available', () => {
    expect(() => resolveConnectionString()).toThrow(
      /DATABASE_URL/i,
    );
  });
});

describe('DB client — getDb() interface preserved', () => {
  afterEach(async () => {
    setDbConnectionString(null);
    await closeDb();
  });

  it('getDb() returns the cached db instance on subsequent calls', () => {
    process.env.DATABASE_URL = 'postgres://test:test@localhost:5432/test';
    const db1 = getDb();
    const db2 = getDb();
    expect(db1).toBe(db2);
  });

  it('registers an idle-pool error listener for suspended Worker isolates', () => {
    const onSpy = jest.spyOn(Pool.prototype, 'on');
    process.env.DATABASE_URL = 'postgres://test:test@localhost:5432/test';

    getDb();

    expect(onSpy).toHaveBeenCalledWith('error', expect.any(Function));
    onSpy.mockRestore();
  });
});
