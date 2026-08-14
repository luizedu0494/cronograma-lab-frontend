import { useQuery } from '@tanstack/react-query';
import { collection, getDocs, query, where, Timestamp } from 'firebase/firestore';
import dayjs from 'dayjs';
import { db } from '../firebaseConfig';

export const useAulasDia = (dataFormatted?: string) => {
  const targetDate = dataFormatted || dayjs().format('DD/MM/YYYY');

  return useQuery({
    queryKey: ['aulas', targetDate],
    queryFn: async () => {
      const q = query(
        collection(db, 'aulas'),
        where('data', '==', targetDate)
      );
      const snapshot = await getDocs(q);
      return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    },
    staleTime: 5 * 60 * 1000,
  });
};
