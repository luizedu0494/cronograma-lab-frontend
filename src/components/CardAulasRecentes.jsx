import React, { useState } from 'react';
import {
    Card, CardContent, CardHeader, CardActions, Typography, Box, CircularProgress,
    Alert, Button, Chip, Grid, Skeleton, useTheme
} from '@mui/material';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useNavigate } from 'react-router-dom';
import { BookOpen, ChevronRight, Clock, User, CheckCircle, XCircle } from 'lucide-react';
import useFetchAulas from '../hooks/useFetchAulas';

const CardAulasRecentes = ({ limite = 5 }) => {
    const theme = useTheme();
    const navigate = useNavigate();
    const { aulas, loading, error } = useFetchAulas({ limitCount: limite });

    // Função para obter a cor do status
    const getStatusColor = (status) => {
        switch (status) {
            case 'aprovada':
                return '#4caf50';
            case 'reprovada':
                return '#f44336';
            case 'pendente':
                return '#ff9800';
            default:
                return '#9e9e9e';
        }
    };

    // Função para obter o ícone do status
    const getStatusIcon = (status) => {
        switch (status) {
            case 'aprovada':
                return <CheckCircle size={16} />;
            case 'reprovada':
                return <XCircle size={16} />;
            default:
                return null;
        }
    };

    // Função para formatar a data
    const formatarData = (data) => {
        if (!data) return 'Data não disponível';
        try {
            const dataObj = typeof data === 'string' ? new Date(data) : data.toDate?.() || data;
            return format(dataObj, 'dd MMM yyyy', { locale: ptBR });
        } catch {
            return 'Data inválida';
        }
    };

    // Função para formatar a hora
    const formatarHora = (data) => {
        if (!data) return '';
        try {
            const dataObj = typeof data === 'string' ? new Date(data) : data.toDate?.() || data;
            return format(dataObj, 'HH:mm', { locale: ptBR });
        } catch {
            return '';
        }
    };

    if (loading) {
        return (
            <Card sx={{ boxShadow: 2, borderRadius: 2 }}>
                <CardHeader
                    avatar={<BookOpen size={24} style={{ color: theme.palette.primary.main }} />}
                    title="Aulas Recentes"
                    titleTypographyProps={{ variant: 'h6', fontWeight: 600 }}
                />
                <CardContent>
                    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                        {[1, 2, 3].map((i) => (
                            <Skeleton key={i} variant="rectangular" height={80} sx={{ borderRadius: 1 }} />
                        ))}
                    </Box>
                </CardContent>
            </Card>
        );
    }

    if (error) {
        return (
            <Card sx={{ boxShadow: 2, borderRadius: 2 }}>
                <CardHeader
                    avatar={<BookOpen size={24} style={{ color: theme.palette.primary.main }} />}
                    title="Aulas Recentes"
                    titleTypographyProps={{ variant: 'h6', fontWeight: 600 }}
                />
                <CardContent>
                    <Alert severity="error">{error}</Alert>
                </CardContent>
            </Card>
        );
    }

    if (aulas.length === 0) {
        return (
            <Card sx={{ boxShadow: 2, borderRadius: 2 }}>
                <CardHeader
                    avatar={<BookOpen size={24} style={{ color: theme.palette.primary.main }} />}
                    title="Aulas Recentes"
                    titleTypographyProps={{ variant: 'h6', fontWeight: 600 }}
                />
                <CardContent>
                    <Alert severity="info">Nenhuma aula encontrada.</Alert>
                </CardContent>
            </Card>
        );
    }

    return (
        <Card sx={{ boxShadow: 2, borderRadius: 2, height: '100%', display: 'flex', flexDirection: 'column' }}>
            <CardHeader
                avatar={<BookOpen size={24} style={{ color: theme.palette.primary.main }} />}
                title="Aulas Recentes"
                titleTypographyProps={{ variant: 'h6', fontWeight: 600 }}
                subheader={`Últimas ${aulas.length} aulas adicionadas`}
            />
            <CardContent sx={{ flex: 1, overflow: 'auto' }}>
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
                    {aulas.map((aula) => (
                        <Box
                            key={aula.id}
                            sx={{
                                p: 1.5,
                                border: `1px solid ${theme.palette.divider}`,
                                borderRadius: 1,
                                backgroundColor: theme.palette.mode === 'dark' ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.02)',
                                transition: 'all 0.2s ease',
                                '&:hover': {
                                    backgroundColor: theme.palette.mode === 'dark' ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.04)',
                                    borderColor: theme.palette.primary.main,
                                }
                            }}
                        >
                            {/* Cabeçalho da aula */}
                            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 1 }}>
                                <Box sx={{ flex: 1 }}>
                                    <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 0.5 }}>
                                        {aula.titulo || 'Sem título'}
                                    </Typography>
                                    <Typography variant="caption" sx={{ color: theme.palette.text.secondary }}>
                                        {aula.laboratorio || 'Laboratório não especificado'}
                                    </Typography>
                                </Box>
                                <Chip
                                    icon={getStatusIcon(aula.status)}
                                    label={aula.status || 'Desconhecido'}
                                    size="small"
                                    sx={{
                                        backgroundColor: getStatusColor(aula.status),
                                        color: 'white',
                                        fontWeight: 500,
                                        ml: 1
                                    }}
                                />
                            </Box>

                            {/* Informações de data e hora */}
                            <Box sx={{ display: 'flex', gap: 2, mb: 1, flexWrap: 'wrap' }}>
                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                                    <Clock size={14} style={{ color: theme.palette.text.secondary }} />
                                    <Typography variant="caption" sx={{ color: theme.palette.text.secondary }}>
                                        {formatarData(aula.dataInicio)} às {formatarHora(aula.dataInicio)}
                                    </Typography>
                                </Box>
                            </Box>

                            {/* Informações do autor */}
                            {aula.autorNome && (
                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                                    <User size={14} style={{ color: theme.palette.text.secondary }} />
                                    <Typography variant="caption" sx={{ color: theme.palette.text.secondary }}>
                                        Adicionado por: {aula.autorNome}
                                    </Typography>
                                </Box>
                            )}
                        </Box>
                    ))}
                </Box>
            </CardContent>
            <CardActions sx={{ justifyContent: 'flex-end', pt: 1 }}>
                <Button
                    endIcon={<ChevronRight size={18} />}
                    color="primary"
                    onClick={() => navigate('/listagem-completa-aulas')}
                    sx={{ fontWeight: 500 }}
                >
                    Ver Todas
                </Button>
            </CardActions>
        </Card>
    );
};

export default CardAulasRecentes;
