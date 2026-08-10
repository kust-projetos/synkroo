import fs from 'node:fs'
import path from 'node:path'

function productionFiles(root: string): string[] {
  const entries = fs.readdirSync(root, { withFileTypes: true })
  return entries.flatMap((entry) => {
    const filePath = path.join(root, entry.name)
    if (entry.isDirectory()) {
      if (['__tests__', 'node_modules', '.next'].includes(entry.name)) return []
      return productionFiles(filePath)
    }
    if (!/\.(ts|tsx|mjs)$/.test(entry.name) || /\.(test|spec)\./.test(entry.name)) return []
    return [filePath]
  })
}

function sourceText(): string {
  const repositoryRoot = path.resolve(__dirname, '../../..')
  const files = [
    ...productionFiles(path.join(repositoryRoot, 'src')),
    path.join(repositoryRoot, 'worker-entry.mjs'),
  ]
  return files.map((filePath) => fs.readFileSync(filePath, 'utf8')).join('\n')
}

test('production source contains no stale legacy webhook contracts', () => {
  const source = sourceText()
  const staleMarkers = [
    ['legacy', '_agent_removed'].join(''),
    ['ai_enabled', ': false'].join(''),
    ['TODO(', 'W5.3', ')'].join(''),
    ['TODO ', 'W5.3'].join(''),
  ]

  for (const marker of staleMarkers) {
    expect(source).not.toContain(marker)
  }

  expect(source).not.toMatch(/success\s*:\s*true[\s\S]{0,200}skipped\s*:\s*true/)
})
