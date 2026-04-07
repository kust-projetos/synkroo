/**
 * Test with exact function from minimax.ts
 */

require('dotenv').config({ path: '.env.local' });

const MINIMAX_API_KEY = process.env.MINIMAX_API_KEY;
const MINIMAX_MODEL = process.env.MINIMAX_MODEL || 'MiniMax-M2.7';
const MINIMAX_API_URL = 'https://api.minimax.io/v1/text/chatcompletion_v2';

/**
 * Extract first complete JSON object from text
 */
function extractFirstJson(text) {
  let start = -1
  let depth = 0
  let inString = false
  let escape = false

  for (let i = 0; i < text.length; i++) {
    const char = text[i]

    if (escape) {
      escape = false
      continue
    }

    if (char === '\\') {
      escape = true
      continue
    }

    if (char === '"') {
      inString = !inString
      continue
    }

    if (!inString) {
      if (char === '{') {
        if (start === -1) start = i
        depth++
      } else if (char === '}') {
        depth--
        if (depth === 0 && start !== -1) {
          return text.substring(start, i + 1)
        }
      }
    }
  }

  return null
}

/**
 * Strip thinking blocks
 */
function stripThinkingBlocks(content) {
  let result = content.replace(/\u240e[\s\S]*?\u240f/g, '')
  result = result.replace(/\u240e[\s\S]*?(?=\{|\[|$)/g, '')
  result = result.replace(/\u240e/g, '')
  result = result.replace(/\u240f/g, '')
  return result.trim()
}

async function chat(messages, options = {}) {
  const response = await fetch(MINIMAX_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${MINIMAX_API_KEY}`,
    },
    body: JSON.stringify({
      model: MINIMAX_MODEL,
      messages,
      temperature: options.temperature ?? 0.7,
      max_tokens: options.maxTokens ?? 2048,
      stream: false,
    })
  });

  const data = await response.json();

  if (data.base_resp && data.base_resp.status_code !== 0) {
    throw new Error(`MiniMax API error: ${data.base_resp.status_msg || 'Unknown error'}`);
  }

  let content = data.choices?.[0]?.message?.content || data.reply || '';
  content = stripThinkingBlocks(content);
  return content;
}

async function classifyIntent(message) {
  const systemPrompt = `Você é um classificador de intenções especializado para uma clínica odontológica brasileira.
Analise a mensagem do paciente e retorne APENAS um JSON válido (sem markdown, sem code blocks, sem explicação).

{
  "intent": "agendamento" | "duvida" | "emergencia" | "confirmacao" | "reclamacao" | "outros",
  "confidence": 0.0 a 1.0,
  "entities": {
    "data": "data mencionada em formato ISO (YYYY-MM-DD) ou null",
    "hora": "hora em formato HH:MM ou null",
    "procedimento": "procedimento mencionado ou null",
    "nome": "nome mencionado ou null"
  }
}

REGRAS IMPORTANTES:
- Emergências SEMPRE confidence > 0.9
- RETORNE APENAS O JSON, NENHUMA EXPLICAÇÃO ADICIONAL`;

  const response = await chat([
    { role: 'system', content: systemPrompt },
    { role: 'user', content: message },
  ], { temperature: 0.3 });

  console.log('\n📝 Raw response (length:', response.length, '):');
  console.log(response);

  // Clean
  let cleaned = response
    .replace(/```json\s*/gi, '')
    .replace(/```\s*/g, '')
    .trim();

  console.log('\n✂️ After markdown cleanup:');
  console.log(cleaned);

  // Extract first JSON
  const jsonStr = extractFirstJson(cleaned);
  if (jsonStr) {
    console.log('\n📋 Extracted JSON (length:', jsonStr.length, '):');
    console.log(jsonStr);

    // Check for problematic characters
    console.log('\n🔍 Character analysis:');
    for (let i = 0; i < jsonStr.length && i < 80; i++) {
      const code = jsonStr.charCodeAt(i);
      if (code > 127 || code < 32) {
        console.log(`  pos ${i}: '${jsonStr[i]}' (code ${code}) - NON-ASCII or CONTROL`);
      }
    }

    try {
      const parsed = JSON.parse(jsonStr);
      console.log('\n✅ Parsed successfully:', parsed);
      return parsed;
    } catch (e) {
      console.log('\n❌ Parse error:', e.message);

      // Show exact position
      const pos = parseInt(e.message.match(/position (\d+)/)?.[1] || '0');
      console.log(`\n🔍 Context around position ${pos}:`);
      const start = Math.max(0, pos - 10);
      const end = Math.min(jsonStr.length, pos + 10);
      for (let i = start; i < end; i++) {
        const c = jsonStr[i];
        const code = jsonStr.charCodeAt(i);
        const marker = i === pos ? ' <-- ERROR' : '';
        console.log(`  pos ${i}: '${c}' (code ${code})${marker}`);
      }
    }
  }

  return null;
}

// Test
const message = "Estou com muita dor de dente, é urgente!";
console.log('🧪 Testing with message:', message);
console.log('=========================================');

classifyIntent(message).then(result => {
  console.log('\n=========================================');
  console.log('Final result:', result);
}).catch(err => {
  console.error('Error:', err);
});