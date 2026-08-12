import { db } from '../firebaseConfig';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';

export const registrarLogExclusao = async (aulaData, user) => {
  try {
    await addDoc(collection(db, "logs"), {
      type: 'exclusao',
      collection: 'aulas',
      aula: {
        assunto: aulaData.title || aulaData.assunto || 'Sem assunto',
        disciplina: aulaData.title || aulaData.assunto || 'Sem assunto',
        cursos: aulaData.cursos || [],
        curso: Array.isArray(aulaData.cursos) ? aulaData.cursos.join(', ') : (aulaData.cursos || ''),
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
      }
    });
  } catch (error) {
    console.error("Erro ao registrar log de exclusão:", error);
  }
};
