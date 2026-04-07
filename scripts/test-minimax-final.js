/**
 * Test MiniMax API Connection - Final Correct Version
 * Run: node scripts/test-minimax-final.js
 */

require('dotenv').config({ path: '.env.local' });

const MINIMAX_API_KEY = process.env.MINIMAX_API_KEY;
// Correct endpoint from user: https://api.minimax.io/v1
const MINIMAX_MODEL = 'MiniMax-M2.7';
const MINIMAX_API_URL = 'https://api.minimax.io/v1/text/chatcompletion_v2';

console.log('🔍 Testing MiniMax API Connection (Final)...\n');

console.log('📋 Configuration:');
console.log(`   API Key: ${MINIMAX_API_KEY ? `${MINIMAX_API_KEY.substring(0, 10)}...${MINIMAX_API_KEY.substring(MINIMAX_API_KEY.length - 10)}` : 'NOT SET'}`);
console.log(`   Model: ${MINIMAX_MODEL}`);
console.log(`   API URL: ${MINIMAX_API_URL}\n`);

if (!MINIMAX_API_KEY) {
  console.error('❌ MINIMAX_API_KEY not found in environment variables!');
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
        max_tokens: 50
      })
    });

    console.log(`   Status: ${response.status}`);
    const text = await response.text();
    console.log(`   Raw Response: ${text.substring(0, 500)}\n`);

    try {
      const data = JSON.parse(text);
      if (data.base_resp?.status_code === 0 || response.ok) {
        const content = data.choices?.[0]?.message?.content || 'No content';
        console.log(`   ✅ Response: ${content}`);
        if (data.usage) console.log(`   ✅ Usage: ${JSON.stringify(data.usage)}\n`);
        return data;
      } else {
        console.log(`   ❌ Error: ${data.base_resp?.status_msg || 'Unknown error'}\n`);
      }
    } catch (e) {
      console.log(`   ❌ Parse error: ${e.message}\n`);
    }
  } catch (error) {
    console.log(`   ❌ Request failed: ${error.message}\n`);
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
        max_tokens: 100
      })
    });

    const text = await response.text();
    console.log(`   Status: ${response.status}`);

    try {
      const data = JSON.parse(text);
      if (data.base_resp?.status_code === 0 || response.ok) {
        const content = data.choices?.[0]?.message?.content || '';
        console.log(`   ✅ Response: ${content}`);
        const jsonMatch = content.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          const parsed = JSON.parse(jsonMatch[0]);
          console.log(`   ✅ Intent: ${parsed.intent}`);
          console.log(`   ✅ Confidence: ${parsed.confidence}\n`);
        }
        return data;
      } else {
        console.log(`   ❌ Error: ${data.base_resp?.status_msg || text}\n`);
      }
    } catch (e) {
      console.log(`   ❌ Parse error: ${e.message}\n`);
    }
  } catch (error) {
    console.log(`   ❌ Request failed: ${error.message}\n`);
  }
}

// Run tests
async function runTests() {
  await testChat();
  await testIntentClassification();
  console.log('✨ Tests completed!');
}

runTests();