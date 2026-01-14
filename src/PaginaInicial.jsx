import React, { useState, useEffect, useCallback } from 'react';
import dayjs from 'dayjs';
import { db } from './firebaseConfig';
import { collection, query, where, getDocs, doc, getDoc, setDoc, onSnapshot, orderBy, limit } from 'firebase/firestore';
import {
    Container, Grid, Paper, Typography, Box, CircularProgress, Alert, Button,
    FormControlLabel, Switch, Dialog, DialogContent, IconButton, Badge,
    Card, CardActionArea, Divider, Chip, List, ListItem, ListItemText
} from '@mui/material';
import { useTheme } from '@mui/material/styles';
import CloseIcon from '@mui/icons-material/Close';
import { useNavigate } from 'react-router-dom';

// Ícones
import { CalendarCheck, Clock, FileText, Bell, UserCheck, CalendarOff, PlusCircle, Trash2 } from 'lucide-react';

// Imagens
import calendarioAcademico from './assets/images/destaque-calendario.jpeg';

// Componentes
import UltimasAulasCard from './components/UltimasAulasCard';
import UltimasExclusoesCard from './components/UltimasExclusoesCard';
import AssistenteIA from './AssistenteIA'; 

const PaginaInicial = ({ userInfo }) => {

    const theme = useTheme();
    const navigate = useNavigate();
    const mode = theme.palette.mode; 

    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    // Contadores
    const [aulasHoje, setAulasHoje] = useState(0);
    const [propostasPendentes, setPropostasPendentes] = useState(0);
    const [totalAulasNoCronograma, setTotalAulasNoCronograma] = useState(0);
    const [totalEventosNoCronograma, setTotalEventosNoCronograma] = useState(0);
    const [minhasPropostasCount, setMinhasPropostasCount] = useState(0);
    const [avisosNaoLidos, setAvisosNaoLidos] = useState(0);

    // Listas Recentes de Eventos
    const [ultimosEventos, setUltimosEventos] = useState([]);
    const [ultimosEventosExcluidos, setUltimosEventosExcluidos] = useState([]);

    const [isCalendarEnabled, setIsCalendarEnabled] = useState(false);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [showWelcomeAlert, setShowWelcomeAlert] = useState(true);

    const currentYear = dayjs().year();

    // Monitoramento de Avisos
    useEffect(() => {
        if (!userInfo?.uid) return;
        const avisosRef = collection(db, 'avisos');
        const unsubscribe = onSnapshot(avisosRef, async (avisosSnapshot) => {
            const todosAvisosIds = avisosSnapshot.docs.map(doc => doc.id);
            if (todosAvisosIds.length === 0) { setAvisosNaoLidos(0); return; }
            const leituraPromises = todosAvisosIds.map(avisoId => getDoc(doc(db, 'avisos', avisoId, 'leituras', userInfo.uid)));
            const leituraDocs = await Promise.all(leituraPromises);
            setAvisosNaoLidos(leituraDocs.filter(snap => !snap.exists()).length);
        });
        return () => unsubscribe();
    }, [userInfo]);

    const fetchData = useCallback(async () => {
        setError(null);
        try {
            const today = dayjs().startOf('day');
            const tomorrow = dayjs().add(1, 'day').startOf('day');
            const startOfYear = dayjs().startOf('year').toDate();
            const endOfYear = dayjs().endOf('year').toDate();

            const aulasRef = collection(db, 'aulas');
            const eventosRef = collection(db, 'eventosManutencao');
            const logsRef = collection(db, 'logs');
            const configDocRef = doc(db, 'config', 'geral');

            const qAulasHoje = query(aulasRef, where('status', '==', 'aprovada'), where('dataInicio', '>=', today.toDate()), where('dataInicio', '<', tomorrow.toDate()));
            
            const promises = [getDocs(qAulasHoje), getDoc(configDocRef)];

            if (userInfo?.role === 'coordenador') {
                promises.push(getDocs(query(aulasRef, where('dataInicio', '>=', startOfYear), where('dataInicio', '<=', endOfYear)))); 
                promises.push(getDocs(query(aulasRef, where('status', '==', 'pendente')))); 
                promises.push(getDocs(query(eventosRef, where('dataInicio', '>=', startOfYear), where('dataInicio', '<=', endOfYear))));
                
                // Buscar Últimos 5 Eventos Adicionados (Limitado a 5 para caber melhor)
                promises.push(getDocs(query(eventosRef, orderBy('createdAt', 'desc'), limit(5))));
                // Buscar Últimos 5 Eventos Excluídos
                promises.push(getDocs(query(logsRef, where('type', '==', 'exclusao'), where('collection', '==', 'eventos'), orderBy('timestamp', 'desc'), limit(5))));
            }

            if (userInfo?.role === 'tecnico') {
                promises.push(getDocs(query(aulasRef, where('propostoPorUid', '==', userInfo.uid))));
            }

            const results = await Promise.all(promises);
            
            setAulasHoje(results[0].size);
            const configDoc = results[1];
            if (configDoc.exists()) setIsCalendarEnabled(configDoc.data().isCalendarEnabled || false);

            let idx = 2;
            if (userInfo?.role === 'coordenador') {
                setTotalAulasNoCronograma(results[idx].size);
                setPropostasPendentes(results[idx + 1].size);
                setTotalEventosNoCronograma(results[idx + 2].size);
                
                const eventosRecentes = results[idx + 3].docs.map(doc => ({ id: doc.id, ...doc.data() }));
                setUltimosEventos(eventosRecentes);

                const exclusoesEventos = results[idx + 4].docs.map(doc => ({ id: doc.id, ...doc.data() }));
                setUltimosEventosExcluidos(exclusoesEventos);

                idx += 5;
            }
            if (userInfo?.role === 'tecnico') {
                setMinhasPropostasCount(results[idx].size);
            }

        } catch (err) {
            console.error("Erro ao buscar dados:", err);
            setError("Erro ao carregar dados.");
        } finally {
            setLoading(false);
        }
    }, [userInfo]);

    useEffect(() => {
        setLoading(true);
        if (userInfo) fetchData();
        else setLoading(false);
    }, [fetchData, userInfo]);

    const handleUpdateCalendarStatus = async (event) => {
        try {
            await setDoc(doc(db, 'config', 'geral'), { isCalendarEnabled: event.target.checked }, { merge: true });
            setIsCalendarEnabled(event.target.checked);
            alert("Status atualizado!");
        } catch (error) { alert("Erro ao atualizar."); }
    };

    const handleImageClick = () => setIsModalOpen(true);
    const handleCloseModal = () => setIsModalOpen(false);

    if (loading) return <Box sx={{ display: 'flex', justifyContent: 'center', mt: 4 }}><CircularProgress /></Box>;
    if (error) return <Box sx={{ mt: 4 }}><Alert severity="error">{error}</Alert></Box>;

    const canUseAI = userInfo?.role === 'coordenador' || userInfo?.role === 'tecnico';

    return (
        <Container maxWidth="xl" sx={{ mt: 4, mb: 4 }}>
            {showWelcomeAlert && userInfo && (
                <Alert severity={userInfo.approvalPending ? "warning" : "info"} onClose={() => setShowWelcomeAlert(false)} sx={{ mb: 3 }}>
                    Bem-vindo(a), <Typography component="span" fontWeight="bold">{userInfo.name || 'Usuário'}</Typography>!
                </Alert>
            )}

            {/* --- BLOCO SUPERIOR: IA --- */}
            {canUseAI && (
                <Box sx={{ mb: 4 }}>
                    <AssistenteIA userInfo={userInfo} currentUser={userInfo} mode={mode} />
                    <Divider sx={{ mt: 2, mb: 2 }}><Chip label="VISÃO GERAL" size="small" sx={{ fontWeight: 'bold', fontSize: '0.7rem' }} /></Divider>
                </Box>
            )}

            <Typography variant="h5" component="h1" gutterBottom sx={{ fontWeight: 'bold', mb: 3 }}>Dashboard Principal</Typography>

            {/* --- BLOCO 1: KPIs (INDICADORES) - LINHA ÚNICA --- */}
            <Grid container spacing={3} sx={{ mb: 4 }}>
                {/* 1. Aulas Hoje */}
                <Grid item xs={12} sm={6} md={3}>
                    <Card elevation={3} sx={{ p: 2, height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center' }}>
                        <Box sx={{ color: theme.palette.info.main, mb: 1 }}><Clock size={40} /></Box>
                        <Typography variant="h4" component="p" sx={{ fontWeight: 'bold' }}>{aulasHoje}</Typography>
                        <Typography variant="body2" color="text.secondary">Aulas Hoje</Typography>
                        <Button size="small" sx={{ mt: 'auto' }} onClick={() => navigate('/calendario', { state: { initialDate: dayjs().toISOString() } })}>Ver Calendário</Button>
                    </Card>
                </Grid>

                {userInfo?.role === 'coordenador' && (
                    <>
                        {/* 2. Pendentes */}
                        <Grid item xs={12} sm={6} md={3}>
                            <Card elevation={3} sx={{ p: 2, height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center' }}>
                                <Box sx={{ color: theme.palette.warning.main, mb: 1 }}><FileText size={40} /></Box>
                                <Typography variant="h4" component="p" sx={{ fontWeight: 'bold' }}>{propostasPendentes}</Typography>
                                <Typography variant="body2" color="text.secondary">Pendentes</Typography>
                                <Button size="small" sx={{ mt: 'auto' }} onClick={() => navigate('/gerenciar-aprovacoes')}>Revisar</Button>
                            </Card>
                        </Grid>
                        {/* 3. Total Aulas */}
                        <Grid item xs={12} sm={6} md={3}>
                            <Card elevation={3} sx={{ p: 2, height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center' }}>
                                <Box sx={{ color: theme.palette.success.main, mb: 1 }}><CalendarCheck size={40} /></Box>
                                <Typography variant="h4" component="p" sx={{ fontWeight: 'bold' }}>{totalAulasNoCronograma}</Typography>
                                <Typography variant="body2" color="text.secondary">Aulas ({currentYear})</Typography>
                                <Button size="small" sx={{ mt: 'auto' }} onClick={() => navigate('/analise-aulas')}>Análise</Button>
                            </Card>
                        </Grid>
                        {/* 4. Total Eventos */}
                        <Grid item xs={12} sm={6} md={3}>
                            <Card elevation={3} sx={{ p: 2, height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center' }}>
                                <Box sx={{ color: theme.palette.secondary.main, mb: 1 }}><CalendarOff size={40} /></Box>
                                <Typography variant="h4" component="p" sx={{ fontWeight: 'bold' }}>{totalEventosNoCronograma}</Typography>
                                <Typography variant="body2" color="text.secondary">Eventos ({currentYear})</Typography>
                                <Button size="small" sx={{ mt: 'auto' }} onClick={() => navigate('/analise-eventos')}>Análise</Button>
                            </Card>
                        </Grid>
                    </>
                )}

                {userInfo?.role === 'tecnico' && (
                    <Grid item xs={12} sm={6} md={3}>
                        <Card elevation={3} sx={{ p: 2, height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center' }}>
                            <Box sx={{ color: theme.palette.primary.main, mb: 1 }}><UserCheck size={40} /></Box>
                            <Typography variant="h4" component="p" sx={{ fontWeight: 'bold' }}>{minhasPropostasCount}</Typography>
                            <Typography variant="body2" color="text.secondary">Minhas Propostas</Typography>
                            <Button size="small" sx={{ mt: 'auto' }} onClick={() => navigate('/minhas-propostas')}>Ver Detalhes</Button>
                        </Card>
                    </Grid>
                )}
            </Grid>

            {/* --- BLOCO 2: CONTEÚDO PRINCIPAL (Sidebar + Feed) --- */}
            <Grid container spacing={3}>
                
                {/* COLUNA ESQUERDA (SIDEBAR): AVISOS + IMAGEM */}
                <Grid item xs={12} md={3}>
                    {/* Avisos */}
                    {!userInfo?.approvalPending && (
                        <Card elevation={3} sx={{ p: 2, mb: 3, textAlign: 'center' }}>
                            <Box sx={{ color: theme.palette.error.main, mb: 1 }}>
                                <Badge badgeContent={avisosNaoLidos} color="error" overlap="circular" max={99}><Bell size={40} /></Badge>
                            </Box>
                            <Typography variant="h5" component="p" sx={{ fontWeight: 'bold' }}>{avisosNaoLidos}</Typography>
                            <Typography variant="body2" color="text.secondary" gutterBottom>Avisos não Lidos</Typography>
                            <Button variant="outlined" size="small" fullWidth onClick={() => navigate('/avisos')}>Ver Avisos</Button>
                        </Card>
                    )}

                    {/* Calendário Imagem */}
                    <Paper elevation={3} sx={{ p: 2 }}>
                        <Typography variant="subtitle2" gutterBottom fontWeight="bold">Calendário Acadêmico</Typography>
                        <CardActionArea onClick={handleImageClick} sx={{ borderRadius: 1, overflow: 'hidden' }}>
                            <img src={calendarioAcademico} alt="Calendário Acadêmico" style={{ width: '100%', display: 'block', objectFit: 'cover' }} />
                        </CardActionArea>
                        {userInfo?.role === 'coordenador' && (
                            <Box sx={{ mt: 2, pt: 1, borderTop: 1, borderColor: 'divider' }}>
                                <FormControlLabel
                                    control={<Switch checked={isCalendarEnabled} onChange={handleUpdateCalendarStatus} size="small" />}
                                    label={<Typography variant="caption">Visível para alunos</Typography>}
                                />
                            </Box>
                        )}
                    </Paper>
                </Grid>

                {/* COLUNA DIREITA (FEED): LISTAS DE ATIVIDADES */}
                <Grid item xs={12} md={9}>
                    {!userInfo?.approvalPending && (
                        <Grid container spacing={3}>
                            
                            {/* LINHA 1: AULAS */}
                            <Grid item xs={12} md={6}>
                                <UltimasAulasCard />
                            </Grid>
                            <Grid item xs={12} md={6}>
                                <UltimasExclusoesCard />
                            </Grid>

                            {/* LINHA 2: EVENTOS (Apenas Coordenador) */}
                            {userInfo?.role === 'coordenador' && (
                                <>
                                    <Grid item xs={12} md={6}>
                                        <Card elevation={3} sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
                                            <Box sx={{ p: 2, display: 'flex', alignItems: 'center', gap: 1, borderBottom: 1, borderColor: 'divider' }}>
                                                <PlusCircle size={20} color={theme.palette.secondary.main} />
                                                <Typography variant="h6" fontSize="1rem" fontWeight="bold">Eventos Recentes</Typography>
                                            </Box>
                                            <List dense sx={{ flex: 1, overflow: 'auto', p: 0 }}>
                                                {ultimosEventos.length > 0 ? ultimosEventos.map((ev, index) => (
                                                    <React.Fragment key={ev.id}>
                                                        {index > 0 && <Divider />}
                                                        <ListItem>
                                                            <ListItemText 
                                                                primary={<Typography variant="subtitle2" fontWeight="bold">{ev.titulo}</Typography>}
                                                                secondary={
                                                                    <>
                                                                        <Typography variant="caption" component="span" sx={{ display: 'block', color: 'secondary.main' }}>{ev.tipo}</Typography>
                                                                        <Typography variant="caption" component="span">{dayjs(ev.dataInicio.toDate()).format('DD/MM/YYYY')} - {ev.laboratorio}</Typography>
                                                                    </>
                                                                } 
                                                            />
                                                        </ListItem>
                                                    </React.Fragment>
                                                )) : <Box p={3} textAlign="center"><Typography variant="caption" color="text.secondary">Nenhum evento recente.</Typography></Box>}
                                            </List>
                                        </Card>
                                    </Grid>

                                    <Grid item xs={12} md={6}>
                                        <Card elevation={3} sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
                                            <Box sx={{ p: 2, display: 'flex', alignItems: 'center', gap: 1, borderBottom: 1, borderColor: 'divider' }}>
                                                <Trash2 size={20} color={theme.palette.error.main} />
                                                <Typography variant="h6" fontSize="1rem" fontWeight="bold">Eventos Excluídos</Typography>
                                            </Box>
                                            <List dense sx={{ flex: 1, overflow: 'auto', p: 0 }}>
                                                {ultimosEventosExcluidos.length > 0 ? ultimosEventosExcluidos.map((log, index) => (
                                                    <React.Fragment key={log.id}>
                                                        {index > 0 && <Divider />}
                                                        <ListItem>
                                                            <ListItemText 
                                                                primary={<Typography variant="subtitle2" fontWeight="bold" color="error">{log.aula?.assunto || 'Evento sem nome'}</Typography>}
                                                                secondary={
                                                                    <>
                                                                        <Typography variant="caption" component="span" sx={{ display: 'block' }}>{log.aula?.laboratorio}</Typography>
                                                                        <Typography variant="caption">Excluído em {dayjs(log.timestamp.toDate()).format('DD/MM HH:mm')}</Typography>
                                                                    </>
                                                                } 
                                                            />
                                                        </ListItem>
                                                    </React.Fragment>
                                                )) : <Box p={3} textAlign="center"><Typography variant="caption" color="text.secondary">Nenhuma exclusão recente.</Typography></Box>}
                                            </List>
                                        </Card>
                                    </Grid>
                                </>
                            )}
                        </Grid>
                    )}
                </Grid>
            </Grid>

            {/* MODAL DE CALENDÁRIO */}
            <Dialog open={isModalOpen} onClose={handleCloseModal} maxWidth="lg" fullWidth>
                <DialogContent sx={{ p: 0, position: 'relative' }}>
                    <img src={calendarioAcademico} alt="Calendário Acadêmico em tela cheia" style={{ width: '100%' }} />
                    <IconButton onClick={handleCloseModal} sx={{ position: 'absolute', right: 8, top: 8, color: 'white', bgcolor: 'rgba(0,0,0,0.5)' }}>
                        <CloseIcon />
                    </IconButton>
                </DialogContent>
            </Dialog>
        </Container>
    );
};

export default PaginaInicial;