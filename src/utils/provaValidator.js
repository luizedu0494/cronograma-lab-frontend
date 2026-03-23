import dayjs from 'dayjs';

/**
 * Valida dados de prova
 * 
 * @param {boolean} isProva - Se é prova
 * @param {string} tipoProva - Tipo de prova
 * @returns {object} { valid: boolean, errors: [] }
 */
export const validarDadosProva = (isProva, tipoProva) => {
    const errors = [];

    if (isProva && !tipoProva) {
        errors.push('Tipo de prova é obrigatório quando marcar como prova');
    }

    const tiposValidos = ['avaliacao', 'simulado', 'prova_final', 'outro'];
    if (isProva && tipoProva && !tiposValidos.includes(tipoProva)) {
        errors.push('Tipo de prova inválido');
    }

    return {
        valid: errors.length === 0,
        errors
    };
};

/**
 * Obtém label do tipo de prova
 * 
 * @param {string} tipoProva - Tipo de prova
 * @returns {string} Label formatado
 */
export const obterLabelTipoProva = (tipoProva) => {
    const labels = {
        'avaliacao': '📋 Avaliação',
        'simulado': '🎯 Simulado',
        'prova_final': '🏆 Prova Final',
        'outro': '📌 Outro'
    };
    return labels[tipoProva] || tipoProva;
};

/**
 * Agrupa provas por tipo
 * 
 * @param {Array} aulas - Array de aulas
 * @returns {object} { avaliacao: [], simulado: [], prova_final: [], outro: [] }
 */
export const obterProvasPorTipo = (aulas) => {
    const resultado = {
        avaliacao: [],
        simulado: [],
        prova_final: [],
        outro: []
    };

    if (!Array.isArray(aulas)) return resultado;

    aulas.forEach(aula => {
        if (aula.isProva && aula.tipoProva) {
            if (resultado[aula.tipoProva]) {
                resultado[aula.tipoProva].push(aula);
            }
        }
    });

    return resultado;
};

/**
 * Agrupa provas por mês
 * 
 * @param {Array} aulas - Array de aulas
 * @param {number} ano - Ano para filtrar
 * @returns {object} { 'janeiro': [], 'fevereiro': [], ... }
 */
export const obterProvasPorMes = (aulas, ano) => {
    const meses = {
        'janeiro': [], 'fevereiro': [], 'março': [], 'abril': [],
        'maio': [], 'junho': [], 'julho': [], 'agosto': [],
        'setembro': [], 'outubro': [], 'novembro': [], 'dezembro': []
    };

    if (!Array.isArray(aulas)) return meses;

    aulas.forEach(aula => {
        if (aula.isProva && aula.dataInicio) {
            const data = dayjs(aula.dataInicio.toDate?.() || aula.dataInicio);
            if (data.year() === ano) {
                const mesIndex = data.month();
                const mesNome = Object.keys(meses)[mesIndex];
                if (mesNome) {
                    meses[mesNome].push(aula);
                }
            }
        }
    });

    return meses;
};

/**
 * Agrupa provas por laboratório
 * 
 * @param {Array} aulas - Array de aulas
 * @returns {object} { 'Anatomia 1': [], 'Microscopia 1': [], ... }
 */
export const obterProvasPorLaboratorio = (aulas) => {
    const resultado = {};

    if (!Array.isArray(aulas)) return resultado;

    aulas.forEach(aula => {
        if (aula.isProva) {
            const lab = aula.laboratorioSelecionado || 'Sem laboratório';
            if (!resultado[lab]) {
                resultado[lab] = [];
            }
            resultado[lab].push(aula);
        }
    });

    return resultado;
};

/**
 * Obtém próximas provas
 * 
 * @param {Array} aulas - Array de aulas
 * @param {number} dias - Número de dias a considerar (padrão: 7)
 * @returns {Array} Array de provas ordenadas por data
 */
export const obterProximasProvas = (aulas, dias = 7) => {
    if (!Array.isArray(aulas)) return [];

    const hoje = dayjs().startOf('day');
    const futuro = hoje.add(dias, 'day').endOf('day');

    return aulas
        .filter(aula => {
            if (!aula.isProva || !aula.dataInicio) return false;
            const data = dayjs(aula.dataInicio.toDate?.() || aula.dataInicio);
            return data.isBetween(hoje, futuro, null, '[]');
        })
        .sort((a, b) => {
            const dataA = dayjs(a.dataInicio.toDate?.() || a.dataInicio);
            const dataB = dayjs(b.dataInicio.toDate?.() || b.dataInicio);
            return dataA.diff(dataB);
        });
};

/**
 * Calcula estatísticas de provas
 * 
 * @param {Array} aulas - Array de aulas
 * @param {number} ano - Ano para filtrar
 * @returns {object} Estatísticas gerais
 */
export const calcularEstatisticasProvas = (aulas, ano) => {
    if (!Array.isArray(aulas)) {
        return {
            total: 0,
            porTipo: { avaliacao: 0, simulado: 0, prova_final: 0, outro: 0 },
            porLaboratorio: {},
            porMes: {}
        };
    }

    const provas = aulas.filter(a => a.isProva);
    const provasAno = provas.filter(a => {
        const data = dayjs(a.dataInicio?.toDate?.() || a.dataInicio);
        return data.year() === ano;
    });

    const porTipo = {
        avaliacao: 0,
        simulado: 0,
        prova_final: 0,
        outro: 0
    };

    const porLaboratorio = {};
    const porMes = {};

    provasAno.forEach(prova => {
        // Por tipo
        if (prova.tipoProva && porTipo.hasOwnProperty(prova.tipoProva)) {
            porTipo[prova.tipoProva]++;
        }

        // Por laboratório
        const lab = prova.laboratorioSelecionado || 'Sem laboratório';
        porLaboratorio[lab] = (porLaboratorio[lab] || 0) + 1;

        // Por mês
        const data = dayjs(prova.dataInicio?.toDate?.() || prova.dataInicio);
        const mes = data.format('MMMM');
        porMes[mes] = (porMes[mes] || 0) + 1;
    });

    return {
        total: provasAno.length,
        porTipo,
        porLaboratorio,
        porMes
    };
};

/**
 * Formata dados de prova para exibição
 * 
 * @param {object} prova - Objeto de prova
 * @returns {object} Dados formatados
 */
export const formatarProva = (prova) => {
    return {
        ...prova,
        dataFormatada: prova.dataInicio 
            ? dayjs(prova.dataInicio.toDate?.() || prova.dataInicio).format('DD/MM/YYYY')
            : 'Data não disponível',
        tipoLabel: obterLabelTipoProva(prova.tipoProva),
        statusLabel: prova.status === 'aprovada' ? '✅ Aprovada' : '⏳ Pendente'
    };
};

/**
 * Verifica se uma aula é uma prova
 * 
 * @param {object} aula - Objeto de aula
 * @returns {boolean}
 */
export const ehProva = (aula) => {
    return aula && aula.isProva === true;
};

/**
 * Conta provas por status
 * 
 * @param {Array} aulas - Array de aulas
 * @returns {object} { aprovadas: number, pendentes: number }
 */
export const contarProvasPorStatus = (aulas) => {
    const resultado = {
        aprovadas: 0,
        pendentes: 0
    };

    if (!Array.isArray(aulas)) return resultado;

    aulas.forEach(aula => {
        if (aula.isProva) {
            if (aula.status === 'aprovada') {
                resultado.aprovadas++;
            } else if (aula.status === 'pendente') {
                resultado.pendentes++;
            }
        }
    });

    return resultado;
};
