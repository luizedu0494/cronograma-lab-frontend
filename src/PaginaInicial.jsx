import React, { useState, useEffect, useCallback } from 'react';
import dayjs from 'dayjs';
import { db } from './firebaseConfig';
import { collection, query, where, getDocs, doc, getDoc, setDoc, onSnapshot } from 'firebase/firestore';
import {
    Container, Grid, Paper, Typography, Box, CircularProgress, Alert, Button,
    FormControlLabel, Switch, Dialog, DialogContent, IconButton, Badge,
    Card, CardActionArea, Divider, Chip
} from '@mui/material';
import { useTheme } from '@mui/material/styles';
import CloseIcon from '@mui/icons-material/Close';
import { useNavigate } from 'react-router-dom';

// Ícones
import { CalendarCheck, Clock, FileText, Bell, UserCheck, CalendarOff } from 'lucide-react';

// Imagens
import calendarioAcademico from './assets/images/destaque-calendario.jpeg';

// Componentes
import UltimasAulasCard from './components/UltimasAulasCard';
import UltimasExclusoesCard from './components/UltimasExclusoesCard';

// IMPORTAÇÃO DA IA (Localizada em src/AssistenteIA.jsx)
import AssistenteIA from './AssistenteIA'; 

const PaginaInicial = ({ userInfo }) => {

    const theme = useTheme();
    const navigate = useNavigate();
    const mode = theme.palette.mode; 

    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    // Dados do Dashboard (Contadores)
    const [aulasHoje, setAulasHoje] = useState(0);
    const [propostasPendentes, setPropostasPendentes] = useState(0);
    const [totalAulasNoCronograma, setTotalAulasNoCronograma] = useState(0);
    const [totalEventosNoCronograma, setTotalEventosNoCronograma] = useState(0);
    const [minhasPropostasCount, setMinhasPropostasCount] = useState(0);
    const [avisosNaoLidos, setAvisosNaoLidos] = useState(0);

    // Estados de UI
    const [isCalendarEnabled, setIsCalendarEnabled] = useState(false);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [showWelcomeAlert, setShowWelcomeAlert] = useState(true);

    // 1. Monitoramento de Avisos em Tempo Real
    useEffect(() => {
        if (!userInfo?.uid) return;

        const avisosRef = collection(db, 'avisos');
        const unsubscribe = onSnapshot(avisosRef, async (avisosSnapshot) => {
            const todosAvisosIds = avisosSnapshot.docs.map(doc => doc.id);

            if (todosAvisosIds.length === 0) {
                setAvisosNaoLidos(0);
                return;
            }

            // Verifica quais avisos o usuário já leu na subcoleção 'leituras'
            const leituraPromises = todosAvisosIds.map(avisoId => {
                const leituraDocRef = doc(db, 'avisos', avisoId, 'leituras', userInfo.uid);
                return getDoc(leituraDocRef);
            });

            const leituraDocs = await Promise.all(leituraPromises);
            const unreadCount = leituraDocs.filter(snap => !snap.exists()).length;
            
            setAvisosNaoLidos(unreadCount);
        });

        return () => unsubscribe();
    }, [userInfo]);


    // 2. Busca de Dados Estatísticos (Aulas Hoje, Totais, etc)
    const fetchData = useCallback(async () => {
        setError(null);
        try {
            const today = dayjs().startOf('day');
            const tomorrow = dayjs().add(1, 'day').startOf('day');
            const aulasRef = collection(db, 'aulas');
            const eventosRef = collection(db, 'eventosManutencao');
            const configDocRef = doc(db, 'config', 'geral');

            // Query: Aulas de hoje aprovadas
            const qAulasHoje = query(
                aulasRef,
                where('status', '==', 'aprovada'),
                where('dataInicio', '>=', today.toDate()),
                where('dataInicio', '<', tomorrow.toDate())
            );

            // Prepara promises básicas
            const promises = [getDocs(qAulasHoje), getDoc(configDocRef)];

            // Se for Coordenador, busca totais e pendentes
            if (userInfo?.role === 'coordenador') {
                promises.push(getDocs(aulasRef)); // Total geral
                promises.push(getDocs(query(aulasRef, where('status', '==', 'pendente')))); // Pendentes
                promises.push(getDocs(eventosRef)); // Total eventos
            }

            // Se for Técnico, busca as propostas dele
            if (userInfo?.role === 'tecnico') {
                promises.push(getDocs(query(aulasRef, where('propostoPorUid', '==', userInfo.uid))));
            }

            const results = await Promise.all(promises);
            
            // Atualiza estados
            setAulasHoje(results[0].size);
            
            const configDoc = results[1];
            if (configDoc.exists()) {
                setIsCalendarEnabled(configDoc.data().isCalendarEnabled || false);
            }

            let promiseIndex = 2;
            if (userInfo?.role === 'coordenador') {
                setTotalAulasNoCronograma(results[promiseIndex].size);
                setPropostasPendentes(results[promiseIndex + 1].size);
                setTotalEventosNoCronograma(results[promiseIndex + 2].size);
                promiseIndex += 3;
            }
            if (userInfo?.role === 'tecnico') {
                setMinhasPropostasCount(results[promiseIndex].size);
            }

        } catch (err) {
            console.error("Erro ao buscar dados da Pagina Inicial:", err);
            setError("Erro ao carregar os dados do painel.");
        } finally {
            setLoading(false);
        }
    }, [userInfo]);

    useEffect(() => {
        setLoading(true);
        if (userInfo) {
            fetchData();
        } else {
            setLoading(false);
        }
    }, [fetchData, userInfo]);

    // Função para Coordenador ligar/desligar calendário para alunos
    const handleUpdateCalendarStatus = async (event) => {
        const newStatus = event.target.checked;
        try {
            const configDocRef = doc(db, 'config', 'geral');
            await setDoc(configDocRef, { isCalendarEnabled: newStatus }, { merge: true });
            setIsCalendarEnabled(newStatus);
            alert("Status do calendário atualizado com sucesso!");
        } catch (error) {
            console.error("Erro:", error);
            alert("Erro ao atualizar o status.");
        }
    };

    const handleImageClick = () => setIsModalOpen(true);
    const handleCloseModal = () => setIsModalOpen(false);

    if (loading) {
        return <Box sx={{ display: 'flex', justifyContent: 'center', mt: 4 }}><CircularProgress /></Box>;
    }

    if (error) {
        return <Box sx={{ mt: 4 }}><Alert severity="error">{error}</Alert></Box>;
    }

    // Permissão para ver a IA: Coordenador ou Técnico
    const canUseAI = userInfo?.role === 'coordenador' || userInfo?.role === 'tecnico';

    return (
        <Container maxWidth="lg" sx={{ mt: 4, mb: 4 }}>
            
            {/* ALERTA DE BOAS-VINDAS */}
            {showWelcomeAlert && userInfo && (
                <Alert
                    severity={userInfo.approvalPending ? "warning" : "info"}
                    onClose={() => setShowWelcomeAlert(false)}
                    sx={{ mb: 3 }}
                >
                    Bem-vindo(a), <Typography component="span" fontWeight="bold">{userInfo.name || 'Usuário'}</Typography>!
                  {userInfo.approvalPending && " Sua conta está aguardando aprovação."}
                </Alert>
            )}

            {/* --- INTEGRAÇÃO DO ASSISTENTE IA (NO TOPO) --- */}
            {canUseAI && (
                <Box sx={{ mb: 4 }}>
                    <AssistenteIA 
                        userInfo={userInfo} 
                        currentUser={userInfo} 
                        mode={mode} 
                    />
                    <Divider sx={{ mt: 2, mb: 2 }}>
                        <Chip label="DASHBOARD GERAL" size="small" sx={{ fontWeight: 'bold', fontSize: '0.7rem' }} />
                    </Divider>
                </Box>
            )}
            {/* --------------------------------------------- */}

            <Typography variant="h5" component="h1" gutterBottom>Dashboard Principal</Typography>

            <Grid container spacing={3} sx={{ mt: 1 }}>
                
                {/* CARD 1: AULAS HOJE (Todos veem) */}
                <Grid item xs={12} sm={6} md={4}>
                    <Card elevation={3} sx={{ p: 3, display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center' }}>
                        <Box sx={{ color: theme.palette.info.main, mb: 1 }}><Clock size={48} /></Box>
                        <Typography variant="h4" component="p" sx={{ fontWeight: 'bold' }}>{aulasHoje}</Typography>
                        <Typography color="text.secondary">Aulas Agendadas para Hoje</Typography>
                        <Button size="small" variant="text" sx={{ mt: 1 }} onClick={() => navigate('/calendario', { state: { initialDate: dayjs().toISOString() } })}>Ver no Calendário</Button>
                    </Card>
                </Grid>

                {/* CARDS DE COORDENADOR */}
                {userInfo?.role === 'coordenador' && (
                    <>
                        <Grid item xs={12} sm={6} md={4}>
                            <Card elevation={3} sx={{ p: 3, display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center' }}>
                                <Box sx={{ color: theme.palette.warning.main, mb: 1 }}><FileText size={48} /></Box>
                                <Typography variant="h4" component="p" sx={{ fontWeight: 'bold' }}>{propostasPendentes}</Typography>
                                <Typography color="text.secondary">Propostas Pendentes</Typography>
                                <Button size="small" variant="text" sx={{ mt: 1 }} onClick={() => navigate('/gerenciar-aprovacoes')}>Revisar Propostas</Button>
                            </Card>
                        </Grid>
                        <Grid item xs={12} sm={6} md={4}>
                            <Card elevation={3} sx={{ p: 3, display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center' }}>
                                <Box sx={{ color: theme.palette.success.main, mb: 1 }}><CalendarCheck size={48} /></Box>
                                <Typography variant="h4" component="p" sx={{ fontWeight: 'bold' }}>{totalAulasNoCronograma}</Typography>
                                <Typography color="text.secondary">Total de Aulas</Typography>
                                <Button size="small" variant="text" sx={{ mt: 1 }} onClick={() => navigate('/analise-aulas')}>Ver Análise</Button>
                            </Card>
                        </Grid>
                        <Grid item xs={12} sm={6} md={4}>
                            <Card elevation={3} sx={{ p: 3, display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center' }}>
                                <Box sx={{ color: theme.palette.secondary.main, mb: 1 }}><CalendarOff size={48} /></Box>
                                <Typography variant="h4" component="p" sx={{ fontWeight: 'bold' }}>{totalEventosNoCronograma}</Typography>
                                <Typography color="text.secondary">Total de Eventos</Typography>
                                <Button size="small" variant="text" sx={{ mt: 1 }} onClick={() => navigate('/analise-eventos')}>Ver Análise</Button>
                            </Card>
                        </Grid>
                    </>
                )}

                {/* CARD DE TÉCNICO */}
                {userInfo?.role === 'tecnico' && (
                    <Grid item xs={12} sm={6} md={4}>
                        <Card elevation={3} sx={{ p: 3, display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center' }}>
                            <Box sx={{ color: theme.palette.primary.main, mb: 1 }}><UserCheck size={48} /></Box>
                            <Typography variant="h4" component="p" sx={{ fontWeight: 'bold' }}>{minhasPropostasCount}</Typography>
                            <Typography color="text.secondary">Minhas Propostas</Typography>
                            <Button size="small" variant="text" sx={{ mt: 1 }} onClick={() => navigate('/minhas-propostas')}>Ver Minhas Propostas</Button>
                        </Card>
                    </Grid>
                )}

                {/* CARD DE AVISOS (Se aprovado) */}
                {!userInfo?.approvalPending && (
                    <Grid item xs={12} sm={6} md={4}>
                        <Card elevation={3} sx={{ p: 3, display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center' }}>
                            <Box sx={{ color: theme.palette.error.main, mb: 1 }}>
                                <Badge badgeContent={avisosNaoLidos} color="error" overlap="circular" max={99}><Bell size={48} /></Badge>
                            </Box>
                            <Typography variant="h4" component="p" sx={{ fontWeight: 'bold' }}>{avisosNaoLidos}</Typography>
                            <Typography color="text.secondary">Avisos não Lidos</Typography>
                            <Button size="small" variant="text" sx={{ mt: 1 }} onClick={() => navigate('/avisos')}>Ver Avisos</Button>
                        </Card>
                    </Grid>
                )}

                {/* CARDS DE ATIVIDADE RECENTE (Listas) */}
                {!userInfo?.approvalPending && (
                    <>
                        <Grid item xs={12} md={6} lg={4}>
                            <UltimasAulasCard />
                        </Grid>
                        
                        <Grid item xs={12} md={6} lg={4}>
                            <UltimasExclusoesCard />
                        </Grid>
                    </>
                )}

                {/* CALENDÁRIO ACADÊMICO (Imagem) */}
                <Grid item xs={12}>
                    <Paper elevation={2} sx={{ p: 2, mt: 2 }}>
                        <Typography variant="h6" gutterBottom>Calendário Acadêmico</Typography>
                        <CardActionArea onClick={handleImageClick} sx={{ mt: 1, borderRadius: 1, overflow: 'hidden' }}>
                            <img src={calendarioAcademico} alt="Calendário Acadêmico" style={{ width: '100%', display: 'block' }} />
                        </CardActionArea>
                        {userInfo?.role === 'coordenador' && (
                            <Box sx={{ mt: 2, pt: 2, borderTop: 1, borderColor: 'divider' }}>
                                <FormControlLabel
                                    control={<Switch checked={isCalendarEnabled} onChange={handleUpdateCalendarStatus} />}
                                    label="Habilitar visualização do calendário para todos"
                                />
                            </Box>
                        )}
                    </Paper>
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