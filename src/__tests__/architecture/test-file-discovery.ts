import { readdirSync, statSync } from 'node:fs';
import { relative, resolve } from 'node:path';

type Options = { ignore?: string[] };

const SOURCE_EXTENSIONS = /\.(ts|tsx)$/;
const IGNORED_DIRECTORIES = new Set(['node_modules', '.next', 'dist']);

function walk(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    if (entry.isDirectory() && IGNORED_DIRECTORIES.has(entry.name)) return [];
    const file = resolve(dir, entry.name);
    return entry.isDirectory() ? walk(file) : [file];
  });
}

function patternRoot(pattern: string): string {
  const wildcard = pattern.search(/[*!?{[]/);
  const prefix = wildcard < 0 ? pattern : pattern.slice(0, wildcard);
  const slash = prefix.lastIndexOf('/');
  return resolve(process.cwd(), slash < 0 ? '.' : prefix.slice(0, slash));
}

function isIgnored(file: string, rules: string[]): boolean {
  const normalized = file.replaceAll('\\\\', '/');
  return rules.some((rule) => {
    if (rule.includes('__tests__')) return normalized.includes('/__tests__/');
    if (rule.includes('.test.')) return normalized.includes('.test.');
    if (rule.includes('.d.ts')) return normalized.endsWith('.d.ts');
    return false;
  });
}

export function discoverRequiredFiles(pattern: string, options: Options = {}): string[] {
  const root = patternRoot(pattern);
  if (!statSync(root, { throwIfNoEntry: false })) throw new Error('ARCH_SCAN_EMPTY');
  const result = walk(root)
    .filter((file) => SOURCE_EXTENSIONS.test(file))
    .filter((file) => !isIgnored(file, options.ignore ?? []));
  if (!result.length) throw new Error('ARCH_SCAN_EMPTY');
  return result.map((file) => relative(process.cwd(), file));
}
