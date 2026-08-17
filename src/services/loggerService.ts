import { db } from '../firebaseConfig';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';

export interface UserLog {
  uid?: string;
  nome?: string;
  name?: string;
  displayName?: string;
  email?: string;
}

export interface AulaLogData {
  title?: string;
  assunto?: string;
  cursos?: string[];
  status?: string;
  start?: any;
  dataInicio?: any;
  laboratorio?: string;
  laboratorioSelecionado?: string;
  isRevisao?: boolean;
  tipoRevisaoLabel?: string | null;
}

export const registrarLogExclusao = async (
  aulaData: AulaLogData,
  user?: UserLog | null
): Promise<void> => {
  try {
    await addDoc(collection(db, 'logs'), {
      type: 'exclusao',
      collection: 'aulas',
      aula: {
        assunto: aulaData.title || aulaData.assunto || 'Sem assunto',
        disciplina: aulaData.title || aulaData.assunto || 'Sem assunto',
        cursos: aulaData.cursos || [],
        curso: Array.isArray(aulaData.cursos) ? aulaData.cursos.join(', ') : aulaData.cursos || '',
        status: aulaData.status || 'aprovada',
        dataInicio: aulaData.start || aulaData.dataInicio || null,
        laboratorioSelecionado: aulaData.laboratorio || aulaData.laboratorioSelecionado || '',
        isRevisao: aulaData.isRevisao || false,
        tipoRevisaoLabel: aulaData.tipoRevisaoLabel || null,
      },
      timestamp: serverTimestamp(),
      user: {
        uid: user?.uid || 'desconhecido',
        nome: user?.nome || user?.name || user?.displayName || user?.email || 'Usuário',
      },
    });
  } catch (error) {
    console.error('Erro ao registrar log de exclusão:', error);
  }
};

export interface EventoLogData {
  id?: string;
  titulo?: string;
  tipo?: string;
  laboratorio?: string;
  dataInicio?: any;
  dataFim?: any;
  horarioSlotString?: string;
  status?: string;
}

export const registrarLogEvento = async (
  acao: 'criacao' | 'edicao' | 'exclusao',
  eventoData: EventoLogData,
  user?: UserLog | null
): Promise<void> => {
  try {
    await addDoc(collection(db, 'logs'), {
      type: `evento_${acao}`,
      collection: 'eventosManutencao',
      evento: {
        titulo: eventoData.titulo || 'Sem título',
        tipo: eventoData.tipo || 'Manutenção',
        laboratorio: eventoData.laboratorio || 'Todos',
        dataInicio: eventoData.dataInicio || null,
        dataFim: eventoData.dataFim || null,
        horarioSlotString: eventoData.horarioSlotString || '',
        status: eventoData.status || 'aprovado',
      },
      timestamp: serverTimestamp(),
      user: {
        uid: user?.uid || 'desconhecido',
        nome: user?.nome || user?.name || user?.displayName || user?.email || 'Usuário',
      },
    });
  } catch (error) {
    console.error(`Erro ao registrar log de ${acao} de evento:`, error);
  }
};

