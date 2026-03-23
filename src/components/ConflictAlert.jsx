import React from 'react';
import {
    Alert, Box, Typography, Chip, Divider, Button, Stack,
    Dialog, DialogTitle, DialogContent, DialogActions
} from '@mui/material';
import { AlertCircle, Clock, MapPin, Users, BookOpen } from 'lucide-react';
import dayjs from 'dayjs';
import 'dayjs/locale/pt-br';

dayjs.locale('pt-br');

/**
 * Componente para exibir alertas de conflito de horário/laboratório
 * 
 * Props:
 * - conflitos: Array de objetos com { aulaId, aulaNova, aulaExistente }
 * - onClose: Callback quando fechar o diálogo
 * - open: boolean para controlar visibilidade do diálogo
 * - onReplace: Callback para substituir aulas conflitantes
 * - onSkip: Callback para pular conflitos
 * - onCancel: Callback para cancelar operação
 */
const ConflictAlert = ({ 
    conflitos = [], 
    onClose, 
    open = false,
    onReplace,
    onSkip,
    onCancel,
    isMultiple = false
}) => {
    if (!conflitos || conflitos.length === 0) return null;

    const handleReplace = () => {
        if (onReplace) onReplace();
        onClose?.();
    };

    const handleSkip = () => {
        if (onSkip) onSkip();
        onClose?.();
    };

    const handleCancel = () => {
        if (onCancel) onCancel();
        onClose?.();
    };

    const renderConflito = (conflito, index) => {
        const { aulaNova, aulaExistente } = conflito;
        
        const dataFormatada = aulaExistente.dataInicio 
            ? dayjs(aulaExistente.dataInicio.toDate?.() || aulaExistente.dataInicio).format('DD/MM/YYYY')
            : 'Data não disponível';

        return (
            <Box key={index} sx={{ mb: 2, p: 2, bgcolor: 'rgba(255, 152, 0, 0.08)', borderRadius: 1, border: '1px solid rgba(255, 152, 0, 0.3)' }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1.5 }}>
                    <AlertCircle size={20} style={{ color: '#ff9800' }} />
                    <Typography variant="subtitle2" fontWeight="bold" sx={{ color: '#ff9800' }}>
                        Conflito Detectado
                    </Typography>
                </Box>

                <Divider sx={{ my: 1 }} />

                <Box sx={{ mb: 1.5 }}>
                    <Typography variant="caption" color="text.secondary" display="block" sx={{ mb: 0.5 }}>
                        <strong>Aula que você está tentando agendar:</strong>
                    </Typography>
                    <Box sx={{ pl: 1, borderLeft: '3px solid #1976d2' }}>
                        <Typography variant="body2" sx={{ mb: 0.5 }}>
                            <strong>Assunto:</strong> {aulaNova.assunto || 'Sem assunto'}
                        </Typography>
                        <Typography variant="body2" sx={{ mb: 0.5 }}>
                            <strong>Horário:</strong> {aulaNova.horarioSlotString || 'N/A'}
                        </Typography>
                        <Typography variant="body2">
                            <strong>Laboratório:</strong> {aulaNova.laboratorioSelecionado || 'N/A'}
                        </Typography>
                    </Box>
                </Box>

                <Divider sx={{ my: 1 }} />

                <Box sx={{ mb: 1.5 }}>
                    <Typography variant="caption" color="text.secondary" display="block" sx={{ mb: 0.5 }}>
                        <strong>Aula que já está agendada neste horário:</strong>
                    </Typography>
                    <Box sx={{ pl: 1, borderLeft: '3px solid #f44336' }}>
                        <Typography variant="body2" sx={{ mb: 0.5 }}>
                            <strong>Assunto:</strong> {aulaExistente.assunto || 'Sem assunto'}
                        </Typography>
                        <Typography variant="body2" sx={{ mb: 0.5 }}>
                            <strong>Data:</strong> {dataFormatada}
                        </Typography>
                        <Typography variant="body2" sx={{ mb: 0.5 }}>
                            <strong>Horário:</strong> {aulaExistente.horarioSlotString || 'N/A'}
                        </Typography>
                        <Typography variant="body2" sx={{ mb: 0.5 }}>
                            <strong>Laboratório:</strong> {aulaExistente.laboratorioSelecionado || 'N/A'}
                        </Typography>
                        {aulaExistente.cursos && (
                            <Typography variant="body2">
                                <strong>Cursos:</strong> {Array.isArray(aulaExistente.cursos) ? aulaExistente.cursos.join(', ') : aulaExistente.cursos}
                            </Typography>
                        )}
                        {aulaExistente.propostoPorNome && (
                            <Typography variant="body2" sx={{ mt: 0.5, color: 'text.secondary', fontSize: '0.75rem' }}>
                                <strong>Proposto por:</strong> {aulaExistente.propostoPorNome}
                            </Typography>
                        )}
                    </Box>
                </Box>
            </Box>
        );
    };

    return (
        <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
            <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1, color: '#ff9800' }}>
                <AlertCircle size={24} />
                {isMultiple ? 'Conflitos Detectados' : 'Conflito de Horário Detectado'}
            </DialogTitle>

            <DialogContent sx={{ pt: 2 }}>
                <Alert severity="warning" sx={{ mb: 2 }}>
                    {isMultiple 
                        ? `${conflitos.length} conflito(s) encontrado(s). Escolha como proceder.`
                        : 'O horário/laboratório que você selecionou já está ocupado. Escolha uma das opções abaixo.'
                    }
                </Alert>

                <Box sx={{ maxHeight: 400, overflowY: 'auto' }}>
                    {conflitos.map((conflito, index) => renderConflito(conflito, index))}
                </Box>
            </DialogContent>

            <DialogActions sx={{ p: 2, gap: 1 }}>
                <Button onClick={handleCancel} variant="outlined" color="inherit">
                    Cancelar
                </Button>
                {isMultiple && (
                    <Button onClick={handleSkip} variant="outlined" color="warning">
                        Pular Conflitos
                    </Button>
                )}
                <Button onClick={handleReplace} variant="contained" color="error">
                    {isMultiple ? 'Substituir Conflitantes' : 'Substituir Aula Existente'}
                </Button>
            </DialogActions>
        </Dialog>
    );
};

export default ConflictAlert;
