/**
 * Test MiniMax module directly
 */

import { MiniMaxClient } from '../src/lib/minimax'

async function test() {
  console.log('🧪 Testing MiniMaxClient module...\n')

  const client = new MiniMaxClient()

  const message = "Estou com muita dor de dente, é urgente!"
  console.log('📩 Message:', message)
  console.log('---\n')

  try {
    const result = await client.classifyIntent(message)
    console.log('✅ Result:', result)
  } catch (error) {
    console.error('❌ Error:', error)
  }
}

test().catch(console.error)