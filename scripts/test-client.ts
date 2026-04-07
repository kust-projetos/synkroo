/**
 * Test MiniMax Client - Using the actual client class
 * Run: npx ts-node --esm scripts/test-client.ts
 */

import { MiniMaxClient } from '../src/lib/minimax'

async function testClient() {
  console.log('🔍 Testing MiniMaxClient...\n')

  const client = new MiniMaxClient()

  // Test 1: Simple chat
  console.log('🧪 Test 1: Simple Chat')
  try {
    const response = await client.chat([
      { role: 'user', content: 'Olá! Responda apenas "Conexão OK" em português.' }
    ], { temperature: 0.1, maxTokens: 50 })

    console.log(`   ✅ Response: ${response}\n`)
  } catch (error) {
    console.log(`   ❌ Error: ${error}\n`)
    return
  }

  // Test 2: Intent classification
  console.log('🧪 Test 2: Intent Classification')
  try {
    const result = await client.classifyIntent('Quero agendar uma limpeza para quinta-feira')
    console.log(`   Intent: ${result.intent}`)
    console.log(`   Confidence: ${result.confidence}`)
    console.log(`   Entities: ${JSON.stringify(result.entities)}\n`)
  } catch (error) {
    console.log(`   ❌ Error: ${error}\n`)
  }

  // Test 3: Emergency detection
  console.log('🧪 Test 3: Emergency Detection')
  try {
    const result = await client.classifyIntent('Estou com muita dor de dente, é urgente!')
    console.log(`   Intent: ${result.intent}`)
    console.log(`   Confidence: ${result.confidence}`)
    if (result.intent === 'emergencia' && result.confidence > 0.9) {
      console.log('   ✅ Emergency correctly detected!\n')
    }
  } catch (error) {
    console.log(`   ❌ Error: ${error}\n`)
  }

  // Test 4: Entity extraction
  console.log('🧪 Test 4: Entity Extraction')
  try {
    const entities = await client.extractEntities('Meu nome é João, quero marcar clareamento dia 15/04 às 14h')
    console.log(`   Entities: ${JSON.stringify(entities, null, 2)}\n`)
  } catch (error) {
    console.log(`   ❌ Error: ${error}\n`)
  }

  console.log('✨ All tests completed!')
}

testClient().catch(console.error)