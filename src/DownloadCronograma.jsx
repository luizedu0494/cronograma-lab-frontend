import React, { useState } from 'react';
import { db } from './firebaseConfig';
import { collection, query, where, getDocs, Timestamp, orderBy } from 'firebase/firestore';
import {
    Button, Container, Paper, Typography, Box, CircularProgress, Alert, Snackbar,
    FormControl, InputLabel, Select, MenuItem, TextField, Grid, OutlinedInput, Chip
} from '@mui/material';
import ClearIcon from '@mui/icons-material/Clear';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDayjs } from '@mui/x-date-pickers/AdapterDayjs';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import dayjs from 'dayjs';
import 'dayjs/locale/pt-br';
import utc from 'dayjs/plugin/utc';

dayjs.extend(utc);
import FileDownloadIcon from '@mui/icons-material/FileDownload';
import { saveAs } from 'file-saver'; // Necessário para salvar o arquivo .ics
import { LISTA_LABORATORIOS } from './constants/laboratorios';
import { LISTA_CURSOS } from './constants/cursos';

const BLOCOS_HORARIO = [
    {"value": "07:00-09:10", "label": "07:00 - 09:10", "turno": "Matutino"},
    {"value": "09:30-12:00", "label": "09:30 - 12:00", "turno": "Matutino"},
    {"value": "13:00-15:10", "label": "13:00 - 15:10", "turno": "Vespertino"},
    {"value": "15:30-18:00", "label": "15:30 - 18:00", "turno": "Vespertino"},
    {"value": "18:30-20:10", "label": "18:30 - 20:10", "turno": "Noturno"},
    {"value": "20:30-22:00", "label": "20:30 - 22:00", "turno": "Noturno"},
];

// Função auxiliar para formatar a data para o formato iCalendar (YYYYMMDDTHHMMSSZ)
const formatICalDate = (date) => {
    // A data do Firestore é um objeto Timestamp, que precisa ser convertido para Date
    const d = date instanceof Timestamp ? date.toDate() : date;
    // dayjs para formatação e garantir que está em UTC (Z)
    return dayjs(d).utc().format('YYYYMMDDTHHmmss') + 'Z';
};

// Função auxiliar para gerar o conteúdo do arquivo .ics
const generateICalContent = (aulas) => {
    let content = [
        'BEGIN:VCALENDAR',
        'VERSION:2.0',
        'PRODID:-//Cronograma Lab//NONSGML v1.0//EN',
    ];

    aulas.forEach(aula => {
        const uid = aula.id;
        const start = formatICalDate(aula.dataInicio);
        const end = formatICalDate(aula.dataFim);
        const summary = `[${aula.laboratorioSelecionado}] ${aula.assunto}`;
        const description = `Tipo: ${aula.tipoAtividade}\\nCursos: ${aula.cursos.join(', ')}\\nProponente: ${aula.proponenteNome}`;
        const location = aula.laboratorioSelecionado;

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
  const [selectedDate, setSelectedDate] = useState(dayjs());
  const [loading, setLoading] = useState(false);
  const [feedback, setFeedback] = useState({ open: false, message: '', severity: 'info' });
  
  const [laboratorioFiltro, setLaboratorioFiltro] = useState([]);
  const [assuntoFiltro, setAssuntoFiltro] = useState('');
  const [horarioFiltro, setHorarioFiltro] = useState([]);
  const [cursosFiltro, setCursosFiltro] = useState([]);
  const [ligaFiltro, setLigaFiltro] = useState('');
  const [tipoFiltro, setTipoFiltro] = useState('todos'); // 'todos' | 'aula' | 'revisao'

	  const handleDownload = async (format) => {
	    setLoading(true);
	    setFeedback({ open: false, message: '', severity: 'info' });
	    
	    const ano = selectedDate.year();
	    const mes = selectedDate.month();
	    const inicioDoMes = dayjs().year(ano).month(mes).startOf('month');
	    const fimDoMes = dayjs().year(ano).month(mes).endOf('month');
	
	    try {
	        let q = query(
	            collection(db, 'aulas'),
	            where('status', '==', 'aprovada'),
	            where('dataInicio', '>=', Timestamp.fromDate(inicioDoMes.toDate())),
	            where('dataInicio', '<=', Timestamp.fromDate(fimDoMes.toDate()))
	        );
	        if (laboratorioFiltro.length > 0) q = query(q, where('laboratorioSelecionado', 'in', laboratorioFiltro));
	        if (horarioFiltro.length > 0) q = query(q, where('horarioSlotString', 'in', horarioFiltro));
	        if (assuntoFiltro) q = query(q, where('assunto', '>=', assuntoFiltro), where('assunto', '<=', assuntoFiltro + '\uf8ff'));
	        if (cursosFiltro.length > 0) q = query(q, where('cursos', 'array-contains-any', cursosFiltro));
	        if (ligaFiltro) q = query(q, where('liga', '==', ligaFiltro));
	        q = query(q, orderBy('dataInicio', 'asc'));
	
	        const querySnapshot = await getDocs(q);
	        let aulasDoMes = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

	        // Filtro de tipo no frontend
	        if (tipoFiltro === 'aula') aulasDoMes = aulasDoMes.filter(a => !a.isRevisao);
	        if (tipoFiltro === 'revisao') aulasDoMes = aulasDoMes.filter(a => a.isRevisao === true);

	        // Ordenar por laboratório (alfabético) e depois por data crescente
	        aulasDoMes.sort((a, b) => {
	            const labA = (a.laboratorioSelecionado || '').toLowerCase();
	            const labB = (b.laboratorioSelecionado || '').toLowerCase();
	            if (labA !== labB) return labA.localeCompare(labB, 'pt-BR');
	            const dataA = a.dataInicio?.toDate ? a.dataInicio.toDate() : new Date(a.dataInicio);
	            const dataB = b.dataInicio?.toDate ? b.dataInicio.toDate() : new Date(b.dataInicio);
	            return dataA - dataB;
	        });
	
	        if (aulasDoMes.length === 0) {
	            setFeedback({ open: true, message: 'Nenhuma aula encontrada para os filtros selecionados.', severity: 'warning' });
	            setLoading(false); 
	            return;
	        }
	
	        if (format === 'excel') {
	            // Importação dinâmica da função de geração de Excel
	            const { gerarRelatorioExcel } = await import('./utils/downloadHelper');
	            const nomeArquivo = `Relatorio_Aulas_${selectedDate.locale('pt-br').format('MMMM_YYYY')}.xlsx`;
	            
	            await gerarRelatorioExcel(aulasDoMes, nomeArquivo);
	            setFeedback({ open: true, message: 'Relatório em Excel gerado com sucesso!', severity: 'success' });
	        } else if (format === 'ics') {
	            const icalContent = generateICalContent(aulasDoMes);
	            const blob = new Blob([icalContent], { type: 'text/calendar;charset=utf-8' });
	            saveAs(blob, `Cronograma_Lab_${selectedDate.locale('pt-br').format('MMMM_YYYY')}.ics`);
	            setFeedback({ open: true, message: 'Arquivo de calendário (.ics) gerado com sucesso!', severity: 'success' });
	        }
	
	    } catch (err) {
	        console.error("ERRO CRÍTICO em handleDownload:", err);
	        setFeedback({ open: true, message: `Erro ao gerar relatório: ${err.message}`, severity: 'error' });
	    } finally {
	        setLoading(false);
	    }
	  };

  const handleClearFilters = () => {
    setSelectedDate(dayjs());
    setLaboratorioFiltro([]);
    setHorarioFiltro([]);
    setAssuntoFiltro('');
    setCursosFiltro([]);
    setLigaFiltro('');
    setTipoFiltro('todos');
  };

  const handleCloseSnackbar = (event, reason) => {
    if (reason === 'clickaway') return;
    setFeedback(prev => ({ ...prev, open: false }));
  };

  return (
    <LocalizationProvider dateAdapter={AdapterDayjs} adapterLocale="pt-br">
      <Container maxWidth="md" sx={{ mt: 4, mb: 4 }}>
        <Paper elevation={3} sx={{ p: { xs: 2, md: 4 } }}>
          <Typography variant="h5" component="h2" gutterBottom align="center">Download de Relatórios</Typography>
          <Typography variant="body1" align="center" sx={{ mb: 3 }}>Selecione o mês e aplique filtros para gerar um relatório em Excel.</Typography>
          <Grid container spacing={2} alignItems="flex-start" sx={{ mb: 3 }}>
            <Grid item xs={12} sm={6} md={4}>
              <DatePicker
                label="Selecione Mês e Ano"
                views={['month', 'year']}
                value={selectedDate}
                onChange={(newValue) => setSelectedDate(newValue)}
                slotProps={{ textField: { fullWidth: true, helperText: 'Ex: Junho 2025' } }}
              />
            </Grid>
            <Grid item xs={12} sm={6} md={4}>
              <FormControl sx={{ minWidth: 160 }}>
                <InputLabel shrink>Laboratório(s)</InputLabel>
                <Select multiple value={laboratorioFiltro} onChange={(e) => setLaboratorioFiltro(e.target.value)} input={<OutlinedInput notched label="Laboratório(s)" />} renderValue={(selected) => (<Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>{selected.map((value) => (<Chip key={value} label={value} size="small" />))}</Box>)}>
                  {LISTA_LABORATORIOS.map(l => <MenuItem key={l.id} value={l.name}>{l.name}</MenuItem>)}
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} sm={6} md={4}>
              <FormControl sx={{ minWidth: 150 }}>
                <InputLabel shrink>Horário(s)</InputLabel>
                <Select multiple value={horarioFiltro} onChange={(e) => setHorarioFiltro(e.target.value)} input={<OutlinedInput notched label="Horário(s)" />} renderValue={(selected) => (<Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>{selected.map((value) => (<Chip key={value} label={value} size="small" />))}</Box>)}>
                  {BLOCOS_HORARIO.map(bloco => (<MenuItem key={bloco.value} value={bloco.value}>{bloco.label}</MenuItem>))}
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} sm={6} md={4}>
              <TextField fullWidth label="Assunto da Aula" value={assuntoFiltro} onChange={(e) => setAssuntoFiltro(e.target.value)} />
            </Grid>
            <Grid item xs={12} sm={6} md={4}>
              <FormControl sx={{ minWidth: 140 }}>
                <InputLabel shrink>Curso(s)</InputLabel>
                <Select multiple value={cursosFiltro} onChange={(e) => setCursosFiltro(e.target.value)} input={<OutlinedInput notched label="Curso(s)" />} renderValue={(selected) => (<Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>{selected.map((value) => (<Chip key={value} label={value} size="small" />))}</Box>)}>
                  {LISTA_CURSOS.map(c => <MenuItem key={c.value} value={c.value}>{c.label}</MenuItem>)}
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} sm={6} md={4}>
              <FormControl sx={{ minWidth: 130 }}>
                <InputLabel shrink>Liga</InputLabel>
                <Select value={ligaFiltro} label="Liga" onChange={(e) => setLigaFiltro(e.target.value)} input={<OutlinedInput notched label="Liga" />}>
                  <MenuItem value=""><em>Todas</em></MenuItem>
                  {LISTA_CURSOS.map(c => <MenuItem key={c.value} value={c.value}>{c.label}</MenuItem>)}
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} sm={6} md={4}>
              <FormControl sx={{ minWidth: 160 }}>
                <InputLabel shrink>Tipo de Conteúdo</InputLabel>
                <Select value={tipoFiltro} onChange={(e) => setTipoFiltro(e.target.value)} input={<OutlinedInput notched label="Tipo de Conteúdo" />}>
                  <MenuItem value="todos">📅 Todos</MenuItem>
                  <MenuItem value="aula">🎓 Somente Aulas</MenuItem>
                  <MenuItem value="revisao">📖 Somente Revisões</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} sx={{ display: 'flex', gap: 2, mt: 1 }}>
              <Button variant="contained" color="primary" onClick={() => handleDownload('excel')} disabled={loading || !selectedDate} startIcon={loading ? <CircularProgress size={24} color="inherit" /> : <FileDownloadIcon />} sx={{ flexGrow: 1 }}>{loading ? "Gerando Relatório..." : "Baixar Relatório Excel"}</Button>
              <Button variant="contained" color="secondary" onClick={() => handleDownload('ics')} disabled={loading || !selectedDate} startIcon={loading ? <CircularProgress size={24} color="inherit" /> : <FileDownloadIcon />} sx={{ flexGrow: 1 }}>{loading ? "Gerando Calendário..." : "Baixar Calendário (.ics)"}</Button>
              <Button variant="outlined" onClick={handleClearFilters} disabled={loading} startIcon={<ClearIcon />}>Limpar</Button>
            </Grid>
          </Grid>
          <Snackbar open={feedback.open} autoHideDuration={6000} onClose={handleCloseSnackbar} anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}>{feedback.open && (<Alert onClose={handleCloseSnackbar} severity={feedback.severity} sx={{ width: '100%' }}>{feedback.message}</Alert>)}</Snackbar>
        </Paper>
      </Container>
    </LocalizationProvider>
  );
}

export default DownloadCronograma;
