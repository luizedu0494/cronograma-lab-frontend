import React, { useMemo, useState } from 'react';
import {
  Table, TableBody, TableCell, TableContainer,
  TableHead, TableRow, Paper, Chip, Tooltip, Typography, Box,
  Dialog, DialogTitle, DialogContent, DialogActions, Button, Divider,
  Accordion, AccordionSummary, AccordionDetails, useMediaQuery, useTheme
} from '@mui/material';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
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
 * @param {Array}  aulas      - Aulas do dia/semana já carregadas (mesmo array do calendário)
 * @param {string} dataFoco   - Data no formato 'YYYY-MM-DD' para filtrar as aulas
 * @param {Array}  tiposLab   - Filtro opcional de tipos de laboratório (ex: ['anatomia'])
 * @param {Function} onCelulaClick - Callback opcional quando o usuário clica em uma célula
 */
export default function GradeDisponibilidade({ aulas = [], dataFoco, tiposLab = [], onCelulaClick }) {
  const [modalDetalhes, setModalDetalhes] = useState(null); // { lab, bloco, ocupado, aulas: [...] }
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));

  // Labs filtrados por tipo (se filtro aplicado)
  const labsVisiveis = useMemo(() => {
    if (!tiposLab || !tiposLab.length) return LISTA_LABORATORIOS;
    return LISTA_LABORATORIOS.filter(l => tiposLab.includes(l.tipo));
  }, [tiposLab]);

  // Mapa de ocupação e detalhes: laboratorio -> horario -> Array de aulas
  const mapaDetalhes = useMemo(() => {
    const mapa = {};
    aulas
      .filter(a => {
        if (!dataFoco) return true;
        const dataAula = toDataLocal(a.dataInicio);
        return dataAula === dataFoco;
      })
      .forEach(a => {
        const rawLab = a.laboratorioSelecionado || a.laboratorio;
        if (!rawLab) return;
        const labObj = LISTA_LABORATORIOS.find(l => l.id === rawLab || l.name === rawLab);
        const labId = labObj ? labObj.id : rawLab;
        const labName = labObj ? labObj.name : rawLab;

        if (!mapa[labId]) mapa[labId] = {};
        if (!mapa[labName]) mapa[labName] = {};

        const horarios = toHorariosArray(a.horarioSlotString);
        horarios.forEach(h => {
          if (h) {
            if (!mapa[labId][h]) mapa[labId][h] = [];
            if (!mapa[labName][h]) mapa[labName][h] = [];
            mapa[labId][h].push(a);
            mapa[labName][h].push(a);
          }
        });
      });
    return mapa;
  }, [aulas, dataFoco]);

  const getAulasDaCelula = (lab, horario) => {
    return mapaDetalhes[lab.id]?.[horario] || mapaDetalhes[lab.name]?.[horario] || [];
  };

  const isOcupado = (lab, horario) => {
    return getAulasDaCelula(lab, horario).length > 0;
  };

  const handleCellClick = (lab, bloco) => {
    const aulasEncontradas = getAulasDaCelula(lab, bloco.value);
    const ocupado = aulasEncontradas.length > 0;

    setModalDetalhes({
      lab,
      bloco,
      ocupado,
      aulas: aulasEncontradas
    });

    if (onCelulaClick) {
      onCelulaClick({ labId: lab.id, labNome: lab.name, horario: bloco.value, ocupado, aulas: aulasEncontradas });
    }
  };

  return (
    <Box>
      <Typography variant="caption" color="text.secondary" sx={{ mb: 1, display: 'block' }}>
        Clique em qualquer {isMobile ? 'bloco' : 'célula'} para visualizar os detalhes de ocupação ou disponibilidade.
      </Typography>

      {isMobile ? (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
          {labsVisiveis.map(lab => (
            <Accordion key={lab.id} variant="outlined" sx={{ borderRadius: 1 }}>
              <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                <Typography variant="subtitle2" fontWeight={600}>{lab.name}</Typography>
              </AccordionSummary>
              <AccordionDetails sx={{ pt: 0 }}>
                <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 1 }}>
                  {BLOCOS.map(b => {
                    const ocupado = isOcupado(lab, b.value);
                    return (
                      <Paper
                        key={b.value}
                        variant="outlined"
                        onClick={() => handleCellClick(lab, b)}
                        sx={{
                          p: 1,
                          textAlign: 'center',
                          cursor: 'pointer',
                          bgcolor: ocupado ? 'rgba(239, 83, 80, 0.08)' : 'rgba(76, 175, 80, 0.08)',
                          borderColor: ocupado ? 'error.light' : 'success.light',
                          '&:hover': { bgcolor: ocupado ? 'rgba(239, 83, 80, 0.16)' : 'rgba(76, 175, 80, 0.16)' }
                        }}
                      >
                        <Typography variant="caption" display="block" fontWeight={600}>
                          {b.label}
                        </Typography>
                        <Typography variant="caption" color="text.secondary" display="block" sx={{ fontSize: '0.68rem', mb: 0.5 }}>
                          {b.value}
                        </Typography>
                        <Chip
                          label={ocupado ? 'Ocupado' : 'Livre'}
                          color={ocupado ? 'error' : 'success'}
                          size="small"
                          sx={{ height: 18, fontSize: '0.65rem' }}
                        />
                      </Paper>
                    );
                  })}
                </Box>
              </AccordionDetails>
            </Accordion>
          ))}
        </Box>
      ) : (
        <TableContainer component={Paper} variant="outlined">
          <Table size="small" stickyHeader>
            <TableHead>
              <TableRow>
                <TableCell sx={{ fontWeight: 700, minWidth: 140 }}>Laboratório</TableCell>
                {BLOCOS.map(b => (
                  <TableCell key={b.value} align="center" sx={{ fontWeight: 600, fontSize: '0.75rem' }}>
                    {b.label}<br />
                    <Typography variant="caption" color="text.secondary">{b.value}</Typography>
                  </TableCell>
                ))}
              </TableRow>
            </TableHead>
            <TableBody>
              {labsVisiveis.map(lab => (
                <TableRow key={lab.id} hover>
                  <TableCell sx={{ fontSize: '0.8rem', fontWeight: 500 }}>
                    {lab.name}
                  </TableCell>
                  {BLOCOS.map(b => {
                    const ocupado = isOcupado(lab, b.value);
                    const cor = ocupado ? 'error' : 'success';
                    const labelText = ocupado ? 'Ocupado' : 'Livre';
                    return (
                      <TableCell key={b.value} align="center" sx={{ p: 0.5 }}>
                        <Tooltip title={`${lab.name} - ${b.label} (${b.value}): clique para detalhes`}>
                          <Chip
                            label={labelText}
                            color={cor}
                            size="small"
                            variant={ocupado ? 'outlined' : 'filled'}
                            clickable
                            onClick={() => handleCellClick(lab, b)}
                            sx={{ fontSize: '0.65rem', minWidth: 58, cursor: 'pointer' }}
                          />
                        </Tooltip>
                      </TableCell>
                    );
                  })}
                </TableRow>
              ))}
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
              {modalDetalhes.aulas.map((aula, idx) => (
                <Box key={aula.id || idx} sx={{ mb: idx < modalDetalhes.aulas.length - 1 ? 2 : 0 }}>
                  {idx > 0 && <Divider sx={{ my: 1 }} />}
                  <Typography variant="subtitle2" color="primary.main">
                    {aula.assunto || 'Aula sem título'}
                  </Typography>
                  {aula.cursos && (
                    <Typography variant="body2">
                      <strong>Curso(s):</strong> {Array.isArray(aula.cursos) ? aula.cursos.join(', ') : aula.cursos}
                    </Typography>
                  )}
                  {aula.propostoPorNome && (
                    <Typography variant="body2">
                      <strong>Solicitante/Prof.:</strong> {aula.propostoPorNome}
                    </Typography>
                  )}
                  {aula.tipoAtividade && (
                    <Typography variant="body2">
                      <strong>Tipo:</strong> {aula.tipoAtividade}
                    </Typography>
                  )}
                  {aula.observacoes && (
                    <Typography variant="caption" color="text.secondary" display="block" sx={{ mt: 0.5 }}>
                      <strong>Obs:</strong> {aula.observacoes}
                    </Typography>
                  )}
                </Box>
              ))}
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
