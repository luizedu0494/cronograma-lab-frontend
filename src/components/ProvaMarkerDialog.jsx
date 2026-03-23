import React, { useState } from 'react';
import {
    Dialog, DialogTitle, DialogContent, DialogActions, Button,
    FormControl, InputLabel, Select, MenuItem, FormHelperText,
    Box, Typography, Alert, Checkbox, FormControlLabel
} from '@mui/material';
import { BookOpen, AlertCircle } from 'lucide-react';

/**
 * Diálogo para marcar uma ou múltiplas aulas como provas
 * 
 * Props:
 * - open: boolean
 * - onClose: Callback quando fechar
 * - onConfirm: Callback com { isProva, tipoProva }
 * - isMultiple: boolean (se é múltiplas aulas)
 * - aulasCount: número de aulas (para múltiplas)
 */
const ProvaMarkerDialog = ({ 
    open = false, 
    onClose, 
    onConfirm,
    isMultiple = false,
    aulasCount = 1
}) => {
    const [isProva, setIsProva] = useState(false);
    const [tipoProva, setTipoProva] = useState('');
    const [error, setError] = useState('');

    const tiposProva = [
        { value: 'avaliacao', label: '📋 Avaliação' },
        { value: 'simulado', label: '🎯 Simulado' },
        { value: 'prova_final', label: '🏆 Prova Final' },
        { value: 'outro', label: '📌 Outro' }
    ];

    const handleConfirm = () => {
        setError('');

        if (isProva && !tipoProva) {
            setError('Selecione o tipo de prova');
            return;
        }

        onConfirm?.({
            isProva,
            tipoProva: isProva ? tipoProva : null
        });

        // Resetar estado
        setIsProva(false);
        setTipoProva('');
        onClose?.();
    };

    const handleClose = () => {
        setError('');
        setIsProva(false);
        setTipoProva('');
        onClose?.();
    };

    return (
        <Dialog open={open} onClose={handleClose} maxWidth="sm" fullWidth>
            <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <BookOpen size={24} />
                {isMultiple ? `Marcar ${aulasCount} Aula(s) como Prova` : 'Marcar como Prova'}
            </DialogTitle>

            <DialogContent sx={{ pt: 2 }}>
                <Alert severity="info" sx={{ mb: 2 }}>
                    Ao marcar como prova, uma notificação será enviada no Telegram e a aula aparecerá nos gráficos de análise.
                </Alert>

                <Box sx={{ mb: 3 }}>
                    <FormControlLabel
                        control={
                            <Checkbox
                                checked={isProva}
                                onChange={(e) => {
                                    setIsProva(e.target.checked);
                                    if (!e.target.checked) {
                                        setTipoProva('');
                                        setError('');
                                    }
                                }}
                            />
                        }
                        label={
                            <Box>
                                <Typography variant="body2" fontWeight="bold">
                                    Marcar como Prova
                                </Typography>
                                <Typography variant="caption" color="text.secondary">
                                    {isMultiple 
                                        ? `Aplicar a todas as ${aulasCount} aula(s) selecionada(s)`
                                        : 'Esta aula será identificada como prova'
                                    }
                                </Typography>
                            </Box>
                        }
                    />
                </Box>

                {isProva && (
                    <FormControl fullWidth error={!!error} sx={{ mb: 2 }}>
                        <InputLabel shrink>Tipo de Prova *</InputLabel>
                        <Select
                            value={tipoProva}
                            onChange={(e) => {
                                setTipoProva(e.target.value);
                                setError('');
                            }}
                            label="Tipo de Prova"
                        >
                            <MenuItem value="">
                                <em>Selecione um tipo...</em>
                            </MenuItem>
                            {tiposProva.map(tipo => (
                                <MenuItem key={tipo.value} value={tipo.value}>
                                    {tipo.label}
                                </MenuItem>
                            ))}
                        </Select>
                        {error && <FormHelperText>{error}</FormHelperText>}
                    </FormControl>
                )}

                {isProva && tipoProva && (
                    <Alert severity="success" sx={{ mt: 2 }}>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                            <BookOpen size={18} />
                            <Typography variant="body2">
                                {isMultiple 
                                    ? `${aulasCount} aula(s) será(ão) marcada(s) como ${tiposProva.find(t => t.value === tipoProva)?.label || 'prova'}`
                                    : `Esta aula será marcada como ${tiposProva.find(t => t.value === tipoProva)?.label || 'prova'}`
                                }
                            </Typography>
                        </Box>
                    </Alert>
                )}

                {!isProva && (
                    <Alert severity="warning" sx={{ mt: 2 }}>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                            <AlertCircle size={18} />
                            <Typography variant="body2">
                                {isMultiple 
                                    ? `${aulasCount} aula(s) não será(ão) marcada(s) como prova`
                                    : 'Esta aula não será marcada como prova'
                                }
                            </Typography>
                        </Box>
                    </Alert>
                )}
            </DialogContent>

            <DialogActions sx={{ p: 2, gap: 1 }}>
                <Button onClick={handleClose} variant="outlined">
                    Cancelar
                </Button>
                <Button 
                    onClick={handleConfirm} 
                    variant="contained"
                    disabled={isProva && !tipoProva}
                >
                    Confirmar
                </Button>
            </DialogActions>
        </Dialog>
    );
};

export default ProvaMarkerDialog;
