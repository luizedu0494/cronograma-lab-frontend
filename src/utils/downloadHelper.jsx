// src/utils/downloadHelper.js

import ExcelJS from 'exceljs';
import { saveAs } from 'file-saver';
import dayjs from 'dayjs';
import 'dayjs/locale/pt-br';
import { LISTA_CURSOS } from '../constants/cursos';

dayjs.locale('pt-br');

// --- Constantes de Estilização ---
const CURSO_COLORS = {
    'biomedicina': 'FF4CAF50', 'farmacia': 'FFF44336', 'enfermagem': 'FF2196F3',
    'odontologia': 'FFFF9800', 'medicina': 'FF9C27B0', 'fisioterapia': 'FFFFC107',
    'nutricao': 'FF00BCD4', 'ed_fisica': 'FF795548', 'psicologia': 'FFE91E63',
    'med_veterinaria': 'FF8BC34A', 'quimica_tecnologica': 'FF607D8B', 'engenharia': 'FF9E9E9E',
    'tec_cosmetico': 'FF3F51B5', 'default': 'FF616161'
};

const LAB_COLORS = {
    'Anatomia 1': 'FFB99C53', 'Anatomia 2': 'FF80A9A3', 'Anatomia 3': 'FF73956F',
    'Anatomia 4': 'FFB8D8D8', 'Anatomia 5': 'FFDCD5B5', 'Multidisciplinar 1': 'FF97B3C3',
    'Multidisciplinar 2': 'FF8EA9DB', 'Multidisciplinar 3': 'FFB2B8BC',
    'Habilidades 1 (Santander)': 'FFD9D9D9', 'Habilidades 2 (Galeria)': 'FFD1E6E1',
    'default': 'FFE0E0E0'
};

// Função exportada que será chamada dinamicamente
export const gerarRelatorioExcel = async (aulasDoMes, nomeArquivo) => {
    if (!aulasDoMes || aulasDoMes.length === 0) {
        throw new Error('Nenhuma aula encontrada para gerar o relatório.');
    }

    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Cronograma Detalhado');

    worksheet.columns = [
        { header: 'Data', key: 'data', width: 12 },
        { header: 'Dia', key: 'diaSemana', width: 14 },
        { header: 'Horário', key: 'horario', width: 15 },
        { header: 'Tipo', key: 'tipo', width: 18 },
        { header: 'Curso(s)', key: 'cursos', width: 35 },
        { header: 'Assunto/Atividade', key: 'assunto', width: 45 },
    ];

    // Aulas já vêm ordenadas por lab + data do caller
    const aulasPorLaboratorio = aulasDoMes.reduce((acc, aula) => {
        const lab = aula.laboratorioSelecionado || 'Não especificado';
        if (!acc[lab]) acc[lab] = [];
        acc[lab].push(aula);
        return acc;
    }, {});

    // Percorrer labs em ordem alfabética
    const labsOrdenados = Object.keys(aulasPorLaboratorio).sort((a, b) => a.localeCompare(b, 'pt-BR'));

    for (const labNome of labsOrdenados) {
        const labHeaderRow = worksheet.addRow([labNome]);
        worksheet.mergeCells(labHeaderRow.number, 1, labHeaderRow.number, worksheet.columns.length);
        const labHeaderCell = labHeaderRow.getCell(1);
        labHeaderCell.value = labNome;
        labHeaderCell.font = { bold: true, size: 16, color: { argb: 'FFFFFFFF' } };
        labHeaderCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: LAB_COLORS[labNome] || LAB_COLORS.default } };
        labHeaderCell.alignment = { vertical: 'middle', horizontal: 'center' };
        labHeaderRow.height = 30;

        const tableHeaderRow = worksheet.addRow(worksheet.columns.map(c => c.header));
        tableHeaderRow.eachCell(cell => {
            cell.font = { bold: true, color: { argb: 'FF000000' } };
            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFD3D3D3' } };
            cell.border = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } };
        });

        aulasPorLaboratorio[labNome].forEach(aula => {
            const dataInicio = dayjs(aula.dataInicio.toDate()).locale('pt-br');
            const tipoLabel = aula.isRevisao
                ? (aula.tipoRevisaoLabel || 'Revisão/Reforço')
                : (aula.tipoAtividade || 'Aula');

            const row = worksheet.addRow({
                data: dataInicio.format('DD/MM/YYYY'),
                diaSemana: dataInicio.format('dddd'),
                horario: `${dataInicio.format('HH:mm')} - ${dayjs(aula.dataFim.toDate()).format('HH:mm')}`,
                tipo: tipoLabel,
                cursos: (aula.cursos || []).map(c => LISTA_CURSOS.find(lc => lc.value === c)?.label || c).join(', '),
                assunto: aula.assunto,
            });

            row.eachCell({ includeEmpty: true }, (cell, colNumber) => {
                cell.border = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } };
                cell.alignment = { vertical: 'middle', horizontal: 'left', wrapText: true };
                const colKey = worksheet.columns[colNumber - 1]?.key;
                if (colKey === 'cursos') {
                    const primeiroCurso = (aula.cursos || [])[0];
                    cell.font = { color: { argb: CURSO_COLORS[primeiroCurso] || CURSO_COLORS.default }, bold: true };
                }
                // Destacar revisões com fundo levemente diferente
                if (aula.isRevisao) {
                    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF3E5F5' } }; // roxo claro
                }
            });
        });
        worksheet.addRow([]);
    }

    const buffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    saveAs(blob, nomeArquivo);
};

/**
 * Nova função exportada para gerar relatório Excel com Aulas e Eventos de Manutenção.
 * Suporta três abas:
 * 1. Cronológico (Aulas + Eventos)
 * 2. Aulas por Laboratório
 * 3. Eventos
 */
export const gerarRelatorioExcelUnificado = async (itens, nomeArquivo) => {
    if (!itens || itens.length === 0) {
        throw new Error('Nenhum registro encontrado para gerar o relatório.');
    }

    const workbook = new ExcelJS.Workbook();

    // Separar itens por origem
    const aulas = itens.filter(i => i._sourceType !== 'evento');
    const eventos = itens.filter(i => i._sourceType === 'evento');

    // ==========================================
    // ABA 1: Cronológico (Aulas + Eventos)
    // ==========================================
    const wsCronologico = workbook.addWorksheet('Cronológico (Aulas + Eventos)');

    wsCronologico.columns = [
        { header: 'Data', key: 'data', width: 12 },
        { header: 'Dia', key: 'diaSemana', width: 14 },
        { header: 'Horário', key: 'horario', width: 15 },
        { header: 'Registro', key: 'registroType', width: 15 },
        { header: 'Tipo / Categoria', key: 'tipo', width: 22 },
        { header: 'Laboratório', key: 'laboratorio', width: 25 },
        { header: 'Assunto / Título', key: 'assunto', width: 40 },
        { header: 'Curso(s) / Detalhes', key: 'detalhes', width: 35 },
        { header: 'Solicitante / Resp.', key: 'solicitante', width: 25 },
    ];

    // Estilizar cabeçalho
    const headerRow = wsCronologico.getRow(1);
    headerRow.eachCell(cell => {
        cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF2C3E50' } };
        cell.alignment = { vertical: 'middle', horizontal: 'center' };
        cell.border = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } };
    });
    headerRow.height = 25;

    // Preencher dados cronológicos
    itens.forEach(item => {
        const isEvento = item._sourceType === 'evento';
        const dInicio = item.dataInicio?.toDate ? dayjs(item.dataInicio.toDate()).locale('pt-br') : dayjs(item.dataInicio).locale('pt-br');
        const dFim = item.dataFim?.toDate ? dayjs(item.dataFim.toDate()).locale('pt-br') : dayjs(item.dataFim).locale('pt-br');

        let registroType = isEvento ? 'Evento' : (item.isRevisao ? 'Revisão' : 'Aula');
        let tipoLabel = isEvento
            ? (item.tipo || 'Evento')
            : (item.isRevisao ? (item.tipoRevisaoLabel || 'Revisão/Reforço') : (item.tipoAtividade || 'Aula'));
        
        let labStr = isEvento ? (item.laboratorio || 'Todos') : (item.laboratorioSelecionado || 'Não informado');
        let assuntoStr = isEvento ? item.titulo : item.assunto;
        let detalhesStr = isEvento
            ? (item.descricao || '')
            : (item.cursos || []).map(c => LISTA_CURSOS.find(lc => lc.value === c)?.label || c).join(', ');
        let solicitanteStr = isEvento ? (item.criadoPor || 'Sistema') : (item.proponenteNome || '');

        const row = wsCronologico.addRow({
            data: dInicio.format('DD/MM/YYYY'),
            diaSemana: dInicio.format('dddd'),
            horario: `${dInicio.format('HH:mm')} - ${dFim.format('HH:mm')}`,
            registroType: registroType,
            tipo: tipoLabel,
            laboratorio: labStr,
            assunto: assuntoStr,
            detalhes: detalhesStr,
            solicitante: solicitanteStr,
        });

        row.eachCell({ includeEmpty: true }, (cell) => {
            cell.border = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } };
            cell.alignment = { vertical: 'middle', horizontal: 'left', wrapText: true };

            if (isEvento) {
                cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF9C4' } }; // Amarelo claro
            } else if (item.isRevisao) {
                cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF3E5F5' } }; // Lilás claro
            }
        });
    });

    wsCronologico.autoFilter = {
        from: { row: 1, column: 1 },
        to: { row: itens.length + 1, column: wsCronologico.columns.length }
    };

    // ==========================================
    // ABA 2: Aulas por Laboratório (se houver aulas)
    // ==========================================
    if (aulas.length > 0) {
        const wsAulas = workbook.addWorksheet('Aulas por Laboratório');
        wsAulas.columns = [
            { header: 'Data', key: 'data', width: 12 },
            { header: 'Dia', key: 'diaSemana', width: 14 },
            { header: 'Horário', key: 'horario', width: 15 },
            { header: 'Tipo', key: 'tipo', width: 18 },
            { header: 'Curso(s)', key: 'cursos', width: 35 },
            { header: 'Assunto/Atividade', key: 'assunto', width: 45 },
        ];

        const aulasPorLab = aulas.reduce((acc, aula) => {
            const lab = aula.laboratorioSelecionado || 'Não especificado';
            if (!acc[lab]) acc[lab] = [];
            acc[lab].push(aula);
            return acc;
        }, {});

        const labsOrdenados = Object.keys(aulasPorLab).sort((a, b) => a.localeCompare(b, 'pt-BR'));

        for (const labNome of labsOrdenados) {
            const labHeaderRow = wsAulas.addRow([labNome]);
            wsAulas.mergeCells(labHeaderRow.number, 1, labHeaderRow.number, wsAulas.columns.length);
            const labHeaderCell = labHeaderRow.getCell(1);
            labHeaderCell.value = labNome;
            labHeaderCell.font = { bold: true, size: 16, color: { argb: 'FFFFFFFF' } };
            labHeaderCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: LAB_COLORS[labNome] || LAB_COLORS.default } };
            labHeaderCell.alignment = { vertical: 'middle', horizontal: 'center' };
            labHeaderRow.height = 30;

            const tableHeaderRow = wsAulas.addRow(wsAulas.columns.map(c => c.header));
            tableHeaderRow.eachCell(cell => {
                cell.font = { bold: true, color: { argb: 'FF000000' } };
                cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFD3D3D3' } };
                cell.border = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } };
            });

            aulasPorLab[labNome].forEach(aula => {
                const dataInicio = aula.dataInicio?.toDate ? dayjs(aula.dataInicio.toDate()).locale('pt-br') : dayjs(aula.dataInicio).locale('pt-br');
                const dataFim = aula.dataFim?.toDate ? dayjs(aula.dataFim.toDate()).locale('pt-br') : dayjs(aula.dataFim).locale('pt-br');
                const tipoLabel = aula.isRevisao
                    ? (aula.tipoRevisaoLabel || 'Revisão/Reforço')
                    : (aula.tipoAtividade || 'Aula');

                const row = wsAulas.addRow({
                    data: dataInicio.format('DD/MM/YYYY'),
                    diaSemana: dataInicio.format('dddd'),
                    horario: `${dataInicio.format('HH:mm')} - ${dataFim.format('HH:mm')}`,
                    tipo: tipoLabel,
                    cursos: (aula.cursos || []).map(c => LISTA_CURSOS.find(lc => lc.value === c)?.label || c).join(', '),
                    assunto: aula.assunto,
                });

                row.eachCell({ includeEmpty: true }, (cell, colNumber) => {
                    cell.border = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } };
                    cell.alignment = { vertical: 'middle', horizontal: 'left', wrapText: true };
                    const colKey = wsAulas.columns[colNumber - 1]?.key;
                    if (colKey === 'cursos') {
                        const primeiroCurso = (aula.cursos || [])[0];
                        cell.font = { color: { argb: CURSO_COLORS[primeiroCurso] || CURSO_COLORS.default }, bold: true };
                    }
                    if (aula.isRevisao) {
                        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF3E5F5' } };
                    }
                });
            });
            wsAulas.addRow([]);
        }
    }

    // ==========================================
    // ABA 3: Eventos (se houver eventos)
    // ==========================================
    if (eventos.length > 0) {
        const wsEventos = workbook.addWorksheet('Eventos');
        wsEventos.columns = [
            { header: 'Data Início', key: 'dataInicio', width: 14 },
            { header: 'Data Fim', key: 'dataFim', width: 14 },
            { header: 'Tipo de Evento', key: 'tipo', width: 18 },
            { header: 'Título / Evento', key: 'titulo', width: 35 },
            { header: 'Laboratório', key: 'laboratorio', width: 25 },
            { header: 'Descrição', key: 'descricao', width: 45 },
            { header: 'Criado Por', key: 'criadoPor', width: 25 },
        ];

        const evHeaderRow = wsEventos.getRow(1);
        evHeaderRow.eachCell(cell => {
            cell.font = { bold: true, color: { argb: 'FF000000' } };
            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFD54F' } }; // Amarelo Dourado
            cell.alignment = { vertical: 'middle', horizontal: 'center' };
            cell.border = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } };
        });
        evHeaderRow.height = 25;

        eventos.forEach(ev => {
            const dInicio = ev.dataInicio?.toDate ? dayjs(ev.dataInicio.toDate()).locale('pt-br') : dayjs(ev.dataInicio).locale('pt-br');
            const dFim = ev.dataFim?.toDate ? dayjs(ev.dataFim.toDate()).locale('pt-br') : dayjs(ev.dataFim).locale('pt-br');

            const row = wsEventos.addRow({
                dataInicio: dInicio.format('DD/MM/YYYY HH:mm'),
                dataFim: dFim.format('DD/MM/YYYY HH:mm'),
                tipo: ev.tipo || 'Evento',
                titulo: ev.titulo,
                laboratorio: ev.laboratorio || 'Todos',
                descricao: ev.descricao || '',
                criadoPor: ev.criadoPor || 'Sistema',
            });

            row.eachCell({ includeEmpty: true }, (cell) => {
                cell.border = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } };
                cell.alignment = { vertical: 'middle', horizontal: 'left', wrapText: true };
                cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF9C4' } };
            });
        });

        wsEventos.autoFilter = {
            from: { row: 1, column: 1 },
            to: { row: eventos.length + 1, column: wsEventos.columns.length }
        };
    }

    const buffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    saveAs(blob, nomeArquivo);
};

