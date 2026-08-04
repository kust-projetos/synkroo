import { test, expect } from '@playwright/test'

test('publishes widget asset with JavaScript content type', async ({ request }) => {
  const response = await request.get('/widget.js')

  expect(response.ok()).toBe(true)
  expect(response.headers()['content-type']).toContain('javascript')
  expect(await response.text()).toContain('Synkroo')
})
