import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
    Container, Typography, Box, Paper, Grid, CircularProgress, Button,
    Snackbar, Alert, FormControl, InputLabel, Select, MenuItem, Tooltip,
    Divider, Card, CardContent, CardActions, Chip, Tabs, Tab
} from '@mui/material';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import CancelIcon from '@mui/icons-material/Cancel';
import ClearIcon from '@mui/icons-material/Clear';
import { db } from './firebaseConfig';
import {
    collection, query, where, onSnapshot, doc, updateDoc,
    Timestamp, orderBy
} from 'firebase/firestore';
import dayjs from 'dayjs';
import 'dayjs/locale/pt-br';

dayjs.locale('pt-br');

const MONTHS = Array.from({ length: 12 }, (_, i) => ({ value: i, label: dayjs().month(i).format('MMMM') }));
const YEARS = Array.from({ length: 5 }, (_, i) => dayjs().year() - 2 + i);

// Componente para o Card de Aula, para manter o código limpo
function AulaCard({ aula, onAction }) {
    const statusConfig = {
        pendente: { color: 'warning.main', label: 'Pendente' },
        aprovada: { color: 'success.main', label: 'Aprovada' },
        rejeitada: { color: 'error.main', label: 'Rejeitada' },
    };

    return (
        <Card variant="outlined" sx={{ mb: 2, borderLeft: `5px solid ${statusConfig[aula.status]?.color || 'grey.500'}` }}>
            <CardContent>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                    <Typography variant="h6" component="div" sx={{ fontWeight: 'bold' }}>
                        {aula.assunto}
                    </Typography>
                    <Chip label={statusConfig[aula.status]?.label} color={aula.status} size="small" variant="outlined" />
                </Box>
                <Typography color="text.secondary" gutterBottom>
                    {aula.laboratorioSelecionado} • {aula.cursos.join(', ')}
                </Typography>
                <Divider sx={{ my: 1.5 }} />
                <Typography variant="body2">
                    <strong>Data e Horário:</strong> {dayjs(aula.dataInicio.toDate()).format('ddd, DD/MM/YYYY [às] HH:mm')}
                </Typography>
                <Typography variant="body2">
                    <strong>Solicitado por:</strong> {aula.propostoPorNome || 'N/A'}
                </Typography>
                <Typography variant="body2" sx={{ fontSize: '0.75rem', color: 'text.disabled' }}>
                    Pedido em: {aula.createdAt ? dayjs(aula.createdAt.toDate()).format('DD/MM/YYYY HH:mm') : 'Data indisponível'}
                </Typography>
            </CardContent>
            {aula.status === 'pendente' && (
                <CardActions sx={{ justifyContent: 'flex-end' }}>
                    <Button
                        size="small"
                        color="error"
                        startIcon={<CancelIcon />}
                        onClick={() => onAction(aula.id, 'rejeitada')}
                    >
                        Rejeitar
                    </Button>
                    <Button
                        size="small"
                        color="success"
                        variant="contained"
                        startIcon={<CheckCircleIcon />}
                        onClick={() => onAction(aula.id, 'aprovada')}
                    >
                        Aprovar
                    </Button>
                </CardActions>
            )}
        </Card>
    );
}

function GerenciarAprovacoes() {
    const [allAulas, setAllAulas] = useState([]);
    const [loading, setLoading] = useState(true);
    const [openSnackbar, setOpenSnackbar] = useState(false);
    const [snackbarMessage, setSnackbarMessage] = useState('');
    const [snackbarSeverity, setSnackbarSeverity] = useState('success');
    const [currentTab, setCurrentTab] = useState('pendente');

    const now = dayjs();
    const [selectedMonth, setSelectedMonth] = useState(now.month());
    const [selectedYear, setSelectedYear] = useState(now.year());

    const fetchAulas = useCallback(() => {
        setLoading(true);
        const startOfMonth = dayjs().year(selectedYear).month(selectedMonth).startOf('month');
        const endOfMonth = dayjs().year(selectedYear).month(selectedMonth).endOf('month');

        const q = query(
            collection(db, 'aulas'),
            where('dataInicio', '>=', Timestamp.fromDate(startOfMonth.toDate())),
            where('dataInicio', '<=', Timestamp.fromDate(endOfMonth.toDate())),
            orderBy('dataInicio', 'asc')
        );

        const unsubscribe = onSnapshot(q, (snapshot) => {
            const aulasData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            setAllAulas(aulasData);
            setLoading(false);
        }, (error) => {
            console.error("Erro ao buscar aulas:", error);
            setSnackbarMessage("Erro ao carregar as aulas.");
            setSnackbarSeverity("error");
            setOpenSnackbar(true);
            setLoading(false);
        });

        return unsubscribe;
    }, [selectedMonth, selectedYear]);

    useEffect(() => {
        const unsubscribe = fetchAulas();
        return () => unsubscribe();
    }, [fetchAulas]);

    const handleAction = async (aulaId, newStatus) => {
        try {
            await updateDoc(doc(db, 'aulas', aulaId), { status: newStatus });
            setSnackbarMessage(`Aula ${newStatus === 'aprovada' ? 'aprovada' : 'rejeitada'} com sucesso!`);
            setSnackbarSeverity("success");
            setOpenSnackbar(true);
        } catch (error) {
            console.error("Erro ao atualizar status da aula:", error);
            setSnackbarMessage("Erro ao atualizar o status da aula.");
            setSnackbarSeverity("error");
            setOpenSnackbar(true);
        }
    };

    const handleClearFilters = () => {
        setSelectedMonth(now.month());
        setSelectedYear(now.year());
    };

    const filteredAulas = useMemo(() => {
        return allAulas.filter(aula => aula.status === currentTab);
    }, [allAulas, currentTab]);

    return (
        <Container maxWidth="lg">
            <Typography variant="h4" component="h1" gutterBottom align="center" sx={{ mb: 2, mt: 4, color: '#3f51b5', fontWeight: 'bold' }}>
                Gerenciar Aprovações de Aulas
            </Typography>
            <Paper elevation={2} sx={{ p: 2, mb: 4, display: 'flex', gap: 2, justifyContent: 'center', alignItems: 'center', flexWrap: 'wrap' }}>
                <FormControl sx={{ minWidth: 150 }} size="small">
                    <InputLabel>Mês</InputLabel>
                    <Select value={selectedMonth} label="Mês" onChange={(e) => setSelectedMonth(e.target.value)}>
                        {MONTHS.map(m => (<MenuItem key={m.value} value={m.value}>{m.label}</MenuItem>))}
                    </Select>
                </FormControl>
                <FormControl sx={{ minWidth: 120 }} size="small">
                    <InputLabel>Ano</InputLabel>
                    <Select value={selectedYear} label="Ano" onChange={(e) => setSelectedYear(e.target.value)}>
                        {YEARS.map(y => (<MenuItem key={y} value={y}>{y}</MenuItem>))}
                    </Select>
                </FormControl>
                <Tooltip title="Voltar para o mês atual">
                    <Button variant="outlined" onClick={handleClearFilters} startIcon={<ClearIcon />}>
                        Limpar Filtros
                    </Button>
                </Tooltip>
            </Paper>

            <Box sx={{ borderBottom: 1, borderColor: 'divider', mb: 3 }}>
                <Tabs value={currentTab} onChange={(e, newValue) => setCurrentTab(newValue)} centered>
                    <Tab label={`Pendentes (${allAulas.filter(a => a.status === 'pendente').length})`} value="pendente" />
                    <Tab label={`Aprovadas (${allAulas.filter(a => a.status === 'aprovada').length})`} value="aprovada" />
                    <Tab label={`Rejeitadas (${allAulas.filter(a => a.status === 'rejeitada').length})`} value="rejeitada" />
                </Tabs>
            </Box>

            {loading ? (
                <Box sx={{ textAlign: 'center', mt: 4 }}><CircularProgress /></Box>
            ) : (
                <Grid container spacing={4}>
                    <Grid item xs={12}>
                        {filteredAulas.length > 0 ? (
                            filteredAulas.map(aula => (
                                <AulaCard key={aula.id} aula={aula} onAction={handleAction} />
                            ))
                        ) : (
                            <Typography align="center" color="text.secondary" sx={{ mt: 5 }}>
                                Nenhuma aula encontrada nesta categoria para o período selecionado.
                            </Typography>
                        )}
                    </Grid>
                </Grid>
            )}

            <Snackbar open={openSnackbar} autoHideDuration={4000} onClose={() => setOpenSnackbar(false)}>
                <Alert onClose={() => setOpenSnackbar(false)} severity={snackbarSeverity} sx={{ width: '100%' }}>
                    {snackbarMessage}
                </Alert>
            </Snackbar>
        </Container>
    );
}

export default GerenciarAprovacoes;
