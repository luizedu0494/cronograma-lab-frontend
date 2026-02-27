import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { db } from './firebaseConfig';
import EmptyState from './components/EmptyState'; // O caminho deve estar correto
    import DialogConfirmacao from './components/DialogConfirmacao'; // Componente de diálogo reutilizável
import { collection, query, where, getDocs, doc, deleteDoc, Timestamp, orderBy, updateDoc, writeBatch, limit, startAfter, addDoc, serverTimestamp } from 'firebase/firestore';
import {
        Button, Container, Paper, Typography, Box, CircularProgress, Alert, Snackbar, FormControl, InputLabel, Select, MenuItem, TextField, Grid, OutlinedInput, Chip, Checkbox, ListItem, ListItemText, List, Tooltip, IconButton,
        Dialog, DialogTitle, DialogContent, DialogActions // ADICIONADOS
    } from '@mui/material';
import { LocalizationProvider, DatePicker } from '@mui/x-date-pickers';
import { AdapterDayjs } from '@mui/x-date-pickers/AdapterDayjs';
import dayjs from 'dayjs';
import 'dayjs/locale/pt-br';
import DeleteIcon from '@mui/icons-material/Delete';
import EditIcon from '@mui/icons-material/Edit';
import ClearIcon from '@mui/icons-material/Clear';
import { LISTA_LABORATORIOS } from './constants/laboratorios';
import { LISTA_CURSOS } from './constants/cursos';

const BLOCOS_HORARIO = [
    { value: "07:00-09:10", label: "07:00 - 09:10" },
    { value: "09:30-12:00", label: "09:30 - 12:00" },
    { value: "13:00-15:10", label: "13:00 - 15:10" },
    { value: "15:30-18:00", label: "15:30 - 18:00" },
    { value: "18:30-22:00", label: "18:30 - 22:00" },
];
const STATUS_AULA = ['pendente', 'aprovada', 'rejeitada'];

const ResultadosBusca = ({ aulas, selectedAulas, onToggleSelectAll, onToggleSelectAula }) => (
    <List>
        <ListItem divider>
            <Checkbox
                edge="start"
                onChange={onToggleSelectAll}
                checked={aulas.length > 0 && selectedAulas.length === aulas.length}
                indeterminate={selectedAulas.length > 0 && selectedAulas.length < aulas.length}
            />
            <ListItemText primary="Selecionar Todas" primaryTypographyProps={{ fontWeight: 'bold' }} />
        </ListItem>
        {aulas.map(aula => (
            <ListItem key={aula.id} divider button onClick={() => onToggleSelectAula(aula.id)}>
                <Checkbox edge="start" checked={selectedAulas.includes(aula.id)} tabIndex={-1} disableRipple />
                <ListItemText
                    primary={`${aula.assunto} - ${aula.propostoPorNome || 'Nome não informado'}`}
                    secondary={`Lab: ${aula.laboratorioSelecionado} | Data: ${dayjs(aula.dataInicio).format('DD/MM/YYYY HH:mm')} | Cursos: ${aula.cursos?.join(', ') || 'N/A'}`}
                />
                <Chip label={aula.status} size="small" color={aula.status === 'aprovada' ? 'success' : aula.status === 'pendente' ? 'warning' : 'error'} sx={{ ml: 2 }} />
            </ListItem>
        ))}
    </List>
);

function GerenciarAulasAvancado({ userInfo }) {

    const logActivity = async (type, aulaData, user) => {
        try {
            await addDoc(collection(db, "logs"), {
                type: type,
                aula: {
                    disciplina: aulaData.assunto,
                    curso: aulaData.cursos?.join(', '),
                    ano: aulaData.ano,
                    status: aulaData.status,
                    dataInicio: aulaData.dataInicio,
                    laboratorioSelecionado: aulaData.laboratorioSelecionado,
                },
                timestamp: serverTimestamp(),
                user: {
                    uid: user.uid,
                    nome: user.name || user.displayName || user.email,
                }
            });
        } catch (error) {
            console.error("Erro ao registrar log:", error);
        }
    };
    const [aulas, setAulas] = useState([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [selectedAulas, setSelectedAulas] = useState([]);
    const [openDeleteDialog, setOpenDeleteDialog] = useState(false);
    const [openEditDialog, setOpenEditDialog] = useState(false);
    
    const [editFields, setEditFields] = useState({ assunto: '', laboratorioSelecionado: '', cursos: [], liga: '', status: '' });
    const [filtros, setFiltros] = useState({ dataInicio: dayjs().startOf('month'), dataFim: dayjs().endOf('month'), laboratorio: [], horario: [], assunto: '', status: '', cursos: [], liga: '' });
    const [feedback, setFeedback] = useState({ open: false, message: '', severity: 'info' });

    const [lastVisible, setLastVisible] = useState(null);
    const [pagina, setPagina] = useState(1);
    const [historicoLastVisible, setHistoricoLastVisible] = useState([]);
    const AULAS_POR_PAGINA = 25;

    const handleSearch = useCallback(async (direction = 'start') => {
        setLoading(true);
        setError(null);
        try {
            let q = query(collection(db, 'aulas'), orderBy('dataInicio', 'asc'));

            if (filtros.dataInicio) q = query(q, where('dataInicio', '>=', Timestamp.fromDate(filtros.dataInicio.startOf('day').toDate())));
            if (filtros.dataFim) q = query(q, where('dataInicio', '<=', Timestamp.fromDate(filtros.dataFim.endOf('day').toDate())));
            if (filtros.status) q = query(q, where('status', '==', filtros.status));
            if (filtros.laboratorio.length > 0) q = query(q, where('laboratorioSelecionado', 'in', filtros.laboratorio));
            if (filtros.horario.length > 0) q = query(q, where('horarioSlotString', 'in', filtros.horario));
            // O filtro de cursos será aplicado localmente para evitar problemas com array-contains-any e outros filtros de query.
            // if (filtros.cursos.length > 0) q = query(q, where('cursos', 'array-contains-any', filtros.cursos));
            
            // Aplica a paginação
            if (direction === 'next' && lastVisible) {
                setHistoricoLastVisible(prev => [...prev, lastVisible]);
                q = query(q, startAfter(lastVisible), limit(AULAS_POR_PAGINA));
            } else if (direction === 'prev') {
                const prevLastVisible = historicoLastVisible[historicoLastVisible.length - 2] || null;
                setHistoricoLastVisible(prev => prev.slice(0, -1));
                q = query(q, startAfter(prevLastVisible), limit(AULAS_POR_PAGINA));
            } else {
                setHistoricoLastVisible([]);
                setPagina(1);
                q = query(q, limit(AULAS_POR_PAGINA));
            }

            const querySnapshot = await getDocs(q);
            let aulasList = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data(), dataInicio: doc.data().dataInicio.toDate() }));

            // Filtros locais (assunto, liga e cursos)
            if (filtros.assunto) aulasList = aulasList.filter(aula => aula.assunto.toLowerCase().includes(filtros.assunto.toLowerCase()));
            if (filtros.liga) aulasList = aulasList.filter(aula => aula.liga === filtros.liga);
            if (filtros.cursos.length > 0) aulasList = aulasList.filter(a => a.cursos?.some(c => filtros.cursos.includes(c)));

            if (querySnapshot.docs.length > 0) {
                setLastVisible(querySnapshot.docs[querySnapshot.docs.length - 1]);
            } else {
                setLastVisible(null);
            }
            
            setAulas(aulasList);
            setSelectedAulas([]);
        } catch (err) {
            setError("Não foi possível carregar as aulas. Verifique os filtros e tente novamente.");
        } finally {
            setLoading(false);
        }
    }, [filtros, lastVisible, historicoLastVisible]);

    useEffect(() => { handleSearch('start'); }, []);

    const handleFiltroChange = (field) => (event) => setFiltros(prev => ({ ...prev, [field]: event.target.value }));
    const handleDateChange = (field) => (date) => setFiltros(prev => ({ ...prev, [field]: date }));

    const handleClearFilters = () => {
        setFiltros({ dataInicio: null, dataFim: null, laboratorio: [], horario: [], assunto: '', status: '', cursos: [], liga: '' });
        setAulas([]);
        setLastVisible(null);
        setHistoricoLastVisible([]);
        setPagina(1);
    };

    const handleToggleSelectAll = (event) => setSelectedAulas(event.target.checked ? aulas.map(a => a.id) : []);
    const handleToggleSelectAula = (id) => setSelectedAulas(prev => prev.includes(id) ? prev.filter(aId => aId !== id) : [...prev, id]);

    const handleDeleteSelected = async () => {
        setOpenDeleteDialog(false);
        setLoading(true);
        try {
            const batch = writeBatch(db);
            const logs = [];
            const aulasParaLog = aulas.filter(a => selectedAulas.includes(a.id));
            
            selectedAulas.forEach(id => {
                batch.delete(doc(db, 'aulas', id));
            });

            aulasParaLog.forEach(aula => {
                logs.push(logActivity('exclusao', aula, { uid: userInfo.uid, name: userInfo.name }));
            });

            await batch.commit();
            await Promise.all(logs);
            setFeedback({ open: true, message: `${selectedAulas.length} aula(s) excluída(s) com sucesso!`, severity: 'success' });
            handleSearch('start'); // Re-executa a busca para atualizar a página
        } catch (err) {
            setFeedback({ open: true, message: `Erro ao excluir aulas: ${err.message}`, severity: 'error' });
        } finally {
            setLoading(false);
        }
    };
    
    const handleOpenEditDialog = () => {
        setEditFields({ assunto: '', laboratorioSelecionado: '', cursos: [], liga: '', status: '' });
        setOpenEditDialog(true);
    };

    const handleEditFieldChange = (field) => (event) => setEditFields({ ...editFields, [field]: event.target.value });

    const handleUpdateSelected = async () => {
        setOpenEditDialog(false);
        setLoading(true);
        try {
            const updates = {};
            if (editFields.assunto) updates.assunto = editFields.assunto;
            if (editFields.laboratorioSelecionado) updates.laboratorioSelecionado = editFields.laboratorioSelecionado;
            if (editFields.cursos.length > 0) updates.cursos = editFields.cursos;
            if (editFields.liga) updates.liga = editFields.liga;
            if (editFields.status) updates.status = editFields.status;
            if (Object.keys(updates).length === 0) {
                setFeedback({ open: true, message: 'Nenhum campo foi alterado.', severity: 'info' });
                setLoading(false);
                return;
            }
            const batch = writeBatch(db);
            selectedAulas.forEach(id => batch.update(doc(db, 'aulas', id), updates));
            await batch.commit();
            setFeedback({ open: true, message: `${selectedAulas.length} aula(s) atualizada(s) com sucesso!`, severity: 'success' });
            handleSearch('start');
            setSelectedAulas([]);
        } catch (err) {
            setFeedback({ open: true, message: `Erro ao atualizar aulas: ${err.message}`, severity: 'error' });
        } finally {
            setLoading(false);
        }
    };

    const handleCloseSnackbar = (event, reason) => {
        if (reason === 'clickaway') return;
        setFeedback(prev => ({ ...prev, open: false }));
    };

    const memoizedActions = useMemo(() => (
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 2, mb: 2 }}>
            <Typography variant="h6">Resultados</Typography>
            {aulas.length > 0 && (
                <Box>
                    <Button variant="contained" color="primary" onClick={handleOpenEditDialog} startIcon={<EditIcon />} disabled={selectedAulas.length === 0} sx={{ mr: 1 }}>Editar ({selectedAulas.length})</Button>
                    <Button variant="contained" color="error" onClick={() => setOpenDeleteDialog(true)} startIcon={<DeleteIcon />} disabled={selectedAulas.length === 0}>Excluir ({selectedAulas.length})</Button>
                </Box>
            )}
        </Box>
    ), [aulas.length, selectedAulas.length]);

    return (
        <LocalizationProvider dateAdapter={AdapterDayjs} adapterLocale="pt-br">
            <Container maxWidth="xl" sx={{ mt: 4, mb: 4 }}>
                <Typography variant="h4" component="h1" gutterBottom align="center">Gerenciamento Avançado de Aulas</Typography>
                <Paper elevation={3} sx={{ p: { xs: 2, md: 3 }, mb: 4 }}>
                    <Typography variant="h6" gutterBottom>Filtros Avançados</Typography>
                    <Grid container spacing={2} alignItems="center">
                        <Grid item xs={12} sm={6} md={3}>
                            <DatePicker label="Data Início" value={filtros.dataInicio} onChange={handleDateChange('dataInicio')} slotProps={{ textField: { fullWidth: true, size: 'small' } }} />
                        </Grid>
                        <Grid item xs={12} sm={6} md={3}>
                            <DatePicker label="Data Fim" value={filtros.dataFim} onChange={handleDateChange('dataFim')} slotProps={{ textField: { fullWidth: true, size: 'small' } }} />
                        </Grid>
                        <Grid item xs={12} sm={6} md={3}>
                            <FormControl sx={{ minWidth: 130 }} size="small">
                                <InputLabel shrink>Status</InputLabel>
                                <Select value={filtros.status} label="Status" onChange={handleFiltroChange('status')}>
                                    <MenuItem value=""><em>Todos</em></MenuItem>
                                    {STATUS_AULA.map(s => <MenuItem key={s} value={s}>{s}</MenuItem>)}
                                </Select>
                            </FormControl>
                        </Grid>
                        <Grid item xs={12} sm={6} md={3}>
                            <FormControl sx={{ minWidth: 160 }} size="small">
                                <InputLabel shrink>Laboratório(s)</InputLabel>
                                <Select multiple value={filtros.laboratorio} onChange={handleFiltroChange('laboratorio')} input={<OutlinedInput notched label="Laboratório(s)" />} renderValue={(selected) => selected.length === 0 ? <em style={{color:'rgba(200,200,200,0.5)'}}>Laboratório(s)</em> : selected.length === 1 ? selected[0] : `${selected[0]} +${selected.length - 1}`}>
                                    {LISTA_LABORATORIOS.map(l => <MenuItem key={l.id} value={l.name}>{l.name}</MenuItem>)}
                                </Select>
                            </FormControl>
                        </Grid>
                        <Grid item xs={12} sm={6} md={3}>
                            <TextField fullWidth size="small" label="Assunto" value={filtros.assunto} onChange={handleFiltroChange('assunto')} />
                        </Grid>
                        <Grid item xs={12} md={6} sx={{ display: 'flex', gap: 2, mt: 1 }}>
                            <Button variant="contained" onClick={() => handleSearch('start')} disabled={loading} sx={{ flexGrow: 1 }}>{loading ? <CircularProgress size={24} /> : 'Buscar Aulas'}</Button>
                            <Tooltip title="Limpar todos os filtros"><IconButton onClick={handleClearFilters} disabled={loading}><ClearIcon /></IconButton></Tooltip>
                        </Grid>
                    </Grid>
                </Paper>

                <Paper elevation={3} sx={{ p: { xs: 2, md: 3 } }}>
                    {memoizedActions}
                    {loading ? (
                        <Box sx={{ display: 'flex', justifyContent: 'center', my: 4 }}><CircularProgress /></Box>
                    ) : error ? (
                        <Alert severity="error">{error}</Alert>
                    ) : aulas.length === 0 ? (
                        <EmptyState 
                            title="Nenhuma Aula Encontrada"
                            message="Não encontramos aulas que correspondam aos seus filtros. Tente ajustar os critérios de busca ou limpar os filtros." 
                        />
                    ) : (
                        <>
                            <ResultadosBusca aulas={aulas} selectedAulas={selectedAulas} onToggleSelectAll={handleToggleSelectAll} onToggleSelectAula={handleToggleSelectAula} />
                            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mt: 3, pt: 2, borderTop: 1, borderColor: 'divider' }}>
                                <Button variant="outlined" onClick={() => { setPagina(p => p - 1); handleSearch('prev'); }} disabled={pagina <= 1 || loading}>Anterior</Button>
                                <Typography color="text.secondary">Página {pagina}</Typography>
                                <Button variant="outlined" onClick={() => { setPagina(p => p + 1); handleSearch('next'); }} disabled={!lastVisible || aulas.length < AULAS_POR_PAGINA || loading}>Próxima</Button>
                            </Box>
                        </>
                    )}
                </Paper>
                
                <Snackbar open={feedback.open} autoHideDuration={6000} onClose={handleCloseSnackbar} anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}><Alert onClose={handleCloseSnackbar} severity={feedback.severity} sx={{ width: '100%' }}>{feedback.message}</Alert></Snackbar>
                <DialogConfirmacao
                        open={openDeleteDialog}
                        onClose={() => setOpenDeleteDialog(false)}
                        onConfirm={handleDeleteSelected}
                        title="Confirmar Exclusão"
                        message={`Tem certeza que deseja excluir **${selectedAulas.length}** aula(s)? Esta ação não pode ser desfeita.`}
                        confirmText="Excluir"
                        confirmColor="error"
                    />
                <Dialog open={openEditDialog} onClose={() => setOpenEditDialog(false)} fullWidth maxWidth="sm"><DialogTitle>Editar {selectedAulas.length} Aulas Selecionadas</DialogTitle><DialogContent><Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>Apenas os campos preenchidos serão atualizados. Deixe em branco para não alterar.</Typography><Grid container spacing={3}><Grid item xs={12}><TextField fullWidth label="Novo Assunto" value={editFields.assunto} onChange={handleEditFieldChange('assunto')} /></Grid><Grid item xs={12}><FormControl sx={{ minWidth: 160 }}><InputLabel shrink>Novo Laboratório</InputLabel><Select value={editFields.laboratorioSelecionado} label="Novo Laboratório" onChange={handleEditFieldChange('laboratorioSelecionado')}>{LISTA_LABORATORIOS.map(l => <MenuItem key={l.id} value={l.name}>{l.name}</MenuItem>)}</Select></FormControl></Grid><Grid item xs={12}><FormControl sx={{ minWidth: 130 }}><InputLabel shrink>Novo Status</InputLabel><Select value={editFields.status} label="Novo Status" onChange={handleEditFieldChange('status')}>{STATUS_AULA.map(s => <MenuItem key={s} value={s}>{s}</MenuItem>)}</Select></FormControl></Grid></Grid></DialogContent><DialogActions><Button onClick={() => setOpenEditDialog(false)}>Cancelar</Button><Button onClick={handleUpdateSelected} variant="contained">Salvar Edição</Button></DialogActions></Dialog>
            </Container>
        </LocalizationProvider>
    );
}

export default GerenciarAulasAvancado;