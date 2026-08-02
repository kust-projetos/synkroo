/* eslint-disable no-console */
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
  if (inlineMatch) return inlineMatch[1].split(',').map(s => s.trim().replace(/['"]/g, ''));
  // Match multiline branches block
  const multiline = src.match(/branches:\s*\n((?:\s*-\s+.+\n?)+)/);
  if (!multiline) throw new Error('branches: not found in ci.yml');
  return multiline[1]
    .split('\n')
    .map(line => line.replace(/^\s*-\s*/, '').trim())
    .filter(Boolean)
    .map(s => s.replace(/['"]/g, ''));
}

describe('CI branch filter', () => {
  const src = readFileSync(new URL('../ci.yml', import.meta.url), 'utf-8');

  it("ci.yml push branches includes '**' (allows slash branches)", () => {
    const patterns = extractBranchPatterns(src);
    console.log('ci.yml push branches:', patterns);
    expect(patterns).toContain('**');
  });

  it("ci.yml includes a pull_request trigger for main", () => {
    const hasPrTrigger = /pull_request:\s*\n\s+branches:\s*\[['"]main['"]\]/.test(src);
    console.log('ci.yml has pull_request main trigger:', hasPrTrigger);
    expect(hasPrTrigger).toBe(true);
  });

  it("ci.yml has gitleaks job before build & test", () => {
    const jobOrder = src.indexOf('gitleaks:');
    const ciOrder = src.indexOf('ci:');
    console.log('ci.yml job order — gitleaks:', jobOrder, 'ci:', ciOrder);
    expect(jobOrder).toBeLessThan(ciOrder);
  });
});
