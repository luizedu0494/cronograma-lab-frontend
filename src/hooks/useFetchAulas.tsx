import { useState, useEffect, useCallback } from 'react';
import {
  collection,
  query,
  orderBy,
  limit,
  getDocs,
  where,
  Timestamp,
  OrderByDirection,
} from 'firebase/firestore';
import { db } from '../firebaseConfig';
import { Aula } from '../types';

export interface DateFilterOption {
  field: string;
  start: Timestamp;
  end: Timestamp;
}

export interface UseFetchAulasOptions {
  limitCount?: number | null;
  statusFilter?: string | null;
  authorFilter?: string | null;
  dateFilter?: DateFilterOption | null;
  orderByField?: string;
  orderByDirection?: OrderByDirection;
}

export interface UseFetchAulasReturn {
  aulas: Aula[];
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

const useFetchAulas = (options: UseFetchAulasOptions = {}): UseFetchAulasReturn => {
  const {
    limitCount = null,
    statusFilter = null,
    authorFilter = null,
    dateFilter = null,
    orderByField = 'dataCriacao',
    orderByDirection = 'desc',
  } = options;

  const [aulas, setAulas] = useState<Aula[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const fetchAulas = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const aulasRef = collection(db, 'aulas');
      let q = query(aulasRef);

      if (statusFilter) {
        q = query(q, where('status', '==', statusFilter));
      }

      if (authorFilter) {
        q = query(q, where('autorUid', '==', authorFilter));
      }

      if (dateFilter && dateFilter.field && dateFilter.start && dateFilter.end) {
        q = query(
          q,
          where(dateFilter.field, '>=', dateFilter.start),
          where(dateFilter.field, '<=', dateFilter.end)
        );
      }

      q = query(q, orderBy(orderByField, orderByDirection));

      if (limitCount) {
        q = query(q, limit(limitCount));
      }

      const querySnapshot = await getDocs(q);

      const aulasList: Aula[] = querySnapshot.docs.map(docSnap => {
        const data = docSnap.data();
        return {
          id: docSnap.id,
          disciplina: data.disciplina || data.assunto || '',
          professor: data.professor || data.propostoPorNome || '',
          laboratorio: data.laboratorio || data.laboratorioSelecionado || '',
          status: data.status || 'agendada',
          turma: data.turma || '',
          dataInicio: data.dataInicio?.toDate().toISOString() || null,
          dataFim: data.dataFim?.toDate().toISOString() || null,
          criadoEm: data.dataCriacao?.toDate().toISOString() || null,
          ...data,
        } as Aula;
      });

      setAulas(aulasList);
    } catch (err) {
      console.error('Erro ao buscar aulas:', err);
      setError('Não foi possível carregar as aulas.');
    } finally {
      setLoading(false);
    }
  }, [limitCount, statusFilter, authorFilter, dateFilter, orderByField, orderByDirection]);

  useEffect(() => {
    fetchAulas();
  }, [fetchAulas]);

  return { aulas, loading, error, refetch: fetchAulas };
};

export default useFetchAulas;
