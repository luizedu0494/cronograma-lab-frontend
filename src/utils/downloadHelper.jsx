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
        { header: 'Professor', key: 'professor', width: 30 },
        { header: 'Técnico(s)', key: 'tecnicos', width: 30 },
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
                professor: aula.isRevisao ? (aula.professorRevisao || aula.professorNome || '') : (aula.professorNome || ''),
                tecnicos: (aula.tecnicosInfo || []).map(t => t.name).join(', ')
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
