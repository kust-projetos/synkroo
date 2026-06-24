import { getPersona } from '../personas';
import type { PersonaType, Persona } from '../personas';

describe('Personas', () => {
  const validTypes: PersonaType[] = ['vendas', 'relacionamento', 'recepcao', 'gestao'];

  describe('getPersona', () => {
    it.each(validTypes)('returns a Persona for type "%s"', (type) => {
      const persona = getPersona(type);
      expect(persona).toBeDefined();
      expect(persona.type).toBe(type);
    });

    it.each(validTypes)('returns a non-empty systemPrompt for "%s"', (type) => {
      const persona = getPersona(type);
      expect(typeof persona.systemPrompt).toBe('string');
      expect(persona.systemPrompt.length).toBeGreaterThan(0);
    });

    it.each(validTypes)('systemPrompt for "%s" is in Brazilian Portuguese', (type) => {
      const persona = getPersona(type);
      const prompt = persona.systemPrompt.toLowerCase();
      // Brazilian Portuguese markers: accented chars + common words
      const hasPtMarkers =
        prompt.includes('você') ||
        prompt.includes('sua') ||
        prompt.includes('responda') ||
        prompt.includes('português') ||
        prompt.includes('brasil');
      expect(hasPtMarkers).toBe(true);
    });

    it('sells persona instructs to use tools', () => {
      const persona = getPersona('vendas');
      expect(persona.systemPrompt).toMatch(/ferramenta|tool|função|agendar/i);
    });

    it('relacionamento persona mentions follow-up', () => {
      const persona = getPersona('relacionamento');
      expect(persona.systemPrompt).toMatch(/retorno|follow-up|pós|confirmar/i);
    });

    it('recepcao persona mentions lead capture', () => {
      const persona = getPersona('recepcao');
      expect(persona.systemPrompt).toMatch(/identificar|lead|capturar|qualificar/i);
    });

    it('gestao persona mentions internal tasks', () => {
      const persona = getPersona('gestao');
      expect(persona.systemPrompt).toMatch(/tarefa|relatório|informação|interno/i);
    });

    it('throws for invalid persona type', () => {
      expect(() => getPersona('invalid_type' as PersonaType)).toThrow();
    });

    it('returns a Persona with type matching the requested type', () => {
      for (const type of validTypes) {
        const persona = getPersona(type);
        expect(persona).toHaveProperty('type', type);
      }
    });

    it('all personas have the correct structure', () => {
      for (const type of validTypes) {
        const persona: Persona = getPersona(type);
        expect(persona).toEqual(
          expect.objectContaining({
            type: expect.any(String) as unknown as PersonaType,
            systemPrompt: expect.any(String),
          }),
        );
      }
    });
  });
});
