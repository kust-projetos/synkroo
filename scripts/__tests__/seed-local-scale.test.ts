import { buildFixture, parseOptions, runCli, validateScaleDatabaseUrl } from '../seed-local-scale';

describe('scale seed', () => {
  it('defaults to dry-run small preset', () => expect(parseOptions([])).toEqual({ preset: 'small', seed: 1337, apply: false }));
  it.each([['--apply', '--apply'], ['--preset', 'small', '--preset', 'large'], ['--seed', '1', '--seed', '2'], ['--wat']])('rejects invalid args %j', (...args: string[]) => expect(() => parseOptions(args)).toThrow());
  it.each(['postgres://u:p@db.example/synkroo', 'postgres://u:p@localhost/other', 'not a url'])('rejects unsafe URL %s', (url) => expect(() => validateScaleDatabaseUrl(url)).toThrow());
  it('parses valid preset and seed', () => expect(parseOptions(['--preset', 'large', '--seed', '-7', '--apply'])).toEqual({ preset: 'large', seed: -7, apply: true }));
  it('creates deterministic fixture values', () => {
    const fixture = buildFixture({ preset: 'small', seed: 7, apply: false });
    expect(fixture).toEqual(buildFixture({ preset: 'small', seed: 7, apply: false }));
    expect(fixture.clinic.slug).toBe('clinica-demo');
    expect(fixture.patients[0]).toEqual({ id: '3476238a-1f68-5d56-ad1d-7dbd692907c8', name: 'Demo Patient 1', phone: '11000700001' });
    expect(new Set(fixture.patients.map(({ phone }) => phone)).size).toBe(20);
    expect(fixture.appointments).toHaveLength(40);
    expect(fixture.appointments[0].scheduledAt).toBe('2025-01-01T08:00:00.000Z');
    for (const appointment of fixture.appointments) expect(fixture.patients.some(({ id }) => id === appointment.patientId)).toBe(true);
  });
  it('creates large fixture', () => { const fixture = buildFixture({ preset: 'large', seed: 1337, apply: false }); expect(fixture.patients).toHaveLength(200); expect(fixture.appointments).toHaveLength(400); });
  it('does not persist a dry run and prints exact summary', async () => {
    const persist = jest.fn(); const print = jest.fn();
    await runCli({ persist, print }, [], {});
    expect(persist).not.toHaveBeenCalled();
    expect(print).toHaveBeenCalledWith('{"preset":"small","patients":20,"appointments":40,"apply":false}');
  });
  it('rejects apply without URL before persistence', async () => { const persist = jest.fn(); await expect(runCli({ persist, print: jest.fn() }, ['--apply'], {})).rejects.toThrow(/loopback/); expect(persist).not.toHaveBeenCalled(); });
  it('persists only after explicit apply and guarded URL', async () => {
    const persist = jest.fn();
    await runCli({ persist, print: jest.fn() }, ['--apply'], { DATABASE_URL: 'postgres://u:p@127.0.0.1/synkroo' });
    expect(persist).toHaveBeenCalledTimes(1);
  });
});
