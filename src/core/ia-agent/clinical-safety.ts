/**
 * Clinical Safety Guardrails & AI Takeover / Escalation Engine (F6.08)
 *
 * Implements deterministic safety rules to:
 * 1. Explicitly identify as AI Assistant
 * 2. Handle Human Takeover requests
 * 3. Intercept and escalate Clinical Urgencies (severe pain, hemorrhage, facial swelling, trauma)
 * 4. Intercept Medication / Prescription requests (refuse and require dental evaluation)
 * 5. Intercept Diagnosis requests (refuse and require in-person dental consultation)
 */

export interface ClinicalSafetyResult {
  isTakeoverRequest: boolean;
  isAiIdentityQuery: boolean;
  isUrgency: boolean;
  isMedicationRequest: boolean;
  isDiagnosisRequest: boolean;
  requiresEscalation: boolean;
  escalationReason?: 'user_requested_human' | 'urgency' | 'medication_inquiry' | 'diagnosis_inquiry';
  reply?: string;
}

function normalize(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

export function analyzeClinicalSafety(message: string): ClinicalSafetyResult {
  const norm = normalize(message);

  // ── 1. Human Takeover Detection ──────────────────────────────────────────
  const takeoverPatterns = [
    /\b(falar com (um |uma )?(atendente|humano|pessoa|alguem|operador))\b/,
    /\b(quero (um |uma )?(atendente|humano|pessoa real|atendimento humano))\b/,
    /\b(passa(r)? para (um |uma )?(atendente|humano|pessoa))\b/,
    /\b(transferir para (um |uma )?(atendente|humano|recepcao))\b/,
    /\b(atendente por favor)\b/,
    /\b(sair do bot|sair do robo)\b/,
    /\b(atendimento humano)\b/,
  ];

  const isTakeoverRequest = takeoverPatterns.some((p) => p.test(norm));
  if (isTakeoverRequest) {
    return {
      isTakeoverRequest: true,
      isAiIdentityQuery: false,
      isUrgency: false,
      isMedicationRequest: false,
      isDiagnosisRequest: false,
      requiresEscalation: true,
      escalationReason: 'user_requested_human',
      reply: 'Com certeza! Estou transferindo o seu atendimento para um de nossos atendentes humanos da clínica. Um momento, por favor.',
    };
  }

  // ── 2. AI Identity Query ──────────────────────────────────────────────────
  const identityPatterns = [
    /\b(voce e (um |uma )?(robo|ia|inteligencia artificial|bot|humano|pessoa))\b/,
    /\b(e (um |uma )?(robo|ia|inteligencia artificial|bot))\b/,
    /\b(estou falando com (um |uma )?(robo|ia|bot|humano|pessoa))\b/,
    /\b(quem (e |esta falando))\b/,
  ];

  const isAiIdentityQuery = identityPatterns.some((p) => p.test(norm));
  if (isAiIdentityQuery) {
    return {
      isTakeoverRequest: false,
      isAiIdentityQuery: true,
      isUrgency: false,
      isMedicationRequest: false,
      isDiagnosisRequest: false,
      requiresEscalation: false,
      reply: 'Olá! Eu sou a assistente virtual de inteligência artificial da clínica odontológica. Estou aqui para te ajudar com agendamentos, dúvidas e informações. Se preferir, também posso te transferir para um atendente humano a qualquer momento!',
    };
  }

  // ── 3. Clinical Urgency / Severe Pain / Trauma ────────────────────────────
  const urgencyPatterns = [
    /\b(dor insuportavel|dor muito forte|dor aguda|dor extrema)\b/,
    /\b(sangrando muito|sangramento intenso|hemorragia)\b/,
    /\b(rosto (muito )?inchado|incha(c|co) no rosto|bochecha inchada)\b/,
    /\b(febre alta|febre com dor)\b/,
    /\b(quebr(ou|ei) o dente|dente quebrado|bater o dente|trauma dental)\b/,
    /\b(emergencia|urgencia odontologica)\b/,
    /\b(pus|abscesso|infeccao grave)\b/,
  ];

  const isUrgency = urgencyPatterns.some((p) => p.test(norm));
  if (isUrgency) {
    return {
      isTakeoverRequest: false,
      isAiIdentityQuery: false,
      isUrgency: true,
      isMedicationRequest: false,
      isDiagnosisRequest: false,
      requiresEscalation: true,
      escalationReason: 'urgency',
      reply: 'Atenção: Os sintomas que você relatou indicam uma possível urgência odontológica que requer avaliação profissional presencial imediata. Estou notificando a equipe da clínica e transferindo para um atendente humano agora mesmo.',
    };
  }

  // ── 4. Medication & Prescription Inquiries ─────────────────────────────────
  const medicationPatterns = [
    /\b(qual (remedio|medicamento|anti-inflamatorio|analgesico|antibiotico))\b/,
    /\b(posso tomar (amoxicilina|ibuprofeno|dipirona|paracetamol|nimesulida|clavulanato|azitromicina|prednisona))\b/,
    /\b(quantos mg|qual dosagem|quantas gotas|qual posologia)\b/,
    /\b(me receita(r)?|receita de (antibiotico|remedio)|prescrever (remedio|medicamento))\b/,
    /\b(indica (um |algum )?(remedio|medicamento))\b/,
  ];

  const isMedicationRequest = medicationPatterns.some((p) => p.test(norm));
  if (isMedicationRequest) {
    return {
      isTakeoverRequest: false,
      isAiIdentityQuery: false,
      isUrgency: false,
      isMedicationRequest: true,
      isDiagnosisRequest: false,
      requiresEscalation: true,
      escalationReason: 'medication_inquiry',
      reply: 'Por motivos de segurança e ética odontológica, eu como assistente virtual não posso prescrever nem recomendar medicamentos ou dosagens. A prescrição só pode ser feita por um cirurgião-dentista após avaliação clínica. Gostaria de agendar uma consulta de avaliação ou falar com a nossa equipe?',
    };
  }

  // ── 5. Clinical Diagnosis Requests ────────────────────────────────────────
  const diagnosisPatterns = [
    /\b(diagnostico|diagnosticar)\b/,
    /\b(o que (significa|eu tenho|pode ser))\b/,
    /\b(e (carie|canal|cancer|gengivite|periodontite|tartaro))\b/,
    /\b(cancer|cancer de boca)\b/,
  ];

  const isDiagnosisRequest = diagnosisPatterns.some((p) => p.test(norm));
  if (isDiagnosisRequest) {
    return {
      isTakeoverRequest: false,
      isAiIdentityQuery: false,
      isUrgency: false,
      isMedicationRequest: false,
      isDiagnosisRequest: true,
      requiresEscalation: false,
      reply: 'Como assistente virtual de inteligência artificial, não posso formular diagnósticos clínicos. Apenas o cirurgião-dentista pode diagnosticar com precisão após um exame clínico presencial e eventuais exames radiográficos. Gostaria de agendar uma consulta de avaliação para verificar isso com o dentista?',
    };
  }

  return {
    isTakeoverRequest: false,
    isAiIdentityQuery: false,
    isUrgency: false,
    isMedicationRequest: false,
    isDiagnosisRequest: false,
    requiresEscalation: false,
  };
}
