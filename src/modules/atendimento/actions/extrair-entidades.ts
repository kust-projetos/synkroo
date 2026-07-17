import { z } from 'zod';
import { defineAction } from '@/core/actions';
import type { ActionContext } from '@/core/actions/types';

function normalize(text: string): string {
  return text.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

const WEEKDAYS: Record<string, number> = {
  domingo: 0, dom: 0,
  segunda: 1, seg: 1,
  terca: 2, ter: 2,
  quarta: 3, qua: 3,
  quinta: 4, qui: 4,
  sexta: 5, sex: 5,
  sabado: 6, sab: 6,
};

const PROCEDURE_KEYWORDS: Array<[string, string[]]> = [
  ['limpeza', ['limpeza', 'profilaxia', 'raspagem']],
  ['clareamento', ['clareamento', 'branqueamento']],
  ['canal', ['canal', 'endodontia', 'tratamento de canal']],
  ['extracao', ['extração', 'extrair', 'arrancar', 'tirar dente']],
  ['implante', ['implante', 'pino']],
  ['aparelho', ['aparelho', 'ortodontia', 'correção']],
  ['restauracao', ['restauração', 'restaurar', 'obturação', 'cárie']],
  ['protese', ['prótese', 'dentadura', 'ponte']],
  ['cirurgia', ['cirurgia', 'siso', 'dente do siso']],
];

function extractDate(text: string): string | null {
  const now = new Date();

  // "amanhã"
  if (/amanh[ãa]/.test(text)) {
    const d = new Date(now);
    d.setDate(d.getDate() + 1);
    return d.toISOString().slice(0, 10);
  }

  // "depois de amanhã"
  if (/depois de amanh[ãa]/.test(text)) {
    const d = new Date(now);
    d.setDate(d.getDate() + 2);
    return d.toISOString().slice(0, 10);
  }

  // "hoje"
  if (/hoje/i.test(text)) {
    return now.toISOString().slice(0, 10);
  }

  // "próxima semana" → next Monday
  if (/pr[óo]xim[oa]\s*seman/.test(text)) {
    const d = new Date(now);
    const daysUntilMonday = (8 - d.getDay()) % 7 || 7;
    d.setDate(d.getDate() + daysUntilMonday);
    return d.toISOString().slice(0, 10);
  }

  // Weekday match: "segunda", "terça", etc.
  const weekdayMatch = normalize(text).match(/(?:proximo\s+|proxima\s+)?(segunda|terca|quarta|quinta|sexta|sabado|domingo|seg|ter|qua|qui|sex|sab|dom)(?:-feira)?/i);
  if (weekdayMatch) {
    const targetDay = WEEKDAYS[weekdayMatch[1].toLowerCase()];
    if (targetDay !== undefined) {
      const d = new Date(now);
      const daysUntil = (targetDay + 7 - d.getDay()) % 7 || 7;
      d.setDate(d.getDate() + daysUntil);
      return d.toISOString().slice(0, 10);
    }
  }

  // "15/03" or "15/03/2026"
  const dateMatch = text.match(/(\d{1,2})\/(\d{1,2})(?:\/(\d{4}))?/);
  if (dateMatch) {
    const day = parseInt(dateMatch[1], 10);
    const month = parseInt(dateMatch[2], 10);
    const year = dateMatch[3] ? parseInt(dateMatch[3], 10) : now.getFullYear();
    if (day >= 1 && day <= 31 && month >= 1 && month <= 12) {
      return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    }
  }

  return null;
}

function extractTime(text: string): string | null {
  // "10h", "14:30", "10 horas"
  const timeMatch = text.match(/(\d{1,2})[h:](\d{2})?/);
  if (timeMatch) {
    const hour = parseInt(timeMatch[1], 10);
    const minute = timeMatch[2] ? parseInt(timeMatch[2], 10) : 0;
    if (hour >= 0 && hour <= 23 && minute >= 0 && minute <= 59) {
      return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
    }
  }
  return null;
}

function extractName(text: string): string | null {
  const match = text.match(/meu nome[ée]\s+([A-ZÀ-Úa-zà-ú\s]{2,40})/);
  return match?.[1]?.trim() ?? null;
}

function extractProcedure(text: string): string | null {
  const lower = text.toLowerCase();
  for (const [name, keywords] of PROCEDURE_KEYWORDS) {
    for (const kw of keywords) {
      if (lower.includes(kw)) return name;
    }
  }
  return null;
}

export const extrairEntidades = defineAction({
  name: 'atendimento.extrairEntidades',
  module: 'atendimento',
  requires: 'atendimento:manage_messages',
  label: 'Extrair entidades da mensagem',
  input: z.object({
    message: z.string().min(1),
  }),
  handler: async (input, _ctx: ActionContext) => {
    const data = extractDate(input.message);
    const hora = extractTime(input.message);
    const nome = extractName(input.message);
    const procedimento = extractProcedure(input.message);

    const entities: Record<string, unknown> = {};
    if (data) entities.data = data;
    if (hora) entities.hora = hora;
    if (nome) entities.nome = nome;
    if (procedimento) entities.procedimento = procedimento;

    return { entities };
  },
});
