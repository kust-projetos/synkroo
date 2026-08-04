import { discoverRequiredFiles } from './test-file-discovery';

test('fails closed when architecture scan finds no production files', () => {
  expect(() => discoverRequiredFiles('missing/**/*.ts')).toThrow('ARCH_SCAN_EMPTY');
});

test('discovers real production files', () => {
  expect(discoverRequiredFiles('src/**/*.{ts,tsx}', {
    ignore: ['**/*.test.*', '**/__tests__/**', '**/*.d.ts'],
  }).length).toBeGreaterThan(0);
});
