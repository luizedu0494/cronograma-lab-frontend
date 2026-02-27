import React, { useState, useEffect } from 'react';
import { db } from '../firebaseConfig';
import { collection, query, orderBy, limit, getDocs } from 'firebase/firestore';
import {
    Card, CardContent, Typography, Box, CircularProgress, Alert,
    Divider, Button, Chip, Tabs, Tab
} from '@mui/material';
import { useTheme } from '@mui/material/styles';
import { useNavigate } from 'react-router-dom';
import { Clock, BookOpen, Users, FlaskConical } from 'lucide-react';
import dayjs from 'dayjs';
import 'dayjs/locale/pt-br';

dayjs.locale('pt-br');

const UltimasAulasCard = () => {
    const theme = useTheme();
    const navigate = useNavigate();
    const [aulasNormais, setAulasNormais] = useState([]);
    const [revisoes, setRevisoes] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [tab, setTab] = useState(0);

    useEffect(() => {
        const fetch = async () => {
            try {
                setLoading(true);
                const q = query(collection(db, 'aulas'), orderBy('createdAt', 'desc'), limit(30));
                const snap = await getDocs(q);
                const all = snap.docs.map(doc => ({
                    id: doc.id, ...doc.data(),
                    createdAt: doc.data().createdAt?.toDate() || new Date(),
                    dataInicio: doc.data().dataInicio?.toDate() || null
                }));
                setAulasNormais(all.filter(a => !a.isRevisao).slice(0, 5));
                setRevisoes(all.filter(a => a.isRevisao === true).slice(0, 5));
                setError(null);
            } catch (err) {
                setError("Erro ao carregar as últimas aulas.");
            } finally {
                setLoading(false);
            }
        };
        fetch();
    }, []);

    const getStatusChip = (status) => {
        const map = { aprovada: ['success','Aprovada'], pendente: ['warning','Pendente'], rejeitada: ['error','Rejeitada'] };
        const [color, label] = map[status] || ['default', status || 'Indefinido'];
        return <Chip label={label} color={color} size="small" variant="outlined" sx={{ height: 20, fontSize: '0.65rem' }} />;
    };

    const formatarCursos = (aula) => {
        const c = aula.cursos || aula.curso;
        if (Array.isArray(c) && c.length > 0) return c.join(', ');
        if (typeof c === 'string' && c.trim()) return c;
        return 'Curso não especificado';
    };

    const renderList = (items, isRevisao) => {
        if (!items.length) return (
            <Typography variant="body2" color="text.secondary" textAlign="center" py={3}>
                {isRevisao ? 'Nenhuma revisão adicionada.' : 'Nenhuma aula adicionada.'}
            </Typography>
        );
        return items.map((aula, i) => (
            <React.Fragment key={aula.id}>
                {i > 0 && <Divider />}
                <Box sx={{ py: 1.5 }}>
                    <Box display="flex" justifyContent="space-between" width="100%" mb={0.4}>
                        <Box display="flex" alignItems="center" gap={0.5}>
                            <Typography variant="caption">{isRevisao ? '📖' : '🎓'}</Typography>
                            <Typography variant="subtitle2" fontWeight="bold" sx={{ color: theme.palette.primary.main }}>
                                {aula.disciplina || aula.assunto || 'Sem nome'}
                            </Typography>
                        </Box>
                        {getStatusChip(aula.status)}
                    </Box>
                    {isRevisao && aula.tipoRevisaoLabel && (
                        <Chip label={aula.tipoRevisaoLabel} size="small" color="secondary" sx={{ mb: 0.4, height: 18, fontSize: '0.65rem' }} />
                    )}
                    <Box display="flex" alignItems="center" mb={0.3}>
                        <Users size={13} style={{ marginRight: 4, color: theme.palette.text.secondary }} />
                        <Typography variant="caption">{formatarCursos(aula)}{aula.dataInicio ? ` - ${dayjs(aula.dataInicio).year()}` : ''}</Typography>
                    </Box>
                    <Box display="flex" alignItems="center" mb={0.3}>
                        <FlaskConical size={13} style={{ marginRight: 4, color: theme.palette.text.secondary }} />
                        <Typography variant="caption" color="text.secondary">{aula.laboratorioSelecionado || aula.laboratorio || 'Lab não definido'}</Typography>
                    </Box>
                    <Box display="flex" alignItems="center" gap={0.5} flexWrap="wrap">
                        <Clock size={13} style={{ color: theme.palette.text.secondary }} />
                        <Typography variant="caption" color="text.secondary">
                            Adicionada em: {dayjs(aula.createdAt).format('DD/MM/YYYY [às] HH:mm')}
                        </Typography>
                        {aula.propostoPorNome && (
                            <Typography variant="caption" color="text.secondary" sx={{ ml: 'auto', fontStyle: 'italic' }}>
                                Por: {aula.propostoPorNome}
                            </Typography>
                        )}
                    </Box>
                </Box>
            </React.Fragment>
        ));
    };

    return (
        <Card elevation={3} sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
            <CardContent sx={{ flexGrow: 1, p: 2, pb: 0 }}>
                <Box display="flex" alignItems="center" mb={1}>
                    <BookOpen size={22} style={{ marginRight: 8, color: theme.palette.primary.main }} />
                    <Typography variant="h6" fontWeight="bold">Últimas Adicionadas</Typography>
                </Box>
                <Tabs value={tab} onChange={(_, v) => setTab(v)} textColor="primary" indicatorColor="primary"
                    sx={{ mb: 1, minHeight: 34, '& .MuiTab-root': { minHeight: 34, fontSize: '0.75rem', py: 0 } }}>
                    <Tab label={`🎓 Aulas (${aulasNormais.length})`} />
                    <Tab label={`📖 Revisões (${revisoes.length})`} />
                </Tabs>
                {loading ? (
                    <Box display="flex" justifyContent="center" py={3}><CircularProgress size={22} /></Box>
                ) : error ? (
                    <Alert severity="error">{error}</Alert>
                ) : (
                    <Box>
                        {tab === 0 && renderList(aulasNormais, false)}
                        {tab === 1 && renderList(revisoes, true)}
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

export default UltimasAulasCard;
