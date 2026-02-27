import React, { useState, useEffect, useCallback } from 'react';
import dayjs from 'dayjs';
import { db } from './firebaseConfig';
import { collection, query, where, getDocs, doc, getDoc, setDoc, onSnapshot, orderBy, limit, Timestamp } from 'firebase/firestore';
import {
    Container, Grid, Paper, Typography, Box, CircularProgress, Alert, Button,
    FormControlLabel, Switch, Dialog, DialogContent, DialogTitle, DialogActions,
    IconButton, Badge, Tooltip, Checkbox, FormGroup,
    Card, CardActionArea, Divider, Chip, List, ListItem, ListItemText,
    Accordion, AccordionSummary, AccordionDetails, Tab, Tabs
} from '@mui/material';
import { useTheme } from '@mui/material/styles';
import { 
    Close as CloseIcon, ExpandMore as ExpandMoreIcon, 
    CalendarMonth as CalendarIcon,
    Settings as SettingsIcon,
    FilterList as FilterListIcon
} from '@mui/icons-material'; // Ícones MUI padrão para componentes visuais
import { 
    Clock, FileText, Bell, UserCheck, CalendarOff, 
    PlusCircle, Trash2, CalendarCheck, LayoutDashboard, BookOpen
} from 'lucide-react'; // Ícones Lucide para os cards
import { useNavigate } from 'react-router-dom';

// Constantes
import { LISTA_LABORATORIOS, TIPOS_LABORATORIO } from './constants/laboratorios';
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

    // Estados de Dados
    const [aulasHoje, setAulasHoje] = useState(0);
    const [revisoesHoje, setRevisoesHoje] = useState(0);
    const [propostasPendentes, setPropostasPendentes] = useState(0);
    const [totalAulasNoCronograma, setTotalAulasNoCronograma] = useState(0);
    const [totalRevisoesNoCronograma, setTotalRevisoesNoCronograma] = useState(0);
    const [totalEventosNoCronograma, setTotalEventosNoCronograma] = useState(0);
    const [minhasPropostasCount, setMinhasPropostasCount] = useState(0);
    const [avisosNaoLidos, setAvisosNaoLidos] = useState(0);
    const [ultimosEventos, setUltimosEventos] = useState([]);
    const [ultimosEventosExcluidos, setUltimosEventosExcluidos] = useState([]);
    const [revisoesTecnicoHoje, setRevisoesTecnicoHoje] = useState([]);
    const [aulasOficiaisHoje, setAulasOficiaisHoje] = useState([]);
    const [revisoesOficiaisHoje, setRevisoesOficiaisHoje] = useState([]);

    // Estados de UI
    const [isCalendarEnabled, setIsCalendarEnabled] = useState(false);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [showWelcomeAlert, setShowWelcomeAlert] = useState(true);
    const [tabValue, setTabValue] = useState(0); // Controle das Abas (0 = Aulas, 1 = Eventos)

    // Filtro de laboratórios favoritos do técnico (salvo no localStorage por usuário)
    const storageKey = userInfo?.uid ? `labsFavoritos_${userInfo.uid}` : null;
    const [labsFavoritos, setLabsFavoritos] = useState(() => {
        if (!storageKey) return [];
        try {
            const saved = localStorage.getItem(storageKey);
            return saved ? JSON.parse(saved) : [];
        } catch { return []; }
    });
    const [isLabFilterOpen, setIsLabFilterOpen] = useState(false);

    const currentYear = dayjs().year();

    // --- EFEITOS E BUSCA DE DADOS (Mantidos iguais à lógica anterior) ---
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

            // Busca todas as aulas aprovadas de hoje — filtramos isRevisao no frontend
            // (Firestore não permite desigualdade em dois campos diferentes)
            const qAulasHoje = query(aulasRef,
                where('status', '==', 'aprovada'),
                where('dataInicio', '>=', today.toDate()),
                where('dataInicio', '<', tomorrow.toDate())
            );
            const promises = [getDocs(qAulasHoje), getDoc(configDocRef)];

            if (userInfo?.role === 'coordenador') {
                promises.push(getDocs(query(aulasRef, where('dataInicio', '>=', startOfYear), where('dataInicio', '<=', endOfYear)))); 
                promises.push(getDocs(query(aulasRef, where('status', '==', 'pendente')))); 
                promises.push(getDocs(query(eventosRef, where('dataInicio', '>=', startOfYear), where('dataInicio', '<=', endOfYear))));
                promises.push(getDocs(query(eventosRef, orderBy('createdAt', 'desc'), limit(5))));
                promises.push(getDocs(query(logsRef, where('type', '==', 'exclusao'), where('collection', '==', 'eventos'), orderBy('timestamp', 'desc'), limit(5))));
            }

            if (userInfo?.role === 'tecnico') {
                promises.push(getDocs(query(aulasRef, where('propostoPorUid', '==', userInfo.uid))));
                // Revisões de hoje
                promises.push(getDocs(query(
                    collection(db, 'revisoesTecnicos'),
                    where('data', '>=', Timestamp.fromDate(today.toDate())),
                    where('data', '<',  Timestamp.fromDate(tomorrow.toDate())),
                    orderBy('data', 'asc')
                )));
            }

            const results = await Promise.all(promises);
            // Filtrar isRevisao no frontend (Firestore não permite 2 desigualdades em campos diferentes)
            const aulasHojeDocs = results[0].docs.map(d => ({ id: d.id, ...d.data() }));
            setAulasHoje(aulasHojeDocs.filter(a => !a.isRevisao).length);
            setRevisoesHoje(aulasHojeDocs.filter(a => a.isRevisao === true).length);
            setAulasOficiaisHoje(aulasHojeDocs.filter(a => !a.isRevisao));
            setRevisoesOficiaisHoje(aulasHojeDocs.filter(a => a.isRevisao === true));

            const configDoc = results[1];
            if (configDoc.exists()) setIsCalendarEnabled(configDoc.data().isCalendarEnabled || false);

            let idx = 2;
            if (userInfo?.role === 'coordenador') {
                const todasAulasAno = results[idx].docs.map(d => d.data());
                setTotalAulasNoCronograma(todasAulasAno.filter(a => !a.isRevisao).length);
                setTotalRevisoesNoCronograma(todasAulasAno.filter(a => a.isRevisao === true).length);
                setPropostasPendentes(results[idx + 1].size);
                setTotalEventosNoCronograma(results[idx + 2].size);
                setUltimosEventos(results[idx + 3].docs.map(doc => ({ id: doc.id, ...doc.data() })));
                setUltimosEventosExcluidos(results[idx + 4].docs.map(doc => ({ id: doc.id, ...doc.data() })));
                idx += 5;
            }
            if (userInfo?.role === 'tecnico') {
                setMinhasPropostasCount(results[idx].size);
                const revisoesDocs = results[idx + 1]?.docs || [];
                setRevisoesTecnicoHoje(revisoesDocs.map(d => ({ id: d.id, ...d.data() })));
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
        } catch (error) { alert("Erro ao atualizar."); }
    };

    const handleTabChange = (event, newValue) => {
        setTabValue(newValue);
    };

    // Salvar labsFavoritos no localStorage sempre que mudar
    const toggleLabFavorito = (labName) => {
        const next = labsFavoritos.includes(labName)
            ? labsFavoritos.filter(l => l !== labName)
            : [...labsFavoritos, labName];
        setLabsFavoritos(next);
        if (storageKey) {
            try { localStorage.setItem(storageKey, JSON.stringify(next)); } catch {}
        }
    };

    const selecionarTodosTipo = (tipo) => {
        const labsDoTipo = LISTA_LABORATORIOS.filter(l => l.tipo === tipo).map(l => l.name);
        const todosSelecionados = labsDoTipo.every(n => labsFavoritos.includes(n));
        let next;
        if (todosSelecionados) {
            next = labsFavoritos.filter(n => !labsDoTipo.includes(n));
        } else {
            next = [...new Set([...labsFavoritos, ...labsDoTipo])];
        }
        setLabsFavoritos(next);
        if (storageKey) {
            try { localStorage.setItem(storageKey, JSON.stringify(next)); } catch {}
        }
    };

    const limparFavoritos = () => {
        setLabsFavoritos([]);
        if (storageKey) {
            try { localStorage.removeItem(storageKey); } catch {}
        }
    };

    if (loading) return <Box sx={{ display: 'flex', justifyContent: 'center', mt: 4 }}><CircularProgress /></Box>;
    if (error) return <Box sx={{ mt: 4 }}><Alert severity="error">{error}</Alert></Box>;

    const canUseAI = userInfo?.role === 'coordenador' || userInfo?.role === 'tecnico';

    // Componente de Cartão Miniatura para KPIs
    const MiniStatCard = ({ icon, value, label, onClick, color }) => (
        <Paper 
            elevation={2} 
            sx={{ 
                p: 2, 
                display: 'flex', 
                alignItems: 'center', 
                cursor: onClick ? 'pointer' : 'default',
                transition: 'transform 0.2s',
                '&:hover': onClick ? { transform: 'translateY(-2px)', boxShadow: 4 } : {}
            }}
            onClick={onClick}
        >
            <Box sx={{ 
                mr: 2, 
                p: 1, 
                borderRadius: '50%', 
                bgcolor: `${color}20`, // Cor com transparência
                color: color,
                display: 'flex'
            }}>
                {icon}
            </Box>
            <Box>
                <Typography variant="h5" fontWeight="bold" lineHeight={1}>{value}</Typography>
                <Typography variant="caption" color="text.secondary" fontWeight="medium">{label}</Typography>
            </Box>
        </Paper>
    );

    return (
        <Container maxWidth="lg" sx={{ mt: 2, mb: 4 }}>
            {/* 1. TOPO: Boas-vindas e Avisos Rápidos */}
            <Box display="flex" justifyContent="space-between" alignItems="center" mb={2} flexWrap="wrap" gap={1}>
                <Typography variant="h6" fontWeight="bold">
                    Olá, {userInfo?.name?.split(' ')[0]} 👋
                </Typography>
                {!userInfo?.approvalPending && avisosNaoLidos > 0 && (
                    <Chip 
                        icon={<Bell size={16} />} 
                        label={`${avisosNaoLidos} avisos novos`} 
                        color="error" 
                        size="small" 
                        onClick={() => navigate('/avisos')}
                        sx={{ cursor: 'pointer', fontWeight: 'bold' }}
                    />
                )}
            </Box>

            {/* 2. KPIs (Indicadores) - Visual Compacto em Grid */}
            <Grid container spacing={2} sx={{ mb: 3 }}>
                {userInfo?.role === 'coordenador' ? (
                    <>
                        <Grid item xs={6} sm={3}>
                            <MiniStatCard
                                icon={<Clock size={22} />}
                                value={aulasHoje}
                                label="🎓 Aulas Hoje"
                                color={theme.palette.info.main}
                                onClick={() => navigate('/calendario', { state: { initialDate: dayjs().toISOString() } })}
                            />
                        </Grid>
                        <Grid item xs={6} sm={3}>
                            <MiniStatCard
                                icon={<BookOpen size={22} />}
                                value={revisoesHoje}
                                label="📖 Revisões Hoje"
                                color={theme.palette.secondary.main}
                                onClick={() => navigate('/calendario', { state: { initialDate: dayjs().toISOString() } })}
                            />
                        </Grid>
                        <Grid item xs={6} sm={3}>
                            <MiniStatCard
                                icon={<CalendarCheck size={22} />}
                                value={totalAulasNoCronograma}
                                label={`🎓 Aulas ${currentYear}`}
                                color={theme.palette.success.main}
                                onClick={() => navigate('/analise-aulas')}
                            />
                        </Grid>
                        <Grid item xs={6} sm={3}>
                            <MiniStatCard
                                icon={<CalendarCheck size={22} />}
                                value={totalRevisoesNoCronograma}
                                label={`📖 Revisões ${currentYear}`}
                                color={theme.palette.warning.main}
                                onClick={() => navigate('/analise-aulas')}
                            />
                        </Grid>
                        <Grid item xs={6} sm={3}>
                            <MiniStatCard
                                icon={<FileText size={22} />}
                                value={propostasPendentes}
                                label="Pendentes"
                                color={theme.palette.error.main}
                                onClick={() => navigate('/gerenciar-aprovacoes')}
                            />
                        </Grid>
                        <Grid item xs={6} sm={3}>
                            <MiniStatCard
                                icon={<CalendarOff size={22} />}
                                value={totalEventosNoCronograma}
                                label={`Eventos ${currentYear}`}
                                color={theme.palette.primary.main}
                                onClick={() => navigate('/analise-eventos')}
                            />
                        </Grid>
                    </>
                ) : userInfo?.role === 'tecnico' ? (
                    <>
                        {/* Cronograma oficial — hoje */}
                        <Grid item xs={6} sm={3}>
                            <MiniStatCard
                                icon={<Clock size={22} />}
                                value={aulasOficiaisHoje.length}
                                label="🎓 Aulas Hoje"
                                color={theme.palette.info.main}
                                onClick={() => navigate('/calendario', { state: { initialDate: dayjs().toISOString() } })}
                            />
                        </Grid>
                        <Grid item xs={6} sm={3}>
                            <MiniStatCard
                                icon={<BookOpen size={22} />}
                                value={revisoesOficiaisHoje.length}
                                label="📋 Revisões Cronograma"
                                color={theme.palette.warning.main}
                                onClick={() => navigate('/calendario', { state: { initialDate: dayjs().toISOString() } })}
                            />
                        </Grid>
                        {/* Calendário privado do técnico */}
                        <Grid item xs={6} sm={3}>
                            <MiniStatCard
                                icon={<CalendarCheck size={22} />}
                                value={revisoesTecnicoHoje.length}
                                label="📖 Agenda Técnico Hoje"
                                color={theme.palette.secondary.main}
                                onClick={() => navigate('/revisoes')}
                            />
                        </Grid>
                        <Grid item xs={6} sm={3}>
                            <MiniStatCard
                                icon={<UserCheck size={22} />}
                                value={minhasPropostasCount}
                                label="Minhas Propostas"
                                color={theme.palette.primary.main}
                                onClick={() => navigate('/minhas-propostas')}
                            />
                        </Grid>
                    </>
                ) : (
                    <Grid item xs={6} sm={3}>
                        <MiniStatCard
                            icon={<Clock size={22} />}
                            value={aulasHoje}
                            label="Aulas Hoje"
                            color={theme.palette.info.main}
                        />
                    </Grid>
                )}
            </Grid>

            {/* 3. PAINEL DO DIA — só técnico */}
            {userInfo?.role === 'tecnico' && (
                <Grid container spacing={2} sx={{ mb: 3 }}>
                    {/* Coluna esquerda: Cronograma Oficial */}
                    <Grid item xs={12} md={6}>
                        <Paper elevation={2} sx={{ overflow: 'hidden', height: '100%' }}>
                            <Box sx={{
                                px: 2, py: 1.5,
                                bgcolor: 'info.main', color: 'white',
                                display: 'flex', alignItems: 'center', justifyContent: 'space-between'
                            }}>
                                <Box display="flex" alignItems="center" gap={1}>
                                    <Clock size={16} />
                                    <Typography variant="subtitle2" fontWeight="bold">Cronograma Oficial — Hoje</Typography>
                                    {labsFavoritos.length > 0 && (
                                        <Chip
                                            label={`${labsFavoritos.length} lab${labsFavoritos.length > 1 ? 's' : ''}`}
                                            size="small"
                                            sx={{ bgcolor: 'rgba(255,255,255,0.25)', color: 'white', height: 18, fontSize: '0.65rem', fontWeight: 'bold' }}
                                        />
                                    )}
                                </Box>
                                <Box display="flex" gap={0.5}>
                                    <Tooltip title="Filtrar laboratórios">
                                        <IconButton size="small" onClick={() => setIsLabFilterOpen(true)}
                                            sx={{ color: 'white', bgcolor: labsFavoritos.length > 0 ? 'rgba(255,255,255,0.2)' : 'transparent', '&:hover': { bgcolor: 'rgba(255,255,255,0.2)' } }}>
                                            <FilterListIcon fontSize="small" />
                                        </IconButton>
                                    </Tooltip>
                                    <Button size="small" variant="outlined"
                                        sx={{ color: 'white', borderColor: 'rgba(255,255,255,0.5)', fontSize: '0.7rem' }}
                                        onClick={() => navigate('/calendario', { state: { initialDate: dayjs().toISOString() } })}>
                                        Ver calendário
                                    </Button>
                                </Box>
                            </Box>

                            {/* Aulas normais */}
                            {(() => {
                                const aulasVisiveis = labsFavoritos.length > 0
                                    ? aulasOficiaisHoje.filter(a => labsFavoritos.includes(a.laboratorioSelecionado))
                                    : aulasOficiaisHoje;
                                if (aulasVisiveis.length === 0) return null;
                                return (
                                <>
                                    <Box sx={{ px: 2, pt: 1.5, pb: 0.5, display: 'flex', alignItems: 'center', gap: 0.8 }}>
                                        <Typography variant="caption" fontWeight="bold" color="text.secondary" sx={{ textTransform: 'uppercase', letterSpacing: 0.5 }}>
                                            🎓 Aulas ({aulasVisiveis.length}{labsFavoritos.length > 0 && aulasVisiveis.length < aulasOficiaisHoje.length ? ` de ${aulasOficiaisHoje.length}` : ''})
                                        </Typography>
                                    </Box>
                                    <List dense disablePadding>
                                        {aulasVisiveis.map((aula, i) => {
                                            const dataInicio = aula.dataInicio?.toDate ? aula.dataInicio.toDate() : new Date(aula.dataInicio);
                                            const dataFim = aula.dataFim?.toDate ? aula.dataFim.toDate() : null;
                                            const horario = dataFim
                                                ? `${dayjs(dataInicio).format('HH:mm')} - ${dayjs(dataFim).format('HH:mm')}`
                                                : dayjs(dataInicio).format('HH:mm');
                                            return (
                                                <React.Fragment key={aula.id}>
                                                    {i > 0 && <Divider />}
                                                    <ListItem sx={{ py: 1, px: 2 }}>
                                                        <ListItemText
                                                            primary={<Typography variant="body2" fontWeight="medium">{aula.assunto || 'Sem título'}</Typography>}
                                                            secondary={
                                                                <Box sx={{ display: 'flex', gap: 1, mt: 0.2, flexWrap: 'wrap' }}>
                                                                    <Typography variant="caption" color="text.secondary">🕐 {horario}</Typography>
                                                                    {aula.laboratorioSelecionado && <Typography variant="caption" color="text.secondary">🏛️ {aula.laboratorioSelecionado}</Typography>}
                                                                    {aula.professorNome && <Typography variant="caption" color="text.secondary">👨‍🏫 {aula.professorNome}</Typography>}
                                                                </Box>
                                                            }
                                                        />
                                                    </ListItem>
                                                </React.Fragment>
                                            );
                                        })}
                                    </List>
                                </>
                                );
                            })()}

                            {/* Revisões do cronograma oficial */}
                            {(() => {
                                const revisVisiveis = labsFavoritos.length > 0
                                    ? revisoesOficiaisHoje.filter(a => labsFavoritos.includes(a.laboratorioSelecionado))
                                    : revisoesOficiaisHoje;
                                if (revisVisiveis.length === 0) return null;
                                return (
                                <>
                                    <Divider />
                                    <Box sx={{ px: 2, pt: 1.5, pb: 0.5 }}>
                                        <Typography variant="caption" fontWeight="bold" color="text.secondary" sx={{ textTransform: 'uppercase', letterSpacing: 0.5 }}>
                                            📋 Revisões no Cronograma ({revisVisiveis.length}{labsFavoritos.length > 0 && revisVisiveis.length < revisoesOficiaisHoje.length ? ` de ${revisoesOficiaisHoje.length}` : ''})
                                        </Typography>
                                    </Box>
                                    <List dense disablePadding>
                                        {revisVisiveis.map((aula, i) => {
                                            const dataInicio = aula.dataInicio?.toDate ? aula.dataInicio.toDate() : new Date(aula.dataInicio);
                                            const dataFim = aula.dataFim?.toDate ? aula.dataFim.toDate() : null;
                                            const horario = dataFim
                                                ? `${dayjs(dataInicio).format('HH:mm')} - ${dayjs(dataFim).format('HH:mm')}`
                                                : dayjs(dataInicio).format('HH:mm');
                                            return (
                                                <React.Fragment key={aula.id}>
                                                    {i > 0 && <Divider />}
                                                    <ListItem sx={{ py: 1, px: 2 }}>
                                                        <ListItemText
                                                            primary={
                                                                <Box display="flex" alignItems="center" gap={0.8}>
                                                                    <Typography variant="body2" fontWeight="medium">{aula.assunto || 'Sem título'}</Typography>
                                                                    {aula.tipoRevisaoLabel && <Chip label={aula.tipoRevisaoLabel} size="small" color="secondary" sx={{ height: 18, fontSize: '0.62rem' }} />}
                                                                </Box>
                                                            }
                                                            secondary={
                                                                <Box sx={{ display: 'flex', gap: 1, mt: 0.2, flexWrap: 'wrap' }}>
                                                                    <Typography variant="caption" color="text.secondary">🕐 {horario}</Typography>
                                                                    {aula.laboratorioSelecionado && <Typography variant="caption" color="text.secondary">🏛️ {aula.laboratorioSelecionado}</Typography>}
                                                                    {aula.professorRevisao && <Typography variant="caption" color="text.secondary">👨‍🏫 {aula.professorRevisao}</Typography>}
                                                                </Box>
                                                            }
                                                        />
                                                    </ListItem>
                                                </React.Fragment>
                                            );
                                        })}
                                    </List>
                                </>
                                );
                            })()}

                            {(() => {
                                const aulasVis = labsFavoritos.length > 0 ? aulasOficiaisHoje.filter(a => labsFavoritos.includes(a.laboratorioSelecionado)) : aulasOficiaisHoje;
                                const revisVis = labsFavoritos.length > 0 ? revisoesOficiaisHoje.filter(a => labsFavoritos.includes(a.laboratorioSelecionado)) : revisoesOficiaisHoje;
                                if (aulasVis.length > 0 || revisVis.length > 0) return null;
                                return (
                                <Box sx={{ px: 2, py: 3, textAlign: 'center' }}>
                                    <Typography variant="body2" color="text.secondary">
                                        {labsFavoritos.length > 0 ? 'Nenhuma atividade nos seus laboratórios favoritos hoje.' : 'Nenhuma atividade no cronograma hoje.'}
                                    </Typography>
                                    {labsFavoritos.length > 0 && (
                                        <Button size="small" sx={{ mt: 0.5 }} startIcon={<FilterListIcon />} onClick={() => setIsLabFilterOpen(true)}>
                                            Alterar filtros
                                        </Button>
                                    )}
                                </Box>
                                );
                            })()}
                        </Paper>
                    </Grid>

                    {/* Coluna direita: Agenda Privada do Técnico */}
                    <Grid item xs={12} md={6}>
                        <Paper elevation={2} sx={{ overflow: 'hidden', height: '100%', border: '1px solid', borderColor: 'secondary.light' }}>
                            <Box sx={{
                                px: 2, py: 1.5,
                                bgcolor: 'secondary.main', color: 'white',
                                display: 'flex', alignItems: 'center', justifyContent: 'space-between'
                            }}>
                                <Box display="flex" alignItems="center" gap={1}>
                                    <BookOpen size={16} />
                                    <Typography variant="subtitle2" fontWeight="bold">Agenda do Técnico — Hoje</Typography>
                                    {revisoesTecnicoHoje.length > 0 && (
                                        <Chip label={revisoesTecnicoHoje.length} size="small"
                                            sx={{ bgcolor: 'rgba(255,255,255,0.25)', color: 'white', fontWeight: 'bold', height: 20, fontSize: '0.7rem' }} />
                                    )}
                                </Box>
                                <Button size="small" variant="outlined"
                                    sx={{ color: 'white', borderColor: 'rgba(255,255,255,0.5)', fontSize: '0.7rem' }}
                                    onClick={() => navigate('/revisoes')}>
                                    Ver agenda
                                </Button>
                            </Box>

                            {revisoesTecnicoHoje.length > 0 ? (
                                <List dense disablePadding>
                                    {revisoesTecnicoHoje.map((rev, i) => {
                                        const TIPOS_ICONE = {
                                            revisao_conteudo: '📖', revisao_pre_prova: '📝',
                                            aula_reforco: '💡', pratica_extra: '🔬',
                                            monitoria: '🎓', outro: '📌',
                                        };
                                        const STATUS_COR = { planejada: 'default', confirmada: 'info', realizada: 'success', cancelada: 'error' };
                                        const STATUS_LABEL = { planejada: 'Planejada', confirmada: 'Confirmada', realizada: 'Realizada', cancelada: 'Cancelada' };
                                        const BLOCOS_LABEL = {
                                            '07:00-09:10': '07:00–09:10', '09:30-12:00': '09:30–12:00',
                                            '13:00-15:10': '13:00–15:10', '15:30-18:00': '15:30–18:00',
                                            '18:30-20:10': '18:30–20:10', '20:30-22:00': '20:30–22:00',
                                        };
                                        const icone = TIPOS_ICONE[rev.tipo] || '📌';
                                        const horario = BLOCOS_LABEL[rev.horarioSlot] || rev.horarioSlot || 'Horário não definido';
                                        return (
                                            <React.Fragment key={rev.id}>
                                                {i > 0 && <Divider />}
                                                <ListItem sx={{ py: 1.2, px: 2 }}>
                                                    <ListItemText
                                                        primary={
                                                            <Box display="flex" alignItems="center" gap={0.8}>
                                                                <Typography variant="body2">{icone}</Typography>
                                                                <Typography variant="body2" fontWeight="medium">{rev.titulo}</Typography>
                                                            </Box>
                                                        }
                                                        secondary={
                                                            <Box sx={{ display: 'flex', gap: 1, mt: 0.3, flexWrap: 'wrap', alignItems: 'center' }}>
                                                                <Typography variant="caption" color="text.secondary">🕐 {horario}</Typography>
                                                                {rev.laboratorio && <Typography variant="caption" color="text.secondary">🏛️ {rev.laboratorio}</Typography>}
                                                                {rev.professor && <Typography variant="caption" color="text.secondary">👨‍🏫 {rev.professor}</Typography>}
                                                            </Box>
                                                        }
                                                    />
                                                    <Chip label={STATUS_LABEL[rev.status] || rev.status}
                                                        color={STATUS_COR[rev.status] || 'default'}
                                                        size="small" sx={{ ml: 1, flexShrink: 0 }} />
                                                </ListItem>
                                            </React.Fragment>
                                        );
                                    })}
                                </List>
                            ) : (
                                <Box sx={{ px: 2, py: 3, textAlign: 'center' }}>
                                    <Typography variant="body2" color="text.secondary">Nenhuma revisão na sua agenda hoje.</Typography>
                                    <Button size="small" sx={{ mt: 1 }} onClick={() => navigate('/revisoes')}>Abrir agenda</Button>
                                </Box>
                            )}
                        </Paper>
                    </Grid>
                </Grid>
            )}

                        {/* 4. ASSISTENTE IA (Opcional/Compacto) */}
            {canUseAI && (
                <Accordion sx={{ mb: 3, bgcolor: 'background.paper', boxShadow: 1, '&:before': { display: 'none' } }}>
                    <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                        <Box display="flex" alignItems="center" gap={1}>
                            <LayoutDashboard size={20} color={theme.palette.primary.main} />
                            <Typography fontWeight="medium">Analista Inteligente (IA)</Typography>
                        </Box>
                    </AccordionSummary>
                    <AccordionDetails sx={{ pt: 0 }}>
                        <AssistenteIA userInfo={userInfo} currentUser={userInfo} mode={mode} />
                    </AccordionDetails>
                </Accordion>
            )}

            {/* 5. CONTEÚDO PRINCIPAL (Abas para economizar espaço) */}
            <Paper elevation={2} sx={{ mb: 3 }}>
                <Tabs 
                    value={tabValue} 
                    onChange={handleTabChange} 
                    indicatorColor="primary" 
                    textColor="primary" 
                    variant="fullWidth"
                    sx={{ borderBottom: 1, borderColor: 'divider' }}
                >
                    <Tab label="Aulas Recentes" />
                    {userInfo?.role === 'coordenador' && <Tab label="Eventos Recentes" />}
                </Tabs>

                {/* PAINEL DE AULAS */}
                <Box role="tabpanel" hidden={tabValue !== 0} sx={{ p: 2 }}>
                    {tabValue === 0 && (
                        <Grid container spacing={2}>
                            <Grid item xs={12} md={6}>
                                <UltimasAulasCard />
                            </Grid>
                            <Grid item xs={12} md={6}>
                                <UltimasExclusoesCard />
                            </Grid>
                        </Grid>
                    )}
                </Box>

                {/* PAINEL DE EVENTOS (Só Coordenador) */}
                {userInfo?.role === 'coordenador' && (
                    <Box role="tabpanel" hidden={tabValue !== 1} sx={{ p: 2 }}>
                        {tabValue === 1 && (
                            <Grid container spacing={2}>
                                <Grid item xs={12} md={6}>
                                    <Paper variant="outlined" sx={{ p: 0 }}>
                                        <Box sx={{ p: 2, display: 'flex', alignItems: 'center', gap: 1, bgcolor: theme.palette.action.hover }}>
                                            <PlusCircle size={20} color={theme.palette.secondary.main} />
                                            <Typography variant="subtitle2" fontWeight="bold">Eventos Adicionados</Typography>
                                        </Box>
                                        <List dense sx={{ maxHeight: 300, overflow: 'auto' }}>
                                            {ultimosEventos.length > 0 ? ultimosEventos.map((ev, i) => (
                                                <React.Fragment key={ev.id}>
                                                    {i > 0 && <Divider />}
                                                    <ListItem>
                                                        <ListItemText 
                                                            primary={<Typography variant="body2" fontWeight="medium">{ev.titulo}</Typography>}
                                                            secondary={`${ev.tipo} • ${dayjs(ev.dataInicio.toDate()).format('DD/MM')}`} 
                                                        />
                                                    </ListItem>
                                                </React.Fragment>
                                            )) : <Box p={2} textAlign="center"><Typography variant="caption">Nada recente.</Typography></Box>}
                                        </List>
                                    </Paper>
                                </Grid>
                                <Grid item xs={12} md={6}>
                                    <Paper variant="outlined" sx={{ p: 0 }}>
                                        <Box sx={{ p: 2, display: 'flex', alignItems: 'center', gap: 1, bgcolor: theme.palette.action.hover }}>
                                            <Trash2 size={20} color={theme.palette.error.main} />
                                            <Typography variant="subtitle2" fontWeight="bold">Eventos Excluídos</Typography>
                                        </Box>
                                        <List dense sx={{ maxHeight: 300, overflow: 'auto' }}>
                                            {ultimosEventosExcluidos.length > 0 ? ultimosEventosExcluidos.map((log, i) => (
                                                <React.Fragment key={log.id}>
                                                    {i > 0 && <Divider />}
                                                    <ListItem>
                                                        <ListItemText 
                                                            primary={<Typography variant="body2" fontWeight="medium" color="error">{log.aula?.assunto || 'Sem nome'}</Typography>}
                                                            secondary={`Excluído em ${dayjs(log.timestamp.toDate()).format('DD/MM HH:mm')}`} 
                                                        />
                                                    </ListItem>
                                                </React.Fragment>
                                            )) : <Box p={2} textAlign="center"><Typography variant="caption">Nenhuma exclusão.</Typography></Box>}
                                        </List>
                                    </Paper>
                                </Grid>
                            </Grid>
                        )}
                    </Box>
                )}
            </Paper>

            {/* 6. CALENDÁRIO ACADÊMICO (Acordeão para não ocupar espaço) */}
            <Accordion elevation={2}>
                <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                    <Box display="flex" alignItems="center" gap={1}>
                        <CalendarIcon color="action" />
                        <Typography fontWeight="medium">Calendário Acadêmico 2026</Typography>
                    </Box>
                </AccordionSummary>
                <AccordionDetails sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                    <img 
                        src={calendarioAcademico} 
                        alt="Calendário Acadêmico" 
                        style={{ maxWidth: '100%', maxHeight: '400px', objectFit: 'contain', cursor: 'pointer', borderRadius: 8 }} 
                        onClick={() => setIsModalOpen(true)}
                    />
                    <Button size="small" onClick={() => setIsModalOpen(true)} sx={{ mt: 1 }}>Ver em Tela Cheia</Button>
                    
                    {userInfo?.role === 'coordenador' && (
                        <Box sx={{ mt: 2, width: '100%', pt: 1, borderTop: 1, borderColor: 'divider' }}>
                            <FormControlLabel
                                control={<Switch checked={isCalendarEnabled} onChange={handleUpdateCalendarStatus} size="small" />}
                                label={<Typography variant="caption">Disponível para alunos</Typography>}
                            />
                        </Box>
                    )}
                </AccordionDetails>
            </Accordion>

            {/* Modal de Imagem Fullscreen */}
            <Dialog open={isModalOpen} onClose={() => setIsModalOpen(false)} maxWidth="lg" fullWidth>
                <DialogContent sx={{ p: 0, position: 'relative', bgcolor: 'black' }}>
                    <img src={calendarioAcademico} alt="Calendário Full" style={{ width: '100%', display: 'block' }} />
                    <IconButton onClick={() => setIsModalOpen(false)} sx={{ position: 'absolute', right: 8, top: 8, color: 'white', bgcolor: 'rgba(0,0,0,0.5)' }}>
                        <CloseIcon />
                    </IconButton>
                </DialogContent>
            </Dialog>

            {/* Modal: Filtro de Laboratórios Favoritos (Técnico) */}
            <Dialog open={isLabFilterOpen} onClose={() => setIsLabFilterOpen(false)} maxWidth="sm" fullWidth>
                <DialogTitle sx={{ pb: 1 }}>
                    <Box display="flex" alignItems="center" justifyContent="space-between">
                        <Box display="flex" alignItems="center" gap={1}>
                            <FilterListIcon color="info" />
                            <Typography variant="h6" fontWeight="bold">Meus Laboratórios</Typography>
                        </Box>
                        <IconButton onClick={() => setIsLabFilterOpen(false)} size="small"><CloseIcon /></IconButton>
                    </Box>
                    <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5, display: 'block' }}>
                        Selecione os laboratórios que deseja monitorar no "Cronograma Oficial — Hoje".
                        Nenhum selecionado = mostrar todos.
                    </Typography>
                </DialogTitle>
                <DialogContent dividers sx={{ maxHeight: 480, overflowY: 'auto' }}>
                    {TIPOS_LABORATORIO.map(tipo => {
                        const labsDoTipo = LISTA_LABORATORIOS.filter(l => l.tipo === tipo.id);
                        const selecionadosCount = labsDoTipo.filter(l => labsFavoritos.includes(l.name)).length;
                        const todosSel = selecionadosCount === labsDoTipo.length;
                        const algumSel = selecionadosCount > 0 && !todosSel;
                        return (
                            <Box key={tipo.id} sx={{ mb: 2 }}>
                                {/* Cabeçalho do tipo — clique seleciona/deseleciona todos do tipo */}
                                <Box
                                    display="flex" alignItems="center" gap={1}
                                    sx={{
                                        cursor: 'pointer', py: 0.8, px: 1, borderRadius: 1,
                                        bgcolor: todosSel ? 'info.main' + '18' : algumSel ? 'warning.main' + '12' : 'action.hover',
                                        mb: 0.8,
                                        '&:hover': { bgcolor: 'info.main' + '22' }
                                    }}
                                    onClick={() => selecionarTodosTipo(tipo.id)}
                                >
                                    <Checkbox
                                        checked={todosSel}
                                        indeterminate={algumSel}
                                        size="small"
                                        color="info"
                                        sx={{ p: 0 }}
                                        onClick={e => e.stopPropagation()}
                                        onChange={() => selecionarTodosTipo(tipo.id)}
                                    />
                                    <Typography variant="subtitle2" fontWeight="bold" color={todosSel ? 'info.main' : 'text.primary'}>
                                        {tipo.name}
                                    </Typography>
                                    <Typography variant="caption" color="text.secondary" sx={{ ml: 'auto' }}>
                                        {selecionadosCount}/{labsDoTipo.length}
                                    </Typography>
                                </Box>
                                {/* Labs individuais */}
                                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.8, pl: 1 }}>
                                    {labsDoTipo.map(lab => {
                                        const sel = labsFavoritos.includes(lab.name);
                                        return (
                                            <Chip
                                                key={lab.id}
                                                label={lab.name}
                                                size="small"
                                                color={sel ? 'info' : 'default'}
                                                variant={sel ? 'filled' : 'outlined'}
                                                onClick={() => toggleLabFavorito(lab.name)}
                                                sx={{
                                                    cursor: 'pointer',
                                                    fontWeight: sel ? 'bold' : 'normal',
                                                    transition: 'all 0.15s',
                                                    '&:hover': { transform: 'scale(1.05)' }
                                                }}
                                            />
                                        );
                                    })}
                                </Box>
                            </Box>
                        );
                    })}
                </DialogContent>
                <DialogActions sx={{ px: 3, py: 1.5, justifyContent: 'space-between' }}>
                    <Box display="flex" alignItems="center" gap={1}>
                        {labsFavoritos.length > 0 ? (
                            <Typography variant="caption" color="info.main" fontWeight="bold">
                                {labsFavoritos.length} laboratório{labsFavoritos.length > 1 ? 's' : ''} selecionado{labsFavoritos.length > 1 ? 's' : ''}
                            </Typography>
                        ) : (
                            <Typography variant="caption" color="text.secondary">
                                Nenhum selecionado — mostrando todos
                            </Typography>
                        )}
                    </Box>
                    <Box display="flex" gap={1}>
                        {labsFavoritos.length > 0 && (
                            <Button size="small" onClick={limparFavoritos} color="inherit">
                                Limpar tudo
                            </Button>
                        )}
                        <Button size="small" variant="contained" color="info" onClick={() => setIsLabFilterOpen(false)}>
                            Aplicar
                        </Button>
                    </Box>
                </DialogActions>
            </Dialog>

        </Container>
    );
};

export default PaginaInicial;