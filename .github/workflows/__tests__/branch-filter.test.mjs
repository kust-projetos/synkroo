/**
 * Branch filter contract test for .github/workflows/ci.yml
 * Verifies that push events on branches with '/' are covered.
 *
 * GitHub Actions branch filter:
 *   '*'  — matches any string EXCEPT '/' (no slashes)
 *   '**' — matches any string INCLUDING '/' (slashes allowed)
 *
 * Reference: https://docs.github.com/en/actions/reference/workflow-syntax-for-github-actions#filter-pattern-cheat-sheet
 */

import { readFileSync } from 'fs';

function extractBranchPatterns(src) {
  // Match branches: ['*'] or branches: ["*"] inline on same line
  const inlineMatch = src.match(/branches:\s*\[([^\]]+)\]/);
  if (inlineMatch) {
    return inlineMatch[1].split(',').map(s => s.trim().replace(/['"]/g, '')).filter(Boolean);
  }
  // Multi-line: collect dash items
  const pushIdx = src.indexOf('push:');
  if (pushIdx === -1) return [];
  const afterPush = src.slice(pushIdx);
  const branchesIdx = afterPush.indexOf('branches:');
  if (branchesIdx === -1) return [];
  const afterBranches = afterPush.slice(branchesIdx + 'branches:'.length);
  const lines = afterBranches.split('\n');
  const patterns = [];
  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.match(/^\S/) && !trimmed.startsWith('-')) break;
    const dashMatch = trimmed.match(/^-\s*['"]?([^'"\n#]+)['"]?/);
    if (dashMatch) patterns.push(dashMatch[1].trim());
  }
  return patterns;
}

function branchMatches(pattern, branch) {
  if (Array.isArray(pattern)) return pattern.some(p => branchMatches(p, branch));
  const escaped = pattern
    .replace(/\./g, '\\.')
    .replace(/\*\*/g, '{{DBL}}')
    .replace(/\*/g, '{{STAR}}')
    .replace(/\?/g, '.')
    .replace(/\{\{DBL\}\}/g, '(?:.*)')
    .replace(/\{\{STAR\}\}/g, '[^/]*');
  return new RegExp('^' + escaped + '$').test(branch);
}

const ciYml = readFileSync('.github/workflows/ci.yml', 'utf8');
const patterns = extractBranchPatterns(ciYml);

// Must find patterns
if (patterns.length === 0) {
  console.error('ERROR: no branch patterns found in ci.yml on.push.branches');
  process.exit(1);
}
console.log('Patterns found:', JSON.stringify(patterns));

const testCases = [
  { branch: 'main', expected: true, reason: 'standard branch name' },
  { branch: 'fix/security-integrity-hardening', expected: true, reason: 'branch with / — critical path' },
  { branch: 'feature/foo-bar', expected: true, reason: 'branch with single /' },
  { branch: 'a/b/c', expected: true, reason: 'nested branch path' },
  { branch: 'dev', expected: true, reason: 'simple branch' },
];

let passed = 0;
let failed = 0;

for (const tc of testCases) {
  const result = patterns.some(p => branchMatches(p, tc.branch));
  const ok = result === tc.expected;
  if (ok) {
    passed++;
    console.log(`PASS: '${tc.branch}' -> ${result}  (${tc.reason})`);
  } else {
    failed++;
    console.error(`FAIL: '${tc.branch}' -> ${result} (expected ${tc.expected}) | reason: ${tc.reason}`);
  }
}

console.log(`\nBranch filter contract: ${passed}/${passed + failed} passed`);
if (failed > 0) process.exit(1);
