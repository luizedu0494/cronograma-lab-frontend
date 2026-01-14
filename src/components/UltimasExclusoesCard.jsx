import React, { useState, useEffect } from 'react';
import { db } from '../firebaseConfig';
import { collection, query, where, orderBy, limit, getDocs } from 'firebase/firestore';
import {
    Card, CardContent, Typography, Box, CircularProgress, Alert, Button, Divider, Chip
} from '@mui/material';
import { Trash2, Clock, BookOpen, Users } from 'lucide-react';
import dayjs from 'dayjs';
import { useNavigate } from 'react-router-dom';
import { useTheme } from '@mui/material/styles';

const UltimasExclusoesCard = () => {
    const [logs, setLogs] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const navigate = useNavigate();
    const theme = useTheme();

    const fetchUltimasExclusoes = async () => {
        try {
            setLoading(true);
            const logsRef = collection(db, 'logs');
            
            // CORREÇÃO: Adicionado filtro para trazer APENAS exclusões de 'aulas'
            const q = query(
                logsRef,
                where('type', '==', 'exclusao'),
                where('collection', '==', 'aulas'), // <--- FILTRA APENAS AULAS
                orderBy('timestamp', 'desc'),
                limit(5)
            );
            
            const querySnapshot = await getDocs(q);
            const logsData = querySnapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data(),
                timestamp: doc.data().timestamp ? doc.data().timestamp.toDate() : new Date()
            }));
            setLogs(logsData);
        } catch (err) {
            console.error("Erro ao buscar logs de exclusão:", err);
            setError("Falha ao carregar as últimas exclusões.");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchUltimasExclusoes();
    }, []);

    const getStatusChip = (status) => {
        let color = 'default';
        let label = 'Status Desconhecido';
        switch (status) {
            case 'aprovada': color = 'success'; label = 'Aprovada'; break;
            case 'pendente': color = 'warning'; label = 'Pendente'; break;
            case 'rejeitada': color = 'error'; label = 'Rejeitada'; break;
            default: break;
        }
        return <Chip label={label} color={color} size="small" sx={{ ml: 1, height: 20, fontSize: '0.7rem' }} />;
    };

    const formatarCursos = (cursos) => {
        if (Array.isArray(cursos) && cursos.length > 0) return cursos.join(', ');
        if (typeof cursos === 'string' && cursos.trim() !== '') return cursos;
        return 'Curso não especificado';
    };

    const formatarAno = (dataInicio) => {
        if (!dataInicio) return '';
        const dateObj = dataInicio.toDate ? dataInicio.toDate() : new Date(dataInicio);
        return dayjs(dateObj).isValid() ? ` - ${dayjs(dateObj).year()}` : '';
    };

    return (
        <Card elevation={3} sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
            <CardContent sx={{ flexGrow: 1, p: 2 }}>
                <Box display="flex" alignItems="center" mb={2}>
                    <Trash2 color={theme.palette.error.main} style={{ marginRight: 8 }} size={24} />
                    <Typography variant="h6" component="div" fontWeight="bold">
                        Últimas Aulas Excluídas
                    </Typography>
                </Box>

                {loading ? (
                    <Box display="flex" justifyContent="center" py={4}><CircularProgress size={24} /></Box>
                ) : error ? (
                    <Alert severity="error">{error}</Alert>
                ) : logs.length === 0 ? (
                    <Typography variant="body2" color="text.secondary" textAlign="center" py={4}>
                        Nenhuma aula excluída recentemente.
                    </Typography>
                ) : (
                    <Box>
                        {logs.map((log, index) => (
                            <React.Fragment key={log.id}>
                                <Box sx={{ py: 1.5 }}>
                                    <Box display="flex" justifyContent="space-between" alignItems="flex-start">
                                        <Typography variant="subtitle2" fontWeight="bold" sx={{ color: theme.palette.error.main, lineHeight: 1.2 }}>
                                            {log.aula?.assunto || 'Sem nome'}
                                        </Typography>
                                        {getStatusChip(log.aula?.status)}
                                    </Box>
                                    
                                    <Box display="flex" alignItems="center" mt={0.5} mb={0.5}>
                                        <Users size={14} style={{ marginRight: 4, color: theme.palette.text.secondary }} />
                                        <Typography variant="caption" color="text.primary">
                                            {formatarCursos(log.aula?.cursos || log.aula?.curso)}{formatarAno(log.aula?.dataInicio)}
                                        </Typography>
                                    </Box>
                                    
                                    <Box display="flex" alignItems="center" gap={0.5}>
                                        <Clock size={14} style={{ color: theme.palette.text.secondary }} />
                                        <Typography variant="caption" color="text.secondary">
                                            Excluída em: {dayjs(log.timestamp).format('DD/MM/YYYY [às] HH:mm')}
                                        </Typography>
                                    </Box>
                                    
                                    {log.user?.nome && (
                                        <Typography variant="caption" display="block" sx={{ mt: 0.5, fontStyle: 'italic', color: theme.palette.text.secondary }}>
                                            Por: {log.user.nome}
                                        </Typography>
                                    )}
                                </Box>
                                {index < logs.length - 1 && <Divider />}
                            </React.Fragment>
                        ))}
                    </Box>
                )}
            </CardContent>
            <Box sx={{ p: 2, pt: 0 }}>
                <Button 
                    fullWidth 
                    variant="outlined" 
                    onClick={() => navigate('/historico-aulas')}
                    startIcon={<BookOpen size={18} />}
                    size="small"
                >
                    Ver Histórico Completo
                </Button>
            </Box>
        </Card>
    );
};

export default UltimasExclusoesCard;