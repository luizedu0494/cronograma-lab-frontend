import React, { useState, useMemo } from 'react';
import {
  Container, Paper, Typography, Box, Grid, Button, Checkbox, FormControlLabel,
  FormGroup, Divider, Card, CardContent, Chip, CircularProgress, Alert, Snackbar,
  IconButton, Tooltip, Collapse, Badge
} from '@mui/material';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import { LocalizationProvider } from '@mui/x-date-pickers';
import { AdapterDayjs } from '@mui/x-date-pickers/AdapterDayjs';
import dayjs from 'dayjs';
import 'dayjs/locale/pt-br';
import SearchIcon from '@mui/icons-material/Search';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import DownloadIcon from '@mui/icons-material/Download';
import EventIcon from '@mui/icons-material/Event';
import ClearIcon from '@mui/icons-material/Clear';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import WarningIcon from '@mui/icons-material/Warning';
import CancelIcon from '@mui/icons-material/Cancel';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';

import { useDisponibilidade } from './hooks/useDisponibilidade';
import { LISTA_LABORATORIOS, TIPOS_LABORATORIO } from './constants/laboratorios';

dayjs.locale('pt-br');

const DIAS_SEMANA_OPCOES = [
  { value: 1, label: 'Seg' },
  { value: 2, label: 'Ter' },
  { value: 3, label: 'Qua' },
  { value: 4, label: 'Qui' },
  { value: 5, label: 'Sex' },
  { value: 6, label: 'Sáb' },
];

const BLOCOS_HORARIO = [
  { value: '07:00-09:10', label: '07:00 - 09:10', turno: 'Manhã' },
  { value: '09:30-12:00', label: '09:30 - 12:00', turno: 'Manhã' },
  { value: '13:00-15:10', label: '13:00 - 15:10', turno: 'Tarde' },
  { value: '15:30-18:00', label: '15:30 - 18:00', turno: 'Tarde' },
  { value: '18:30-20:10', label: '18:30 - 20:10', turno: 'Noite' },
  { value: '20:30-22:00', label: '20:30 - 22:00', turno: 'Noite' },
];

export default function ConsultaDisponibilidade() {
  const { consultarDisponibilidade, resultados, loading, error } = useDisponibilidade();

  // Estados dos Filtros
  const [dataInicio, setDataInicio] = useState(dayjs().add(1, 'day'));
  const [dataFim, setDataFim] = useState(dayjs().add(3, 'month'));
  const [diasSemana, setDiasSemana] = useState([2, 4]); // Terça e Quinta por padrão
  const [horarios, setHorarios] = useState(['13:00-15:10', '15:30-18:00']);
  const [laboratorios, setLaboratorios] = useState(LISTA_LABORATORIOS.slice(0, 3).map(l => l.name));
  const [apenasLivres, setApenasLivres] = useState(false);
  const [consultaRealizada, setConsultaRealizada] = useState(false);
  const [expandedCards, setExpandedCards] = useState({});

  const [feedback, setFeedback] = useState({ open: false, message: '', severity: 'info' });

  // Toggle handlers
  const handleToggleDiaSemana = (val) => {
    setDiasSemana(prev => prev.includes(val) ? prev.filter(v => v !== val) : [...prev, val]);
  };

  const handleToggleHorario = (val) => {
    setHorarios(prev => prev.includes(val) ? prev.filter(v => v !== val) : [...prev, val]);
  };

  const handleToggleLab = (name) => {
    setLaboratorios(prev => prev.includes(name) ? prev.filter(n => n !== name) : [...prev, name]);
  };

  const handleSelectAreaLabs = (tipo) => {
    const labsArea = LISTA_LABORATORIOS.filter(l => l.tipo === tipo).map(l => l.name);
    const todosJaSelecionados = labsArea.every(l => laboratorios.includes(l));

    if (todosJaSelecionados) {
      setLaboratorios(prev => prev.filter(l => !labsArea.includes(l)));
    } else {
      setLaboratorios(prev => Array.from(new Set([...prev, ...labsArea])));
    }
  };

  const handleLimpar = () => {
    setDataInicio(dayjs().add(1, 'day'));
    setDataFim(dayjs().add(3, 'month'));
    setDiasSemana([2, 4]);
    setHorarios(['13:00-15:10', '15:30-18:00']);
    setLaboratorios(LISTA_LABORATORIOS.slice(0, 3).map(l => l.name));
    setApenasLivres(false);
    setConsultaRealizada(false);
  };

  const handleExecutarConsulta = async () => {
    if (diasSemana.length === 0) {
      setFeedback({ open: true, message: 'Selecione pelo menos um dia da semana.', severity: 'warning' });
      return;
    }
    if (horarios.length === 0) {
      setFeedback({ open: true, message: 'Selecione pelo menos um bloco de horário.', severity: 'warning' });
      return;
    }
    if (laboratorios.length === 0) {
      setFeedback({ open: true, message: 'Selecione pelo menos um laboratório.', severity: 'warning' });
      return;
    }

    await consultarDisponibilidade({
      dataInicio,
      dataFim,
      diasSemana,
      horarios,
      laboratorios,
      apenasLivres,
    });
    setConsultaRealizada(true);
  };

  // Agrupamento por Mês
  const resultadosAgrupadosPorMes = useMemo(() => {
    const grupos = {};
    resultados.forEach(res => {
      const mesChave = dayjs(res.data).format('MMMM [de] YYYY').toUpperCase();
      if (!grupos[mesChave]) grupos[mesChave] = [];
      grupos[mesChave].push(res);
    });
    return grupos;
  }, [resultados]);

  const estatisticas = useMemo(() => {
    const livres = resultados.filter(r => r.status === 'livre').length;
    const parciais = resultados.filter(r => r.status === 'parcial').length;
    const ocupadas = resultados.filter(r => r.status === 'ocupado').length;
    return { livres, parciais, ocupadas, total: resultados.length };
  }, [resultados]);

  // Exportações
  const handleCopiarLista = () => {
    if (resultados.length === 0) return;
    const linhas = [
      `Resumo de Disponibilidade de Laboratórios (${dataInicio.format('DD/MM/YYYY')} a ${dataFim.format('DD/MM/YYYY')})`,
      `Laboratórios: ${laboratorios.join(', ')}`,
      `Horários: ${horarios.join(', ')}`,
      '------------------------------------------------',
    ];

    resultados.forEach(res => {
      const statusIcon = res.status === 'livre' ? '[LIVRE]' : res.status === 'parcial' ? '[PARCIAL]' : '[OCUPADO]';
      linhas.push(`${statusIcon} ${res.dataFormatted} (${res.diaSemanaNome})`);
      if (res.conflitos.length > 0) {
        res.conflitos.forEach(c => {
          linhas.push(`   -> ${c.laboratorio} - ${c.horario}: ${c.titulo} (${c.detalhe || ''})`);
        });
      }
    });

    navigator.clipboard.writeText(linhas.join('\n'));
    setFeedback({ open: true, message: 'Lista copiada para a área de transferência!', severity: 'success' });
  };

  const handleExportarCSV = () => {
    if (resultados.length === 0) return;
    const csvRows = [
      ['Data', 'Dia da Semana', 'Horário', 'Laboratório', 'Status', 'Conflito/Ocupante'],
    ];

    resultados.forEach(res => {
      res.slotsStatus.forEach(slot => {
        const conflitoStr = slot.conflitos.map(c => `${c.titulo} (${c.detalhe || ''})`).join(' | ');
        csvRows.push([
          res.dataFormatted,
          res.diaSemanaNome,
          slot.horario,
          slot.laboratorio,
          slot.livre ? 'LIVRE' : 'OCUPADO',
          conflitoStr || 'Nenhum',
        ]);
      });
    });

    const csvContent = 'data:text/csv;charset=utf-8,\uFEFF' + csvRows.map(e => e.map(val => `"${val}"`).join(',')).join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `disponibilidade_laboratorios_${dayjs().format('YYYYMMDD')}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    setFeedback({ open: true, message: 'Arquivo CSV gerado e baixado!', severity: 'success' });
  };

  const handleExportarICS = () => {
    if (resultados.length === 0) return;
    const icsLines = [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'PRODID:-//CronoLab//Consulta de Disponibilidade//PT',
      'CALSCALE:GREGORIAN',
    ];

    resultados.forEach(res => {
      if (res.status === 'livre' || res.status === 'parcial') {
        res.slotsStatus.filter(s => s.livre).forEach(slot => {
          const [hInicio, hFim] = slot.horario.split('-');
          const dtStart = dayjs(res.data)
            .hour(parseInt(hInicio.split(':')[0]))
            .minute(parseInt(hInicio.split(':')[1]))
            .format('YYYYMMDDTHHmm00');
          const dtEnd = dayjs(res.data)
            .hour(parseInt(hFim.split(':')[0]))
            .minute(parseInt(hFim.split(':')[1]))
            .format('YYYYMMDDTHHmm00');

          icsLines.push(
            'BEGIN:VEVENT',
            `SUMMARY:Janela Livre: ${slot.laboratorio}`,
            `DESCRIPTION:Horário livre para agendamento em ${slot.laboratorio}`,
            `DTSTART:${dtStart}`,
            `DTEND:${dtEnd}`,
            `LOCATION:${slot.laboratorio}`,
            'END:VEVENT'
          );
        });
      }
    });

    icsLines.push('END:VCALENDAR');

    const blob = new Blob([icsLines.join('\r\n')], { type: 'text/calendar;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `janelas_livres_${dayjs().format('YYYYMMDD')}.ics`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    setFeedback({ open: true, message: 'Arquivo .ics gerado com sucesso!', severity: 'success' });
  };

  const toggleExpandCard = (key) => {
    setExpandedCards(prev => ({ ...prev, [key]: !prev[key] }));
  };

  return (
    <LocalizationProvider dateAdapter={AdapterDayjs} adapterLocale="pt-br">
      <Container maxWidth="xl" sx={{ mt: 4, mb: 4 }}>
        <Paper elevation={3} sx={{ p: 3, mb: 4, borderRadius: 2 }}>
          <Typography variant="h5" fontWeight="bold" color="primary" mb={1} display="flex" alignItems="center" gap={1}>
            <SearchIcon color="primary" /> Consulta de Disponibilidade por Período
          </Typography>
          <Typography variant="body2" color="text.secondary" mb={3}>
            Localize datas e horários disponíveis em múltiplos laboratórios para agendamentos recorrentes ou eventos especiais.
          </Typography>

          {/* PASSO 1: Configurar a Consulta */}
          <Paper variant="outlined" sx={{ p: 3, backgroundColor: 'background.default', borderRadius: 2 }}>
            <Grid container spacing={3}>
              {/* Período */}
              <Grid item xs={12} md={4}>
                <Typography variant="subtitle2" fontWeight="bold" mb={1}>
                  1. Período da Consulta
                </Typography>
                <Box display="flex" gap={2}>
                  <DatePicker
                    label="Data Início"
                    value={dataInicio}
                    onChange={(d) => setDataInicio(d)}
                    slotProps={{ textField: { size: 'small', fullWidth: true } }}
                  />
                  <DatePicker
                    label="Data Fim"
                    value={dataFim}
                    onChange={(d) => setDataFim(d)}
                    slotProps={{ textField: { size: 'small', fullWidth: true } }}
                  />
                </Box>
              </Grid>

              {/* Dias da Semana */}
              <Grid item xs={12} md={4}>
                <Typography variant="subtitle2" fontWeight="bold" mb={1}>
                  2. Dias da Semana
                </Typography>
                <FormGroup row>
                  {DIAS_SEMANA_OPCOES.map((d) => (
                    <FormControlLabel
                      key={d.value}
                      control={
                        <Checkbox
                          size="small"
                          checked={diasSemana.includes(d.value)}
                          onChange={() => handleToggleDiaSemana(d.value)}
                        />
                      }
                      label={d.label}
                    />
                  ))}
                </FormGroup>
              </Grid>

              {/* Opção Adicional */}
              <Grid item xs={12} md={4}>
                <Typography variant="subtitle2" fontWeight="bold" mb={1}>
                  Filtro de Exibição
                </Typography>
                <FormControlLabel
                  control={
                    <Checkbox
                      checked={apenasLivres}
                      onChange={(e) => setApenasLivres(e.target.checked)}
                      color="success"
                    />
                  }
                  label="Mostrar apenas datas onde TODOS os labs e horários estão livres"
                />
              </Grid>

              <Grid item xs={12}><Divider /></Grid>

              {/* Blocos de Horário */}
              <Grid item xs={12} md={6}>
                <Typography variant="subtitle2" fontWeight="bold" mb={1}>
                  3. Blocos de Horário Desejados
                </Typography>
                <Grid container spacing={1}>
                  {BLOCOS_HORARIO.map((b) => (
                    <Grid item xs={6} sm={4} key={b.value}>
                      <Chip
                        label={`${b.label} (${b.turno})`}
                        onClick={() => handleToggleHorario(b.value)}
                        color={horarios.includes(b.value) ? 'primary' : 'default'}
                        variant={horarios.includes(b.value) ? 'filled' : 'outlined'}
                        sx={{ width: '100%' }}
                      />
                    </Grid>
                  ))}
                </Grid>
              </Grid>

              {/* Seleção de Laboratórios */}
              <Grid item xs={12} md={6}>
                <Box display="flex" justifyContent="space-between" alignItems="center" mb={1}>
                  <Typography variant="subtitle2" fontWeight="bold">
                    4. LaboratóriosAlvo ({laboratorios.length} selecionados)
                  </Typography>
                  <Box display="flex" gap={0.5}>
                    {TIPOS_LABORATORIO.map(tipo => (
                      <Button
                        key={tipo}
                        size="small"
                        variant="text"
                        onClick={() => handleSelectAreaLabs(tipo)}
                        sx={{ fontSize: '0.7rem', p: 0.5 }}
                      >
                        {tipo}
                      </Button>
                    ))}
                  </Box>
                </Box>
                <Box display="flex" flexWrap="wrap" gap={0.8} maxHeight={140} sx={{ overflowY: 'auto', p: 1, border: '1px solid #e0e0e0', borderRadius: 1, backgroundColor: '#fff' }}>
                  {LISTA_LABORATORIOS.map((lab) => (
                    <Chip
                      key={lab.id || lab.name}
                      label={lab.name}
                      size="small"
                      onClick={() => handleToggleLab(lab.name)}
                      color={laboratorios.includes(lab.name) ? 'secondary' : 'default'}
                      variant={laboratorios.includes(lab.name) ? 'filled' : 'outlined'}
                    />
                  ))}
                </Box>
              </Grid>

              {/* Botões de Ação */}
              <Grid item xs={12} display="flex" justifyContent="flex-end" gap={2} mt={1}>
                <Button variant="outlined" startIcon={<ClearIcon />} onClick={handleLimpar}>
                  Limpar Filtros
                </Button>
                <Button
                  variant="contained"
                  color="primary"
                  size="large"
                  startIcon={loading ? <CircularProgress size={20} color="inherit" /> : <SearchIcon />}
                  onClick={handleExecutarConsulta}
                  disabled={loading}
                >
                  Consultar Disponibilidade
                </Button>
              </Grid>
            </Grid>
          </Paper>
        </Paper>

        {error && <Alert severity="error" sx={{ mb: 3 }}>{error}</Alert>}

        {/* PASSO 2: Resultado */}
        {consultaRealizada && (
          <Paper elevation={3} sx={{ p: 3, borderRadius: 2 }}>
            <Box display="flex" flexWrap="wrap" justifyContent="space-between" alignItems="center" mb={3} gap={2}>
              <Box>
                <Typography variant="h6" fontWeight="bold">
                  Resultado da Consulta
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Período: {dataInicio.format('DD/MM/YYYY')} a {dataFim.format('DD/MM/YYYY')} | {laboratorios.length} laboratório(s) analisado(s)
                </Typography>
              </Box>

              {/* Painel de Exportação */}
              <Box display="flex" gap={1}>
                <Tooltip title="Copiar lista de disponibilidade para o clipboard">
                  <Button variant="outlined" size="small" startIcon={<ContentCopyIcon />} onClick={handleCopiarLista}>
                    Copiar Lista
                  </Button>
                </Tooltip>
                <Tooltip title="Baixar planilha tabulada CSV">
                  <Button variant="outlined" color="success" size="small" startIcon={<DownloadIcon />} onClick={handleExportarCSV}>
                    Exportar CSV
                  </Button>
                </Tooltip>
                <Tooltip title="Baixar arquivo iCalendar (.ics) para Google Calendar/Outlook">
                  <Button variant="outlined" color="secondary" size="small" startIcon={<EventIcon />} onClick={handleExportarICS}>
                    Exportar .ics
                  </Button>
                </Tooltip>
              </Box>
            </Box>

            {/* Banner de Estatísticas */}
            <Grid container spacing={2} mb={4}>
              <Grid item xs={12} sm={4}>
                <Card sx={{ borderLeft: '5px solid #2e7d32', backgroundColor: '#f1f8e9' }}>
                  <CardContent sx={{ py: 1.5, '&:last-child': { pb: 1.5 } }}>
                    <Typography variant="subtitle2" color="success.dark" fontWeight="bold">
                      ✅ Datas Totalmente Livres
                    </Typography>
                    <Typography variant="h4" fontWeight="bold" color="success.dark">
                      {estatisticas.livres}
                    </Typography>
                  </CardContent>
                </Card>
              </Grid>
              <Grid item xs={12} sm={4}>
                <Card sx={{ borderLeft: '5px solid #ed6c02', backgroundColor: '#fff8e1' }}>
                  <CardContent sx={{ py: 1.5, '&:last-child': { pb: 1.5 } }}>
                    <Typography variant="subtitle2" color="warning.dark" fontWeight="bold">
                      ⚠️ Datas com Conflito Parcial
                    </Typography>
                    <Typography variant="h4" fontWeight="bold" color="warning.dark">
                      {estatisticas.parciais}
                    </Typography>
                  </CardContent>
                </Card>
              </Grid>
              <Grid item xs={12} sm={4}>
                <Card sx={{ borderLeft: '5px solid #d32f2f', backgroundColor: '#ffebee' }}>
                  <CardContent sx={{ py: 1.5, '&:last-child': { pb: 1.5 } }}>
                    <Typography variant="subtitle2" color="error.dark" fontWeight="bold">
                      ❌ Datas Totalmente Ocupadas
                    </Typography>
                    <Typography variant="h4" fontWeight="bold" color="error.dark">
                      {estatisticas.ocupadas}
                    </Typography>
                  </CardContent>
                </Card>
              </Grid>
            </Grid>

            {/* Listagem Agrupada por Mês */}
            {Object.keys(resultadosAgrupadosPorMes).length === 0 ? (
              <Alert severity="info">Nenhuma data encontrada para os critérios selecionados.</Alert>
            ) : (
              Object.entries(resultadosAgrupadosPorMes).map(([mesAno, listaDatas]) => (
                <Box key={mesAno} mb={4}>
                  <Typography variant="subtitle1" fontWeight="bold" sx={{ backgroundColor: 'primary.main', color: '#fff', px: 2, py: 1, borderRadius: 1, mb: 2 }}>
                    {mesAno} ({listaDatas.length} datas)
                  </Typography>

                  <Grid container spacing={2}>
                    {listaDatas.map((res) => {
                      const isExpanded = !!expandedCards[res.dataIso];
                      return (
                        <Grid item xs={12} key={res.dataIso}>
                          <Paper variant="outlined" sx={{ p: 2, borderColor: res.status === 'livre' ? 'success.main' : res.status === 'parcial' ? 'warning.main' : 'error.main' }}>
                            <Box display="flex" justifyContent="space-between" alignItems="center" flexWrap="wrap">
                              <Box display="flex" alignItems="center" gap={1.5}>
                                {res.status === 'livre' && <CheckCircleIcon color="success" />}
                                {res.status === 'parcial' && <WarningIcon color="warning" />}
                                {res.status === 'ocupado' && <CancelIcon color="error" />}

                                <Typography variant="h6" fontWeight="bold">
                                  {res.diaSemanaNome}, {res.dataFormatted}
                                </Typography>

                                <Chip
                                  label={res.status === 'livre' ? 'LIVRE' : res.status === 'parcial' ? 'PARCIAL' : 'OCUPADO'}
                                  color={res.status === 'livre' ? 'success' : res.status === 'parcial' ? 'warning' : 'error'}
                                  size="small"
                                />
                              </Box>

                              <Box display="flex" alignItems="center" gap={1}>
                                <Typography variant="body2" color="text.secondary">
                                  {res.slotsStatus.filter(s => s.livre).length} de {res.slotsStatus.length} slots livres
                                </Typography>
                                <IconButton size="small" onClick={() => toggleExpandCard(res.dataIso)}>
                                  {isExpanded ? <ExpandLessIcon /> : <ExpandMoreIcon />}
                                </IconButton>
                              </Box>
                            </Box>

                            {/* Resumo de slots */}
                            <Box display="flex" flexWrap="wrap" gap={1} mt={1.5}>
                              {res.slotsStatus.map((slot, idx) => (
                                <Chip
                                  key={idx}
                                  label={`${slot.laboratorio} (${slot.horario})`}
                                  size="small"
                                  color={slot.livre ? 'success' : 'error'}
                                  variant={slot.livre ? 'outlined' : 'filled'}
                                />
                              ))}
                            </Box>

                            {/* Detalhes expandidos */}
                            <Collapse in={isExpanded} timeout="auto" unmountOnExit>
                              <Divider sx={{ my: 1.5 }} />
                              <Typography variant="subtitle2" fontWeight="bold" mb={1}>
                                Detalhes de Ocupação / Conflitos:
                              </Typography>
                              {res.conflitos.length === 0 ? (
                                <Typography variant="body2" color="text.secondary">
                                  Nenhum conflito registrado. Todos os laboratórios selecionados estão totalmente livres neste dia.
                                </Typography>
                              ) : (
                                <Box component="ul" sx={{ pl: 2, m: 0 }}>
                                  {res.conflitos.map((c, i) => (
                                    <Typography key={i} component="li" variant="body2" color="error.main">
                                      <strong>{c.laboratorio}</strong> ({c.horario}): {c.titulo} {c.detalhe ? `— ${c.detalhe}` : ''}
                                    </Typography>
                                  ))}
                                </Box>
                              )}
                            </Collapse>
                          </Paper>
                        </Grid>
                      );
                    })}
                  </Grid>
                </Box>
              ))
            )}
          </Paper>
        )}

        <Snackbar
          open={feedback.open}
          autoHideDuration={4000}
          onClose={() => setFeedback(prev => ({ ...prev, open: false }))}
        >
          <Alert severity={feedback.severity} onClose={() => setFeedback(prev => ({ ...prev, open: false }))}>
            {feedback.message}
          </Alert>
        </Snackbar>
      </Container>
    </LocalizationProvider>
  );
}
