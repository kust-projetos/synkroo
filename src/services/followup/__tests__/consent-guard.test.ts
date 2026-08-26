import { assertConsentVersion } from '../consent-guard';

describe('F7.08 consent versionado', () => {
  test('passes when version matches and not opted-out', () => {
    expect(() =>
      assertConsentVersion({ patientId: 'p1', version: 3, optOutMarketing: false }, 3),
    ).not.toThrow();
  });

  test('throws consent missing when null', () => {
    expect(() => assertConsentVersion(null, 1)).toThrow(/consent missing/);
  });

  test('throws stale when version mismatch', () => {
    expect(() =>
      assertConsentVersion({ patientId: 'p1', version: 2, optOutMarketing: false }, 1),
    ).toThrow(/consent stale/);
  });

  test('throws opted-out blocks dispatch', () => {
    expect(() =>
      assertConsentVersion({ patientId: 'p1', version: 1, optOutMarketing: true }, 1),
    ).toThrow(/opted-out/);
  });
});
