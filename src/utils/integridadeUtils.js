import dayjs from 'dayjs';
import { LISTA_CURSOS } from '../constants/cursos';
import { LISTA_LABORATORIOS } from '../constants/laboratorios';

const LISTA_CURSOS_VALIDOS = LISTA_CURSOS.map(c => c.value);
const LISTA_LABORATORIOS_VALIDOS = LISTA_LABORATORIOS.map(l => l.name);
const TIPOS_ATIVIDADE_VALIDOS = ['aula', 'revisao'];

export const KEYWORD_MAP = [
    { keywords: ['biomed', 'biomedicina'], value: 'biomedicina' },
    { keywords: ['farmacia'], value: 'farmacia' },
    { keywords: ['enf', 'enfermagem'], value: 'enfermagem' },
    { keywords: ['odonto', 'odontologia'], value: 'odontologia' },
    { keywords: ['med', 'medicina'], value: 'medicina' },
    { keywords: ['fisio', 'fisioterapia'], value: 'fisioterapia' },
    { keywords: ['nutri', 'nutricao'], value: 'nutricao' },
    { keywords: ['ed.fisica', 'edfisica'], value: 'ed_fisica' },
    { keywords: ['psico', 'psicologia'], value: 'psicologia' },
    { keywords: ['veterinaria', 'vet'], value: 'med_veterinaria' },
    { keywords: ['quimica'], value: 'quimica_tecnologica' },
    { keywords: ['eng', 'engenharia'], value: 'engenharia' },
    { keywords: ['cosmetico'], value: 'tec_cosmetico' },
];

/**
 * Valida se o documento possui divergências de schema ou resíduos de versões antigas.
 */
export function validarSchemaLegado(aula, periodos = []) {
    const errosLegado = [];

    // 1. Campo de data string antiga sem Timestamp 'dataInicio'
    if (aula.data && !aula.dataInicio) {
        errosLegado.push('Usa campo legados de data ("data" string) sem "dataInicio" Timestamp.');
    }

    // 2. Campo de laboratório antigo 'laboratorio' em vez de 'laboratorioSelecionado'
    if (aula.laboratorio && !aula.laboratorioSelecionado) {
        errosLegado.push(`Usa campo legado "laboratorio" ("${aula.laboratorio}") em vez de "laboratorioSelecionado".`);
    }

    // 3. Campo de título antigo 'disciplina' em vez de 'assunto'
    if (aula.disciplina && !aula.assunto) {
        errosLegado.push(`Usa campo legado "disciplina" ("${aula.disciplina}") em vez de "assunto".`);
    }

    // 4. Ausência de campo de status (assume-se 'agendada' implicitamente no app, mas pode mascarar dados mortos)
    if (!aula.status) {
        errosLegado.push('Documento não possui o campo "status" explícito.');
    }

    // 5. Data fora de qualquer período letivo cadastrado (se houver períodos)
    if (aula.dataInicio?.toDate && periodos.length > 0) {
        const dataAula = dayjs(aula.dataInicio.toDate());
        const emAlgumPeriodo = periodos.some(p => {
            if (!p.dataInicio?.toDate || !p.dataFim?.toDate) return false;
            const inicio = dayjs(p.dataInicio.toDate());
            const fim = dayjs(p.dataFim.toDate());
            return dataAula.isAfter(inicio.subtract(1, 'day')) && dataAula.isBefore(fim.add(1, 'day'));
        });
        if (!emAlgumPeriodo) {
            errosLegado.push('Data da aula está fora de todos os períodos/semestres ativos cadastrados.');
        }
    }

    return errosLegado;
}

/**
 * Valida inconsistências de dados obrigatórios atuais.
 */
export function validarDadosInvalidos(aula) {
    const errorsForAula = [];
    const assuntoLowerCase = (aula.assunto || aula.disciplina || '').toLowerCase();
    const suggestedCursos = [];

    if (!aula.assunto?.trim() && !aula.disciplina?.trim()) {
        errorsForAula.push('Assunto/disciplina da aula está faltando.');
    }
    if (aula.tipoAtividade && !TIPOS_ATIVIDADE_VALIDOS.includes(aula.tipoAtividade)) {
        errorsForAula.push(`Tipo de atividade inválido: "${aula.tipoAtividade}".`);
    } else if (!aula.tipoAtividade) {
        errorsForAula.push('Tipo de atividade não especificado.');
    }

    const labName = aula.laboratorioSelecionado || aula.laboratorio;
    if (!labName || !LISTA_LABORATORIOS_VALIDOS.includes(labName)) {
        errorsForAula.push(`Laboratório inválido ou não selecionado: "${labName || 'Ausente'}".`);
    }

    if (!aula.cursos?.length || aula.cursos.some(c => !LISTA_CURSOS_VALIDOS.includes(c))) {
        errorsForAula.push('Curso(s) faltando ou inválido(s).');
        KEYWORD_MAP.forEach(map => {
            if (map.keywords.some(keyword => assuntoLowerCase.includes(keyword)) && !suggestedCursos.includes(map.value)) {
                suggestedCursos.push(map.value);
            }
        });
    }

    if (!aula.propostoPorUid && !aula.propostoPor) {
        errorsForAula.push('Dados do proponente estão faltando.');
    }
    if (!aula.dataInicio?.toDate && !aula.data) {
        errorsForAula.push('Data de início inválida.');
    }

    return { erros: errorsForAula, sugestoes: { cursos: suggestedCursos } };
}

/**
 * Detecta duplicatas idênticas de aulas no mesmo laboratório, data e assunto/disciplina.
 */
export function detectarDuplicatas(aulas) {
    const map = {};
    const duplicatasSet = new Set();

    aulas.forEach(aula => {
        const lab = aula.laboratorioSelecionado || aula.laboratorio || 'N/A';
        const dataStr = aula.dataInicio?.toDate ? dayjs(aula.dataInicio.toDate()).toISOString() : (aula.data || 'N/A');
        const titulo = (aula.assunto || aula.disciplina || '').trim().toLowerCase();

        const key = `${lab}@${dataStr}@${titulo}`;
        if (!map[key]) {
            map[key] = [];
        }
        map[key].push(aula);
    });

    Object.values(map).forEach(grupo => {
        if (grupo.length > 1) {
            grupo.forEach(aula => duplicatasSet.add(aula.id));
        }
    });

    return duplicatasSet;
}

/**
 * Detecta se proponente ou técnicos possuem UIDs que não existem na coleção de usuários.
 */
export function detectarVinculosQuebrados(aula, usuariosMap) {
    const errosVinculo = [];
    if (!usuariosMap || Object.keys(usuariosMap).length === 0) return errosVinculo;

    if (aula.propostoPorUid && !usuariosMap[aula.propostoPorUid]) {
        errosVinculo.push(`Proponente com UID inexistente: ${aula.propostoPorUid}`);
    }

    if (aula.tecnicoResponsavelUid && !usuariosMap[aula.tecnicoResponsavelUid]) {
        errosVinculo.push(`Técnico responsável com UID inexistente: ${aula.tecnicoResponsavelUid}`);
    }

    if (Array.isArray(aula.tecnicosDesignados)) {
        aula.tecnicosDesignados.forEach(uid => {
            if (!usuariosMap[uid]) {
                errosVinculo.push(`Técnico designado com UID inexistente: ${uid}`);
            }
        });
    }

    return errosVinculo;
}

/**
 * Exporta o relatório de integridade em formato CSV.
 */
export function exportarRelatorioCSV(relatorioItems, filename = 'relatorio_integridade.csv') {
    if (!relatorioItems || relatorioItems.length === 0) return;

    const headers = ['ID', 'Assunto/Disciplina', 'Laboratorio', 'DataInicio', 'CategoriaProblema', 'DetalhesErros'];
    const rows = relatorioItems.map(item => [
        `"${item.id}"`,
        `"${(item.assunto || item.disciplina || 'Sem Assunto').replace(/"/g, '""')}"`,
        `"${(item.laboratorioSelecionado || item.laboratorio || 'N/A').replace(/"/g, '""')}"`,
        `"${item.dataInicio?.toDate ? dayjs(item.dataInicio.toDate()).format('DD/MM/YYYY HH:mm') : (item.data || 'N/A')}"`,
        `"${item.categoria || 'Inconsistência'}"`,
        `"${(item.erros || []).join(' | ').replace(/"/g, '""')}"`
    ]);

    const csvContent = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', filename);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}
