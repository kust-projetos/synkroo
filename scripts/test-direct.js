/**
 * Direct API test - simulates exactly what Next.js API does
 */

require('dotenv').config({ path: '.env.local' });

const MINIMAX_API_KEY = process.env.MINIMAX_API_KEY;
const MINIMAX_MODEL = process.env.MINIMAX_MODEL || 'MiniMax-M2.7';
const MINIMAX_API_URL = 'https://api.minimax.io/v1/text/chatcompletion_v2';

/**
 * Strip thinking/reasoning blocks from MiniMax-M2.7 responses
 */
function stripThinkingBlocks(content) {
  // Remove complete thinking blocks (Unicode characters for ⍰ and ⍰)
  let result = content.replace(/\u240e[\s\S]*?\u240f/g, '');
  // Remove incomplete thinking blocks
  result = result.replace(/\u240e[\s\S]*?(?=\{|\[|$)/g, '');
  // Remove any remaining thinking markers
  result = result.replace(/\u240e/g, '');
  result = result.replace(/\u240f/g, '');
  return result.trim();
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

GUIA DE CLASSIFICAÇÃO:

1. agendamento: Paciente quer AGENDAR, REAGENDAR ou CANCELAR consulta
2. duvida: Perguntas sobre SERVIÇOS, PREÇOS, PROCEDIMENTOS, HORÁRIOS
3. emergencia: DOR, URGÊNCIA, NECESSIDADE IMEDIATA - SEMPRE alta confiança (>0.9)
4. confirmacao: CONFIRMANDO presença em consulta já agendada
5. reclamacao: RECLAMAÇÕES, INSATISFAÇÃO, PROBLEMAS
6. outros: Saudações, despedidas, mensagens genéricas

REGRAS IMPORTANTES:
- Emergências SEMPRE confidence > 0.9
- RETORNE APENAS O JSON, NENHUMA EXPLICAÇÃO ADICIONAL`;

  const response = await chat([
    { role: 'system', content: systemPrompt },
    { role: 'user', content: message },
  ], { temperature: 0.3 });

  let cleaned = response
    .replace(/```json\s*/gi, '')
    .replace(/```\s*/g, '')
    .trim();

  console.log('\n📝 Cleaned response:');
  console.log(cleaned);

  const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
  if (jsonMatch) {
    const rawJson = jsonMatch[0];
    console.log('\n📋 JSON to parse (length:', rawJson.length, '):');
    console.log(rawJson);

    // Character analysis
    console.log('\n🔍 Character codes around position 53:');
    for (let i = 48; i < 60 && i < rawJson.length; i++) {
      console.log(`  pos ${i}: '${rawJson[i]}' (code ${rawJson.charCodeAt(i)})`);
    }

    try {
      return JSON.parse(rawJson);
    } catch (e) {
      console.log('\n❌ Parse error:', e.message);

      // Try to fix
      let fixed = rawJson
        .replace(/,\s*}/g, '}')
        .replace(/,\s*]/g, ']')
        .replace(/'/g, '"');
      console.log('\n🔧 Fixed JSON:', fixed);
      return JSON.parse(fixed);
    }
  }

  return null;
}

// Test
const message = "Estou com muita dor de dente, é urgente!";
console.log('🧪 Testing with message:', message);
console.log('=========================================\n');

classifyIntent(message).then(result => {
  console.log('\n=========================================');
  console.log('Final result:', result);
}).catch(err => {
  console.error('Error:', err);
});