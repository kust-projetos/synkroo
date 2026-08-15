import { execFileSync } from 'node:child_process';
import { resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

export const VERIFY_STEPS = [
  { name: 'lint', command: 'run', args: ['lint'] },
  { name: 'typecheck', command: 'run', args: ['typecheck'] },
  { name: 'typecheck:ia-bridge', command: 'run', args: ['typecheck:ia-bridge'] },
  { name: 'typecheck:ia-agent', command: 'run', args: ['typecheck:ia-agent'] },
  { name: 'coverage', command: 'test', args: ['--', '--runInBand', '--coverage'] },
  { name: 'contracts', command: 'run', args: ['test:release'] },
];

const NPM = process.platform === 'win32' ? (process.env.ComSpec || 'cmd.exe') : 'npm';
const NPM_PREFIX = process.platform === 'win32' ? ['/d', '/s', '/c', 'npm.cmd'] : [];

export function executeVerifyStep(step) {
  try {
    execFileSync(NPM, [...NPM_PREFIX, step.command, ...step.args], {
      cwd: resolve(fileURLToPath(new URL('..', import.meta.url))),
      stdio: 'inherit',
      env: process.env,
    });
    return 0;
  } catch (error) {
    return typeof error?.status === 'number' ? error.status : 1;
  }
}

export function runVerify({ execute = executeVerifyStep, report = console.log } = {}) {
  for (const step of VERIFY_STEPS) {
    report(`[verify] ${step.name}`);
    const status = execute(step);
    if (status !== 0) {
      report(`[verify] ${step.name} failed with exit ${status}`);
      return status;
    }
  }
  report('[verify] all gates passed');
  return 0;
}

export function isMainModule(metaUrl, argv1) {
  if (!metaUrl || !argv1) return false;
  return pathToFileURL(resolve(argv1)).href === metaUrl;
}

if (isMainModule(import.meta.url, process.argv[1])) {
  process.exitCode = runVerify();
}
