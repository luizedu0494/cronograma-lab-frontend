import React, { useState, useEffect, useCallback } from 'react';
import dayjs from 'dayjs';
import { db } from './firebaseConfig';
import { collection, query, where, getDocs, doc, getDoc, setDoc, onSnapshot } from 'firebase/firestore';
import {
    Container, Grid, Paper, Typography, Box, CircularProgress, Alert, Button,
    FormControlLabel, Switch, Dialog, DialogContent, IconButton, Badge,
    Card, CardActionArea
} from '@mui/material';
import { useTheme } from '@mui/material/styles';
import CloseIcon from '@mui/icons-material/Close';
import { useNavigate } from 'react-router-dom';

// Ícones Lucide-React
import { CalendarCheck, Clock, FileText, Bell, UserCheck } from 'lucide-react';

// Imagens
import calendarioAcademico from './assets/images/destaque-calendario.jpg';

// Componentes
import UltimasAulasCard from './components/UltimasAulasCard';
import UltimasExclusoesCard from './components/UltimasExclusoesCard';

// NOVO: Importa o componente de monitoramento de uso


const PaginaInicial = ({ userInfo }) => {

    const theme = useTheme();
    const navigate = useNavigate();

    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    // Dados do Dashboard
    const [aulasHoje, setAulasHoje] = useState(0);
    const [propostasPendentes, setPropostasPendentes] = useState(0);
    const [totalAulasNoCronograma, setTotalAulasNoCronograma] = useState(0);
    const [minhasPropostasCount, setMinhasPropostasCount] = useState(0);
    const [avisosNaoLidos, setAvisosNaoLidos] = useState(0);

    // Configuração do Calendário Acadêmico
    const [isCalendarEnabled, setIsCalendarEnabled] = useState(false);
    const [isModalOpen, setIsModalOpen] = useState(false);

    // Estado para o aviso de boas-vindas
    const [showWelcomeAlert, setShowWelcomeAlert] = useState(true);

    // useEffect separado para a contagem de avisos, usando a melhor abordagem possível no Plano Spark
    useEffect(() => {
        if (!userInfo?.uid) return;

        const avisosRef = collection(db, 'avisos');
        // Escuta em tempo real as mudanças na coleção de avisos
        const unsubscribe = onSnapshot(avisosRef, async (avisosSnapshot) => {
            // Pega o ID de todos os avisos
            const todosAvisosIds = avisosSnapshot.docs.map(doc => doc.id);

            if (todosAvisosIds.length === 0) {
                setAvisosNaoLidos(0);
                return;
            }

            // Cria um array de Promises, onde cada promise é uma verificação de leitura (getDoc)
            const leituraPromises = todosAvisosIds.map(avisoId => {
                const leituraDocRef = doc(db, 'avisos', avisoId, 'leituras', userInfo.uid);
                return getDoc(leituraDocRef);
            });

            // Executa todas as verificações em paralelo para otimizar o tempo de resposta
            const leituraDocs = await Promise.all(leituraPromises);

            // Conta quantos documentos de leitura NÃO existem
            const unreadCount = leituraDocs.filter(snap => !snap.exists()).length;
            
            setAvisosNaoLidos(unreadCount);
        });

        // Limpa o listener quando o componente é desmontado para evitar vazamentos de memória
        return () => unsubscribe();
    }, [userInfo]);


    // Função para buscar os dados principais do dashboard
    const fetchData = useCallback(async () => {
        setError(null);
        try {
            const today = dayjs().startOf('day');
            const tomorrow = dayjs().add(1, 'day').startOf('day');
            const aulasRef = collection(db, 'aulas');
            const configDocRef = doc(db, 'config', 'geral');

            const qAulasHoje = query(
                aulasRef,
                where('status', '==', 'aprovada'),
                where('dataInicio', '>=', today.toDate()),
                where('dataInicio', '<', tomorrow.toDate())
            );

            const promises = [getDocs(qAulasHoje), getDoc(configDocRef)];

	            if (userInfo?.role === 'coordenador') {
	                // Modificado para contar TODAS as aulas no cronograma (aprovadas, pendentes, etc.)
	                promises.push(getDocs(aulasRef)); 
	                promises.push(getDocs(query(aulasRef, where('status', '==', 'pendente'))));
	            }

            if (userInfo?.role === 'tecnico') {
                promises.push(getDocs(query(aulasRef, where('propostoPorUid', '==', userInfo.uid))));
            }

            const results = await Promise.all(promises);
            
            setAulasHoje(results[0].size);
            const configDoc = results[1];
            if (configDoc.exists()) {
                setIsCalendarEnabled(configDoc.data().isCalendarEnabled || false);
            }

	            let promiseIndex = 2;
	            if (userInfo?.role === 'coordenador') {
	                setTotalAulasNoCronograma(results[promiseIndex].size);
	                setPropostasPendentes(results[promiseIndex + 1].size);
	                promiseIndex += 2;
	            }
            if (userInfo?.role === 'tecnico') {
                setMinhasPropostasCount(results[promiseIndex].size);
            }

        } catch (err) {
            console.error("Erro ao buscar dados da Pagina Inicial:", err);
            setError("Erro ao carregar os dados. Por favor, tente novamente.");
        } finally {
            setLoading(false);
        }
    }, [userInfo]);

    useEffect(() => {
        setLoading(true);
        if (userInfo) {
            fetchData();
        } else {
            setLoading(false); // Garante que o loading pare se não houver usuário
        }
    }, [fetchData, userInfo]);

    const handleUpdateCalendarStatus = async (event) => {
        const newStatus = event.target.checked;
        try {
            const configDocRef = doc(db, 'config', 'geral');
            await setDoc(configDocRef, { isCalendarEnabled: newStatus }, { merge: true });
            setIsCalendarEnabled(newStatus);
            alert("Status do calendário atualizado com sucesso!");
        } catch (error) {
            console.error("Erro ao atualizar o status do calendário:", error);
            alert("Erro ao atualizar o status do calendário.");
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

    return (
        <Container maxWidth="lg" sx={{ mt: 4, mb: 4 }}>
            

            {showWelcomeAlert && userInfo && (
                <Alert
                    severity={userInfo.approvalPending ? "warning" : "info"}
                    onClose={() => setShowWelcomeAlert(false)}
                    sx={{ mb: 3, mt: userInfo?.role !== 'coordenador' ? 0 : 3 }} // Ajusta a margem superior se o monitor estiver presente
                >
                    Bem-vindo(a), <Typography component="span" fontWeight="bold">{userInfo.name || 'Usuário'}</Typography>!
                  {userInfo.approvalPending && " Sua conta está aguardando aprovação."}
                </Alert>
            )}


            
            <Typography variant="h5" component="h1" gutterBottom>Dashboard Principal</Typography>
            <Typography variant="subtitle1" gutterBottom color="text.secondary">Visão Geral do Sistema</Typography>

            <Grid container spacing={3} sx={{ mt: 1 }}>
                <Grid item xs={12} sm={6} md={4}>
                    <Card elevation={3} sx={{ p: 3, display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center' }}>
                        <Box sx={{ color: theme.palette.info.main, mb: 1 }}><Clock size={48} /></Box>
                        <Typography variant="h4" component="p" sx={{ fontWeight: 'bold' }}>{aulasHoje}</Typography>
                        <Typography color="text.secondary">Aulas Agendadas para Hoje</Typography>
                        <Button size="small" variant="text" sx={{ mt: 1 }} onClick={() => navigate('/calendario', { state: { initialDate: dayjs().toISOString() } })}>Ver no Calendário</Button>
                    </Card>
                </Grid>

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
	                                <Typography color="text.secondary">Total de Aulas no Cronograma</Typography>
                                <Button size="small" variant="text" sx={{ mt: 1 }} onClick={() => navigate('/analise-aulas')}>Ver Análise</Button>
                            </Card>
                        </Grid>
                    </>
                )}

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

                {!userInfo?.approvalPending && (
                    <Grid item xs={12} md={6} lg={4}>
                        <UltimasAulasCard />
                    </Grid>
                )}
                
                {!userInfo?.approvalPending && (
                    <Grid item xs={12} md={6} lg={4}>
                        <UltimasExclusoesCard />
                    </Grid>
                )}

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
                                    label="Habilitar visualização do calendário"
                                />
                            </Box>
                        )}
                    </Paper>
                </Grid>
            </Grid>

            <Dialog open={isModalOpen} onClose={handleCloseModal} maxWidth="lg" fullWidth>
                <DialogContent sx={{ p: 0, position: 'relative' }}>
                    <img src={calendarioAcademico} alt="Calendário Acadêmico em tela cheia" style={{ width: '100%' }} />
                    <IconButton onClick={handleCloseModal} sx={{ position: 'absolute', right: 8, top: 8, color: 'white', bgcolor: 'rgba(0,0,0,0.5)', '&:hover': { bgcolor: 'rgba(0,0,0,0.7)' } }}>
                        <CloseIcon />
                    </IconButton>
                </DialogContent>
            </Dialog>
        </Container>
    );
};

export default PaginaInicial;
