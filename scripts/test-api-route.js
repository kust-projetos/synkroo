/**
 * Test MiniMax via API Route
 * Run: node scripts/test-api-route.js
 */

const API_URL = 'http://localhost:3000/api/chat';

async function test() {
  console.log('🔍 Testing MiniMax via API Route...\n');
  
  try {
    const response = await fetch(API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        messages: [{ role: 'user', content: 'Olá! Responda apenas "OK"' }]
      })
    });
    
    const data = await response.json();
    console.log('Response:', JSON.stringify(data, null, 2));
  } catch (error) {
    console.log('Error:', error.message);
    console.log('\n⚠️  Certifique-se que o servidor está rodando: npm run dev');
  }
}

test();
