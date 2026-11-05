/**
 * Caracterização do contrato tool-catalog → JSON Schema (Zod V3).
 *
 * Congela o comportamento observado no baseline (Zod 3.25.76 +
 * zod-to-json-schema 3.25.2) para que a migração para Zod >= 4.6.7 com
 * imports explícitos `zod/v3` possa ser verificada sem mudança de forma:
 * - `toRemoteTool` produz alias provider-safe, description/permissions
 *   preservadas e `inputSchemaJson` sem `$schema`/`definitions`/`$ref` de topo;
 * - o JSON Schema cobre os tipos usados pelos inputs reais das Actions
 *   (uuid, date coagida, default, enum, nullable, array, objeto aninhado);
 * - `buildToolCatalog` é determinístico para o mesmo conjunto de aliases.
 *
 * O snapshot `representative-input-schema 1` é a âncora exata da forma.
 * Qualquer divergência pós-migração deve parar a migração, não afrouxar o teste.
 */
import { z } from 'zod/v3';
import { buildToolCatalog, normalizeToolName, toRemoteTool } from '../tool-catalog';

const representativeInput = z.object({
  patientId: z.string().uuid(),
  dentistId: z.string().uuid().optional(),
  scheduledAt: z.coerce.date(),
  durationMinutes: z.number().int().positive().default(30),
  channel: z.enum(['whatsapp', 'instagram', 'web']).optional(),
  notes: z.string().max(1000).nullable().optional(),
  tags: z.array(z.string().min(1)).optional(),
  address: z
    .object({
      street: z.string(),
      number: z.string().optional(),
    })
    .optional(),
});

function representativeAction() {
  return {
    name: 'operacional.agendarConsulta',
    module: 'operacional',
    requires: 'operacional:manage_appointments',
    label: 'Agendar consulta',
    description: 'Agenda uma consulta',
    input: representativeInput,
  };
}

function allowAllContext() {
  return {
    source: 'user',
    clinicId: 'clinic-1',
    can: () => true,
    hasModule: () => true,
    audit: { actor: 'test' },
  } as any;
}

describe('tool-catalog schema contract (V3 characterization)', () => {
  it('produces provider-safe remote tool metadata', () => {
    const tool = toRemoteTool(representativeAction());
    expect(tool.name).toBe('operacional.agendarConsulta');
    expect(tool.alias).toBe('operacional__agendarConsulta');
    expect(normalizeToolName(tool.name)).toBe(tool.alias);
    expect(tool.description).toBe('Agenda uma consulta');
    expect(tool.permissions).toEqual(['operacional:manage_appointments']);
    expect(tool.module).toBe('operacional');
  });

  it('strips top-level JSON Schema envelope keys', () => {
    const tool = toRemoteTool(representativeAction());
    expect(tool.inputSchemaJson).not.toHaveProperty('$schema');
    expect(tool.inputSchemaJson).not.toHaveProperty('definitions');
    expect(tool.inputSchemaJson).not.toHaveProperty('$ref');
    expect(tool.inputSchemaJson).toHaveProperty('type', 'object');
  });

  it('covers the input types used by real action schemas', () => {
    const tool = toRemoteTool(representativeAction());
    const schema = tool.inputSchemaJson as any;
    expect(schema.properties.patientId).toMatchObject({ type: 'string', format: 'uuid' });
    expect(schema.properties.scheduledAt).toHaveProperty('type', 'string');
    expect(schema.properties.durationMinutes).toMatchObject({ type: 'integer', default: 30 });
    expect(schema.properties.channel).toHaveProperty('enum', ['whatsapp', 'instagram', 'web']);
    expect(schema.properties.tags).toMatchObject({ type: 'array' });
    expect(schema.properties.address).toMatchObject({ type: 'object' });
    expect(schema.required).toEqual(expect.arrayContaining(['patientId', 'scheduledAt']));
    expect(schema.required).not.toContain('dentistId');
    expect(schema.required).not.toContain('channel');
  });

  it('locks the exact representative JSON Schema shape', () => {
    const tool = toRemoteTool(representativeAction());
    expect(tool.inputSchemaJson).toMatchSnapshot('representative-input-schema');
  });

  it('buildToolCatalog is deterministic for the same alias set', () => {
    const actions = [representativeAction()];
    const first = buildToolCatalog(allowAllContext(), actions);
    const second = buildToolCatalog(allowAllContext(), actions);
    expect(second.version).toBe(first.version);
    expect(first.version).toMatch(/^v[0-9a-f]+$/);
    expect(first.tools).toHaveLength(1);
    expect(first.tools[0].inputSchemaJson).toEqual(second.tools[0].inputSchemaJson);
  });
});
