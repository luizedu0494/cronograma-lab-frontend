// src/components/UsageMonitor.jsx

import React from 'react';
import { Box, Typography, LinearProgress, Alert, CircularProgress } from '@mui/material';
import { useUsageCounter } from '../utils/useUsageCounter';


const UsageMonitor = () => {
  const { usageCount, DAILY_READ_LIMIT, usagePercentage, isCritical, isLoading } = useUsageCounter();




  if (isLoading) {
    return (
      <Box sx={{ display: 'flex', alignItems: 'center', p: 2 }}>
        <CircularProgress size={20} sx={{ mr: 1 }} />
        <Typography variant="body2">Carregando monitor de uso...</Typography>
      </Box>
    );
  }

  return (
    <Box sx={{ p: 2, border: '1px solid #ccc', borderRadius: '4px', mt: 3 }}>
      <Typography variant="h6" gutterBottom>
        Monitor de Uso do Firestore (Simulado)
      </Typography>
      
      <Typography variant="body2" color="text.secondary">
        Leituras Críticas Registradas: **{usageCount.toLocaleString()}** de **{DAILY_READ_LIMIT.toLocaleString()}** (Limite Diário do Plano Spark)
      </Typography>

      <LinearProgress 
        variant="determinate" 
        value={usagePercentage} 
        color={isCritical ? 'error' : 'primary'} 
        sx={{ height: 10, borderRadius: 5, my: 1 }}
      />

      <Typography variant="body2" sx={{ fontWeight: 'bold' }}>
        {usagePercentage.toFixed(2)}% de uso
      </Typography>

      {isCritical && (
        <Alert severity="warning" sx={{ mt: 2 }}>
          Atenção: O uso de leituras críticas está acima de 80%. Considere otimizar as operações ou monitorar o painel do Firebase.
        </Alert>
      )}
      
      <Typography variant="caption" display="block" sx={{ mt: 1 }}>
        *Este contador rastreia apenas as operações que você configurou como críticas e não o uso total do Firebase.
      </Typography>
    </Box>
  );
};

export default UsageMonitor;
