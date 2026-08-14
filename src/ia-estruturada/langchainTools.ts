import { DynamicStructuredTool } from "@langchain/core/tools";
import { z } from "zod";

/**
 * Ferramenta do LangChain para montar proposta de agendamento (Técnico/Coordenador)
 */
export const proporAulaTool = new DynamicStructuredTool({
  name: "propor_aula",
  description: "Monta uma proposta de agendamento de aula ou evento para aprovação do coordenador.",
  schema: z.object({
    assunto: z.string().describe("Assunto ou nome da disciplina/evento"),
    laboratorio: z.string().describe("Nome do laboratório (ex: Anatomia 1, Informática 2)"),
    data: z.string().describe("Data no formato DD/MM/YYYY"),
    horario: z.string().describe("Bloco de horário ex: 07:00-09:10, 13:00-15:10"),
    cursos: z.array(z.string()).optional().describe("Lista de cursos associados"),
    observacoes: z.string().optional().describe("Observações adicionais para o coordenador")
  }),
  func: async ({ assunto, laboratorio, data, horario, cursos, observacoes }) => {
    return JSON.stringify({
      status: "rascunho_criado",
      mensagem: "Proposta estruturada com sucesso. Apresentar confirmação ao usuário.",
      proposta: {
        assunto,
        laboratorio,
        data,
        horario,
        cursos: cursos || ["Medicina"],
        observacoes: observacoes || "Gerado via Assistente IA"
      }
    });
  }
});

/**
 * Ferramenta do LangChain para consultar disponibilidade de laboratórios
 */
export const buscarDisponibilidadeTool = new DynamicStructuredTool({
  name: "buscar_disponibilidade",
  description: "Verifica quais laboratórios ou horários estão livres para um determinado dia.",
  schema: z.object({
    data: z.string().describe("Data da consulta no formato DD/MM/YYYY"),
    laboratorio: z.string().optional().describe("Nome do laboratório opcional")
  }),
  func: async ({ data, laboratorio }) => {
    return JSON.stringify({
      dataConsulta: data,
      laboratorioAlvo: laboratorio || "Todos",
      status: "executado",
      instrucoes: "Consultar base Firestore para determinar slots vagos."
    });
  }
});

/**
 * Ferramenta do LangChain para listar propostas pendentes de aprovação
 */
export const consultarPropostasPendentesTool = new DynamicStructuredTool({
  name: "consultar_propostas_pendentes",
  description: "Lista as propostas de aula que aguardam aprovação do coordenador.",
  schema: z.object({
    status: z.string().default("pendente").describe("Status das propostas")
  }),
  func: async ({ status }) => {
    return JSON.stringify({
      filtroStatus: status,
      mensagem: "Buscando propostas com status 'pendente'."
    });
  }
});

export const TODAS_FERRAMENTAS_LANGCHAIN = [
  proporAulaTool,
  buscarDisponibilidadeTool,
  consultarPropostasPendentesTool
];
