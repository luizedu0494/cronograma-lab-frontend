import { useState, useEffect, useCallback } from 'react';
import { collection, query, orderBy, limit, getDocs, where, startAt, endAt } from 'firebase/firestore';
import { db } from '../firebaseConfig';

const useFetchAulas = (options = {}) => {
    const {
        limitCount = null,
        statusFilter = null,
        authorFilter = null,
        dateFilter = null, // Pode ser um objeto { field: 'dataInicio', start: Timestamp, end: Timestamp }
        orderByField = 'dataCriacao',
        orderByDirection = 'desc'
    } = options;

    const [aulas, setAulas] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    const fetchAulas = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const aulasRef = collection(db, 'aulas');
            let q = query(aulasRef);

            // 1. Filtro por Status
            if (statusFilter) {
                q = query(q, where('status', '==', statusFilter));
            }

            // 2. Filtro por Autor (UID)
            if (authorFilter) {
                q = query(q, where('autorUid', '==', authorFilter));
            }

            // 3. Filtro por Data (Intervalo)
            if (dateFilter && dateFilter.field && dateFilter.start && dateFilter.end) {
                // Assume que o campo de data é um Timestamp do Firebase
                q = query(
                    q,
                    where(dateFilter.field, '>=', dateFilter.start),
                    where(dateFilter.field, '<=', dateFilter.end)
                );
            }

            // 4. Ordenação
            q = query(q, orderBy(orderByField, orderByDirection));

            // 5. Limite (para a página inicial)
            if (limitCount) {
                q = query(q, limit(limitCount));
            }

            const querySnapshot = await getDocs(q);

            const aulasList = querySnapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data(),
                // Converte Timestamp para string de data para facilitar o uso
                dataInicio: doc.data().dataInicio?.toDate().toISOString() || null,
                dataFim: doc.data().dataFim?.toDate().toISOString() || null,
                dataCriacao: doc.data().dataCriacao?.toDate().toISOString() || null,
            }));

            setAulas(aulasList);
        } catch (err) {
            console.error("Erro ao buscar aulas:", err);
            setError("Não foi possível carregar as aulas.");
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
