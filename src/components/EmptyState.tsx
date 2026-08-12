import React from 'react';
import { Box, Typography, Paper, SvgIconTypeMap } from '@mui/material';
import { OverridableComponent } from '@mui/types';
import SearchOffIcon from '@mui/icons-material/SearchOff';

export interface EmptyStateProps {
  icon?: OverridableComponent<SvgIconTypeMap<{}, 'svg'>>;
  title?: string;
  message?: string;
}

const EmptyState: React.FC<EmptyStateProps> = ({ icon, title, message }) => {
  const IconComponent = icon || SearchOffIcon;

  return (
    <Paper
      variant="outlined"
      sx={{
        textAlign: 'center',
        p: 4,
        mt: 4,
        borderColor: 'divider',
        bgcolor: 'action.hover',
      }}
    >
      <Box sx={{ color: 'text.secondary', mb: 2 }}>
        <IconComponent sx={{ fontSize: 60 }} />
      </Box>
      <Typography variant="h6" gutterBottom>
        {title || 'Nenhum resultado encontrado'}
      </Typography>
      <Typography color="text.secondary">
        {message || 'Tente ajustar seus filtros ou realizar uma nova busca.'}
      </Typography>
    </Paper>
  );
};

export default EmptyState;
