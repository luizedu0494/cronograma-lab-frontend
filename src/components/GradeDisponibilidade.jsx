import React, { useMemo, useState } from 'react';
import {
  Table, TableBody, TableCell, TableContainer,
  TableHead, TableRow, Paper, Chip, Tooltip, Typography, Box,
  Dialog, DialogTitle, DialogContent, DialogActions, Button, Divider
} from '@mui/material';
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
    <Box sx={{ overflowX: 'auto' }}>
      <Typography variant="caption" color="text.secondary" sx={{ mb: 1, display: 'block' }}>
        Clique em qualquer célula para visualizar os detalhes de ocupação ou disponibilidade.
      </Typography>
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
