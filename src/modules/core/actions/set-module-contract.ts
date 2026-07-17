import { z } from 'zod';
import { defineAction } from '@/core/actions';
import * as modulesService from '../services/modules-service';

export const setModuleContract = defineAction({
  name: 'master.setModuleContract',
  module: 'core',
  requires: 'master:manage_modules',
  label: 'Contratar/desativar módulo (fornecedor)',
  input: z.object({ moduleId: z.string(), enabled: z.boolean() }),
  handler: async (input) => modulesService.setModuleContract(input),
});
