import { buildFixture, parseOptions, runCli, validateScaleDatabaseUrl } from '../seed-local-scale';

describe('scale seed', () => {
  it('defaults to dry-run small preset', () => expect(parseOptions([])).toEqual({ preset: 'small', seed: 1337, apply: false }));
  it.each([['--apply', '--apply'], ['--preset', 'small', '--preset', 'large'], ['--seed', '1', '--seed', '2'], ['--wat']])('rejects invalid args %j', (...args: string[]) => expect(() => parseOptions(args)).toThrow());
  it.each(['postgres://u:p@db.example/synkroo', 'postgres://u:p@localhost/other', 'not a url'])('rejects unsafe URL %s', (url) => expect(() => validateScaleDatabaseUrl(url)).toThrow());
  it('creates deterministic unique phones and valid appointment references', () => {
    const fixture = buildFixture({ preset: 'small', seed: 7, apply: false });
    expect(fixture).toEqual(buildFixture({ preset: 'small', seed: 7, apply: false }));
    expect(new Set(fixture.patients.map(({ phone }) => phone)).size).toBe(20);
    expect(fixture.appointments).toHaveLength(40);
    for (const appointment of fixture.appointments) expect(fixture.patients.some(({ id }) => id === appointment.patientId)).toBe(true);
  });
  it('does not persist a dry run', async () => {
    const persist = jest.fn();
    await runCli({ persist, print: jest.fn() }, [], {});
    expect(persist).not.toHaveBeenCalled();
  });
  it('persists only after explicit apply and guarded URL', async () => {
    const persist = jest.fn();
    await runCli({ persist, print: jest.fn() }, ['--apply'], { DATABASE_URL: 'postgres://u:p@127.0.0.1/synkroo' });
    expect(persist).toHaveBeenCalledTimes(1);
  });
});
