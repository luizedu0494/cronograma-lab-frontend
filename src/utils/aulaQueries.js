import { collection, query, where, getDocs, Timestamp } from 'firebase/firestore';
import dayjs from 'dayjs';
import { db } from '../firebaseConfig';

/**
 * Realiza busca pontual no Firestore de todas as aulas aprovadas ou pendentes para um dia específico.
 * @param {string|Date|dayjs.Dayjs} data - Data a ser consultada
 * @returns {Promise<Array>} Lista de aulas encontradas
 */
export async function buscarAulasPorDia(data) {
  if (!data) return [];
  const dataStr = dayjs(data).format('YYYY-MM-DD');
  if (!dayjs(dataStr).isValid()) return [];

  const inicio = Timestamp.fromDate(dayjs(dataStr).startOf('day').toDate());
  const fim = Timestamp.fromDate(dayjs(dataStr).endOf('day').toDate());

  try {
    const snap = await getDocs(query(
      collection(db, 'aulas'),
      where('dataInicio', '>=', inicio),
      where('dataInicio', '<=', fim),
      where('status', 'in', ['aprovada', 'pendente'])
    ));

    return snap.docs.map(d => ({ id: d.id, ...d.data() }));
  } catch (error) {
    console.error('Erro ao buscar aulas por dia:', error);
    return [];
  }
}
