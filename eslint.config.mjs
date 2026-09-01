import { readFileSync } from 'node:fs';
import { FlatCompat } from '@eslint/eslintrc';

const legacy = JSON.parse(readFileSync(new URL('./eslint.rules.json', import.meta.url), 'utf8'));
const compat = new FlatCompat({ baseDirectory: import.meta.dirname });

const eslintConfig = [
  {
    ignores: [
      '.next/**',
      '.open-next/**',
      'coverage/**',
      'node_modules/**',
      'next-env.d.ts',
      'playwright-report/**',
      'test-results/**',
      'ops/vps/whatsapp-sidecar/dist/**',
    ],
  },
  {
    linterOptions: { reportUnusedDisableDirectives: 'off' },
  },
  ...compat.config(legacy),
  {
    files: ['scripts/**/*.{js,mjs,ts}', 'jest.*.config.js'],
    rules: {
      'no-console': 'off',
      '@typescript-eslint/no-require-imports': 'off',
    },
  },
  {
    files: ['public/widget.js'],
    rules: { 'react/no-deprecated': 'off' },
  },
];

export default eslintConfig;
