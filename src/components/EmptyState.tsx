import React from 'react';
import { Box, Typography, Paper, Button, SvgIconTypeMap } from '@mui/material';
import { OverridableComponent } from '@mui/types';
import SearchOffIcon from '@mui/icons-material/SearchOff';

export interface EmptyStateProps {
  icon?: OverridableComponent<SvgIconTypeMap<{}, 'svg'>>;
  title?: string;
  message?: string;
  action?: {
    label: string;
    onClick: () => void;
    variant?: 'contained' | 'outlined';
  };
}

const EmptyState: React.FC<EmptyStateProps> = ({ icon, title, message, action }) => {
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
        borderRadius: 2
      }}
    >
      <Box sx={{ color: 'text.secondary', mb: 2 }}>
        <IconComponent sx={{ fontSize: 60 }} />
      </Box>
      <Typography variant="h6" gutterBottom fontWeight={600}>
        {title || 'Nenhum resultado encontrado'}
      </Typography>
      <Typography color="text.secondary" variant="body2" sx={{ maxWidth: 450, mx: 'auto', mb: action ? 2.5 : 0 }}>
        {message || 'Tente ajustar seus filtros ou realizar uma nova busca.'}
      </Typography>
      {action && (
        <Button
          variant={action.variant || 'contained'}
          color="primary"
          onClick={action.onClick}
          size="small"
        >
          {action.label}
        </Button>
      )}
    </Paper>
  );
};

export default EmptyState;
