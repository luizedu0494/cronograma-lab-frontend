// src/components/EmptyState.jsx

import React from 'react';
import { Box, Typography, Paper } from '@mui/material';
import SearchOffIcon from '@mui/icons-material/SearchOff'; // Um bom ícone para "não encontrado"

const EmptyState = ({ icon, title, message }) => {
  const IconComponent = icon || SearchOffIcon;

  return (
    <Paper 
      variant="outlined" 
      sx={{ 
        textAlign: 'center', 
        p: 4, 
        mt: 4, 
        borderColor: 'divider',
        bgcolor: 'action.hover'
      }}
    >
      <Box sx={{ color: 'text.secondary', mb: 2 }}>
        <IconComponent sx={{ fontSize: 60 }} />
      </Box>
      <Typography variant="h6" gutterBottom>
        {title || "Nenhum resultado encontrado"}
      </Typography>
      <Typography color="text.secondary">
        {message || "Tente ajustar seus filtros ou realizar uma nova busca."}
      </Typography>
    </Paper>
  );
};

export default EmptyState;
