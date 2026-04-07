/**
 * Test MiniMax JSON Response
 */

require('dotenv').config({ path: '.env.local' });

const MINIMAX_API_KEY = process.env.MINIMAX_API_KEY;
const MINIMAX_MODEL = process.env.MINIMAX_MODEL || 'MiniMax-M2.7';
const MINIMAX_API_URL = 'https://api.minimax.io/v1/text/chatcompletion_v2';

async function testJsonResponse() {
  console.log('🧪 Testing MiniMax JSON Response...\n');

  const response = await fetch(MINIMAX_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${MINIMAX_API_KEY}`,
    },
    body: JSON.stringify({
      model: MINIMAX_MODEL,
      messages: [
        {
          role: 'system',
          content: `Você é um classificador de intenções. Retorne APENAS um JSON válido (sem markdown, sem code blocks).

{"intent": "emergencia" | "agendamento" | "outros", "confidence": 0.0 a 1.0, "entities": {}}

RETORNE APENAS O JSON.`
        },
        {
          role: 'user',
          content: 'Estou com muita dor de dente, é urgente!'
        }
      ],
      temperature: 0.3,
      max_tokens: 200
    })
  });

  const data = await response.json();

  console.log('📊 Full Response:');
  console.log(JSON.stringify(data, null, 2));

  // Get content
  let content = data.choices?.[0]?.message?.content || data.reply || '';
  console.log('\n📝 Raw Content:');
  console.log(content);

  // Strip thinking
  content = content.replace(/<tool_call>[\s\S]*?<\/think>/g, '').trim();
  console.log('\n✂️ After stripping thinking:');
  console.log(content);

  // Try to extract JSON
  const jsonMatch = content.match(/\{[\s\S]*\}/);
  if (jsonMatch) {
    console.log('\n📋 Extracted JSON:');
    console.log(jsonMatch[0]);

    try {
      const parsed = JSON.parse(jsonMatch[0]);
      console.log('\n✅ Parsed successfully:', parsed);
    } catch (e) {
      console.log('\n❌ Parse error:', e.message);
      console.log('\nCharacter codes around position 50:');
      const str = jsonMatch[0];
      for (let i = 45; i < 60 && i < str.length; i++) {
        console.log(`  pos ${i}: '${str[i]}' (code ${str.charCodeAt(i)})`);
      }
    }
  }
}

testJsonResponse().catch(console.error);