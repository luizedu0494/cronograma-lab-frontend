import { collection, query, where, getDocs, Timestamp } from 'firebase/firestore';
import dayjs from 'dayjs';

/**
 * Verifica se há conflito de horário/laboratório para uma aula
 * 
 * @param {object} db - Instância do Firestore
 * @param {Timestamp|Date} dataInicio - Data/hora de início da aula
 * @param {string} horario - Horário no formato "HH:MM-HH:MM"
 * @param {string} laboratorio - Nome do laboratório
 * @param {string} aulaIdExcluir - ID da aula a excluir da verificação (para edição)
 * @returns {Promise<Array>} Array de aulas conflitantes
 */
export const verificarConflito = async (db, dataInicio, horario, laboratorio, aulaIdExcluir = null) => {
    try {
        if (!dataInicio || !horario || !laboratorio) {
            return [];
        }

        // Converter dataInicio para Timestamp se necessário
        let dataTimestamp;
        if (dataInicio instanceof Timestamp) {
            dataTimestamp = dataInicio;
        } else if (dataInicio.toDate) {
            dataTimestamp = Timestamp.fromDate(dataInicio.toDate());
        } else {
            dataTimestamp = Timestamp.fromDate(new Date(dataInicio));
        }

        // Criar intervalo de datas (mesmo dia)
        const dataObj = dataTimestamp.toDate();
        const inicioDodia = dayjs(dataObj).startOf('day').toDate();
        const fimDodia = dayjs(dataObj).endOf('day').toDate();

        // Query para buscar aulas no mesmo laboratório, horário e dia
        const q = query(
            collection(db, 'aulas'),
            where('laboratorioSelecionado', '==', laboratorio),
            where('horarioSlotString', '==', horario),
            where('dataInicio', '>=', Timestamp.fromDate(inicioDodia)),
            where('dataInicio', '<=', Timestamp.fromDate(fimDodia))
        );

        const querySnapshot = await getDocs(q);
        let conflitos = querySnapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        }));

        // Excluir a aula sendo editada (se fornecido)
        if (aulaIdExcluir) {
            conflitos = conflitos.filter(c => c.id !== aulaIdExcluir);
        }

        return conflitos;
    } catch (error) {
        console.error('Erro ao verificar conflito:', error);
        return [];
    }
};

/**
 * Verifica conflitos para múltiplas aulas em lote
 * 
 * @param {object} db - Instância do Firestore
 * @param {Array} aulasIds - Array de IDs de aulas a verificar
 * @param {Timestamp|Date} novaData - Nova data
 * @param {string} novoHorario - Novo horário
 * @param {string} novoLab - Novo laboratório
 * @returns {Promise<object>} { semConflito: [], comConflito: [] }
 */
export const verificarConflitosEmLote = async (db, aulasIds, novaData, novoHorario, novoLab) => {
    try {
        const resultado = {
            semConflito: [],
            comConflito: []
        };

        // Para cada aula, verificar conflito
        for (const aulaId of aulasIds) {
            const conflitos = await verificarConflito(db, novaData, novoHorario, novoLab, aulaId);
            
            if (conflitos.length === 0) {
                resultado.semConflito.push(aulaId);
            } else {
                resultado.comConflito.push({
                    aulaId,
                    conflitoCom: conflitos
                });
            }
        }

        return resultado;
    } catch (error) {
        console.error('Erro ao verificar conflitos em lote:', error);
        return { semConflito: [], comConflito: [] };
    }
};

/**
 * Obtém horários disponíveis para um laboratório em uma data específica
 * 
 * @param {object} db - Instância do Firestore
 * @param {Timestamp|Date} data - Data para verificar
 * @param {string} laboratorio - Nome do laboratório
 * @param {Array} blocos - Array de blocos de horário disponíveis
 * @returns {Promise<Array>} Array de horários disponíveis
 */
export const obterHorariosDisponiveis = async (db, data, laboratorio, blocos = []) => {
    try {
        if (!data || !laboratorio || blocos.length === 0) {
            return blocos;
        }

        // Buscar todas as aulas neste laboratório neste dia
        const dataObj = data instanceof Timestamp ? data.toDate() : new Date(data);
        const inicioDodia = dayjs(dataObj).startOf('day').toDate();
        const fimDodia = dayjs(dataObj).endOf('day').toDate();

        const q = query(
            collection(db, 'aulas'),
            where('laboratorioSelecionado', '==', laboratorio),
            where('dataInicio', '>=', Timestamp.fromDate(inicioDodia)),
            where('dataInicio', '<=', Timestamp.fromDate(fimDodia))
        );

        const querySnapshot = await getDocs(q);
        const aulasExistentes = querySnapshot.docs.map(doc => doc.data());

        // Extrair horários ocupados
        const horariosOcupados = new Set(
            aulasExistentes.map(aula => aula.horarioSlotString)
        );

        // Retornar apenas horários disponíveis
        return blocos.filter(bloco => !horariosOcupados.has(bloco.value));
    } catch (error) {
        console.error('Erro ao obter horários disponíveis:', error);
        return blocos;
    }
};

/**
 * Obtém informações detalhadas sobre ocupação de um laboratório em uma data
 * 
 * @param {object} db - Instância do Firestore
 * @param {Timestamp|Date} data - Data para verificar
 * @param {string} laboratorio - Nome do laboratório
 * @returns {Promise<object>} Mapa de horários com informações de ocupação
 */
export const obterOcupacaoDetalhada = async (db, data, laboratorio) => {
    try {
        if (!data || !laboratorio) {
            return {};
        }

        const dataObj = data instanceof Timestamp ? data.toDate() : new Date(data);
        const inicioDodia = dayjs(dataObj).startOf('day').toDate();
        const fimDodia = dayjs(dataObj).endOf('day').toDate();

        const q = query(
            collection(db, 'aulas'),
            where('laboratorioSelecionado', '==', laboratorio),
            where('dataInicio', '>=', Timestamp.fromDate(inicioDodia)),
            where('dataInicio', '<=', Timestamp.fromDate(fimDodia))
        );

        const querySnapshot = await getDocs(q);
        const ocupacao = {};

        querySnapshot.docs.forEach(doc => {
            const aula = doc.data();
            ocupacao[aula.horarioSlotString] = {
                assunto: aula.assunto,
                professor: aula.propostoPorNome,
                cursos: aula.cursos,
                status: aula.status,
                isRevisao: aula.isRevisao
            };
        });

        return ocupacao;
    } catch (error) {
        console.error('Erro ao obter ocupação detalhada:', error);
        return {};
    }
};

/**
 * Formata mensagem de conflito para exibição
 * 
 * @param {Array} conflitos - Array de aulas conflitantes
 * @returns {string} Mensagem formatada
 */
export const formatarMensagemConflito = (conflitos) => {
    if (!conflitos || conflitos.length === 0) {
        return '';
    }

    if (conflitos.length === 1) {
        const c = conflitos[0];
        return `Conflito: "${c.assunto}" já está agendada neste horário (${c.propostoPorNome || 'Professor'})`;
    }

    return `${conflitos.length} aulas já estão agendadas neste horário`;
};
