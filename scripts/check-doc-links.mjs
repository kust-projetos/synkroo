import fs from 'node:fs';
import path from 'node:path';

const roots = ['docs', 'AGENTS.md'];
const markdownLink = /!?\[[^\]]*\]\(([^)]+)\)/g;
const failures = [];

function filesUnder(root) {
  if (!fs.existsSync(root)) return [];
  if (fs.statSync(root).isFile()) return [root];
  return fs.readdirSync(root, { withFileTypes: true }).flatMap((entry) =>
    filesUnder(path.join(root, entry.name)));
}

for (const file of roots.flatMap(filesUnder).filter((file) => file.endsWith('.md') && !file.includes(`${path.sep}archive${path.sep}`))) {
  const text = fs.readFileSync(file, 'utf8');
  for (const match of text.matchAll(markdownLink)) {
    const target = match[1].split('#')[0].trim();
    if (!target || /^(https?:|mailto:|#)/.test(target)) continue;
    const resolved = path.resolve(path.dirname(file), target);
    if (!fs.existsSync(resolved)) failures.push(`${file}: ${target}`);
  }
}

if (failures.length) {
  console.error(`Broken local documentation links:\n${failures.join('\n')}`);
  process.exitCode = 1;
} else {
  console.log('Documentation links: OK');
}
