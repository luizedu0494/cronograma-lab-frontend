import React, { useMemo } from 'react';
import {
  Table, TableBody, TableCell, TableContainer,
  TableHead, TableRow, Paper, Chip, Tooltip, Typography, Box
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
 * @param {Function} onCelulaClick - Callback quando o coordenador clica em uma célula livre
 */
export default function GradeDisponibilidade({ aulas = [], dataFoco, tiposLab = [], onCelulaClick }) {

  // Labs filtrados por tipo (se filtro aplicado)
  const labsVisiveis = useMemo(() => {
    if (!tiposLab || !tiposLab.length) return LISTA_LABORATORIOS;
    return LISTA_LABORATORIOS.filter(l => tiposLab.includes(l.tipo));
  }, [tiposLab]);

  // Mapa: laboratorioId → Set de horários ocupados
  const mapaOcupacao = useMemo(() => {
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
        // Encontrar objeto do lab por id ou name
        const labObj = LISTA_LABORATORIOS.find(l => l.id === rawLab || l.name === rawLab);
        const labId = labObj ? labObj.id : rawLab;
        const labName = labObj ? labObj.name : rawLab;

        if (!mapa[labId]) mapa[labId] = new Set();
        if (!mapa[labName]) mapa[labName] = new Set();

        const horarios = toHorariosArray(a.horarioSlotString);
        horarios.forEach(h => {
          if (h) {
            mapa[labId].add(h);
            mapa[labName].add(h);
          }
        });
      });
    return mapa;
  }, [aulas, dataFoco]);

  const celulaCor = (lab, horario) => {
    const ocupado = mapaOcupacao[lab.id]?.has(horario) || mapaOcupacao[lab.name]?.has(horario);
    return ocupado ? 'error' : 'success';
  };

  const celulaLabel = (lab, horario) => {
    const ocupado = mapaOcupacao[lab.id]?.has(horario) || mapaOcupacao[lab.name]?.has(horario);
    return ocupado ? 'Ocupado' : 'Livre';
  };

  return (
    <Box sx={{ overflowX: 'auto' }}>
      <Typography variant="caption" color="text.secondary" sx={{ mb: 1, display: 'block' }}>
        Clique em uma célula <strong>verde</strong> para pré-preencher o formulário de agendamento.
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
                  const cor = celulaCor(lab, b.value);
                  const livre = cor === 'success';
                  return (
                    <TableCell key={b.value} align="center" sx={{ p: 0.5 }}>
                      <Tooltip title={livre
                        ? `${lab.name} livre no horário ${b.value} — clique para agendar`
                        : `${lab.name} ocupado no horário ${b.value}`
                      }>
                        <Chip
                          label={celulaLabel(lab, b.value)}
                          color={cor}
                          size="small"
                          variant={livre ? 'filled' : 'outlined'}
                          clickable={livre}
                          onClick={livre && onCelulaClick
                            ? () => onCelulaClick({ labId: lab.id, labNome: lab.name, horario: b.value })
                            : undefined
                          }
                          sx={{ fontSize: '0.65rem', minWidth: 58 }}
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
    </Box>
  );
}
