import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { collection, getDocs, query, where, orderBy, doc, Timestamp, deleteDoc, addDoc, serverTimestamp } from 'firebase/firestore';
import { db } from './firebaseConfig';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import {
    Container, Typography, Paper, Box, CircularProgress, List, ListItem,
    ListItemText, Button, Dialog, DialogTitle, DialogContent,
    DialogActions, TextField, InputAdornment, Grid, Chip, IconButton,
    FormControl, InputLabel, Select, MenuItem, Tooltip
} from '@mui/material';
import SearchIcon from '@mui/icons-material/Search';
import DeleteIcon from '@mui/icons-material/Delete';
import DesignarTecnicosModal from './DesignarTecnicosModal';
import { LISTA_LABORATORIOS } from './constants/laboratorios';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDayjs } from '@mui/x-date-pickers/AdapterDayjs';
import dayjs from 'dayjs';

function ListagemMensalAulas({ userInfo, setSnackBar }) {

    const logActivity = async (type, aulaData, user) => {
        try {
            await addDoc(collection(db, "logs"), {
                type: type,
                aula: {
                    disciplina: aulaData.title,
                    curso: aulaData.cursos?.join(', '),
                    ano: aulaData.ano,
                    status: aulaData.status,
                    dataInicio: aulaData.start,
                    laboratorioSelecionado: aulaData.laboratorio,
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
    const [loading, setLoading] = useState(true);
    const [selectedMonth, setSelectedMonth] = useState(dayjs());
    const [searchTerm, setSearchTerm] = useState('');
    const [laboratorioFilter, setLaboratorioFilter] = useState([]);
    const [selectedAula, setSelectedAula] = useState(null);
    const [isDetailsModalOpen, setIsDetailsModalOpen] = useState(false);
    const [isAssignModalOpen, setIsAssignModalOpen] = useState(false);
    const [openConfirmDelete, setOpenConfirmDelete] = useState(false);
    const [aulaToDelete, setAulaToDelete] = useState(null);

    const fetchAulas = useCallback(async () => {
        setLoading(true);
        try {
            const startOfMonth = selectedMonth.startOf('month').toDate();
            const endOfMonth = selectedMonth.endOf('month').toDate();

            const aulasRef = collection(db, 'aulas');
            const q = query(
                aulasRef,
                where('status', '==', 'aprovada'),
                where('dataInicio', '>=', Timestamp.fromDate(startOfMonth)),
                where('dataInicio', '<=', Timestamp.fromDate(endOfMonth)),
                orderBy('dataInicio', 'asc')
            );
            const querySnapshot = await getDocs(q);

            const aulasList = querySnapshot.docs.map(aulaDoc => {
                const aulaData = aulaDoc.data();
                return {
                    id: aulaDoc.id, ...aulaData,
                    start: aulaData.dataInicio.toDate(),
                    end: aulaData.dataFim.toDate(),
                    title: aulaData.assunto,
                    tecnicosNomes: (aulaData.tecnicosInfo || []).map(t => t.name),
                };
            });
            setAulas(aulasList);
        } catch (error) {
            console.error("Erro ao buscar aulas:", error);
            if (setSnackBar) setSnackBar('Erro ao carregar as aulas.');
        } finally {
            setLoading(false);
        }
    }, [selectedMonth, setSnackBar]);

    useEffect(() => {
        fetchAulas();
    }, [fetchAulas]);

    const aulasFiltradas = useMemo(() => {
        return aulas.filter(aula => {
            const searchMatch = searchTerm === '' || 
                                aula.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
                                (aula.propostoPorNome && aula.propostoPorNome.toLowerCase().includes(searchTerm.toLowerCase()));
            
            const labMatch = laboratorioFilter.length === 0 || laboratorioFilter.includes(aula.laboratorioSelecionado);

            return searchMatch && labMatch;
        });
    }, [aulas, searchTerm, laboratorioFilter]);
    
    const handleOpenDetails = (aula) => { setSelectedAula(aula); setIsDetailsModalOpen(true); };
    const handleCloseDetails = () => { setIsDetailsModalOpen(false); setSelectedAula(null); };
    const handleOpenAssignModal = () => { setIsDetailsModalOpen(false); setIsAssignModalOpen(true); };
    const handleCloseAssignModal = (shouldRefresh) => { setIsAssignModalOpen(false); setSelectedAula(null); if (shouldRefresh) { fetchAulas(); } };
    
    const handleDeleteClick = (aula) => { setAulaToDelete(aula); setOpenConfirmDelete(true); };
    const handleCancelDelete = () => { setAulaToDelete(null); setOpenConfirmDelete(false); };

    const handleConfirmDelete = async () => {
        if (!aulaToDelete) return;
        const tecnicosDesignados = aulaToDelete.tecnicos || [];
        const nomeAulaCancelada = aulaToDelete.title;
        try {
            await deleteDoc(doc(db, 'aulas', aulaToDelete.id));
            logActivity('exclusao', aulaToDelete, { uid: userInfo.uid, name: userInfo.name });
            if(setSnackBar) setSnackBar('Aula excluída com sucesso!');
            if (tecnicosDesignados.length > 0) {
                await fetch('/api/send-push-notification', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ uids: tecnicosDesignados, title: 'Aula Cancelada', body: `A aula '${nomeAulaCancelada}' foi removida.`, link: '/minhas-designacoes' }),
                });
            }
        } catch (error) {
            console.error("Erro ao excluir aula:", error);
            if(setSnackBar) setSnackBar(`Erro ao excluir aula: ${error.message}`);
        } finally {
            handleCancelDelete();
        }
    };
    
    return (
        <LocalizationProvider dateAdapter={AdapterDayjs} adapterLocale="pt-br">
            <Container maxWidth="lg">
                <Paper elevation={3} sx={{ p: 3, mt: 4 }}>
                    <Typography variant="h4" gutterBottom align="center">Listagem Mensal de Aulas</Typography>
                    <Grid container spacing={2} alignItems="center" sx={{ mb: 3 }}>
                        <Grid item xs={12} md={4}><DatePicker views={['month', 'year']} label="Mês/Ano" value={dayjs(selectedMonth)} onChange={(newDate) => setSelectedMonth(newDate || dayjs())} slotProps={{ textField: { fullWidth: true, size: 'small' } }} /></Grid>
                        <Grid item xs={12} md={4}><FormControl sx={{ minWidth: 160 }} size="small"><InputLabel shrink>Laboratório</InputLabel><Select multiple value={laboratorioFilter} label="Laboratório" onChange={(e) => setLaboratorioFilter(typeof e.target.value === 'string' ? e.target.value.split(',') : e.target.value)} renderValue={(selected) => selected.join(', ')}><MenuItem value=""><em>Todos</em></MenuItem>{LISTA_LABORATORIOS.map(l => <MenuItem key={l.id} value={l.name}>{l.name}</MenuItem>)}</Select></FormControl></Grid>
                        <Grid item xs={12} md={4}><TextField label="Buscar Assunto ou Proponente" variant="outlined" fullWidth size="small" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} InputProps={{ endAdornment: (<InputAdornment position="end"><SearchIcon /></InputAdornment>), }}/></Grid>
                    </Grid>
                    {loading ? <Box sx={{ display: 'flex', justifyContent: 'center', my: 4 }}><CircularProgress /></Box> : (
                        <List>
                            {aulasFiltradas.length > 0 ? aulasFiltradas.map((aula) => (
                                <ListItem key={aula.id} divider secondaryAction={
                                    userInfo?.role === 'coordenador' && (
                                        <Tooltip title="Excluir Aula">
                                            <IconButton edge="end" aria-label="delete" onClick={() => handleDeleteClick(aula)}>
                                                <DeleteIcon />
                                            </IconButton>
                                        </Tooltip>
                                    )
                                }>
                                    <ListItemText
                                        primary={<Typography variant="h6" component="span" color="primary">{aula.title}<Chip label="Aprovada" color="success" size="small" sx={{ ml: 2 }} /></Typography>}
                                        secondary={
                                            <Box component="span">
                                                <Typography variant="body2" component="div"><b>Data:</b> {format(aula.start, "dd/MM/yyyy (EEEE) 'às' HH:mm", { locale: ptBR })}</Typography>
                                                <Typography variant="body2" component="div"><b>Laboratório:</b> {aula.laboratorioSelecionado}</Typography>
                                                <Typography variant="body2" component="div"><b>Proposto por:</b> {aula.propostoPorNome}</Typography>
                                                {aula.tecnicosNomes && aula.tecnicosNomes.length > 0 && <Typography variant="body2" component="div"><b>Técnico(s):</b> {aula.tecnicosNomes.join(', ')}</Typography>}
                                                {aula.observacoes && <Typography variant="body2" component="div"><b>Observações:</b> {aula.observacoes}</Typography>}
                                                <Button size="small" sx={{mt: 1}} onClick={() => handleOpenDetails(aula)}>Ver Detalhes / Designar</Button>
                                            </Box>
                                        }
                                        secondaryTypographyProps={{component: 'div'}}
                                    />
                                </ListItem>
                            )) : <Typography align="center">Nenhuma aula encontrada para os filtros aplicados.</Typography>}
                        </List>
                    )}
                </Paper>

                {selectedAula && (
                    <Dialog open={isDetailsModalOpen} onClose={handleCloseDetails} maxWidth="sm" fullWidth>
                        <DialogTitle>Detalhes da Aula</DialogTitle>
                        <DialogContent>
                            <Typography variant="h6">{selectedAula.title}</Typography>
                            <Typography variant="body1" color="text.secondary" gutterBottom>Tipo: {selectedAula.tipoAtividade === 'aula' ? 'Aula' : 'Revisão'}</Typography>
                            <Typography variant="body1"><b>Laboratório:</b> {selectedAula.laboratorioSelecionado}</Typography>
                            <Typography variant="body1"><b>Data:</b> {format(selectedAula.start, 'dd/MM/yyyy (EEEE)', { locale: ptBR })}</Typography>
                            <Typography variant="body1"><b>Horário:</b> {format(selectedAula.start, 'HH:mm')} - {format(selectedAula.end, 'HH:mm')}</Typography>
                            <Typography variant="body1"><b>Proposto por:</b> {selectedAula.propostoPorNome}</Typography>
                            <Typography variant="body1"><b>Técnico(s):</b> {selectedAula.tecnicosNomes?.join(', ') || 'Nenhum técnico designado'}</Typography>
                            {selectedAula.observacoes && <Typography variant="body1"><b>Observações:</b> {selectedAula.observacoes}</Typography>}
                        </DialogContent>
                        <DialogActions>
                            {userInfo?.role === 'coordenador' && <Button onClick={handleOpenAssignModal} variant="outlined">Designar Técnicos</Button>}
                            <Button onClick={handleCloseDetails}>Fechar</Button>
                        </DialogActions>
                    </Dialog>
                )}
                
                {aulaToDelete && (
                    <Dialog open={openConfirmDelete} onClose={handleCancelDelete}>
                        <DialogTitle>Confirmar Exclusão</DialogTitle>
                        <DialogContent><Typography>Tem certeza que deseja excluir a aula "{aulaToDelete.title}"? Esta ação não pode ser desfeita.</Typography></DialogContent>
                        <DialogActions>
                            <Button onClick={handleCancelDelete}>Cancelar</Button>
                            <Button onClick={handleConfirmDelete} color="error">Excluir</Button>
                        </DialogActions>
                    </Dialog>
                )}

                {selectedAula && <DesignarTecnicosModal open={isAssignModalOpen} onClose={handleCloseAssignModal} aula={selectedAula} setSnackBar={setSnackBar} />}
            </Container>
        </LocalizationProvider>
    );
};

export default ListagemMensalAulas;