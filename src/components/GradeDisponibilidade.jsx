import React, { useMemo, useState } from 'react';
import {
  Table, TableBody, TableCell, TableContainer,
  TableHead, TableRow, Paper, Chip, Tooltip, Typography, Box,
  Dialog, DialogTitle, DialogContent, DialogActions, Button, Divider,
  Accordion, AccordionSummary, AccordionDetails, useMediaQuery, useTheme,
  ToggleButtonGroup, ToggleButton, FormControlLabel, Switch
} from '@mui/material';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import CalendarTodayIcon from '@mui/icons-material/CalendarToday';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import dayjs from 'dayjs';
import { LISTA_LABORATORIOS } from '../constants/laboratorios';
import { toDataLocal, toHorariosArray } from '../utils/dateHelper';

// Blocos de horário — mesma constante usada no restante do sistema
const BLOCOS = [
  { value: '07:00-09:10', label: 'Manhã 1' },
  { value: '09:30-12:00', label: 'Manhã 2' },
  { value: '13:00-15:10', label: 'Tarde 1' },
  { value: '15:30-18:00', label: 'Tarde 2' },
  { value: '18:30-20:10', label: 'Noite 1' },
  { value: '20:30-22:00', label: 'Noite 2' },
];

/**
 * GradeDisponibilidade
 * @param {Array}  aulas      - Aulas do dia/semana já carregadas
 * @param {string} dataFoco   - Data inicial foco ('YYYY-MM-DD')
 * @param {Array}  tiposLab   - Filtro opcional de tipos de laboratório
 * @param {string} perspectivaFiltro - 'todos' | 'livres' | 'ocupados'
 * @param {Function} onCelulaClick - Callback quando o usuário clica em uma célula
 * @param {Array}  horariosDestacados - Lista de horarios selecionados para destacar
 */
export default function GradeDisponibilidade({
  aulas = [],
  eventos = [],
  dataFoco = dayjs().format('YYYY-MM-DD'),
  tiposLab = [],
  perspectivaFiltro = 'todos',
  onCelulaClick,
  horariosDestacados = [],
  isCoordenador = false,
  onEditAula,
  onDeleteAula,
  onEditEvento,
  onDeleteEvento
}) {
  const [modalDetalhes, setModalDetalhes] = useState(null);
  const [dataSelecionada, setDataSelecionada] = useState(dataFoco);
  const [apenasComVaga, setApenasComVaga] = useState(false);
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));

  // Gerar os 6 dias da semana (Segunda a Sábado) baseados na data foco
  const diasDaSemana = useMemo(() => {
    const base = dayjs(dataFoco, 'YYYY-MM-DD').startOf('week').add(1, 'day'); // Segunda
    return Array.from({ length: 6 }, (_, i) => {
      const d = base.add(i, 'day');
      return {
        iso: d.format('YYYY-MM-DD'),
        label: d.format('ddd, DD/MM'),
        diaNome: d.format('dddd')
      };
    });
  }, [dataFoco]);

  // Se dataFoco mudar externamente, atualiza a seleção local
  React.useEffect(() => {
    if (dataFoco) setDataSelecionada(dataFoco);
  }, [dataFoco]);

  // Labs filtrados por tipo (se filtro aplicado)
  const labsVisiveis = useMemo(() => {
    if (!tiposLab || !tiposLab.length) return LISTA_LABORATORIOS;
    return LISTA_LABORATORIOS.filter(l => tiposLab.includes(l.tipo));
  }, [tiposLab]);

  // Mapa de ocupação e detalhes para o dia selecionado
  const mapaDetalhes = useMemo(() => {
    const mapa = {};

    const registrar = (rawLab, horarios, item, origem) => {
      if (!rawLab) return;
      const labObj = LISTA_LABORATORIOS.find(l => l.id === rawLab || l.name === rawLab);
      const alvos = rawLab === 'Todos'
        ? LISTA_LABORATORIOS
        : [labObj || { id: rawLab, name: rawLab }];

      alvos.forEach(lab => {
        horarios.forEach(h => {
          if (!h) return;
          if (!mapa[lab.id]) mapa[lab.id] = {};
          if (!mapa[lab.name]) mapa[lab.name] = {};
          if (!mapa[lab.id][h]) mapa[lab.id][h] = [];
          if (!mapa[lab.name][h]) mapa[lab.name][h] = [];
          const registro = { ...item, origem };
          mapa[lab.id][h].push(registro);
          mapa[lab.name][h].push(registro);
        });
      });
    };

    const extrairDataLocal = (val) => {
      if (!val) return dataSelecionada;
      return toDataLocal(typeof val?.toDate === 'function' ? val.toDate() : val);
    };

    aulas
      .filter(a => a.status !== 'rejeitada')
      .filter(a => {
        if (!dataSelecionada) return true;
        const dataAula = a.dataInicio ? extrairDataLocal(a.dataInicio) : dataSelecionada;
        return dataAula === dataSelecionada;
      })
      .forEach(a => registrar(a.laboratorioSelecionado || a.laboratorio, toHorariosArray(a.horarioSlotString || a.horario), a, 'aula'));

    eventos
      .filter(e => e.status !== 'cancelado')
      .filter(e => {
        if (!dataSelecionada) return true;
        const dataEvento = e.dataInicio ? extrairDataLocal(e.dataInicio) : dataSelecionada;
        return dataEvento === dataSelecionada;
      })
      .forEach(e => registrar(e.laboratorio, toHorariosArray(e.horarioSlotString || e.horario), e, 'evento'));

    return mapa;
  }, [aulas, eventos, dataSelecionada]);

  const getAulasDaCelula = (lab, horario) => {
    return mapaDetalhes[lab.id]?.[horario] || mapaDetalhes[lab.name]?.[horario] || [];
  };

  const getStatusCelula = (lab, horario) => {
    const itens = getAulasDaCelula(lab, horario);
    if (!itens || itens.length === 0) return 'livre';
    const temConfirmado = itens.some(i => i.origem === 'evento' || !i.status || i.status === 'aprovada');
    if (temConfirmado) return 'ocupado';
    const temPendente = itens.some(i => i.status === 'pendente');
    if (temPendente) return 'pendente';
    return 'livre';
  };

  const isOcupado = (lab, horario) => {
    return getStatusCelula(lab, horario) === 'ocupado';
  };

  // Filtro de labs com vaga
  const labsParaRenderizar = useMemo(() => {
    if (!apenasComVaga) return labsVisiveis;
    return labsVisiveis.filter(lab =>
      BLOCOS.some(b => getStatusCelula(lab, b.value) !== 'ocupado')
    );
  }, [labsVisiveis, apenasComVaga, mapaDetalhes]);

  const handleCellClick = (lab, bloco) => {
    const aulasEncontradas = getAulasDaCelula(lab, bloco.value);
    const st = getStatusCelula(lab, bloco.value);
    const ocupado = st === 'ocupado';

    setModalDetalhes({
      lab,
      bloco,
      ocupado,
      statusCelula: st,
      aulas: aulasEncontradas
    });

    if (onCelulaClick) {
      onCelulaClick({ labId: lab.id, labNome: lab.name, horario: bloco.value, ocupado, statusCelula: st, aulas: aulasEncontradas });
    }
  };

  return (
    <Box sx={{ mt: 1 }}>
      {/* Legenda visual de cores */}
      <Box sx={{ display: 'flex', gap: 2, mb: 1.5, flexWrap: 'wrap', alignItems: 'center' }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
          <Box sx={{ width: 14, height: 14, borderRadius: 0.5, bgcolor: 'success.light' }} />
          <Typography variant="caption" color="text.secondary">Livre</Typography>
        </Box>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
          <Box sx={{ width: 14, height: 14, borderRadius: 0.5, bgcolor: 'warning.light', border: '1px dashed #ed6c02' }} />
          <Typography variant="caption" color="text.secondary">Pendente (Aguardando)</Typography>
        </Box>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
          <Box sx={{ width: 14, height: 14, borderRadius: 0.5, bgcolor: 'error.light' }} />
          <Typography variant="caption" color="text.secondary">Ocupado (Aula/Evento)</Typography>
        </Box>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
          <Box sx={{ width: 14, height: 14, borderRadius: 0.5, border: '2px solid #1976d2' }} />
          <Typography variant="caption" color="text.secondary">Selecionado no Form</Typography>
        </Box>
      </Box>

      {/* Barra de Seleção de Dia da Semana da Grade */}
      <Paper elevation={1} sx={{ p: 1.5, mb: 2, borderRadius: 2, bgcolor: 'background.paper', border: '1px solid divider' }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, flexWrap: 'wrap', justifyContent: 'space-between' }}>
          <Box display="flex" alignItems="center" gap={1}>
            <CalendarTodayIcon color="primary" fontSize="small" />
            <Box>
              <Typography variant="subtitle2" fontWeight="bold">
                Grade de Disponibilidade — {dayjs(dataSelecionada).format('dddd, DD [de] MMMM')}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                Escolha o dia da semana para consultar vagas ou ocupação por bloco de horário
              </Typography>
            </Box>
          </Box>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, flexWrap: 'wrap' }}>
            <FormControlLabel
              control={
                <Switch
                  size="small"
                  checked={apenasComVaga}
                  onChange={e => setApenasComVaga(e.target.checked)}
                />
              }
              label={<Typography variant="caption" fontWeight={600}>Só labs com vaga</Typography>}
            />
            <ToggleButtonGroup
              value={dataSelecionada}
              exclusive
              onChange={(_, novaData) => novaData && setDataSelecionada(novaData)}
              size="small"
              color="primary"
            >
              {diasDaSemana.map(d => (
                <ToggleButton key={d.iso} value={d.iso} sx={{ px: 1.5, py: 0.5, fontSize: '0.75rem', fontWeight: 600 }}>
                  {d.label}
                </ToggleButton>
              ))}
            </ToggleButtonGroup>
          </Box>
        </Box>
      </Paper>

      {isMobile ? (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
          {labsParaRenderizar.map(lab => {
            const livresCount = BLOCOS.filter(b => !isOcupado(lab, b.value)).length;
            return (
              <Accordion key={lab.id} variant="outlined" sx={{ borderRadius: 1 }}>
                <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                  <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', pr: 1 }}>
                    <Typography variant="subtitle2" fontWeight={600}>{lab.name}</Typography>
                    <Chip
                      label={`${livresCount}/6 livres`}
                      size="small"
                      color={livresCount === 0 ? 'error' : livresCount === 6 ? 'success' : 'warning'}
                      sx={{ height: 18, fontSize: '0.65rem' }}
                    />
                  </Box>
                </AccordionSummary>
                <AccordionDetails sx={{ pt: 0 }}>
                  <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 1 }}>
                    {BLOCOS.map(b => {
                      const st = getStatusCelula(lab, b.value);
                      const ocupado = st === 'ocupado';
                      const pendente = st === 'pendente';
                      const destacado = horariosDestacados.includes(b.value);
                      const ocultarPorPerspectiva = (perspectivaFiltro === 'livres' && ocupado) || (perspectivaFiltro === 'ocupados' && !ocupado) || (apenasComVaga && ocupado);
                      if (ocultarPorPerspectiva) return null;
                      return (
                        <Paper
                          key={b.value}
                          variant="outlined"
                          onClick={() => handleCellClick(lab, b)}
                          sx={{
                            p: 1,
                            textAlign: 'center',
                            cursor: 'pointer',
                            bgcolor: ocupado ? 'rgba(239, 83, 80, 0.08)' : pendente ? 'rgba(255, 152, 0, 0.12)' : 'rgba(76, 175, 80, 0.08)',
                            borderColor: ocupado ? 'error.light' : pendente ? '#ed6c02' : 'success.light',
                            borderStyle: pendente ? 'dashed' : 'solid',
                            outline: destacado ? '2px solid #1976d2' : 'none',
                            outlineOffset: '-2px',
                            '&:hover': { bgcolor: ocupado ? 'rgba(239, 83, 80, 0.16)' : pendente ? 'rgba(255, 152, 0, 0.22)' : 'rgba(76, 175, 80, 0.16)' }
                          }}
                        >
                          <Typography variant="caption" display="block" fontWeight={600}>
                            {b.label}
                          </Typography>
                          <Typography variant="caption" color="text.secondary" display="block" sx={{ fontSize: '0.68rem', mb: 0.5 }}>
                            {b.value}
                          </Typography>
                          <Chip
                            label={ocupado ? 'Ocupado' : pendente ? 'Pendente' : 'Livre'}
                            color={ocupado ? 'error' : pendente ? 'warning' : 'success'}
                            size="small"
                            sx={{ height: 18, fontSize: '0.65rem', fontWeight: pendente ? 'bold' : 'normal' }}
                          />
                        </Paper>
                      );
                    })}
                  </Box>
                </AccordionDetails>
              </Accordion>
            );
          })}
        </Box>
      ) : (
        <TableContainer component={Paper} variant="outlined">
          <Table size="small" stickyHeader>
            <TableHead>
              <TableRow>
                <TableCell sx={{ fontWeight: 700, minWidth: 160 }}>Laboratório</TableCell>
                {BLOCOS.map(b => (
                  <TableCell key={b.value} align="center" sx={{ fontWeight: 600, fontSize: '0.75rem' }}>
                    {b.label}<br />
                    <Typography variant="caption" color="text.secondary">{b.value}</Typography>
                  </TableCell>
                ))}
              </TableRow>
            </TableHead>
            <TableBody>
              {labsParaRenderizar.map(lab => {
                const livresCount = BLOCOS.filter(b => getStatusCelula(lab, b.value) === 'livre').length;
                return (
                  <TableRow key={lab.id} hover>
                    <TableCell sx={{ fontSize: '0.8rem', fontWeight: 500 }}>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.8 }}>
                        <span>{lab.name}</span>
                        <Chip
                          label={`${livresCount}/6`}
                          size="small"
                          color={livresCount === 0 ? 'error' : livresCount === 6 ? 'success' : 'warning'}
                          sx={{ height: 16, fontSize: '0.6rem', fontWeight: 700 }}
                        />
                      </Box>
                    </TableCell>
                    {BLOCOS.map(b => {
                      const st = getStatusCelula(lab, b.value);
                      const ocupado = st === 'ocupado';
                      const pendente = st === 'pendente';
                      const destacado = horariosDestacados.includes(b.value);
                      const ocultarPorPerspectiva = (perspectivaFiltro === 'livres' && ocupado) || (perspectivaFiltro === 'ocupados' && !ocupado) || (apenasComVaga && ocupado);
                      const cor = ocupado ? 'error' : pendente ? 'warning' : 'success';
                      const labelText = ocupado ? 'Ocupado' : pendente ? 'Pendente' : 'Livre';

                      if (ocultarPorPerspectiva) {
                        return (
                          <TableCell key={b.value} align="center" sx={{ p: 0.5, opacity: 0.2 }}>
                            <Typography variant="caption" color="text.disabled">—</Typography>
                          </TableCell>
                        );
                      }

                      return (
                        <TableCell key={b.value} align="center" sx={{ p: 0.5 }}>
                          <Tooltip title={`${lab.name} - ${b.label} (${b.value}): ${labelText}`}>
                            <Chip
                              label={labelText}
                              color={cor}
                              size="small"
                              variant={ocupado ? 'outlined' : pendente ? 'outlined' : 'filled'}
                              clickable
                              onClick={() => handleCellClick(lab, b)}
                              sx={{
                                fontSize: '0.65rem',
                                minWidth: 58,
                                cursor: 'pointer',
                                fontWeight: 600,
                                border: pendente ? '1px dashed #ed6c02' : undefined,
                                outline: destacado ? '2px solid #1976d2' : 'none',
                                outlineOffset: '1px'
                              }}
                            />
                          </Tooltip>
                        </TableCell>
                      );
                    })}
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </TableContainer>
      )}

      {/* Modal de Detalhes da Célula */}
      <Dialog
        open={Boolean(modalDetalhes)}
        onClose={() => setModalDetalhes(null)}
        maxWidth="xs"
        fullWidth
      >
        <DialogTitle sx={{ fontWeight: 'bold', pb: 1 }}>
          {modalDetalhes?.lab?.name}
        </DialogTitle>
        <DialogContent dividers>
          <Typography variant="body2" color="text.secondary" gutterBottom>
            <strong>Horário:</strong> {modalDetalhes?.bloco?.label} ({modalDetalhes?.bloco?.value})
          </Typography>

          {modalDetalhes?.ocupado ? (
            <Box sx={{ mt: 2 }}>
              <Chip label="Ocupado" color="error" size="small" sx={{ mb: 1.5 }} />
              {modalDetalhes.aulas.map((item, idx) => {
                const isEvento = item.origem === 'evento' || item.tipo === 'evento';
                return (
                  <Box key={item.id || idx} sx={{ mb: idx < modalDetalhes.aulas.length - 1 ? 2 : 0 }}>
                    {idx > 0 && <Divider sx={{ my: 1 }} />}
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
                      <Chip
                        label={isEvento ? 'Evento' : 'Aula'}
                        color={isEvento ? 'warning' : 'primary'}
                        size="small"
                        sx={{ height: 20, fontSize: '0.65rem', fontWeight: 600 }}
                      />
                      <Typography variant="subtitle2" color="primary.main">
                        {item.assunto || item.titulo || 'Sem título'}
                      </Typography>
                    </Box>
                    {item.cursos && (
                      <Typography variant="body2">
                        <strong>Curso(s):</strong> {Array.isArray(item.cursos) ? item.cursos.join(', ') : item.cursos}
                      </Typography>
                    )}
                    {(item.propostoPorNome || item.detalhe) && (
                      <Typography variant="body2">
                        <strong>Solicitante/Prof.:</strong> {item.propostoPorNome || item.detalhe}
                      </Typography>
                    )}
                    {(item.tipoAtividade || item.tipo) && (
                      <Typography variant="body2">
                        <strong>Tipo:</strong> {item.tipoAtividade || item.tipo}
                      </Typography>
                    )}
                    {(item.observacoes || item.descricao) && (
                      <Typography variant="caption" color="text.secondary" display="block" sx={{ mt: 0.5 }}>
                        <strong>Obs:</strong> {item.observacoes || item.descricao}
                      </Typography>
                    )}
                    {isCoordenador && (
                      <Box sx={{ display: 'flex', gap: 1, mt: 1 }}>
                        <Button
                          size="small"
                          variant="outlined"
                          color="primary"
                          startIcon={<EditIcon />}
                          onClick={() => {
                            setModalDetalhes(null);
                            if (isEvento) {
                              onEditEvento && onEditEvento(item);
                            } else {
                              onEditAula && onEditAula(item);
                            }
                          }}
                        >
                          Editar
                        </Button>
                        <Button
                          size="small"
                          variant="contained"
                          color="error"
                          startIcon={<DeleteIcon />}
                          onClick={() => {
                            setModalDetalhes(null);
                            if (isEvento) {
                              onDeleteEvento && onDeleteEvento(item);
                            } else {
                              onDeleteAula && onDeleteAula(item);
                            }
                          }}
                        >
                          Excluir
                        </Button>
                      </Box>
                    )}
                  </Box>
                );
              })}
            </Box>
          ) : (
            <Box sx={{ mt: 2, textAlign: 'center', py: 1 }}>
              <Chip label="Livre" color="success" size="small" sx={{ mb: 1.5 }} />
              <Typography variant="body2" color="text.secondary">
                Este laboratório está disponível para agendamento neste horário.
              </Typography>
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setModalDetalhes(null)}>Fechar</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
