// src/GerenciarPeriodos.js

import React, { useState, useEffect } from 'react';
import { db } from './firebaseConfig';
import { collection, addDoc, query, where, getDocs, doc, deleteDoc, Timestamp } from 'firebase/firestore';
import {
    Container, Typography, Box, Paper, CircularProgress, Alert,
    List, ListItem, ListItemText, ListItemSecondaryAction, IconButton,
    Dialog, DialogTitle, DialogContent, DialogActions, Button, Grid,
    TextField, MenuItem, Select, FormControl, InputLabel, Snackbar, Chip
} from '@mui/material';
import DeleteIcon from '@mui/icons-material/Delete';
import FileDownloadIcon from '@mui/icons-material/FileDownload';
import dayjs from 'dayjs';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDayjs } from '@mui/x-date-pickers/AdapterDayjs';
import { DesktopDatePicker } from '@mui/x-date-pickers/DesktopDatePicker';
import { getHolidays } from './utils/holiday-api';
import { HolidayIcon } from './utils/custom-icons';

function GerenciarPeriodos() {
    const [periodos, setPeriodos] = useState([]);
    const [loading, setLoading] = useState(true);
    const [newPeriodoDesc, setNewPeriodoDesc] = useState('');
    const [newPeriodoStart, setNewPeriodoStart] = useState(null);
    const [newPeriodoEnd, setNewPeriodoEnd] = useState(null);
    const [openDeleteDialog, setOpenDeleteDialog] = useState(false);
    const [periodoToDelete, setPeriodoToDelete] = useState(null);
    const [importLoading, setImportLoading] = useState(false);
    const [error, setError] = useState(null);
    const [feedback, setFeedback] = useState({ open: false, message: '', severity: 'info' });

    useEffect(() => {
        const fetchPeriodos = async () => {
            setLoading(true);
            try {
                const q = query(collection(db, 'periodosSemAtividade'), where('dataFim', '>=', Timestamp.fromDate(dayjs().subtract(1, 'year').toDate())));
                const querySnapshot = await getDocs(q);
                const periodosList = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
                setPeriodos(periodosList.sort((a, b) => a.dataInicio.toDate() - b.dataInicio.toDate()));
            } catch (err) {
                console.error("Erro ao buscar períodos inativos:", err);
                setError("Não foi possível carregar os períodos. Tente novamente.");
            } finally {
                setLoading(false);
            }
        };
        fetchPeriodos();
    }, []);

    const handleAddPeriodo = async () => {
        if (!newPeriodoDesc || !newPeriodoStart || !newPeriodoEnd) {
            setFeedback({ open: true, message: "Preencha todos os campos do período.", severity: 'warning' });
            return;
        }
        setLoading(true);
        try {
            await addDoc(collection(db, 'periodosSemAtividade'), {
                descricao: newPeriodoDesc,
                dataInicio: Timestamp.fromDate(newPeriodoStart.toDate()),
                dataFim: Timestamp.fromDate(newPeriodoEnd.toDate()),
                tipo: 'manual'
            });
            setNewPeriodoDesc('');
            setNewPeriodoStart(null);
            setNewPeriodoEnd(null);
            setError(null);
            setFeedback({ open: true, message: "Período adicionado com sucesso!", severity: 'success' });
        } catch (err) {
            console.error("Erro ao adicionar período:", err);
            setFeedback({ open: true, message: "Erro ao adicionar período. Tente novamente.", severity: 'error' });
        } finally {
            setLoading(false);
        }
    };

    const handleDeletePeriodo = async () => {
        if (!periodoToDelete) return;
        setLoading(true);
        try {
            await deleteDoc(doc(db, 'periodosSemAtividade', periodoToDelete.id));
            setPeriodos(periodos.filter(p => p.id !== periodoToDelete.id));
            setFeedback({ open: true, message: "Período excluído com sucesso!", severity: 'success' });
        } catch (err) {
            console.error("Erro ao excluir período:", err);
            setFeedback({ open: true, message: "Erro ao excluir período. Tente novamente.", severity: 'error' });
        } finally {
            setLoading(false);
            setOpenDeleteDialog(false);
            setPeriodoToDelete(null);
        }
    };

    const handleOpenDeleteDialog = (periodo) => {
        setPeriodoToDelete(periodo);
        setOpenDeleteDialog(true);
    };

    const handleImportHolidays = async () => {
        setImportLoading(true);
        setError(null);
        try {
            const currentYear = dayjs().year();
            const holidays = await getHolidays(currentYear, 'AL', 'Maceió');
            
            if (holidays.length > 0) {
                const existingDates = periodos.map(p => dayjs(p.dataInicio.toDate()).format('YYYY-MM-DD'));
                let newHolidaysCount = 0;
                
                await Promise.all(holidays.map(async (holiday) => {
                    const holidayDate = dayjs(holiday.date);
                    if (!existingDates.includes(holidayDate.format('YYYY-MM-DD'))) {
                        await addDoc(collection(db, 'periodosSemAtividade'), {
                            descricao: holiday.name,
                            dataInicio: Timestamp.fromDate(holidayDate.startOf('day').toDate()),
                            dataFim: Timestamp.fromDate(holidayDate.endOf('day').toDate()),
                            tipo: holiday.type,
                            fonte: holiday.source || '' // CORRIGIDO: Adiciona um valor padrão se a fonte for undefined
                        });
                        newHolidaysCount++;
                    }
                }));
                
                setFeedback({ open: true, message: `Importação concluída. ${newHolidaysCount} feriados adicionados.`, severity: 'success' });
            } else {
                setFeedback({ open: true, message: "Nenhum feriado encontrado para importar.", severity: 'warning' });
            }
        } catch (err) {
            console.error("Erro ao importar feriados:", err);
            setFeedback({ open: true, message: "Erro ao importar feriados. Verifique a API ou tente novamente.", severity: 'error' });
        } finally {
            setImportLoading(false);
        }
    };

    const handleCloseSnackbar = (event, reason) => {
        if (reason === 'clickaway') {
            return;
        }
        setFeedback(prev => ({ ...prev, open: false }));
    };

    return (
        <LocalizationProvider dateAdapter={AdapterDayjs}>
            <Container maxWidth="md" sx={{ mt: 4, mb: 4 }}>
                <Typography variant="h5" component="h1" gutterBottom align="center">Gerenciar Períodos Inativos</Typography>

                <Paper elevation={3} sx={{ p: { xs: 2, md: 4 }, mt: 3, borderLeft: '5px solid #d32f2f' }}>
                    <Typography variant="h6" gutterBottom>Importar Feriados</Typography>
                    <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>Importa feriados de Maceió/AL do ano atual.</Typography>
                    <Button variant="contained" onClick={handleImportHolidays} disabled={importLoading} fullWidth startIcon={importLoading ? <CircularProgress size={24} color="inherit" /> : <FileDownloadIcon />}>
                        {importLoading ? "Importando..." : "Importar Feriados"}
                    </Button>
                </Paper>

                <Paper elevation={3} sx={{ p: { xs: 2, md: 4 }, mt: 3, borderLeft: '5px solid #2196f3' }}>
                    <Typography variant="h6" gutterBottom>Adicionar Período Manualmente</Typography>
                    <Grid container spacing={2}>
                        <Grid item xs={12}><TextField fullWidth label="Descrição" value={newPeriodoDesc} onChange={(e) => setNewPeriodoDesc(e.target.value)} /></Grid>
                        <Grid item xs={12} sm={6}><DesktopDatePicker label="Data Início" value={newPeriodoStart} onChange={setNewPeriodoStart} slotProps={{ textField: { fullWidth: true } }} /></Grid>
                        <Grid item xs={12} sm={6}><DesktopDatePicker label="Data Fim" value={newPeriodoEnd} onChange={setNewPeriodoEnd} slotProps={{ textField: { fullWidth: true } }} /></Grid>
                        <Grid item xs={12}><Button variant="contained" onClick={handleAddPeriodo} disabled={loading} fullWidth>{loading ? <CircularProgress size={24} /> : "Adicionar Período"}</Button></Grid>
                    </Grid>
                </Paper>

                <Paper elevation={3} sx={{ p: { xs: 2, md: 4 }, mt: 3 }}>
                    <Typography variant="h6" gutterBottom>Períodos Inativos Existentes</Typography>
                    {loading ? (
                        <Box sx={{ display: 'flex', justifyContent: 'center', mt: 2 }}><CircularProgress /></Box>
                    ) : error ? (
                        <Alert severity="error" sx={{ mt: 2 }}>{error}</Alert>
                    ) : periodos.length === 0 ? (
                        <Typography variant="body1" color="text.secondary" sx={{ mt: 2 }}>Nenhum período inativo adicionado.</Typography>
                    ) : (
                        <List dense>
                            {periodos.map(p => (
                                <ListItem key={p.id} sx={{ pr: 12 }}>
                                    <ListItemText
                                        primary={p.descricao}
                                        secondary={`${dayjs(p.dataInicio.toDate()).format('DD/MM/YYYY')} a ${dayjs(p.dataFim.toDate()).format('DD/MM/YYYY')}`}
                                    />
                                    <Chip label={p.tipo || 'Manual'} size="small" icon={<HolidayIcon type={p.tipo} />} sx={{ position: 'absolute', right: 50 }} />
                                    <ListItemSecondaryAction>
                                        <IconButton edge="end" onClick={() => handleOpenDeleteDialog(p)}>
                                            <DeleteIcon />
                                        </IconButton>
                                    </ListItemSecondaryAction>
                                </ListItem>
                            ))}
                        </List>
                    )}
                </Paper>

                <Dialog open={openDeleteDialog} onClose={() => setOpenDeleteDialog(false)}>
                    <DialogTitle>Confirmar Exclusão</DialogTitle>
                    <DialogContent><Typography>Tem certeza que deseja excluir o período "{periodoToDelete?.descricao}"?</Typography></DialogContent>
                    <DialogActions>
                        <Button onClick={() => setOpenDeleteDialog(false)}>Cancelar</Button>
                        <Button onClick={handleDeletePeriodo} color="error" autoFocus>Excluir</Button>
                    </DialogActions>
                </Dialog>
                <Snackbar 
                    open={feedback.open} 
                    autoHideDuration={6000} 
                    onClose={handleCloseSnackbar} 
                    anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
                >
                    {feedback.open && (
                        <Alert onClose={handleCloseSnackbar} severity={feedback.severity} sx={{ width: '100%' }}>
                            {feedback.message}
                        </Alert>
                    )}
                </Snackbar>
            </Container>
        </LocalizationProvider>
    );
}

export default GerenciarPeriodos;