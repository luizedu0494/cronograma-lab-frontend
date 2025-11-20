import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { db } from './firebaseConfig';
import { collection, query, where, getDocs, Timestamp, orderBy, doc, updateDoc, deleteDoc } from 'firebase/firestore';
import {
    Container, Typography, Box, CircularProgress, Alert, Paper, Grid,
    Button, IconButton, Tooltip, Collapse, FormControl, InputLabel,
    Select, MenuItem, OutlinedInput, Chip, TextField, Divider, Dialog,
    DialogTitle, DialogContent, DialogActions, Snackbar, Menu, Badge // Adicionado Badge
} from '@mui/material';
import {
    ChevronLeft, ChevronRight, FilterList as FilterListIcon, Edit as EditIcon,
    Delete as DeleteIcon, MoreVert as MoreVertIcon, Add as AddIcon // Adicionado MoreVertIcon e AddIcon
} from '@mui/icons-material';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDayjs } from '@mui/x-date-pickers/AdapterDayjs';
import dayjs from 'dayjs';
import 'dayjs/locale/pt-br';

import { LISTA_LABORATORIOS } from './constants/laboratorios';
import ProporAulaForm from './ProporAulaForm'; // Importar o formulário de proposta/agendamento
import { LISTA_CURSOS } from './constants/cursos';

dayjs.locale('pt-br');

const TURNOS = ['Manhã', 'Tarde', 'Noite'];
const STATUS_AULA = ['aprovada', 'pendente', 'rejeitada'];
const CURSO_COLORS = {
    'biomedicina': '#4CAF50', 'farmacia': '#F44336', 'enfermagem': '#2196F3',
    'odontologia': '#FF9800', 'medicina': '#9C27B0', 'fisioterapia': '#FFC107',
    'nutricao': '#00BCD4', 'ed_fisica': '#795548', 'psicologia': '#E91E63',
    'med_veterinaria': '#8BC34A', 'quimica_tecnologica': '#607D8B', 'engenharia': '#9E9E9E',
    'tec_cosmetico': '#3F51B5', 'default': '#616161'
};

// Componente de Card de Aula com Menu de Ações
const AulaCard = ({ aula, onEdit, onDelete, isCoordenador }) => {
    const [expanded, setExpanded] = useState(false);
    const [anchorEl, setAnchorEl] = useState(null);
    const openMenu = Boolean(anchorEl);

    const handleMenuClick = (event) => {
        event.stopPropagation();
        setAnchorEl(event.currentTarget);
    };
    const handleMenuClose = () => {
        setAnchorEl(null);
    };

    const handleEditClick = () => {
        onEdit(aula);
        handleMenuClose();
    };

    const handleDeleteClick = () => {
        onDelete(aula);
        handleMenuClose();
    };

    const aulaDetalhes = {
        ...aula,
        horario: `${dayjs(aula.start).format('HH:mm')} - ${dayjs(aula.end).format('HH:mm')}`,
        cursosNomes: (aula.cursos || []).map(c => LISTA_CURSOS.find(lc => lc.value === c)?.label || c).join(', '),
    };

    return (
        <Paper 
            elevation={expanded ? 6 : 2} 
            sx={{ 
                width: '100%', 
                mb: 1, 
                position: 'relative',
                borderLeft: `4px solid ${CURSO_COLORS[aula.cursos?.[0]] || CURSO_COLORS.default}`, // COR DA BORDA RESTAURADA
                transition: 'all 0.2s ease-in-out',
            }}
        >
            {isCoordenador && (
                <>
                    <Tooltip title="Mais Opções">
                        <IconButton size="small" onClick={handleMenuClick} sx={{ position: 'absolute', top: 4, right: 4, zIndex: 2 }}>
                            <MoreVertIcon fontSize="small" />
                        </IconButton>
                    </Tooltip>
                    <Menu anchorEl={anchorEl} open={openMenu} onClose={handleMenuClose}>
                        <MenuItem onClick={handleEditClick}><EditIcon fontSize="small" sx={{ mr: 1 }}/> Editar</MenuItem>
                        <MenuItem onClick={handleDeleteClick} sx={{ color: 'error.main' }}><DeleteIcon fontSize="small" sx={{ mr: 1 }}/> Excluir</MenuItem>
                    </Menu>
                </>
            )}
            <Box onClick={() => setExpanded(!expanded)} sx={{ p: 1.5, cursor: 'pointer' }}>
                <Box>
                    <Typography variant="subtitle2" fontWeight="bold" sx={{ pr: '30px' }}>{aulaDetalhes.title}</Typography>
                    <Typography variant="caption" color="text.secondary">{aulaDetalhes.horario}</Typography>
                </Box>
                <Collapse in={expanded} timeout="auto" unmountOnExit>
                    <Divider sx={{ my: 1 }} />
                    <Box sx={{ mt: 1, pl: 1 }}>
                        <Typography variant="body2"><strong>Laboratório:</strong> {aulaDetalhes.laboratorio}</Typography>
                        <Typography variant="body2"><strong>Cursos:</strong> {aulaDetalhes.cursosNomes}</Typography>
                    </Box>
                </Collapse>
            </Box>
        </Paper>
    );
};


function CalendarioCronograma({ userInfo }) {
    const [aulas, setAulas] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [currentDate, setCurrentDate] = useState(dayjs());

    const [filtros, setFiltros] = useState({ laboratorio: [], cursos: [], assunto: '', turno: [], status: [] });
    const [aulasFiltradas, setAulasFiltradas] = useState([]);
    const [filtrosVisiveis, setFiltrosVisiveis] = useState(false);
    const [isAddModalOpen, setIsAddModalOpen] = useState(false); // Estado para o modal de adição

    const [isEditModalOpen, setIsEditModalOpen] = useState(false);
    const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
    const [aulaParaAcao, setAulaParaAcao] = useState(null);
    const [actionLoading, setActionLoading] = useState(false);
    const [feedback, setFeedback] = useState({ open: false, message: '', severity: 'info' });

    const week = useMemo(() => currentDate.startOf('week'), [currentDate]);
    const weekDays = useMemo(() => Array.from({ length: 7 }, (_, i) => week.add(i, 'day')), [week]);

    const fetchAulasDaSemana = useCallback(async () => {
        setLoading(true);
        const inicioSemana = week.startOf('day').toDate();
        const fimSemana = week.endOf('week').endOf('day').toDate();
        try {
            let q = query(collection(db, 'aulas'), where('dataInicio', '>=', Timestamp.fromDate(inicioSemana)), where('dataInicio', '<=', Timestamp.fromDate(fimSemana)), orderBy('dataInicio', 'asc'));
            
            // Se houver filtros de status, aplica-os
            if (filtros.status.length > 0) {
                q = query(q, where('status', 'in', filtros.status));
            } else {
                // Comportamento padrão: mostrar apenas aprovadas, a menos que o filtro de status esteja ativo
                q = query(q, where('status', '==', 'aprovada'));
            }

            const querySnapshot = await getDocs(q);
            const aulasData = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data(), start: doc.data().dataInicio.toDate(), end: doc.data().dataFim.toDate(), title: doc.data().assunto, laboratorio: doc.data().laboratorioSelecionado }));
            setAulas(aulasData);
        } catch (err) {
            setError("Falha ao carregar o cronograma.");
        } finally {
            setLoading(false);
        }
    }, [week]);

    useEffect(() => { fetchAulasDaSemana(); }, [fetchAulasDaSemana]);

    useEffect(() => {
        let aulasTemp = [...aulas];
        if (filtros.laboratorio.length > 0) aulasTemp = aulasTemp.filter(a => filtros.laboratorio.includes(a.laboratorio));
        if (filtros.cursos.length > 0) aulasTemp = aulasTemp.filter(a => a.cursos?.some(c => filtros.cursos.includes(c)));
        if (filtros.assunto) aulasTemp = aulasTemp.filter(a => a.title.toLowerCase().includes(filtros.assunto.toLowerCase()));
        if (filtros.turno.length > 0) {
            aulasTemp = aulasTemp.filter(a => {
                const hora = dayjs(a.start).hour();
                if (filtros.turno.includes('Manhã') && hora < 12) return true;
                if (filtros.turno.includes('Tarde') && hora >= 12 && hora < 18) return true;
                if (filtros.turno.includes('Noite') && hora >= 18) return true;
                return false;
            });
        }
        // O filtro de status é aplicado na query do Firebase, mas mantemos a lógica de filtro local para o assunto e turno.
        // Se o filtro de status estiver vazio, a query já filtrou por 'aprovada'.
        // Se o filtro de status estiver preenchido, a query já filtrou pelos status selecionados.
        setAulasFiltradas(aulasTemp);
    }, [aulas, filtros]);

    const handleFiltroChange = (field, value) => setFiltros(prev => ({ ...prev, [field]: value }));
    const handleLimparFiltros = () => setFiltros({ laboratorio: [], cursos: [], assunto: '', turno: [], status: [] });

    const handleOpenEditModal = (aula) => { setAulaParaAcao({ ...aula, title: aula.assunto }); setIsEditModalOpen(true); };
    const handleOpenDeleteModal = (aula) => { setAulaParaAcao(aula); setIsDeleteModalOpen(true); };
    const handleCloseModals = () => { setIsEditModalOpen(false); setIsDeleteModalOpen(false); setIsAddModalOpen(false); setAulaParaAcao(null); };
    const handleEditFormChange = (field, value) => setAulaParaAcao(prev => ({ ...prev, [field]: value }));

    const handleSaveChanges = async () => {
        if (!aulaParaAcao) return;
        setActionLoading(true);
        try {
            const aulaDocRef = doc(db, 'aulas', aulaParaAcao.id);
            await updateDoc(aulaDocRef, { assunto: aulaParaAcao.title, laboratorioSelecionado: aulaParaAcao.laboratorio, cursos: aulaParaAcao.cursos });
            setFeedback({ open: true, message: 'Aula atualizada com sucesso!', severity: 'success' });
            handleCloseModals();
            fetchAulasDaSemana();
        } catch (err) {
            setFeedback({ open: true, message: `Erro ao salvar: ${err.message}`, severity: 'error' });
        } finally {
            setActionLoading(false);
        }
    };

    const handleDeleteConfirm = async () => {
        if (!aulaParaAcao) return;
        setActionLoading(true);
        try {
            await deleteDoc(doc(db, 'aulas', aulaParaAcao.id));
            setFeedback({ open: true, message: 'Aula excluída com sucesso!', severity: 'success' });
            handleCloseModals();
            fetchAulasDaSemana();
        } catch (err) {
            setFeedback({ open: true, message: `Erro ao excluir: ${err.message}`, severity: 'error' });
        } finally {
            setActionLoading(false);
        }
    };

    if (loading) return <Box sx={{ display: 'flex', justifyContent: 'center', mt: 4 }}><CircularProgress /></Box>;
    if (error) return <Alert severity="error" sx={{ mt: 4 }}>{error}</Alert>;

    return (
        <LocalizationProvider dateAdapter={AdapterDayjs} adapterLocale="pt-br">
            <Container maxWidth="xl">
                <Paper elevation={3} sx={{ p: 3, mb: 4 }}>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2, flexWrap: 'wrap' }}>
                        <IconButton onClick={() => setCurrentDate(d => d.subtract(1, 'week'))}><ChevronLeft /></IconButton>
                        <Typography variant="h5" component="h2" textAlign="center">Semana de {week.format('DD/MM')} a {week.endOf('week').format('DD/MM/YYYY')}</Typography>
                        <IconButton onClick={() => setCurrentDate(d => d.add(1, 'week'))}><ChevronRight /></IconButton>
                    </Box>
                    <Box sx={{ my: 2, p: 2, border: '1px solid', borderColor: 'divider', borderRadius: 2 }}>
                        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
                            <Badge color="error" variant="dot" invisible={Object.values(filtros).every(f => (Array.isArray(f) ? f.length === 0 : !f))}>
                                <Button onClick={() => setFiltrosVisiveis(!filtrosVisiveis)} endIcon={<FilterListIcon />}>{filtrosVisiveis ? 'Ocultar Filtros' : 'Exibir Filtros Avançados'}</Button>
                            </Badge>
                            <Button onClick={handleLimparFiltros} variant="outlined" size="small">Limpar Filtros</Button>
                        </Box>
                        <Collapse in={filtrosVisiveis} timeout="auto" unmountOnExit>
                             <Grid container spacing={2} sx={{ mt: 1 }}>
                                <Grid item xs={12} sm={6} md={3}><FormControl fullWidth size="small"><InputLabel>Laboratório(s)</InputLabel><Select multiple value={filtros.laboratorio} onChange={(e) => handleFiltroChange('laboratorio', e.target.value)} input={<OutlinedInput label="Laboratório(s)" />} renderValue={(selected) => <Chip label={`${selected.length} sel.`} size="small" />}>{LISTA_LABORATORIOS.map(l => <MenuItem key={l.id} value={l.name}>{l.name}</MenuItem>)}</Select></FormControl></Grid>
                                <Grid item xs={12} sm={6} md={3}><FormControl fullWidth size="small"><InputLabel>Curso(s)</InputLabel><Select multiple value={filtros.cursos} onChange={(e) => handleFiltroChange('cursos', e.target.value)} input={<OutlinedInput label="Curso(s)" />} renderValue={(selected) => <Chip label={`${selected.length} sel.`} size="small" />}>{LISTA_CURSOS.map(c => <MenuItem key={c.value} value={c.value}>{c.label}</MenuItem>)}</Select></FormControl></Grid>
                                <Grid item xs={12} sm={6} md={3}><FormControl fullWidth size="small"><InputLabel>Turno(s)</InputLabel><Select multiple value={filtros.turno} onChange={(e) => handleFiltroChange('turno', e.target.value)} input={<OutlinedInput label="Turno(s)" />} renderValue={(selected) => <Chip label={`${selected.length} sel.`} size="small" />}>{TURNOS.map(t => <MenuItem key={t} value={t}>{t}</MenuItem>)}</Select></FormControl></Grid>
                                <Grid item xs={12} sm={6} md={3}><TextField fullWidth label="Buscar Assunto" value={filtros.assunto} onChange={(e) => handleFiltroChange('assunto', e.target.value)} size="small" /></Grid>
                                {userInfo?.role === 'coordenador' && (
                                    <Grid item xs={12} sm={6} md={3}><FormControl fullWidth size="small"><InputLabel>Status</InputLabel><Select multiple value={filtros.status} onChange={(e) => handleFiltroChange('status', e.target.value)} input={<OutlinedInput label="Status" />} renderValue={(selected) => <Chip label={`${selected.length} sel.`} size="small" />}>{STATUS_AULA.map(s => <MenuItem key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</MenuItem>)}</Select></FormControl></Grid>
                                )}
                            </Grid>d item xs={12} sx={{ display: 'flex', justifyContent: 'flex-end' }}><Button onClick={handleLimparFiltros}>Limpar Filtros</Button></Grid>
                            </Grid>
                        </Collapse>
                    </Box>
                </Paper>

                <Grid container spacing={2}>
                    {weekDays.map(day => {
                        const aulasDoDia = aulasFiltradas.filter(a => dayjs(a.start).isSame(day, 'day'));
                        return (
                            <Grid item xs={12} sm={6} md={4} lg={3} key={day.toString()}>
                                <Paper elevation={2} sx={{ p: 2, height: '100%', position: 'relative' }}>
                                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                        <Typography variant="h6" component="h3" sx={{ textTransform: 'capitalize' }}>{day.format('dddd, DD')}</Typography>
                                        {userInfo?.role === 'coordenador' && (
                                            <Tooltip title={`Adicionar aula em ${day.format('DD/MM')}`}>
                                                <IconButton size="small" color="primary" onClick={() => { setAulaParaAcao({ dataInicio: day }); setIsAddModalOpen(true); }}>
                                                    <AddIcon />
                                                </IconButton>
                                            </Tooltip>
                                        )}
                                    </Box>
                                    <Divider sx={{ my: 1 }} />
                                    <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', minHeight: '50px' }}>
                                        {aulasDoDia.length > 0 ? aulasDoDia.map(aula => <AulaCard key={aula.id} aula={aula} onEdit={handleOpenEditModal} onDelete={handleOpenDeleteModal} isCoordenador={userInfo?.role === 'coordenador'} />) : <Typography variant="body2" color="text.secondary" sx={{ p: 1 }}>Nenhuma aula agendada.</Typography>}
                                    </Box>
                                </Paper>
                            </Grid>
                        );
                    })}
                </Grid>

                {/* Modal de Adição de Aula */}
                <Dialog open={isAddModalOpen} onClose={handleCloseModals} fullWidth maxWidth="md">
                    <DialogTitle>Adicionar Nova Aula</DialogTitle>
                    <DialogContent>
                        <ProporAulaForm 
                            userInfo={userInfo} 
                            currentUser={userInfo} // Assumindo que userInfo contém as informações do usuário logado
                            initialDate={aulaParaAcao?.dataInicio}
                            onSuccess={() => { handleCloseModals(); fetchAulasDaSemana(); }}
                            onCancel={handleCloseModals}
                            isModal={true}
                        />
                    </DialogContent>
                </Dialog>

                {/* Modais de Edição e Exclusão (existentes) */}
                <Dialog open={isEditModalOpen} onClose={handleCloseModals} fullWidth maxWidth="sm">
                    <DialogTitle>Edição Rápida de Aula</DialogTitle>
                    <DialogContent>
                        {aulaParaAcao && (
                            <Grid container spacing={2} sx={{ pt: 1 }}>
                                <Grid item xs={12}><TextField fullWidth label="Assunto da Aula" value={aulaParaAcao.title} onChange={(e) => handleEditFormChange('title', e.target.value)} /></Grid>
                                <Grid item xs={12}><FormControl fullWidth><InputLabel>Laboratório</InputLabel><Select value={aulaParaAcao.laboratorio} label="Laboratório" onChange={(e) => handleEditFormChange('laboratorio', e.target.value)}>{LISTA_LABORATORIOS.map(l => <MenuItem key={l.id} value={l.name}>{l.name}</MenuItem>)}</Select></FormControl></Grid>
                                <Grid item xs={12}><FormControl fullWidth><InputLabel>Cursos</InputLabel><Select multiple value={aulaParaAcao.cursos || []} label="Cursos" onChange={(e) => handleEditFormChange('cursos', e.target.value)} renderValue={(selected) => <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>{selected.map(value => <Chip key={value} label={LISTA_CURSOS.find(c => c.value === value)?.label || value} />)}</Box>}>{LISTA_CURSOS.map(c => <MenuItem key={c.value} value={c.value}>{c.label}</MenuItem>)}</Select></FormControl></Grid>
                            </Grid>
                        )}
                    </DialogContent>
                    <DialogActions><Button onClick={handleCloseModals}>Cancelar</Button><Button onClick={handleSaveChanges} variant="contained" disabled={actionLoading}>{actionLoading ? <CircularProgress size={24} /> : "Salvar"}</Button></DialogActions>
                </Dialog>

                <Dialog open={isDeleteModalOpen} onClose={handleCloseModals} maxWidth="xs">
                    <DialogTitle>Confirmar Exclusão</DialogTitle>
                    <DialogContent><Typography>Tem certeza que deseja excluir a aula "{aulaParaAcao?.title}"? Esta ação não pode ser desfeita.</Typography></DialogContent>
                    <DialogActions><Button onClick={handleCloseModals}>Cancelar</Button><Button onClick={handleDeleteConfirm} variant="contained" color="error" disabled={actionLoading}>{actionLoading ? <CircularProgress size={24} /> : "Excluir"}</Button></DialogActions>
                </Dialog>

                <Snackbar open={feedback.open} autoHideDuration={4000} onClose={() => setFeedback(prev => ({...prev, open: false}))}><Alert severity={feedback.severity} sx={{ width: '100%' }}>{feedback.message}</Alert></Snackbar>
            </Container>
        </LocalizationProvider>
    );
}

export default CalendarioCronograma;
