export interface Aula {
  id: string;
  disciplina: string;
  professor: string;
  professorUid?: string;
  propostoPorUid?: string;
  laboratorio: string;
  dataInicio: string | Date;
  dataFim: string | Date;
  status: 'pendente' | 'agendada' | 'confirmada' | 'cancelada';
  turma?: string;
  observacoes?: string;
  criadoEm?: string | Date;
}

export interface Usuario {
  uid: string;
  nome: string;
  email: string;
  role: 'coordenador' | 'tecnico' | 'professor' | 'aluno';
  status?: 'aprovado' | 'pendente' | 'rejeitado';
  approvalPending?: boolean;
}

export interface Periodo {
  id: string;
  nome: string;
  inicio: string | Date;
  fim: string | Date;
  ativo: boolean;
}

export type IntencaoIA =
  | 'consultar_aulas'
  | 'verificar_disponibilidade'
  | 'agendar_laboratorio'
  | 'cancelar_aula'
  | 'desconhecida';

export interface ConsultaIA {
  texto: string;
  intencao: IntencaoIA;
  parametros: Record<string, unknown>;
  confianca: number;
}

export interface ResultadoIA {
  sucesso: boolean;
  mensagem: string;
  dados?: unknown;
}
