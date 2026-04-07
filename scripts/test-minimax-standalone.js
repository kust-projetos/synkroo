/**
 * Test MiniMax API Connection - Standalone
 * Run: node scripts/test-minimax-standalone.js
 */

require('dotenv').config({ path: '.env.local' });

const MINIMAX_API_KEY = process.env.MINIMAX_API_KEY;
const MINIMAX_MODEL = process.env.MINIMAX_MODEL || 'MiniMax-M2.7';
const MINIMAX_API_URL = process.env.MINIMAX_API_URL || 'https://api.minimax.chat/v1/text/chatcompletion_v2';

console.log('🔍 Testing MiniMax API Connection...\n');

console.log('📋 Configuration:');
console.log(`   API Key: ${MINIMAX_API_KEY ? `${MINIMAX_API_KEY.substring(0, 10)}...${MINIMAX_API_KEY.substring(MINIMAX_API_KEY.length - 10)}` : 'NOT SET'}`);
console.log(`   Model: ${MINIMAX_MODEL}`);
console.log(`   API URL: ${MINIMAX_API_URL}\n`);

if (!MINIMAX_API_KEY) {
  console.error('❌ MINIMAX_API_KEY not found in environment variables!');
  console.log('\nPlease set MINIMAX_API_KEY in your .env.local file');
  process.exit(1);
}

// Test chat completion
async function testChat() {
  console.log('🧪 Test 1: Simple Chat');

  try {
    const response = await fetch(MINIMAX_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${MINIMAX_API_KEY}`,
      },
      body: JSON.stringify({
        model: MINIMAX_MODEL,
        messages: [
          { role: 'user', content: 'Olá! Responda apenas "Conexão OK" em português.' }
        ],
        temperature: 0.1,
        max_tokens: 50,
        stream: false
      })
    });

    const data = await response.json();

    if (response.ok) {
      const content = data.choices?.[0]?.message?.content || 'No content';
      console.log(`   ✅ Status: ${response.status}`);
      console.log(`   ✅ Response: ${content}`);
      console.log(`   ✅ Usage: ${JSON.stringify(data.usage)}\n`);
      return data;
    } else {
      console.log(`   ❌ Status: ${response.status}`);
      console.log(`   ❌ Error: ${JSON.stringify(data)}\n`);
      throw new Error(`API returned ${response.status}`);
    }
  } catch (error) {
    console.log(`   ❌ Request failed: ${error.message}\n`);
    throw error;
  }
}

// Test intent classification
async function testIntentClassification() {
  console.log('🧪 Test 2: Intent Classification');

  const systemPrompt = `Você é um classificador de intenções. Retorne APENAS um JSON válido.
{"intent": "agendamento" | "duvida" | "emergencia" | "confirmacao" | "reclamacao" | "outros", "confidence": 0.0-1.0}`;

  try {
    const response = await fetch(MINIMAX_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${MINIMAX_API_KEY}`,
      },
      body: JSON.stringify({
        model: MINIMAX_MODEL,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: 'Quero agendar uma limpeza para quinta-feira' }
        ],
        temperature: 0.3,
        max_tokens: 100,
        stream: false
      })
    });

    const data = await response.json();

    if (response.ok) {
      const content = data.choices?.[0]?.message?.content || '';
      console.log(`   ✅ Status: ${response.status}`);
      console.log(`   ✅ Response: ${content}`);

      // Try to parse JSON
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        console.log(`   ✅ Intent: ${parsed.intent}`);
        console.log(`   ✅ Confidence: ${parsed.confidence}\n`);
      }
      return data;
    } else {
      console.log(`   ❌ Status: ${response.status}`);
      console.log(`   ❌ Error: ${JSON.stringify(data)}\n`);
      throw new Error(`API returned ${response.status}`);
    }
  } catch (error) {
    console.log(`   ❌ Request failed: ${error.message}\n`);
    throw error;
  }
}

// Test emergency detection
async function testEmergency() {
  console.log('🧪 Test 3: Emergency Detection');

  const systemPrompt = `Você é um classificador de intenções. Retorne APENAS um JSON válido.
{"intent": "agendamento" | "duvida" | "emergencia" | "confirmacao" | "reclamacao" | "outros", "confidence": 0.0-1.0}`;

  try {
    const response = await fetch(MINIMAX_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${MINIMAX_API_KEY}`,
      },
      body: JSON.stringify({
        model: MINIMAX_MODEL,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: 'Estou com muita dor de dente, é urgente!' }
        ],
        temperature: 0.3,
        max_tokens: 100,
        stream: false
      })
    });

    const data = await response.json();

    if (response.ok) {
      const content = data.choices?.[0]?.message?.content || '';
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        console.log(`   Intent: ${parsed.intent}`);
        console.log(`   Confidence: ${parsed.confidence}`);
        if (parsed.intent === 'emergencia' && parsed.confidence > 0.9) {
          console.log('   ✅ Emergency correctly detected with high confidence\n');
        } else {
          console.log('   ⚠️ Emergency detection may need tuning\n');
        }
      }
      return data;
    } else {
      console.log(`   ❌ Status: ${response.status}`);
      throw new Error(`API returned ${response.status}`);
    }
  } catch (error) {
    console.log(`   ❌ Request failed: ${error.message}\n`);
    throw error;
  }
}

// Run all tests
async function runTests() {
  try {
    await testChat();
    await testIntentClassification();
    await testEmergency();

    console.log('✨ MiniMax API tests completed successfully!');
    console.log('\n✅ All tests passed - MiniMax API is working correctly!');
  } catch (error) {
    console.log('\n❌ Some tests failed. Please check:');
    console.log('   1. API key is correct');
    console.log('   2. Model name is valid (MiniMax-M2.7)');
    console.log('   3. API endpoint is accessible');
    console.log('   4. Account has sufficient credits');
    console.log('\n📝 Error details:', error.message);
  }
}

runTests();