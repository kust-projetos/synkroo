// Wrapper Windows-compatível para o bundle analyzer.
// `ANALYZE=true next build` não funciona no cmd/PowerShell, então este
// script injeta a env var via spawn e roda o build. Uso: `npm run analyze`.
import { spawn } from 'node:child_process'

const child = spawn('npx next build', {
  stdio: 'inherit',
  shell: true,
  env: { ...process.env, ANALYZE: 'true' },
})

child.on('exit', (code) => process.exit(code ?? 1))
