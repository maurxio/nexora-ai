import { z } from 'zod';

const tools = {
  'suppliers.lookup': {
    name: 'suppliers.lookup',
    description: 'Busca un proveedor por su identificación fiscal.',
    inputSchema: z.object({ taxId: z.string() }).strict(),
    execute: async (input, _ctx) => ({
      taxId: input.taxId,
      name: 'Proveedor simulado',
      status: 'active',
    }),
  },
  'report.summarize': {
    name: 'report.summarize',
    description: 'Calcula la cantidad de caracteres y palabras de un texto.',
    inputSchema: z.object({ text: z.string() }).strict(),
    execute: async (input, _ctx) => ({
      chars: input.text.length,
      words: input.text.trim() ? input.text.trim().split(/\s+/).length : 0,
    }),
  },
};

export function listToolNames() {
  return Object.keys(tools);
}

export function getTool(name) {
  return tools[name];
}

export default tools;
