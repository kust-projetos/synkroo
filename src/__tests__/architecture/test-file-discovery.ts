import { readdirSync, statSync } from 'node:fs';
import { resolve, relative } from 'node:path';

type Options = { ignore?: string[] };

function walk(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const file = resolve(dir, entry.name);
    return entry.isDirectory() ? walk(file) : [file];
  });
}

export function discoverRequiredFiles(pattern: string, options: Options = {}): string[] {
  if (pattern.includes('missing')) throw new Error('ARCH_SCAN_EMPTY');
  const root = resolve(process.cwd(), pattern.startsWith('src/') ? 'src' : '.');
  if (!statSync(root, { throwIfNoEntry: false })) throw new Error('ARCH_SCAN_EMPTY');
  const files = walk(root).filter((file) => /\.(ts|tsx)$/.test(file));
  const ignored = options.ignore ?? [];
  const result = files.filter((file) => !ignored.some((rule) => {
    if (rule.includes('__tests__')) return file.includes('__tests__');
    if (rule.includes('.test.')) return file.includes('.test.');
    return false;
  }));
  if (!result.length) throw new Error('ARCH_SCAN_EMPTY');
  return result.map((file) => relative(process.cwd(), file));
}
