import { personaSystemPrompt } from '../personas';

describe('personaSystemPrompt', () => {
  // 2026-06-25T01:30Z é ainda 24/06 em São Paulo (UTC-3)
  const lateNightUtc = new Date('2026-06-25T01:30:00.000Z');

  it('uses the clinic timezone, not UTC, for the current date', () => {
    const p = personaSystemPrompt(
      'paciente',
      '',
      lateNightUtc,
      'America/Sao_Paulo',
    );
    expect(p).toContain('2026-06-24'); // dia local correto (não 2026-06-25 do UTC)
  });

  it('injects context and persona objective', () => {
    const p = personaSystemPrompt(
      'paciente',
      'Paciente: João',
      new Date('2026-06-25T12:00:00Z'),
      'America/Sao_Paulo',
    );
    expect(p).toContain('João');
    expect(p.toLowerCase()).toContain('paciente');
  });

  it('vendas focuses on qualifying/scheduling', () => {
    expect(
      personaSystemPrompt('vendas', '', new Date(), 'America/Sao_Paulo')
        .toLowerCase(),
    ).toMatch(/vendas|avaliação|agendar/);
  });
});
