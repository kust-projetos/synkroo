import { readFileSync } from 'node:fs';
import { FlatCompat } from '@eslint/eslintrc';
import boundaries from 'eslint-plugin-boundaries';

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
  // R4/F3 — gate EFETIVO services → modules via eslint-plugin-boundaries v6.
  // ÚNICA fonte de settings/elements do plugin (flat sobrescreve `settings`
  // por chave: nada de boundaries/* em eslint.rules.json). O resolver
  // typescript faz `@/` resolver para o arquivo real, sem o qual os imports
  // de alias seriam "externos" e o gate passaria vacuamente.
  {
    settings: {
      'boundaries/root-path': '.',
      'boundaries/include': ['src/**/*'],
      'boundaries/elements': [
        { type: 'core', pattern: 'src/core/**' },
        { type: 'module', pattern: 'src/modules/*', mode: 'folder', capture: ['name'] },
        { type: 'service', pattern: 'src/services/*', mode: 'folder', capture: ['name'] },
        { type: 'app', pattern: 'src/app/*' },
        { type: 'lib', pattern: 'src/lib/*' },
      ],
      'import/resolver': {
        typescript: { project: './tsconfig.json' },
      },
    },
  },
  {
    files: ['src/services/**/*.{ts,tsx}'],
    plugins: { boundaries },
    rules: {
      'boundaries/dependencies': ['error', {
        default: 'allow',
        rules: [
          {
            from: { type: 'service' },
            disallow: { to: { type: 'module' } },
            message: 'Services só importam módulos via seam público (raiz, public.ts ou schema/**) — R4',
          },
          {
            from: { type: 'service' },
            allow: { to: { type: 'module', internalPath: 'index.ts' } },
            message: 'Seam público do módulo (barrel)',
          },
          {
            from: { type: 'service' },
            allow: { to: { type: 'module', internalPath: 'public.ts' } },
            message: 'Seam público do módulo (public.ts)',
          },
          {
            from: { type: 'service' },
            allow: { to: { type: 'module', internalPath: 'schema/**' } },
            message: 'Schema do módulo permitido',
          },
        ],
      }],
    },
  },
  {
    // Isenção de testes (política atual): o override de teste do
    // eslint.rules.json já desliga a regra via FlatCompat; este bloco nativo
    // garante o off determinístico após o gate acima, independente da
    // tradução do compat.
    files: ['**/__tests__/**/*.{ts,tsx}', '**/*.test.{ts,tsx}'],
    rules: { 'boundaries/dependencies': 'off' },
  },
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
