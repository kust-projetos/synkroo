/**
 * Test MiniMax classification exactly as the API does
 */

require('dotenv').config({ path: '.env.local' });

const MINIMAX_API_KEY = process.env.MINIMAX_API_KEY;
const MINIMAX_MODEL = process.env.MINIMAX_MODEL || 'MiniMax-M2.7';
const MINIMAX_API_URL = 'https://api.minimax.io/v1/text/chatcompletion_v2';

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
   Exemplos: "quero marcar", "preciso reagendar", "vou cancelar minha consulta", "tem horário para quinta?"

2. duvida: Perguntas sobre SERVIÇOS, PREÇOS, PROCEDIMENTOS, HORÁRIOS
   Exemplos: "qual o valor do clareamento?", "vocês fazem implante?", "qual o horário de funcionamento?"

3. emergencia: DOR, URGÊNCIA, NECESSIDADE IMEDIATA - SEMPRE alta confiança (>0.9)
   Exemplos: "estou com muita dor", "meu dente quebrou", "é urgente", "socorro"

4. confirmacao: CONFIRMANDO presença em consulta já agendada
   Exemplos: "confirmo minha consulta", "sim, vou comparecer", "pode confirmar"

5. reclamacao: RECLAMAÇÕES, INSATISFAÇÃO, PROBLEMAS
   Exemplos: "fiquei esperando muito", "não gostei do atendimento", "estou insatisfeito"

6. outros: Saudações, despedidas, mensagens genéricas
   Exemplos: "olá", "bom dia", "obrigado", "tchau"

REGRAS IMPORTANTES:
- Emergências SEMPRE confidence > 0.9
- Se houver múltiplas intenções, priorize: emergencia > reclamacao > agendamento > duvida > outros
- Extraia entidades relacionadas à intenção principal
- Datas relativas como "amanhã", "quinta" devem ser normalizadas para ISO
- RETORNE APENAS O JSON, NENHUMA EXPLICAÇÃO ADICIONAL`;

  console.log('🔄 Sending request to MiniMax...');

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
        { role: 'user', content: message },
      ],
      temperature: 0.3,
      max_tokens: 2048,
      stream: false,
    })
  });

  const data = await response.json();
  console.log('📊 Response status:', data.base_resp?.status_code);

  // Get content
  let content = data.choices?.[0]?.message?.content || data.reply || '';
  console.log('\n📝 Raw content length:', content.length);

  // Strip thinking blocks
  content = content.replace(/<tool_call>[\s\S]*?<\/think>/g, '').trim();
  console.log('📝 After stripping thinking:', content.length, 'chars');

  // Strip markdown code blocks
  content = content.replace(/```json\s*/gi, '').replace(/```\s*/g, '').trim();
  console.log('📝 After stripping markdown:', content.length, 'chars');

  console.log('\n📋 Cleaned content:');
  console.log(content);

  // Try to find JSON
  const jsonMatch = content.match(/\{[\s\S]*\}/);
  if (jsonMatch) {
    const rawJson = jsonMatch[0];
    console.log('\n📋 Extracted JSON (length:', rawJson.length, '):');
    console.log(rawJson);

    try {
      const parsed = JSON.parse(rawJson);
      console.log('\n✅ Parsed successfully:', parsed);
      return parsed;
    } catch (e) {
      console.log('\n❌ Parse error:', e.message);
      console.log('\nCharacter analysis around position 53:');
      for (let i = 48; i < 58 && i < rawJson.length; i++) {
        console.log(`  pos ${i}: '${rawJson[i]}' (code ${rawJson.charCodeAt(i)})`);
      }
    }
  }

  return null;
}

// Test with the exact same message
const message = "Estou com muita dor de dente, é urgente!";
console.log('🧪 Testing with message:', message);
console.log('=========================================\n');

classifyIntent(message).then(result => {
  console.log('\n=========================================');
  console.log('Final result:', result);
}).catch(err => {
  console.error('Error:', err);
});