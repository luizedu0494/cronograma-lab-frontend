import React, { useState, useEffect } from 'react';
import { db } from '../firebaseConfig';
import { collection, query, where, orderBy, limit, getDocs } from 'firebase/firestore';
import {
    Card, CardContent, Typography, Box, CircularProgress, Alert, Button, Divider, Chip, Tabs, Tab
} from '@mui/material';
import { Trash2, Clock, BookOpen, Users } from 'lucide-react';
import dayjs from 'dayjs';
import { useNavigate } from 'react-router-dom';
import { useTheme } from '@mui/material/styles';

const UltimasExclusoesCard = () => {
    const [logsAulas, setLogsAulas] = useState([]);
    const [logsRevisoes, setLogsRevisoes] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [tab, setTab] = useState(0);
    const navigate = useNavigate();
    const theme = useTheme();

    useEffect(() => {
        const fetchLogs = async () => {
            try {
                setLoading(true);
                const logsRef = collection(db, 'logs');
                const q = query(
                    logsRef,
                    where('type', '==', 'exclusao'),
                    orderBy('timestamp', 'desc'),
                    limit(50)
                );
                const snapshot = await getDocs(q);
                const todos = snapshot.docs.map(doc => ({
                    id: doc.id,
                    ...doc.data(),
                    timestamp: doc.data().timestamp ? doc.data().timestamp.toDate() : new Date()
                }));

                setLogsAulas(todos.filter(l => !l.aula?.isRevisao && l.collection !== 'eventos').slice(0, 5));
                setLogsRevisoes(todos.filter(l => l.aula?.isRevisao === true).slice(0, 5));
            } catch (err) {
                console.error("Erro ao buscar logs:", err);
                setError("Falha ao carregar exclusões.");
            } finally {
                setLoading(false);
            }
        };
        fetchLogs();
    }, []);

    const getStatusChip = (status) => {
        const map = { aprovada: ['success','Aprovada'], pendente: ['warning','Pendente'], rejeitada: ['error','Rejeitada'] };
        const [color, label] = map[status] || ['default','Desconhecido'];
        return <Chip label={label} color={color} size="small" sx={{ ml: 1, height: 20, fontSize: '0.7rem' }} />;
    };

    const formatarCursos = (log) => {
        const c = log.aula?.cursos || log.aula?.curso;
        if (Array.isArray(c) && c.length > 0) return c.join(', ');
        if (typeof c === 'string' && c.trim()) return c;
        return 'Curso não especificado';
    };

    const formatarAno = (d) => {
        if (!d) return '';
        const obj = d.toDate ? d.toDate() : new Date(d);
        return dayjs(obj).isValid() ? ` - ${dayjs(obj).year()}` : '';
    };

    const renderLogs = (logs, isRevisao) => {
        if (!logs.length) return (
            <Typography variant="body2" color="text.secondary" textAlign="center" py={3}>
                {isRevisao ? 'Nenhuma revisão excluída.' : 'Nenhuma aula excluída.'}
            </Typography>
        );
        return logs.map((log, i) => (
            <React.Fragment key={log.id}>
                <Box sx={{ py: 1.5 }}>
                    <Box display="flex" justifyContent="space-between" alignItems="flex-start">
                        <Box display="flex" alignItems="center" gap={0.5}>
                            <Typography variant="caption">{isRevisao ? '📖' : '🎓'}</Typography>
                            <Typography variant="subtitle2" fontWeight="bold" sx={{ color: theme.palette.error.main, lineHeight: 1.2 }}>
                                {log.aula?.assunto || log.aula?.disciplina || 'Sem nome'}
                            </Typography>
                        </Box>
                        {getStatusChip(log.aula?.status)}
                    </Box>
                    {isRevisao && log.aula?.tipoRevisaoLabel && (
                        <Chip label={log.aula.tipoRevisaoLabel} size="small" color="secondary" sx={{ mt: 0.3, height: 18, fontSize: '0.65rem' }} />
                    )}
                    <Box display="flex" alignItems="center" mt={0.5}>
                        <Users size={13} style={{ marginRight: 4, color: theme.palette.text.secondary }} />
                        <Typography variant="caption">{formatarCursos(log)}{formatarAno(log.aula?.dataInicio)}</Typography>
                    </Box>
                    <Box display="flex" alignItems="center" gap={0.5} mt={0.3}>
                        <Clock size={13} style={{ color: theme.palette.text.secondary }} />
                        <Typography variant="caption" color="text.secondary">
                            Excluída em: {dayjs(log.timestamp).format('DD/MM/YYYY [às] HH:mm')}
                        </Typography>
                    </Box>
                    {log.user?.nome && (
                        <Typography variant="caption" display="block" sx={{ fontStyle: 'italic', color: 'text.secondary' }}>
                            Por: {log.user.nome}
                        </Typography>
                    )}
                </Box>
                {i < logs.length - 1 && <Divider />}
            </React.Fragment>
        ));
    };

    return (
        <Card elevation={3} sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
            <CardContent sx={{ flexGrow: 1, p: 2, pb: 0 }}>
                <Box display="flex" alignItems="center" mb={1}>
                    <Trash2 color={theme.palette.error.main} style={{ marginRight: 8 }} size={22} />
                    <Typography variant="h6" fontWeight="bold">Últimas Exclusões</Typography>
                </Box>
                <Tabs value={tab} onChange={(_, v) => setTab(v)} textColor="primary" indicatorColor="primary"
                    sx={{ mb: 1, minHeight: 34, '& .MuiTab-root': { minHeight: 34, fontSize: '0.75rem', py: 0 } }}>
                    <Tab label={`🎓 Aulas (${logsAulas.length})`} />
                    <Tab label={`📖 Revisões (${logsRevisoes.length})`} />
                </Tabs>
                {loading ? (
                    <Box display="flex" justifyContent="center" py={3}><CircularProgress size={22} /></Box>
                ) : error ? (
                    <Alert severity="error">{error}</Alert>
                ) : (
                    <Box>
                        {tab === 0 && renderLogs(logsAulas, false)}
                        {tab === 1 && renderLogs(logsRevisoes, true)}
                    </Box>
                )}
            </CardContent>
            <Box sx={{ p: 2, pt: 1 }}>
                <Button fullWidth variant="outlined" size="small" onClick={() => navigate('/historico-aulas')} startIcon={<BookOpen size={16} />}>
                    Ver Histórico Completo
                </Button>
            </Box>
        </Card>
    );
};

export default UltimasExclusoesCard;
