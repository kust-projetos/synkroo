const TEST_EMAIL = 'admin@clinicademo.com'
const TEST_PASSWORD = 'demo123'
export const testCredentials = { email: TEST_EMAIL, password: TEST_PASSWORD }
let counter = Date.now()
export function uniqueId() { return ++counter }
export function randomName(prefix = 'Test') { return `${prefix} ${uniqueId()}` }
export function randomEmail() { return `test.${uniqueId()}@synkroo-e2e.com` }
export function randomPhone() { return `119${String(Math.floor(Math.random() * 100000000)).padStart(8, '0')}` }
export function futureDate(daysFromNow = 1) { const d = new Date(); d.setDate(d.getDate() + daysFromNow); return d.toISOString().split('T')[0] }
