import React from 'react';
import {
  Paper,
  Box,
  Typography,
  Checkbox,
  Chip,
  Tooltip,
} from '@mui/material';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import WarningIcon from '@mui/icons-material/Warning';
import ErrorIcon from '@mui/icons-material/Error';
import BlockIcon from '@mui/icons-material/Block';

const CONFIG_STATUS = {
  valido: {
    corBorda: '#2e7d32',
    corFundo: 'rgba(46, 125, 50, 0.04)',
    badgeColor: 'success',
    badgeLabel: 'Válido',
    Icon: CheckCircleIcon,
  },
  atencao: {
    corBorda: '#ed6c02',
    corFundo: 'rgba(237, 108, 2, 0.04)',
    badgeColor: 'warning',
    badgeLabel: 'Atenção',
    Icon: WarningIcon,
  },
  conflito: {
    corBorda: '#d32f2f',
    corFundo: 'rgba(211, 47, 47, 0.04)',
    badgeColor: 'error',
    badgeLabel: 'Conflito',
    Icon: ErrorIcon,
  },
  invalido: {
    corBorda: '#9e9e9e',
    corFundo: 'rgba(158, 158, 158, 0.04)',
    badgeColor: 'default',
    badgeLabel: 'Dados Inválidos',
    Icon: BlockIcon,
  },
};

export default function ItemRevisaoCard({ item, onToggle }) {
  const cfg = CONFIG_STATUS[item.status] || CONFIG_STATUS.invalido;
  const IconeStatus = cfg.Icon;
  const ehInvalido = item.status === 'invalido';

  return (
    <Paper
      elevation={1}
      sx={{
        p: 2,
        mb: 1.5,
        borderLeft: `5px solid ${cfg.corBorda}`,
        bgcolor: cfg.corFundo,
        opacity: ehInvalido ? 0.65 : 1,
        transition: 'all 0.2s ease-in-out',
        '&:hover': {
          boxShadow: ehInvalido ? 1 : 3,
        },
      }}
    >
      <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 2 }}>
        <Checkbox
          checked={item.selecionado}
          disabled={ehInvalido}
          onChange={onToggle}
          color={item.status === 'atencao' ? 'warning' : 'primary'}
          sx={{ mt: -0.5 }}
        />

        <Box sx={{ flexGrow: 1 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap', mb: 0.5 }}>
            <Typography variant="subtitle1" fontWeight={700} component="span">
              {item.original.disciplina || '(Sem disciplina)'}
            </Typography>
            
            {item.labReconhecidoName && (
              <Chip
                label={item.labReconhecidoName}
                size="small"
                variant="outlined"
                color="primary"
                sx={{ fontWeight: 600 }}
              />
            )}
            
            {item.original.curso && (
              <Chip
                label={item.original.curso}
                size="small"
                variant="filled"
                sx={{ bgcolor: 'rgba(0,0,0,0.06)' }}
              />
            )}
          </Box>

          <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
            📅 <strong>Data:</strong> {item.original.data || 'Não informada'} | 
            ⏰ <strong>Horário:</strong> {item.original.horarioInicio && item.original.horarioFim ? `${item.original.horarioInicio} às ${item.original.horarioFim}` : item.original.horarioInicio || 'Não informado'} | 
            👤 <strong>Prof:</strong> {item.original.professor || 'Não informado'}
          </Typography>

          {item.motivos.length > 0 && (
            <Box sx={{ mt: 1, pt: 1, borderTop: '1px stroke rgba(0,0,0,0.08)' }}>
              {item.motivos.map((motivo, idx) => (
                <Box key={idx} sx={{ display: 'flex', alignItems: 'center', gap: 0.8, color: cfg.corBorda, mb: 0.3 }}>
                  <IconeStatus fontSize="small" />
                  <Typography variant="caption" fontWeight={600}>
                    {motivo}
                  </Typography>
                </Box>
              ))}
            </Box>
          )}
        </Box>

        <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 1 }}>
          <Chip
            icon={<IconeStatus />}
            label={cfg.badgeLabel}
            color={cfg.badgeColor}
            size="small"
            sx={{ fontWeight: 700 }}
          />
        </Box>
      </Box>
    </Paper>
  );
}
