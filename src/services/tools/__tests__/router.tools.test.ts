import { ROUTER_TOOLS } from '../router.tools'
describe('router.tools', () => {
  it('exports tool array', () => { expect(Array.isArray(ROUTER_TOOLS)).toBe(true); expect(ROUTER_TOOLS.length).toBeGreaterThan(0) })
  it('each tool has required fields', () => { ROUTER_TOOLS.forEach(t => { expect(t.name).toBeTruthy(); expect(t.description).toBeTruthy() }) })
})
