import { z } from 'zod';

export const propostaAulaSchema = z.object({
  assunto: z.string().min(3, 'O assunto deve conter no mínimo 3 caracteres'),
  observacoes: z.string().optional(),
  tipoAtividade: z.string().optional(),
  cursos: z.array(z.string()).min(1, 'Selecione ao menos um curso'),
  horarioSlotString: z.array(z.string()).min(1, 'Selecione ao menos um horário'),
});

export type PropostaAulaInput = z.infer<typeof propostaAulaSchema>;
