import React, { useState } from 'react';
import { db } from './firebaseConfig';
import { collection, query, where, getDocs, Timestamp, orderBy } from 'firebase/firestore';
import {
    Button, Container, Paper, Typography, Box, CircularProgress, Alert, Snackbar,
    FormControl, InputLabel, Select, MenuItem, TextField, Grid, OutlinedInput, Chip,
    Checkbox, FormControlLabel, FormGroup, Tooltip, Divider
} from '@mui/material';
import ClearIcon from '@mui/icons-material/Clear';
import FileDownloadIcon from '@mui/icons-material/FileDownload';
import PictureAsPdfIcon from '@mui/icons-material/PictureAsPdf';
import EventIcon from '@mui/icons-material/Event';
import FilterAltIcon from '@mui/icons-material/FilterAlt';

import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDayjs } from '@mui/x-date-pickers/AdapterDayjs';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import dayjs from 'dayjs';
import 'dayjs/locale/pt-br';
import utc from 'dayjs/plugin/utc';
import { saveAs } from 'file-saver';

import { LISTA_LABORATORIOS } from './constants/laboratorios';
import { LISTA_CURSOS } from './constants/cursos';

dayjs.extend(utc);

const BLOCOS_HORARIO = [
    { "value": "07:00-09:10", "label": "07:00 - 09:10", "turno": "Matutino" },
    { "value": "09:30-12:00", "label": "09:30 - 12:00", "turno": "Matutino" },
    { "value": "13:00-15:10", "label": "13:00 - 15:10", "turno": "Vespertino" },
    { "value": "15:30-18:00", "label": "15:30 - 18:00", "turno": "Vespertino" },
    { "value": "18:30-20:10", "label": "18:30 - 20:10", "turno": "Noturno" },
    { "value": "20:30-22:00", "label": "20:30 - 22:00", "turno": "Noturno" },
];

const TIPOS_AULA_OPCOES = [
    { id: 'aula', label: '🎓 Aula Regular' },
    { id: 'prova', label: '📝 Prova / Avaliação' },
    { id: 'revisao', label: '📖 Revisão / Reforço' },
    { id: 'monitoria', label: '🧑‍🏫 Monitoria' },
    { id: 'pratica', label: '🔬 Aula Prática' },
];

const TIPOS_EVENTO_OPCOES = [
    { id: 'Manutenção', label: '🔧 Manutenção' },
    { id: 'Feriado', label: '🏖️ Feriado' },
    { id: 'Evento', label: '📅 Evento' },
    { id: 'Giro', label: '🔄 Giro' },
    { id: 'Outro', label: '📌 Outro' },
];

const ESTADO_INICIAL_FILTROS = {
    modoPeriodo: 'mes', // 'mes' | 'ano' | 'personalizado'
    selectedDate: dayjs(),
    dataInicio: dayjs().startOf('month'),
    dataFim: dayjs().endOf('month'),

    incluirAulas: true,
    incluirEventos: true,

    tiposAula: [],   // vazio = todos
    tiposEvento: [], // vazio = todos

    laboratorioFiltro: [],
    assuntoFiltro: '',
    horarioFiltro: [],
    cursosFiltro: [],
    ligaFiltro: '',
};

// Formatação UTC para .ics
const formatICalDate = (date) => {
    const d = date?.toDate ? date.toDate() : new Date(date);
    return dayjs(d).utc().format('YYYYMMDDTHHmmss') + 'Z';
};

// Suporte a Aulas e Eventos no iCalendar
const generateICalContent = (items) => {
    let content = [
        'BEGIN:VCALENDAR',
        'VERSION:2.0',
        'PRODID:-//CronoLab CESMAC//NONSGML v2.0//PT',
    ];

    items.forEach(item => {
        const isEvento = item._sourceType === 'evento';
        const uid = item.id || `evt_${Math.random().toString(36).substr(2, 9)}`;
        const start = formatICalDate(item.dataInicio);
        const end = formatICalDate(item.dataFim);

        const summary = isEvento
            ? `[EVENTO – ${item.tipo || 'Manutenção'}] ${item.titulo} (${item.laboratorio || 'Todos'})`
            : `[${item.laboratorioSelecionado || 'Lab'}] ${item.assunto}`;

        const description = isEvento
            ? `Tipo: ${item.tipo || 'Evento'}\\nLaboratório: ${item.laboratorio || 'Todos'}\\nDescrição: ${item.descricao || 'Sem descrição'}`
            : `Tipo: ${item.tipoAtividade || 'Aula'}\\nCursos: ${(item.cursos || []).join(', ')}\\nProponente: ${item.proponenteNome || 'Não informado'}`;

        const location = isEvento
            ? (item.laboratorio || 'Todos os Laboratórios')
            : (item.laboratorioSelecionado || 'Não especificado');

        content.push(
            'BEGIN:VEVENT',
            `UID:${uid}`,
            `DTSTAMP:${formatICalDate(new Date())}`,
            `DTSTART:${start}`,
            `DTEND:${end}`,
            `SUMMARY:${summary}`,
            `DESCRIPTION:${description}`,
            `LOCATION:${location}`,
            'END:VEVENT'
        );
    });

    content.push('END:VCALENDAR');
    return content.join('\r\n');
};

function DownloadCronograma() {
    const [filtros, setFiltros] = useState(ESTADO_INICIAL_FILTROS);
    const [loading, setLoading] = useState(false);
    const [feedback, setFeedback] = useState({ open: false, message: '', severity: 'info' });

    const handleFiltroChange = (campo, valor) => {
        setFiltros(prev => ({ ...prev, [campo]: valor }));
    };

    const handleToggleArray = (campo, valor) => {
        setFiltros(prev => {
            const arr = prev[campo];
            const novo = arr.includes(valor)
                ? arr.filter(v => v !== valor)
                : [...arr, valor];
            return { ...prev, [campo]: novo };
        });
    };

    const calcularIntervalo = () => {
        if (filtros.modoPeriodo === 'ano') {
            const ano = filtros.selectedDate.year();
            return {
                inicio: dayjs().year(ano).startOf('year'),
                fim: dayjs().year(ano).endOf('year'),
                labelSufixo: `Ano_${ano}`,
            };
        }
        if (filtros.modoPeriodo === 'personalizado') {
            return {
                inicio: dayjs(filtros.dataInicio).startOf('day'),
                fim: dayjs(filtros.dataFim).endOf('day'),
                labelSufixo: `${dayjs(filtros.dataInicio).format('DD-MM-YYYY')}_ate_${dayjs(filtros.dataFim).format('DD-MM-YYYY')}`,
            };
        }
        // Padrão: Mês específico
        const ano = filtros.selectedDate.year();
        const mes = filtros.selectedDate.month();
        return {
            inicio: dayjs().year(ano).month(mes).startOf('month'),
            fim: dayjs().year(ano).month(mes).endOf('month'),
            labelSufixo: filtros.selectedDate.locale('pt-br').format('MMMM_YYYY'),
        };
    };

    const buscarAulas = async (inicio, fim) => {
        if (!filtros.incluirAulas) return [];

        let q = query(
            collection(db, 'aulas'),
            where('status', '==', 'aprovada'),
            where('dataInicio', '>=', Timestamp.fromDate(inicio.toDate())),
            where('dataInicio', '<=', Timestamp.fromDate(fim.toDate()))
        );

        if (filtros.laboratorioFiltro.length > 0) {
            q = query(q, where('laboratorioSelecionado', 'in', filtros.laboratorioFiltro));
        }
        if (filtros.horarioFiltro.length > 0) {
            q = query(q, where('horarioSlotString', 'in', filtros.horarioFiltro));
        }
        if (filtros.assuntoFiltro.trim()) {
            q = query(q, where('assunto', '>=', filtros.assuntoFiltro), where('assunto', '<=', filtros.assuntoFiltro + '\uf8ff'));
        }
        if (filtros.cursosFiltro.length > 0) {
            q = query(q, where('cursos', 'array-contains-any', filtros.cursosFiltro));
        }
        if (filtros.ligaFiltro) {
            q = query(q, where('liga', '==', filtros.ligaFiltro));
        }

        q = query(q, orderBy('dataInicio', 'asc'));

        const snapshot = await getDocs(q);
        let docs = snapshot.docs.map(doc => ({
            id: doc.id,
            _sourceType: 'aula',
            ...doc.data()
        }));

        // Filtro de tipos de aula no frontend
        if (filtros.tiposAula.length > 0) {
            docs = docs.filter(aula => {
                const tipoAtiv = (aula.tipoAtividade || '').toLowerCase();
                const isRev = Boolean(aula.isRevisao);

                return filtros.tiposAula.some(t => {
                    if (t === 'revisao') return isRev || tipoAtiv.includes('revisão') || tipoAtiv.includes('revisao');
                    if (t === 'prova') return tipoAtiv.includes('prova') || tipoAtiv.includes('avaliação') || tipoAtiv.includes('avaliacao');
                    if (t === 'monitoria') return tipoAtiv.includes('monitoria');
                    if (t === 'pratica') return tipoAtiv.includes('prática') || tipoAtiv.includes('pratica');
                    if (t === 'aula') return !isRev && !tipoAtiv.includes('prova') && !tipoAtiv.includes('monitoria');
                    return true;
                });
            });
        }

        return docs;
    };

    const buscarEventos = async (inicio, fim) => {
        if (!filtros.incluirEventos) return [];

        let q = query(
            collection(db, 'eventosManutencao'),
            where('dataInicio', '>=', Timestamp.fromDate(inicio.toDate())),
            where('dataInicio', '<=', Timestamp.fromDate(fim.toDate())),
            orderBy('dataInicio', 'asc')
        );

        const snapshot = await getDocs(q);
        let docs = snapshot.docs.map(doc => ({
            id: doc.id,
            _sourceType: 'evento',
            ...doc.data()
        }));

        // Filtro de laboratórios para eventos no frontend
        if (filtros.laboratorioFiltro.length > 0) {
            docs = docs.filter(e =>
                !e.laboratorio ||
                e.laboratorio === 'Todos' ||
                filtros.laboratorioFiltro.includes(e.laboratorio)
            );
        }

        // Filtro de tipos de evento no frontend
        if (filtros.tiposEvento.length > 0) {
            docs = docs.filter(e => filtros.tiposEvento.includes(e.tipo));
        }

        return docs;
    };

    const handleDownload = async (format) => {
        if (!filtros.incluirAulas && !filtros.incluirEventos) {
            setFeedback({
                open: true,
                message: 'Selecione ao menos uma fonte de dados: Aulas ou Eventos.',
                severity: 'warning'
            });
            return;
        }

        if (filtros.modoPeriodo === 'personalizado' && dayjs(filtros.dataInicio).isAfter(dayjs(filtros.dataFim))) {
            setFeedback({
                open: true,
                message: 'A data inicial não pode ser posterior à data final.',
                severity: 'error'
            });
            return;
        }

        setLoading(true);
        setFeedback({ open: false, message: '', severity: 'info' });

        const { inicio, fim, labelSufixo } = calcularIntervalo();

        try {
            const [aulas, eventos] = await Promise.all([
                buscarAulas(inicio, fim),
                buscarEventos(inicio, fim),
            ]);

            const todosItens = [...aulas, ...eventos];

            // Ordenação unificada por dataInicio crescente
            todosItens.sort((a, b) => {
                const da = a.dataInicio?.toDate ? a.dataInicio.toDate() : new Date(a.dataInicio);
                const dbDate = b.dataInicio?.toDate ? b.dataInicio.toDate() : new Date(b.dataInicio);
                return da - dbDate;
            });

            if (todosItens.length === 0) {
                setFeedback({
                    open: true,
                    message: 'Nenum registro encontrado para os filtros selecionados.',
                    severity: 'warning'
                });
                return;
            }

            const totalAulas = aulas.length;
            const totalEventos = eventos.length;
            const infoTotal = `(${totalAulas} aula(s) + ${totalEventos} evento(s))`;

            if (format === 'excel') {
                const { gerarRelatorioExcelUnificado } = await import('./utils/downloadHelper');
                const nomeArquivo = `Cronograma_CESMAC_${labelSufixo}.xlsx`;
                await gerarRelatorioExcelUnificado(todosItens, nomeArquivo);
                setFeedback({
                    open: true,
                    message: `Excel gerado com sucesso! ${infoTotal}`,
                    severity: 'success'
                });
            } else if (format === 'ics') {
                const content = generateICalContent(todosItens);
                const blob = new Blob([content], { type: 'text/calendar;charset=utf-8' });
                saveAs(blob, `Cronograma_CESMAC_${labelSufixo}.ics`);
                setFeedback({
                    open: true,
                    message: `Arquivo iCalendar (.ics) gerado com sucesso! ${infoTotal}`,
                    severity: 'success'
                });
            } else if (format === 'pdf') {
                const { jsPDF } = await import('jspdf');
                const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });

                const pageWidth = doc.internal.pageSize.getWidth();
                const pageHeight = doc.internal.pageSize.getHeight();
                const margin = 14;
                const contentWidth = pageWidth - (margin * 2);

                let y = 15;

                // --- Cabeçalho Institucional ---
                doc.setFillColor(30, 126, 200); // Azul CESMAC #1E7EC8
                doc.rect(0, 0, pageWidth, 24, 'F');

                doc.setTextColor(255, 255, 255);
                doc.setFont('helvetica', 'bold');
                doc.setFontSize(14);
                doc.text('Centro Universitário CESMAC — CronoLab', margin, 11);

                doc.setFont('helvetica', 'normal');
                doc.setFontSize(9);
                doc.text(`Relatório de Cronograma de Laboratórios — Período: ${labelSufixo.replace(/_/g, ' ')}`, margin, 18);

                y = 30;

                // Subtítulo e Resumo KPI
                doc.setTextColor(50, 50, 50);
                doc.setFontSize(10);
                doc.setFont('helvetica', 'bold');
                doc.text(`Total de registros: ${todosItens.length}`, margin, y);

                doc.setFont('helvetica', 'normal');
                doc.setFontSize(9);
                doc.setTextColor(100, 100, 100);
                doc.text(`(${aulas.length} aula(s) aprovada(s) | ${eventos.length} evento(s) de manutenção/bloqueio)`, margin + 45, y);

                y += 8;

                // Linha divisória
                doc.setDrawColor(200, 200, 200);
                doc.setLineWidth(0.4);
                doc.line(margin, y, pageWidth - margin, y);
                y += 6;

                let dataAtualGroup = '';

                todosItens.forEach((item, index) => {
                    const isEvt = item._sourceType === 'evento';
                    const dInicio = item.dataInicio?.toDate ? dayjs(item.dataInicio.toDate()).locale('pt-br') : dayjs(item.dataInicio).locale('pt-br');
                    const dFim = item.dataFim?.toDate ? dayjs(item.dataFim.toDate()).locale('pt-br') : dayjs(item.dataFim).locale('pt-br');
                    const dataFormatada = dInicio.format('DD/MM/YYYY');
                    const diaSemana = dInicio.format('dddd');
                    const horaStr = `${dInicio.format('HH:mm')} às ${dFim.format('HH:mm')}`;

                    // Se a data mudou, adiciona um cabeçalho de grupo de Data
                    if (dataFormatada !== dataAtualGroup) {
                        dataAtualGroup = dataFormatada;

                        // Verificar quebra de página para o grupo de data
                        if (y > pageHeight - 35) {
                            doc.addPage();
                            y = 18;
                        } else {
                            y += 3;
                        }

                        doc.setFillColor(235, 243, 250); // Fundo azul bem claro
                        doc.roundedRect(margin, y, contentWidth, 7, 1.5, 1.5, 'F');

                        doc.setTextColor(30, 126, 200);
                        doc.setFont('helvetica', 'bold');
                        doc.setFontSize(9.5);
                        doc.text(`📅 ${dataFormatada} (${diaSemana})`, margin + 3, y + 5);
                        y += 10;
                    }

                    // Altura do bloco por item
                    const itemHeight = isEvt ? 16 : 18;

                    // Quebra de página se o item exceder a página
                    if (y + itemHeight > pageHeight - 15) {
                        doc.addPage();
                        y = 18;
                    }

                    // Fundo diferenciado para Evento / Revisão / Aula
                    if (isEvt) {
                        doc.setFillColor(255, 249, 196); // Amarelo claro para evento
                        doc.setDrawColor(245, 197, 24); // Borda dourada
                    } else if (item.isRevisao) {
                        doc.setFillColor(243, 229, 245); // Lilás claro para revisão
                        doc.setDrawColor(186, 104, 200);
                    } else {
                        doc.setFillColor(250, 250, 250); // Cinza super leve para aula
                        doc.setDrawColor(220, 220, 220);
                    }

                    doc.setLineWidth(0.3);
                    doc.roundedRect(margin, y, contentWidth, itemHeight - 2, 1, 1, 'FD');

                    // Linha 1 do item: [TAG/LAB] Assunto/Título (Horário)
                    doc.setFontSize(9);
                    doc.setFont('helvetica', 'bold');
                    doc.setTextColor(30, 30, 30);

                    const tagLabel = isEvt
                        ? `[EVENTO – ${item.tipo || 'Manutenção'}]`
                        : `[${item.laboratorioSelecionado || 'Lab'}]`;
                    const tituloText = isEvt ? (item.titulo || 'Evento Sem Título') : (item.assunto || 'Aula Sem Assunto');

                    // Truncar texto se for muito longo
                    const maxChar = 65;
                    const tituloTruncado = tituloText.length > maxChar ? tituloText.substring(0, maxChar) + '...' : tituloText;

                    doc.text(`${tagLabel} ${tituloTruncado}`, margin + 3, y + 5);

                    // Horário alinhado à direita
                    doc.setFontSize(8.5);
                    doc.setFont('helvetica', 'bold');
                    doc.setTextColor(60, 60, 60);
                    doc.text(`🕒 ${horaStr}`, pageWidth - margin - 3, y + 5, { align: 'right' });

                    // Linha 2 do item: Detalhes adicionais (Laboratório, Cursos, Proponente/Solicitante)
                    doc.setFontSize(8);
                    doc.setFont('helvetica', 'normal');
                    doc.setTextColor(90, 90, 90);

                    let detalheLinha = isEvt
                        ? `Lab: ${item.laboratorio || 'Todos os Laboratórios'} | Resp: ${item.criadoPor || 'Sistema'}${item.descricao ? ' | Obs: ' + item.descricao : ''}`
                        : `Tipo: ${item.tipoAtividade || 'Aula'} | Cursos: ${(item.cursos || []).join(', ') || 'N/A'} | Prof/Resp: ${item.proponenteNome || 'N/A'}`;

                    if (detalheLinha.length > 95) {
                        detalheLinha = detalheLinha.substring(0, 95) + '...';
                    }

                    doc.text(detalheLinha, margin + 3, y + 10);

                    y += itemHeight;
                });

                // Adicionar números de página em todas as páginas
                const totalPages = doc.internal.getNumberOfPages();
                for (let i = 1; i <= totalPages; i++) {
                    doc.setPage(i);
                    doc.setFontSize(7.5);
                    doc.setFont('helvetica', 'normal');
                    doc.setTextColor(150, 150, 150);
                    doc.text(`Página ${i} de ${totalPages} — Gerado pelo CronoLab CESMAC em ${dayjs().format('DD/MM/YYYY [às] HH:mm')}`, pageWidth / 2, pageHeight - 8, { align: 'center' });
                }

                doc.save(`Cronograma_CESMAC_${labelSufixo}.pdf`);
                setFeedback({
                    open: true,
                    message: `PDF gerado com sucesso! ${infoTotal}`,
                    severity: 'success'
                });
            }
        } catch (err) {
            console.error('ERRO ao gerar relatório:', err);
            setFeedback({
                open: true,
                message: `Erro ao gerar relatório: ${err.message}`,
                severity: 'error'
            });
        } finally {
            setLoading(false);
        }
    };

    const handleClearFilters = () => setFiltros(ESTADO_INICIAL_FILTROS);

    const handleCloseSnackbar = (event, reason) => {
        if (reason === 'clickaway') return;
        setFeedback(prev => ({ ...prev, open: false }));
    };

    return (
        <LocalizationProvider dateAdapter={AdapterDayjs} adapterLocale="pt-br">
            <Container maxWidth="lg" sx={{ mt: 4, mb: 4 }}>
                <Paper elevation={3} sx={{ p: { xs: 2, md: 4 } }}>
                    <Typography variant="h5" component="h2" align="center" gutterBottom fontWeight="bold">
                        Download de Relatórios do Cronograma
                    </Typography>
                    <Typography variant="body2" align="center" color="text.secondary" sx={{ mb: 3 }}>
                        Exporte aulas aprovadas e eventos de manutenção em formato Excel (.xlsx), PDF ou Calendário (.ics).
                    </Typography>

                    {/* SEÇÃO 1: Fontes de Dados */}
                    <Box sx={{ mb: 3, p: 2, bgcolor: 'background.default', borderRadius: 1, border: '1px solid', borderColor: 'divider' }}>
                        <Typography variant="subtitle2" color="primary" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                            <FilterAltIcon fontSize="small" /> Fontes de Dados a Incluir
                        </Typography>
                        <FormGroup row>
                            <FormControlLabel
                                control={
                                    <Checkbox
                                        checked={filtros.incluirAulas}
                                        onChange={(e) => handleFiltroChange('incluirAulas', e.target.checked)}
                                    />
                                }
                                label="🎓 Incluir Aulas Aprovadas"
                            />
                            <FormControlLabel
                                control={
                                    <Checkbox
                                        checked={filtros.incluirEventos}
                                        onChange={(e) => handleFiltroChange('incluirEventos', e.target.checked)}
                                    />
                                }
                                label="🔧 Incluir Eventos de Manutenção / Feriados / Bloqueios"
                            />
                        </FormGroup>
                    </Box>

                    {/* SEÇÃO 2: Período */}
                    <Typography variant="subtitle2" color="primary" gutterBottom>
                        📅 Período do Relatório
                    </Typography>
                    <Grid container spacing={2} sx={{ mb: 3 }}>
                        <Grid item xs={12} sm={4}>
                            <FormControl fullWidth size="small">
                                <InputLabel shrink>Tipo de Período</InputLabel>
                                <Select
                                    value={filtros.modoPeriodo}
                                    onChange={(e) => handleFiltroChange('modoPeriodo', e.target.value)}
                                    input={<OutlinedInput notched label="Tipo de Período" />}
                                >
                                    <MenuItem value="mes">📅 Mês Específico</MenuItem>
                                    <MenuItem value="ano">🗓️ Ano Inteiro</MenuItem>
                                    <MenuItem value="personalizado">📆 Período Personalizado</MenuItem>
                                </Select>
                            </FormControl>
                        </Grid>

                        {filtros.modoPeriodo !== 'personalizado' ? (
                            <Grid item xs={12} sm={8}>
                                <DatePicker
                                    label={filtros.modoPeriodo === 'ano' ? "Selecione o Ano" : "Selecione Mês e Ano"}
                                    views={filtros.modoPeriodo === 'ano' ? ['year'] : ['month', 'year']}
                                    value={filtros.selectedDate}
                                    onChange={(val) => val && handleFiltroChange('selectedDate', val)}
                                    slotProps={{
                                        textField: {
                                            fullWidth: true,
                                            size: 'small',
                                            helperText: filtros.modoPeriodo === 'ano' ? `Ex: Ano ${filtros.selectedDate.year()}` : 'Ex: Junho 2026'
                                        }
                                    }}
                                />
                            </Grid>
                        ) : (
                            <>
                                <Grid item xs={12} sm={4}>
                                    <DatePicker
                                        label="Data Inicial"
                                        format="DD/MM/YYYY"
                                        value={filtros.dataInicio}
                                        onChange={(val) => val && handleFiltroChange('dataInicio', val)}
                                        slotProps={{ textField: { fullWidth: true, size: 'small' } }}
                                    />
                                </Grid>
                                <Grid item xs={12} sm={4}>
                                    <DatePicker
                                        label="Data Final"
                                        format="DD/MM/YYYY"
                                        value={filtros.dataFim}
                                        onChange={(val) => val && handleFiltroChange('dataFim', val)}
                                        slotProps={{ textField: { fullWidth: true, size: 'small' } }}
                                    />
                                </Grid>
                            </>
                        )}
                    </Grid>

                    <Divider sx={{ my: 2 }} />

                    {/* SEÇÃO 3: Filtros de Tipos Granulares */}
                    <Grid container spacing={2} sx={{ mb: 3 }}>
                        {filtros.incluirAulas && (
                            <Grid item xs={12} md={6}>
                                <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                                    Tipos de Aula (vazio = todos)
                                </Typography>
                                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                                    {TIPOS_AULA_OPCOES.map(t => (
                                        <Chip
                                            key={t.id}
                                            label={t.label}
                                            size="small"
                                            clickable
                                            color={filtros.tiposAula.includes(t.id) ? 'primary' : 'default'}
                                            onClick={() => handleToggleArray('tiposAula', t.id)}
                                        />
                                    ))}
                                </Box>
                            </Grid>
                        )}

                        {filtros.incluirEventos && (
                            <Grid item xs={12} md={6}>
                                <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                                    Tipos de Evento (vazio = todos)
                                </Typography>
                                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                                    {TIPOS_EVENTO_OPCOES.map(t => (
                                        <Chip
                                            key={t.id}
                                            label={t.label}
                                            size="small"
                                            clickable
                                            color={filtros.tiposEvento.includes(t.id) ? 'warning' : 'default'}
                                            onClick={() => handleToggleArray('tiposEvento', t.id)}
                                        />
                                    ))}
                                </Box>
                            </Grid>
                        )}
                    </Grid>

                    {/* SEÇÃO 4: Filtros Opcionais de Aulas */}
                    <Typography variant="subtitle2" color="primary" gutterBottom>
                        🔍 Filtros Adicionais (Laboratório, Horário, Curso)
                    </Typography>
                    <Grid container spacing={2} sx={{ mb: 3 }}>
                        <Grid item xs={12} sm={6} md={4}>
                            <FormControl fullWidth size="small">
                                <InputLabel shrink>Laboratório(s)</InputLabel>
                                <Select
                                    multiple
                                    value={filtros.laboratorioFiltro}
                                    onChange={(e) => handleFiltroChange('laboratorioFiltro', e.target.value)}
                                    input={<OutlinedInput notched label="Laboratório(s)" />}
                                    renderValue={(sel) => (
                                        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                                            {sel.map(v => <Chip key={v} label={v} size="small" />)}
                                        </Box>
                                    )}
                                >
                                    {LISTA_LABORATORIOS.map(l => (
                                        <MenuItem key={l.id} value={l.name}>{l.name}</MenuItem>
                                    ))}
                                </Select>
                            </FormControl>
                        </Grid>

                        <Grid item xs={12} sm={6} md={4}>
                            <FormControl fullWidth size="small" disabled={!filtros.incluirAulas}>
                                <InputLabel shrink>Horário(s)</InputLabel>
                                <Select
                                    multiple
                                    value={filtros.horarioFiltro}
                                    onChange={(e) => handleFiltroChange('horarioFiltro', e.target.value)}
                                    input={<OutlinedInput notched label="Horário(s)" />}
                                    renderValue={(sel) => (
                                        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                                            {sel.map(v => <Chip key={v} label={v} size="small" />)}
                                        </Box>
                                    )}
                                >
                                    {BLOCOS_HORARIO.map(b => (
                                        <MenuItem key={b.value} value={b.value}>{b.label}</MenuItem>
                                    ))}
                                </Select>
                            </FormControl>
                        </Grid>

                        <Grid item xs={12} sm={6} md={4}>
                            <TextField
                                fullWidth
                                size="small"
                                label="Assunto da Aula"
                                value={filtros.assuntoFiltro}
                                onChange={(e) => handleFiltroChange('assuntoFiltro', e.target.value)}
                                disabled={!filtros.incluirAulas}
                            />
                        </Grid>

                        <Grid item xs={12} sm={6} md={4}>
                            <FormControl fullWidth size="small" disabled={!filtros.incluirAulas}>
                                <InputLabel shrink>Curso(s)</InputLabel>
                                <Select
                                    multiple
                                    value={filtros.cursosFiltro}
                                    onChange={(e) => handleFiltroChange('cursosFiltro', e.target.value)}
                                    input={<OutlinedInput notched label="Curso(s)" />}
                                    renderValue={(sel) => (
                                        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                                            {sel.map(v => <Chip key={v} label={v} size="small" />)}
                                        </Box>
                                    )}
                                >
                                    {LISTA_CURSOS.map(c => (
                                        <MenuItem key={c.value} value={c.value}>{c.label}</MenuItem>
                                    ))}
                                </Select>
                            </FormControl>
                        </Grid>

                        <Grid item xs={12} sm={6} md={4}>
                            <FormControl fullWidth size="small" disabled={!filtros.incluirAulas}>
                                <InputLabel shrink>Liga</InputLabel>
                                <Select
                                    value={filtros.ligaFiltro}
                                    onChange={(e) => handleFiltroChange('ligaFiltro', e.target.value)}
                                    input={<OutlinedInput notched label="Liga" />}
                                >
                                    <MenuItem value=""><em>Todas</em></MenuItem>
                                    {LISTA_CURSOS.map(c => (
                                        <MenuItem key={c.value} value={c.value}>{c.label}</MenuItem>
                                    ))}
                                </Select>
                            </FormControl>
                        </Grid>
                    </Grid>

                    {/* BOTOES DE AÇÃO */}
                    <Grid container spacing={2} alignItems="center">
                        <Grid item xs={12} sm={4}>
                            <Tooltip title="Gera planilha Excel com abas Cronológica, Por Lab e Eventos">
                                <span>
                                    <Button
                                        fullWidth
                                        variant="contained"
                                        color="primary"
                                        onClick={() => handleDownload('excel')}
                                        disabled={loading}
                                        startIcon={loading ? <CircularProgress size={20} color="inherit" /> : <FileDownloadIcon />}
                                    >
                                        Exportar Excel (.xlsx)
                                    </Button>
                                </span>
                            </Tooltip>
                        </Grid>

                        <Grid item xs={12} sm={4}>
                            <Tooltip title="Gera lista em formato PDF pronto para impressão">
                                <span>
                                    <Button
                                        fullWidth
                                        variant="contained"
                                        color="error"
                                        onClick={() => handleDownload('pdf')}
                                        disabled={loading}
                                        startIcon={loading ? <CircularProgress size={20} color="inherit" /> : <PictureAsPdfIcon />}
                                    >
                                        Exportar PDF (.pdf)
                                    </Button>
                                </span>
                            </Tooltip>
                        </Grid>

                        <Grid item xs={12} sm={4}>
                            <Tooltip title="Gera arquivo de calendário compatível com Google Calendar, Outlook e Apple Calendar">
                                <span>
                                    <Button
                                        fullWidth
                                        variant="contained"
                                        color="secondary"
                                        onClick={() => handleDownload('ics')}
                                        disabled={loading}
                                        startIcon={loading ? <CircularProgress size={20} color="inherit" /> : <EventIcon />}
                                    >
                                        Exportar iCal (.ics)
                                    </Button>
                                </span>
                            </Tooltip>
                        </Grid>

                        <Grid item xs={12} sx={{ display: 'flex', justifyContent: 'flex-end', mt: 1 }}>
                            <Button
                                variant="outlined"
                                onClick={handleClearFilters}
                                disabled={loading}
                                startIcon={<ClearIcon />}
                            >
                                Limpar Todos os Filtros
                            </Button>
                        </Grid>
                    </Grid>

                    <Snackbar
                        open={feedback.open}
                        autoHideDuration={6000}
                        onClose={handleCloseSnackbar}
                        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
                    >
                        {feedback.open && (
                            <Alert onClose={handleCloseSnackbar} severity={feedback.severity} sx={{ width: '100%' }}>
                                {feedback.message}
                            </Alert>
                        )}
                    </Snackbar>
                </Paper>
            </Container>
        </LocalizationProvider>
    );
}

export default DownloadCronograma;

