import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
    Container, Typography, Box, Paper, Grid, CircularProgress, Button,
    Snackbar, Alert, FormControl, InputLabel, Select, MenuItem, Tooltip,
    Divider, Card, CardContent, CardActions, Chip, Tabs, Tab, Badge,
    TextField, InputAdornment, Collapse, Fade, Dialog, DialogTitle,
    DialogContent, DialogContentText, DialogActions
} from '@mui/material';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import CancelIcon from '@mui/icons-material/Cancel';
import ClearIcon from '@mui/icons-material/Clear';
import SearchIcon from '@mui/icons-material/Search';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import FilterListIcon from '@mui/icons-material/FilterList';
import TaskAltIcon from '@mui/icons-material/TaskAlt';
import { db } from './firebaseConfig';
import {
    collection, query, where, onSnapshot, doc, updateDoc,
    Timestamp, orderBy
} from 'firebase/firestore';
import dayjs from 'dayjs';
import 'dayjs/locale/pt-br';
import { LISTA_CURSOS } from './constants/cursos';
import { notificadorTelegram } from './ia-estruturada/NotificadorTelegram';

const TELEGRAM_CHAT_ID = import.meta.env.VITE_TELEGRAM_CHAT_ID;

dayjs.locale('pt-br');

const MONTHS = Array.from({ length: 12 }, (_, i) => ({ value: i, label: dayjs().month(i).format('MMMM') }));
const YEARS  = Array.from({ length: 5  }, (_, i) => dayjs().year() - 2 + i);

// ─── Card de Aula ─────────────────────────────────────────────────────────────
function AulaCard({ aula, onAction, processando }) {
    const cursosLabel = useMemo(() => {
        if (!aula.cursos?.length) return '—';
        return aula.cursos.map(v => LISTA_CURSOS.find(c => c.value === v)?.label || v).join(', ');
    }, [aula.cursos]);

    const dataFormatada = useMemo(() => {
        try { return dayjs(aula.dataInicio.toDate()).format('ddd, DD/MM/YYYY [às] HH:mm'); }
        catch { return '—'; }
    }, [aula.dataInicio]);

    const pedidoEm = useMemo(() => {
        try { return dayjs(aula.createdAt.toDate()).format('DD/MM/YYYY HH:mm'); }
        catch { return 'Data indisponível'; }
    }, [aula.createdAt]);

    const borderColor =
        aula.status === 'aprovada'  ? '#2e7d32' :
        aula.status === 'rejeitada' ? '#c62828' : '#ed6c02';

    const isProcessando = processando === aula.id;

    return (
        <Card variant="outlined" sx={{
            mb: 2,
            borderLeft: `5px solid ${borderColor}`,
            transition: 'all 0.3s',
            opacity: isProcessando ? 0.6 : 1,
            '&:hover': { boxShadow: 4 }
        }}>
            <CardContent>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1, flexWrap: 'wrap', gap: 1 }}>
                    <Typography variant="h6" fontWeight="bold">{aula.assunto}</Typography>
                    <Chip
                        label={aula.status === 'pendente' ? 'Aguardando aprovação' : aula.status === 'aprovada' ? 'Aprovada' : 'Rejeitada'}
                        color={aula.status === 'pendente' ? 'warning' : aula.status === 'aprovada' ? 'success' : 'error'}
                        size="small"
                    />
                </Box>
                <Typography color="text.secondary" variant="body2" gutterBottom>
                    🏛️ {aula.laboratorioSelecionado || '—'} &nbsp;|&nbsp; 🎓 {cursosLabel}
                </Typography>
                <Divider sx={{ my: 1.5 }} />
                <Grid container spacing={1}>
                    <Grid item xs={12} sm={6}>
                        <Typography variant="body2">
                            <strong>Data e Horário:</strong> {dataFormatada}
                        </Typography>
                    </Grid>
                    <Grid item xs={12} sm={6}>
                        <Typography variant="body2">
                            <strong>Solicitado por:</strong> {aula.propostoPorNome || aula.professorNome || 'N/A'}
                        </Typography>
                    </Grid>
                </Grid>
                <Typography variant="caption" color="text.disabled" sx={{ mt: 0.5, display: 'block' }}>
                    Pedido em: {pedidoEm}
                </Typography>
            </CardContent>

            {aula.status === 'pendente' && (
                <CardActions sx={{ justifyContent: 'flex-end', pt: 0, pb: 1.5, px: 2, gap: 1 }}>
                    {isProcessando ? (
                        <CircularProgress size={24} />
                    ) : (
                        <>
                            <Button size="small" color="error" variant="outlined" startIcon={<CancelIcon />}
                                onClick={() => onAction(aula, 'rejeitada')}>
                                Rejeitar
                            </Button>
                            <Button size="small" color="success" variant="contained" startIcon={<CheckCircleIcon />}
                                onClick={() => onAction(aula, 'aprovada')}>
                                Aprovar
                            </Button>
                        </>
                    )}
                </CardActions>
            )}
        </Card>
    );
}

// ─── Componente Principal ─────────────────────────────────────────────────────
function GerenciarAprovacoes() {
    const [pendentesGlobal, setPendentesGlobal] = useState([]);
    const [aulasDoMes, setAulasDoMes]           = useState([]);
    const [loadingPendentes, setLoadingPendentes] = useState(true);
    const [loadingMes, setLoadingMes]             = useState(true);

    // ID da aula sendo processada neste momento (evita duplo clique)
    const [processando, setProcessando] = useState(null);

    // Confirmação antes de aprovar/rejeitar
    const [confirmDialog, setConfirmDialog] = useState({ open: false, aula: null, acao: null });

    const [currentTab, setCurrentTab] = useState('pendente');
    const [busca, setBusca]           = useState('');
    const [filtrosVisiveis, setFiltrosVisiveis] = useState(false);

    const now = dayjs();
    const [selectedMonth, setSelectedMonth] = useState(now.month());
    const [selectedYear,  setSelectedYear]  = useState(now.year());

    const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' });

    // ── Pendentes: query global sem filtro de data ─────────────────────────
    useEffect(() => {
        setLoadingPendentes(true);
        const q = query(
            collection(db, 'aulas'),
            where('status', '==', 'pendente'),
            orderBy('createdAt', 'asc')
        );
        const unsub = onSnapshot(q, snap => {
            setPendentesGlobal(snap.docs.map(d => ({ id: d.id, ...d.data() })));
            setLoadingPendentes(false);
        }, err => {
            console.error(err);
            setLoadingPendentes(false);
        });
        return () => unsub();
    }, []);

    // ── Aprovadas/Rejeitadas: filtradas por mês/ano ───────────────────────
    const fetchAulasDoMes = useCallback(() => {
        setLoadingMes(true);
        const start = dayjs().year(selectedYear).month(selectedMonth).startOf('month');
        const end   = dayjs().year(selectedYear).month(selectedMonth).endOf('month');
        const q = query(
            collection(db, 'aulas'),
            where('dataInicio', '>=', Timestamp.fromDate(start.toDate())),
            where('dataInicio', '<=', Timestamp.fromDate(end.toDate())),
            where('status', 'in', ['aprovada', 'rejeitada']),
            orderBy('dataInicio', 'asc')
        );
        const unsub = onSnapshot(q, snap => {
            setAulasDoMes(snap.docs.map(d => ({ id: d.id, ...d.data() })));
            setLoadingMes(false);
        }, err => {
            console.error(err);
            setLoadingMes(false);
        });
        return () => unsub();
    }, [selectedMonth, selectedYear]);

    useEffect(() => {
        const unsub = fetchAulasDoMes();
        return () => unsub();
    }, [fetchAulasDoMes]);

    // Abre o diálogo de confirmação ao clicar em Aprovar/Rejeitar
    const handleActionClick = (aula, acao) => {
        setConfirmDialog({ open: true, aula, acao });
    };

    // Executa a ação após confirmação
    const handleConfirmarAcao = async () => {
        const { aula, acao } = confirmDialog;
        setConfirmDialog({ open: false, aula: null, acao: null });
        setProcessando(aula.id);
        try {
            await updateDoc(doc(db, 'aulas', aula.id), { status: acao });

            // Notificação Telegram
            if (TELEGRAM_CHAT_ID) {
                const dataObj = aula.dataInicio?.toDate ? dayjs(aula.dataInicio.toDate()) : dayjs(aula.dataInicio);
                const dadosNotif = {
                    assunto:        aula.assunto,
                    data:           dataObj.isValid() ? dataObj.format('DD/MM/YYYY') : 'N/A',
                    dataISO:        dataObj.isValid() ? dataObj.format('YYYY-MM-DD') : null,
                    horario:        aula.horarioSlotString,
                    laboratorio:    aula.laboratorioSelecionado,
                    cursos:         aula.cursos,
                    observacoes:    aula.observacoes,
                    propostoPorNome: aula.propostoPorNome || aula.professorNome || '',
                    isRevisao:      aula.isRevisao || false,
                    tipoRevisaoLabel: aula.tipoRevisaoLabel || '',
                };
                // Aprovada → tópico do laboratório (tipo 'aprovada' ou 'adicionar' para manter compat)
                // Rejeitada → tópico de rejeições
                await notificadorTelegram.enviarNotificacao(
                    TELEGRAM_CHAT_ID,
                    dadosNotif,
                    acao === 'aprovada' ? 'aprovada' : 'rejeitada'
                );
            }

            setSnackbar({
                open: true,
                severity: 'success',
                message: acao === 'aprovada'
                    ? `✅ Aula "${aula.assunto}" aprovada com sucesso!`
                    : `❌ Aula "${aula.assunto}" rejeitada.`
            });
        } catch (err) {
            console.error(err);
            setSnackbar({ open: true, severity: 'error', message: 'Erro ao atualizar. Tente novamente.' });
        } finally {
            setProcessando(null);
        }
    };

    const listaAtiva = useMemo(() => {
        const base = currentTab === 'pendente'
            ? pendentesGlobal
            : aulasDoMes.filter(a => a.status === currentTab);
        if (!busca.trim()) return base;
        const b = busca.toLowerCase();
        return base.filter(a =>
            a.assunto?.toLowerCase().includes(b) ||
            (a.propostoPorNome || a.professorNome || '').toLowerCase().includes(b) ||
            a.laboratorioSelecionado?.toLowerCase().includes(b)
        );
    }, [currentTab, pendentesGlobal, aulasDoMes, busca]);

    const isLoading = currentTab === 'pendente' ? loadingPendentes : loadingMes;

    return (
        <Container maxWidth="lg">
            <Typography variant="h4" component="h1" gutterBottom align="center"
                sx={{ mb: 2, mt: 4, color: '#3f51b5', fontWeight: 'bold' }}>
                Gerenciar Aprovações de Aulas
            </Typography>

            {/* Banner de alerta quando há pendentes */}
            <Fade in={pendentesGlobal.length > 0}>
                <Paper elevation={0} sx={{
                    mb: 3, p: 2, display: 'flex', alignItems: 'center', gap: 2,
                    bgcolor: 'warning.light', borderRadius: 2,
                    border: '1px solid', borderColor: 'warning.main'
                }}>
                    <WarningAmberIcon color="warning" />
                    <Typography variant="body1" fontWeight="bold" color="warning.dark">
                        {pendentesGlobal.length} proposta{pendentesGlobal.length !== 1 ? 's' : ''} aguardando sua aprovação
                    </Typography>
                    <Button size="small" variant="contained" color="warning"
                        onClick={() => setCurrentTab('pendente')} sx={{ ml: 'auto' }}>
                        Ver pendentes
                    </Button>
                </Paper>
            </Fade>

            {/* Tabs */}
            <Box sx={{ borderBottom: 1, borderColor: 'divider', mb: 2 }}>
                <Tabs value={currentTab} onChange={(_, v) => setCurrentTab(v)} centered>
                    <Tab
                        value="pendente"
                        label={
                            <Badge badgeContent={pendentesGlobal.length} color="error" max={99}>
                                <Box sx={{ pr: pendentesGlobal.length > 0 ? 2 : 0 }}>Pendentes</Box>
                            </Badge>
                        }
                    />
                    <Tab label="Aprovadas" value="aprovada" />
                    <Tab label="Rejeitadas" value="rejeitada" />
                </Tabs>
            </Box>

            {/* Controles */}
            <Paper elevation={1} sx={{ p: 2, mb: 3, borderRadius: 2 }}>
                <Box sx={{ display: 'flex', gap: 2, alignItems: 'center', flexWrap: 'wrap' }}>
                    <TextField
                        size="small" placeholder="Buscar por assunto, técnico ou laboratório..."
                        value={busca} onChange={e => setBusca(e.target.value)}
                        InputProps={{ startAdornment: <InputAdornment position="start"><SearchIcon fontSize="small" /></InputAdornment> }}
                        sx={{ flex: 1, minWidth: 220 }}
                    />
                    {currentTab !== 'pendente' && (
                        <>
                            <Button variant={filtrosVisiveis ? 'contained' : 'outlined'} size="small"
                                startIcon={<FilterListIcon />} onClick={() => setFiltrosVisiveis(v => !v)}>
                                Período
                            </Button>
                            <Collapse in={filtrosVisiveis} orientation="horizontal">
                                <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
                                    <FormControl sx={{ minWidth: 140 }} size="small">
                                        <InputLabel>Mês</InputLabel>
                                        <Select value={selectedMonth} label="Mês" onChange={e => setSelectedMonth(e.target.value)}>
                                            {MONTHS.map(m => <MenuItem key={m.value} value={m.value}>{m.label}</MenuItem>)}
                                        </Select>
                                    </FormControl>
                                    <FormControl sx={{ minWidth: 100 }} size="small">
                                        <InputLabel>Ano</InputLabel>
                                        <Select value={selectedYear} label="Ano" onChange={e => setSelectedYear(e.target.value)}>
                                            {YEARS.map(y => <MenuItem key={y} value={y}>{y}</MenuItem>)}
                                        </Select>
                                    </FormControl>
                                    <Tooltip title="Voltar para o mês atual">
                                        <Button variant="outlined" size="small"
                                            onClick={() => { setSelectedMonth(now.month()); setSelectedYear(now.year()); }}
                                            startIcon={<ClearIcon />}>
                                            Limpar
                                        </Button>
                                    </Tooltip>
                                </Box>
                            </Collapse>
                        </>
                    )}
                    {currentTab === 'pendente' && (
                        <Typography variant="caption" color="text.secondary" sx={{ ml: 'auto' }}>
                            Exibindo todas as propostas pendentes, de qualquer período
                        </Typography>
                    )}
                </Box>
            </Paper>

            {/* Listagem */}
            {isLoading ? (
                <Box sx={{ textAlign: 'center', mt: 6 }}><CircularProgress /></Box>
            ) : listaAtiva.length > 0 ? (
                listaAtiva.map(aula => (
                    <AulaCard key={aula.id} aula={aula} onAction={handleActionClick} processando={processando} />
                ))
            ) : (
                <Box sx={{ textAlign: 'center', mt: 8 }}>
                    {currentTab === 'pendente' ? (
                        <>
                            <TaskAltIcon sx={{ fontSize: 64, color: 'success.main', mb: 1 }} />
                            <Typography color="success.main" variant="h6" fontWeight="bold">
                                Tudo em dia!
                            </Typography>
                            <Typography color="text.secondary">
                                Nenhuma proposta pendente no momento.
                            </Typography>
                        </>
                    ) : (
                        <Typography color="text.secondary" variant="h6">
                            Nenhuma aula {currentTab === 'aprovada' ? 'aprovada' : 'rejeitada'} neste período.
                        </Typography>
                    )}
                </Box>
            )}

            {/* Diálogo de confirmação */}
            <Dialog open={confirmDialog.open} onClose={() => setConfirmDialog({ open: false, aula: null, acao: null })} maxWidth="xs" fullWidth>
                <DialogTitle sx={{
                    bgcolor: confirmDialog.acao === 'aprovada' ? 'success.main' : 'error.main',
                    color: 'white'
                }}>
                    {confirmDialog.acao === 'aprovada' ? '✅ Confirmar Aprovação' : '❌ Confirmar Rejeição'}
                </DialogTitle>
                <DialogContent sx={{ mt: 2 }}>
                    <DialogContentText>
                        {confirmDialog.acao === 'aprovada'
                            ? <>Você está aprovando a aula <strong>"{confirmDialog.aula?.assunto}"</strong>. Ela será incluída no cronograma oficial e ficará visível para todos.</>
                            : <>Você está rejeitando a aula <strong>"{confirmDialog.aula?.assunto}"</strong>. O técnico poderá ver a rejeição em "Minhas Propostas".</>
                        }
                    </DialogContentText>
                    {confirmDialog.aula && (
                        <Box sx={{ mt: 2, p: 1.5, bgcolor: 'action.hover', borderRadius: 1 }}>
                            <Typography variant="caption" display="block">🏛️ {confirmDialog.aula.laboratorioSelecionado || '—'}</Typography>
                            <Typography variant="caption" display="block">📅 {(() => { try { return dayjs(confirmDialog.aula.dataInicio.toDate()).format('ddd, DD/MM/YYYY [às] HH:mm'); } catch { return '—'; } })()}</Typography>
                            <Typography variant="caption" display="block">👤 {confirmDialog.aula.propostoPorNome || confirmDialog.aula.professorNome || 'N/A'}</Typography>
                        </Box>
                    )}
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setConfirmDialog({ open: false, aula: null, acao: null })}>
                        Cancelar
                    </Button>
                    <Button
                        variant="contained"
                        color={confirmDialog.acao === 'aprovada' ? 'success' : 'error'}
                        onClick={handleConfirmarAcao}
                        startIcon={confirmDialog.acao === 'aprovada' ? <CheckCircleIcon /> : <CancelIcon />}
                    >
                        {confirmDialog.acao === 'aprovada' ? 'Sim, aprovar' : 'Sim, rejeitar'}
                    </Button>
                </DialogActions>
            </Dialog>

            <Snackbar open={snackbar.open} autoHideDuration={5000} onClose={() => setSnackbar(p => ({ ...p, open: false }))}>
                <Alert onClose={() => setSnackbar(p => ({ ...p, open: false }))} severity={snackbar.severity} sx={{ width: '100%' }}>
                    {snackbar.message}
                </Alert>
            </Snackbar>
        </Container>
    );
}

export default GerenciarAprovacoes;
