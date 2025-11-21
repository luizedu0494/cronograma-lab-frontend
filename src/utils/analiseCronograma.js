import { collection, query, where, getDocs, Timestamp } from 'firebase/firestore';
import dayjs from 'dayjs';
import 'dayjs/locale/pt-br';

// Assumindo que estas constantes e a instância do db estão disponíveis
// O usuário deve garantir que o caminho para 'db' e as constantes estão corretos
// Ex: import { db } from '../firebaseConfig';
// Ex: import { BLOCOS_HORARIO } from '../AssistenteIA';
// Ex: import { LISTA_LABORATORIOS } from '../constants/laboratorios';

// Mock de dependências para fins de demonstração da lógica
const db = {
    // Simulação de acesso ao Firestore
    aulas: collection(null, "aulas")
};

const BLOCOS_HORARIO = [
    { "value": "07:00-09:10", "label": "07:00 - 09:10", "turno": "Matutino" },
    { "value": "09:30-12:00", "label": "09:30 - 12:00", "turno": "Matutino" },
    { "value": "13:00-15:10", "label": "13:00 - 15:10", "turno": "Vespertino" },
    { "value": "15:30-18:00", "label": "15:30 - 18:00", "turno": "Vespertino" },
    { "value": "18:30-20:10", "label": "18:30 - 20:10", "turno": "Noturno" },
    { "value": "20:30-22:00", "label": "20:30 - 22:00", "turno": "Noturno" },
];

const TURNOS = {
    'matutino': ['07:00-09:10', '09:30-12:00'],
    'vespertino': ['13:00-15:10', '15:30-18:00'],
    'noturno': ['18:30-20:10', '20:30-22:00'],
};

/**
 * Busca aulas no Firebase com base em critérios de data e laboratório.
 * @param {object} criterios - Critérios de busca (data, mes, ano, laboratorio, termoBusca).
 * @returns {Promise<Array>} Lista de aulas encontradas.
 */
export const buscarAulasInteligente = async (criterios) => {
    // Esta função substitui e aprimora a lógica de buscarAulasFirebase em AssistenteIA.jsx
    try {
        let q = collection(db, "aulas");
        const constraints = [];

        // 1. Filtro de Data
        if (criterios.data) {
            const dataInicio = dayjs(criterios.data, 'DD/MM/YYYY').startOf('day');
            const dataFim = dataInicio.endOf('day');
            constraints.push(where("dataInicio", ">=", Timestamp.fromDate(dataInicio.toDate())));
            constraints.push(where("dataInicio", "<=", Timestamp.fromDate(dataFim.toDate())));
        } else if (criterios.mes) {
            const [mes, ano] = criterios.mes.split('/');
            const dataInicio = dayjs().month(parseInt(mes) - 1).year(parseInt(ano)).startOf('month');
            const dataFim = dataInicio.endOf('month');
            constraints.push(where("dataInicio", ">=", Timestamp.fromDate(dataInicio.toDate())));
            constraints.push(where("dataInicio", "<=", Timestamp.fromDate(dataFim.toDate())));
        } else if (criterios.ano) {
            const dataInicio = dayjs().year(parseInt(criterios.ano)).startOf('year');
            const dataFim = dataInicio.endOf('year');
            constraints.push(where("dataInicio", ">=", Timestamp.fromDate(dataInicio.toDate())));
            constraints.push(where("dataInicio", "<=", Timestamp.fromDate(dataFim.toDate())));
        }

        // 2. Filtro de Laboratório
        if (criterios.laboratorio) {
            constraints.push(where("laboratorioSelecionado", "==", criterios.laboratorio));
        }

        // 3. Execução da Query
        if (constraints.length > 0) {
            q = query(q, ...constraints);
        }

        // Simulação de getDocs (o usuário deve garantir que a instância 'db' é real)
        // const querySnapshot = await getDocs(q);
        // let aulas = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        
        // Retornando um mock para fins de demonstração da lógica de análise
        let aulas = [
            { id: 'a1', assunto: 'Anatomia Humana', horarioSlotString: '07:00-09:10', laboratorioSelecionado: 'anatomia_1', dataInicio: dayjs().toDate(), cursos: ['medicina'] },
            { id: 'a2', assunto: 'Histologia', horarioSlotString: '09:30-12:00', laboratorioSelecionado: 'microscopia_2', dataInicio: dayjs().toDate(), cursos: ['biomedicina'] },
            { id: 'a3', assunto: 'BCMOL - Projeto X', horarioSlotString: '13:00-15:10', laboratorioSelecionado: 'multidisciplinar_1', dataInicio: dayjs().toDate(), cursos: ['farmacia'] },
        ];

        // 4. Filtro de Termo de Busca (Full-Text - Cliente-Side)
        if (criterios.termoBusca) {
            const termo = criterios.termoBusca.toLowerCase();
            aulas = aulas.filter(aula => 
                aula.assunto.toLowerCase().includes(termo) ||
                (aula.tipoAtividade && aula.tipoAtividade.toLowerCase().includes(termo)) ||
                (aula.observacoes && aula.observacoes.toLowerCase().includes(termo))
            );
        }

        return aulas;
    } catch (error) {
        console.error('Erro ao buscar aulas:', error);
        return [];
    }
};

/**
 * Realiza a análise de dados do cronograma.
 * @param {Array} aulas - Lista de aulas para análise.
 * @param {string} tipoAnalise - Tipo de análise (ex: 'contagem_turno', 'lista_dia').
 * @param {string} [parametro] - Parâmetro adicional (ex: 'matutino', 'segunda').
 * @returns {string} Resultado da análise formatado para o usuário.
 */
export const analisarAulas = (aulas, tipoAnalise, parametro) => {
    if (!aulas || aulas.length === 0) {
        return "Não há aulas para analisar com os critérios fornecidos.";
    }

    switch (tipoAnalise) {
        case 'contagem_turno': {
            const turno = parametro.toLowerCase();
            const slotsDoTurno = TURNOS[turno];
            if (!slotsDoTurno) return `Turno '${parametro}' inválido. Use Matutino, Vespertino ou Noturno.`;

            const aulasNoTurno = aulas.filter(aula => slotsDoTurno.includes(aula.horarioSlotString));
            return `Encontrei **${aulasNoTurno.length}** aulas no turno **${parametro}** no período.`;
        }
        case 'lista_dia': {
            const aulasPorDia = aulas.reduce((acc, aula) => {
                const dia = dayjs(aula.dataInicio).format('DD/MM/YYYY (ddd)');
                if (!acc[dia]) acc[dia] = [];
                acc[dia].push(aula);
                return acc;
            }, {});

            let resultado = "Aulas encontradas:\n\n";
            for (const dia in aulasPorDia) {
                resultado += `**${dia}** (${aulasPorDia[dia].length} aulas):\n`;
                aulasPorDia[dia].forEach(aula => {
                    const horario = aula.horarioSlotString;
                    const lab = aula.laboratorioSelecionado;
                    const cursos = aula.cursos.join(', ');
                    resultado += `- ${horario} - ${aula.assunto} (${cursos}) no ${lab}\n`;
                });
                resultado += "\n";
            }
            return resultado;
        }
        case 'contagem_total':
            return `Encontrei um total de **${aulas.length}** aulas com os critérios de busca.`;
        
        default:
            return `Análise de dados concluída. Encontrei ${aulas.length} aulas.`;
    }
};

/**
 * Mapeia o nome do turno para os slots de horário.
 * @param {string} turno - Nome do turno (Matutino, Vespertino, Noturno).
 * @returns {Array<string>} Lista de slots de horário.
 */
export const getSlotsPorTurno = (turno) => {
    return TURNOS[turno.toLowerCase()] || [];
};

/**
 * Formata uma lista de aulas para exibição amigável.
 * @param {Array} aulas - Lista de aulas.
 * @returns {string} Texto formatado.
 */
export const formatarListaAulas = (aulas) => {
    if (!aulas || aulas.length === 0) {
        return "Nenhuma aula encontrada.";
    }
    let lista = `Encontrei ${aulas.length} aula(s):\n\n`;
    aulas.forEach(aula => {
        const data = dayjs(aula.dataInicio).format('DD/MM/YYYY');
        const horario = aula.horarioSlotString;
        const lab = aula.laboratorioSelecionado;
        const cursos = aula.cursos.join(', ');
        lista += `- **${aula.assunto}** (${cursos}) em ${data} das ${horario} no ${lab} (ID: ${aula.id})\n`;
    });
    return lista;
};
