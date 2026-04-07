/**
 * Debug MiniMax API Response
 */

require('dotenv').config({ path: '.env.local' });

const MINIMAX_API_KEY = process.env.MINIMAX_API_KEY;
const MINIMAX_MODEL = process.env.MINIMAX_MODEL || 'MiniMax-M2.7';
// Use correct MiniMax API URL
const MINIMAX_API_URL = 'https://api.minimax.io/v1/text/chatcompletion_v2';

console.log('🔍 Debug MiniMax API Response...\n');
console.log(`Model: ${MINIMAX_MODEL}`);

async function debugResponse() {
  const response = await fetch(MINIMAX_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${MINIMAX_API_KEY}`,
    },
    body: JSON.stringify({
      model: MINIMAX_MODEL,
      messages: [
        { role: 'user', content: 'Diga apenas "Olá Mundo"' }
      ],
      temperature: 0.1,
      max_tokens: 50
    })
  });

  console.log(`Status: ${response.status}`);
  const text = await response.text();
  console.log('\n📄 Raw Response:');
  console.log(text);

  try {
    const json = JSON.parse(text);
    console.log('\n📊 Parsed JSON:');
    console.log(JSON.stringify(json, null, 2));
  } catch (e) {
    console.log('\n❌ Failed to parse JSON');
  }
}

debugResponse().catch(console.error);