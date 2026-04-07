/**
 * Test MiniMax API Connection
 * Run: npx ts-node scripts/test-minimax.ts
 */

import { MiniMaxClient } from '../src/lib/minimax'

async function testMiniMaxConnection() {
  console.log('🔍 Testing MiniMax API Connection...\n')

  const client = new MiniMaxClient()

  // Check environment variables
  const apiKey = process.env.MINIMAX_API_KEY
  const model = process.env.MINIMAX_MODEL

  console.log('📋 Configuration:')
  console.log(`   API Key: ${apiKey ? `${apiKey.substring(0, 10)}...${apiKey.substring(apiKey.length - 10)}` : 'NOT SET'}`)
  console.log(`   Model: ${model || 'default (abab6.5s-chat)'}`)
  console.log(`   API URL: ${process.env.MINIMAX_API_URL || 'https://api.minimax.chat/v1/text/chatcompletion_v2'}\n`)

  if (!apiKey) {
    console.error('❌ MINIMAX_API_KEY not found in environment variables!')
    return
  }

  // Test 1: Simple chat
  console.log('🧪 Test 1: Simple Chat')
  try {
    const response = await client.chat([
      { role: 'user', content: 'Olá! Responda apenas "Conexão OK" em português.' }
    ], { temperature: 0.1, maxTokens: 50 })

    console.log(`   ✅ Response: ${response}`)
    console.log('   ✅ Chat test PASSED\n')
  } catch (error) {
    console.error('   ❌ Chat test FAILED:', error)
    return
  }

  // Test 2: Intent classification
  console.log('🧪 Test 2: Intent Classification')
  try {
    const result = await client.classifyIntent('Quero agendar uma limpeza para quinta-feira')
    console.log(`   Intent: ${result.intent}`)
    console.log(`   Confidence: ${result.confidence}`)
    console.log(`   Entities: ${JSON.stringify(result.entities, null, 2)}`)
    console.log('   ✅ Classification test PASSED\n')
  } catch (error) {
    console.error('   ❌ Classification test FAILED:', error)
  }

  // Test 3: Entity extraction
  console.log('🧪 Test 3: Entity Extraction')
  try {
    const entities = await client.extractEntities('Meu nome é João, quero marcar clareamento dia 15/04 às 14h')
    console.log(`   Entities: ${JSON.stringify(entities, null, 2)}`)
    console.log('   ✅ Entity extraction test PASSED\n')
  } catch (error) {
    console.error('   ❌ Entity extraction test FAILED:', error)
  }

  // Test 4: Emergency detection
  console.log('🧪 Test 4: Emergency Detection')
  try {
    const result = await client.classifyIntent('Estou com muita dor de dente, é urgente!')
    console.log(`   Intent: ${result.intent}`)
    console.log(`   Confidence: ${result.confidence}`)
    if (result.intent === 'emergencia' && result.confidence > 0.9) {
      console.log('   ✅ Emergency correctly detected with high confidence\n')
    } else {
      console.log('   ⚠️ Emergency detection may need tuning\n')
    }
  } catch (error) {
    console.error('   ❌ Emergency test FAILED:', error)
  }

  console.log('✨ MiniMax API tests completed!')
}

testMiniMaxConnection().catch(console.error)