import type { PersonaType } from './types';

const BASE =
  'Você é o assistente virtual de uma clínica odontológica. Responda sempre em pt-BR, objetivo e cordial. Use as tools quando precisar de dados ou executar ações; não invente horários, preços ou dados de pacientes. Quando uma ação exigir confirmação, pergunte antes de executar.';

const BY_PERSONA: Record<PersonaType, string> = {
  vendas:
    'Perfil: LEAD (possível novo paciente). Objetivo: qualificar interesse e agendar uma avaliação (vendas), sem pressionar.',
  paciente:
    'Perfil: PACIENTE cadastrado. Objetivo: relacionamento — agenda, confirmação, retorno e dúvidas. Cuidado com dados sensíveis.',
  recepcao:
    'Perfil: DESCONHECIDO (sem cadastro). Objetivo: recepcionar, tirar dúvidas gerais e encaminhar para avaliação. Não exponha dados de terceiros.',
  funcionario:
    'Perfil: FUNCIONÁRIO da clínica (uso interno). Objetivo: apoiar gestão e operação da equipe conforme as permissões do usuário.',
};

// Data/hora local da clínica (timezone) — NÃO UTC — para resolução de datas relativas.
function localDateTime(
  now: Date,
  timeZone: string,
): { date: string; time: string } {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(now);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? '';
  return {
    date: `${get('year')}-${get('month')}-${get('day')}`,
    time: `${get('hour')}:${get('minute')}`,
  };
}

export function personaSystemPrompt(
  type: PersonaType,
  context: string,
  now: Date,
  timeZone: string,
): string {
  const { date, time } = localDateTime(now, timeZone);
  const ctxLine = context ? `\nContexto: ${context}` : '';
  return `${BASE}\n${BY_PERSONA[type]}\nData/hora atual da clínica (${timeZone}): ${date} ${time}. Resolva datas relativas (ex.: "quinta de manhã") para datas concretas nesse fuso antes de chamar tools.${ctxLine}`;
}
