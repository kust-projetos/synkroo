import { normalizeToolName, toRemoteTool } from '../tool-catalog';
import { z } from 'zod';

describe('normalizeToolName', () => {
  it('replaces dots with double underscore (Zen rejects dots)', () => {
    expect(normalizeToolName('operacional.consultarDisponibilidade'))
      .toBe('operacional__consultarDisponibilidade');
  });

  it('keeps already-safe names unchanged', () => {
    expect(normalizeToolName('listar_pendentes')).toBe('listar_pendentes');
  });

  it('replaces dots but preserves hyphens and underscores (provider-safe)', () => {
    expect(normalizeToolName('a.b-c_d')).toBe('a__b-c_d');
  });
});

describe('toRemoteTool', () => {
  const action = {
    name: 'operacional.agendarConsulta',
    module: 'operacional',
    requires: 'operacional:manage_appointments',
    label: 'Agendar consulta',
    description: 'Agenda uma consulta',
    input: z.object({ pacienteId: z.string().uuid(), data: z.string() }),
  };

  it('produces a provider-safe remote tool with JSON Schema', () => {
    const t = toRemoteTool(action);
    expect(t.name).toBe('operacional.agendarConsulta');
    expect(t.alias).toBe('operacional__agendarConsulta');
    expect(t.permissions).toEqual(['operacional:manage_appointments']);
    expect(t.description).toBe('Agenda uma consulta');

    // JSON Schema draft-07: type object with properties
    expect(t.inputSchemaJson).toHaveProperty('type', 'object');
    expect((t.inputSchemaJson as any).properties).toHaveProperty('pacienteId');
  });

  it('uses label when description is missing', () => {
    const a = { ...action, description: undefined };
    const t = toRemoteTool(a);
    expect(t.description).toBe('Agendar consulta');
  });

  it('strips $schema and definitions from top-level', () => {
    const t = toRemoteTool(action);
    expect(t.inputSchemaJson).not.toHaveProperty('$schema');
    expect(t.inputSchemaJson).not.toHaveProperty('definitions');
  });
});
