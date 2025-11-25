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
    // Função para obter a cor do status usando a paleta do tema
    const getStatusColor = (status) => {
        switch (status) {
            case 'aprovada':
                return theme.palette.success.main;
            case 'reprovada':
                return theme.palette.error.main;
            case 'pendente':
                return theme.palette.warning.main;
            default:
                return theme.palette.grey[500];
        }
    };

    // Função para obter a cor do texto do status
    const getStatusTextColor = (status) => {
        switch (status) {
            case 'aprovada':
                return theme.palette.success.contrastText;
            case 'reprovada':
                return theme.palette.error.contrastText;
            case 'pendente':
                return theme.palette.warning.contrastText;
            default:
                return theme.palette.common.white;
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
                                borderRadius: theme.shape.borderRadius, // Usar o borderRadius do tema (12px)
                                backgroundColor: theme.palette.background.paper, // Usar a cor de fundo do Paper
                                transition: 'all 0.3s ease-in-out',
                                '&:hover': {
                                    transform: 'translateY(-2px)',
                                    boxShadow: theme.shadows[3], // Adicionar uma sombra sutil no hover
                                    borderColor: theme.palette.primary.main,
                                }
                            }}
                        >
                            {/* Cabeçalho da aula */}
                            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 1 }}>
                                <Box sx={{ flex: 1, minWidth: 0 }}>
                                    <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 0.5, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
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
                                        color: getStatusTextColor(aula.status),
                                        fontWeight: 600,
                                        ml: 1,
                                        borderRadius: '6px', // Ajuste para um visual mais moderno
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
