import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { db } from './firebaseConfig';
import { collection, query, where, getDocs, Timestamp, orderBy, doc, deleteDoc, addDoc, serverTimestamp } from 'firebase/firestore';
import {
    Container, Typography, Box, CircularProgress, Alert, Paper, Grid,
    Button, IconButton, Tooltip, Collapse, FormControl, InputLabel,
    Select, MenuItem, OutlinedInput, Chip, TextField, Divider, Snackbar, Menu,
    Dialog, DialogTitle, DialogContent, InputAdornment
} from '@mui/material';
import {
    ChevronLeft, ChevronRight, FilterList as FilterListIcon, Edit as EditIcon,
    Delete as DeleteIcon, MoreVert as MoreVertIcon, Add as AddIcon,
    EventNote as EventIcon, CalendarMonth as CalendarIcon, ClearAll as ClearAllIcon
} from '@mui/icons-material';
import { LocalizationProvider, DatePicker } from '@mui/x-date-pickers';
import { AdapterDayjs } from '@mui/x-date-pickers/AdapterDayjs';
import dayjs from 'dayjs';
import 'dayjs/locale/pt-br';

import { LISTA_LABORATORIOS } from './constants/laboratorios';
import ProporAulaForm from './ProporAulaForm';
import ProporEventoForm from './ProporEventoForm';
import DialogConfirmacao from './components/DialogConfirmacao';
import { LISTA_CURSOS } from './constants/cursos';
import { getHolidays } from './utils/holiday-api';
import EventoCard from './components/EventoCard';
import { useSearchParams } from 'react-router-dom';
import { notificadorTelegram } from './ia-estruturada/NotificadorTelegram';

dayjs.locale('pt-br');

const TURNOS = ['Manhã', 'Tarde', 'Noite'];
const CURSO_COLORS = {
    'biomedicina': '#4CAF50', 'farmacia': '#F44336', 'enfermagem': '#2196F3',
    'odontologia': '#FF9800', 'medicina': '#9C27B0', 'fisioterapia': '#FFC107',
    'nutricao': '#00BCD4', 'ed_fisica': '#795548', 'psicologia': '#E91E63',
    'med_veterinaria': '#8BC34A', 'quimica_tecnologica': '#607D8B', 'engenharia': '#9E9E9E',
    'tec_cosmetico': '#3F51B5', 'default': '#616161'
};

// Chave para salvar no LocalStorage
const STORAGE_KEY_FILTROS = 'cronograma_filtros_v1';

const AulaCard = ({ aula, onEdit, onDelete, isCoordenador }) => {
    const [expanded, setExpanded] = useState(false);
    const [anchorEl, setAnchorEl] = useState(null);
    const openMenu = Boolean(anchorEl);

    const handleMenuClick = (event) => { event.stopPropagation(); setAnchorEl(event.currentTarget); };
    
    const aulaDetalhes = {
        ...aula,
        horario: `${dayjs(aula.start).format('HH:mm')} - ${dayjs(aula.end).format('HH:mm')}`,
        cursosNomes: (aula.cursos || []).map(c => LISTA_CURSOS.find(lc => lc.value === c)?.label || c).join(', '),
    };

    return (
        <Paper elevation={expanded ? 6 : 2} sx={{ width: '100%', mb: 1, position: 'relative', borderLeft: `4px solid ${CURSO_COLORS[aula.cursos?.[0]] || CURSO_COLORS.default}` }}>
            {isCoordenador && (
                <>
                    <IconButton size="small" onClick={handleMenuClick} sx={{ position: 'absolute', top: 4, right: 4, zIndex: 2 }}><MoreVertIcon fontSize="small" /></IconButton>
                    <Menu anchorEl={anchorEl} open={openMenu} onClose={() => setAnchorEl(null)}>
                        <MenuItem onClick={() => { onEdit(aula); setAnchorEl(null); }}><EditIcon fontSize="small" sx={{ mr: 1 }}/> Editar</MenuItem>
                        <MenuItem onClick={() => { onDelete(aula); setAnchorEl(null); }} sx={{ color: 'error.main' }}><DeleteIcon fontSize="small" sx={{ mr: 1 }}/> Excluir</MenuItem>
                    </Menu>
                </>
            )}
            <Box onClick={() => setExpanded(!expanded)} sx={{ p: 1.5, cursor: 'pointer' }}>
                <Typography variant="subtitle2" fontWeight="bold">{aulaDetalhes.title}</Typography>
                <Typography variant="caption" color="text.secondary">{aulaDetalhes.horario}</Typography>
                <Collapse in={expanded} timeout="auto" unmountOnExit>
                    <Divider sx={{ my: 1 }} />
                    <Typography variant="body2"><strong>Lab:</strong> {aulaDetalhes.laboratorio}</Typography>
                    <Typography variant="body2"><strong>Cursos:</strong> {aulaDetalhes.cursosNomes}</Typography>
                </Collapse>
            </Box>
        </Paper>
    );
};

function CalendarioCronograma({ userInfo }) {
    const [searchParams] = useSearchParams();
    const [currentDate, setCurrentDate] = useState(() => {
        const dateParam = searchParams.get('date');
        return dateParam ? dayjs(dateParam) : dayjs();
    });

    const [isPickerOpen, setIsPickerOpen] = useState(false);

    const [aulas, setAulas] = useState([]);
    const [eventos, setEventos] = useState([]);
    const [aulasFiltradas, setAulasFiltradas] = useState([]);
    const [eventosFiltrados, setEventosFiltrados] = useState([]);
    const [loading, setLoading] = useState(true);
    const [holidays, setHolidays] = useState([]);
    
    // Inicializa Filtros do LocalStorage ou Padrão
    const [filtros, setFiltros] = useState(() => {
        const saved = localStorage.getItem(STORAGE_KEY_FILTROS);
        return saved ? JSON.parse(saved) : { laboratorio: [], cursos: [], assunto: '', turno: [], status: ['aprovada'] };
    });
    
    // Se tiver filtros salvos (diferentes do padrão vazio), abre o painel automaticamente
    const [filtrosVisiveis, setFiltrosVisiveis] = useState(() => {
        const saved = localStorage.getItem(STORAGE_KEY_FILTROS);
        if (!saved) return false;
        const parsed = JSON.parse(saved);
        return parsed.laboratorio.length > 0 || parsed.cursos.length > 0 || parsed.turno.length > 0 || parsed.assunto !== '';
    });
    
    // Modais
    const [isAddModalOpen, setIsAddModalOpen] = useState(false);
    const [isEditModalOpen, setIsEditModalOpen] = useState(false);
    const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
    const [isEventModalOpen, setIsEventModalOpen] = useState(false);
    
    // Estados de Seleção
    const [aulaParaAcao, setAulaParaAcao] = useState(null);
    const [eventoParaAcao, setEventoParaAcao] = useState(null);
    const [actionLoading, setActionLoading] = useState(false);
    const [feedback, setFeedback] = useState({ open: false, message: '', severity: 'info' });

    const week = useMemo(() => currentDate.startOf('week'), [currentDate]);
    const weekDays = useMemo(() => Array.from({ length: 7 }, (_, i) => week.add(i, 'day')), [week]);

    // Salva filtros no LocalStorage sempre que mudarem
    useEffect(() => {
        localStorage.setItem(STORAGE_KEY_FILTROS, JSON.stringify(filtros));
    }, [filtros]);

    const limparFiltros = () => {
        const reset = { laboratorio: [], cursos: [], assunto: '', turno: [], status: ['aprovada'] };
        setFiltros(reset);
        setFiltrosVisiveis(false);
    };

    const fetchDados = useCallback(async () => {
        setLoading(true);
        const inicioSemana = week.startOf('day').toDate();
        const fimSemana = week.endOf('week').endOf('day').toDate();
        try {
            const qAulas = query(collection(db, 'aulas'), where('dataInicio', '>=', Timestamp.fromDate(inicioSemana)), where('dataInicio', '<=', Timestamp.fromDate(fimSemana)), orderBy('dataInicio', 'asc'));
            const qEventos = query(collection(db, 'eventosManutencao'), where('dataInicio', '>=', Timestamp.fromDate(inicioSemana)), where('dataInicio', '<=', Timestamp.fromDate(fimSemana)));
            const [aulasSnap, eventosSnap] = await Promise.all([getDocs(qAulas), getDocs(qEventos)]);
            
            setAulas(aulasSnap.docs.map(doc => ({ id: doc.id, ...doc.data(), start: doc.data().dataInicio.toDate(), end: doc.data().dataFim.toDate(), title: doc.data().assunto, laboratorio: doc.data().laboratorioSelecionado })));
            setEventos(eventosSnap.docs.map(doc => ({ id: doc.id, ...doc.data(), start: doc.data().dataInicio.toDate(), end: doc.data().dataFim.toDate() })));
            setHolidays(await getHolidays(currentDate.year(), 'AL', 'Maceió'));
        } catch (err) { console.error(err); } finally { setLoading(false); }
    }, [week]);

    useEffect(() => { fetchDados(); }, [fetchDados]);

    useEffect(() => {
        const filtrar = (item, isEvento = false) => {
            const matchLab = filtros.laboratorio.length === 0 || filtros.laboratorio.includes(isEvento ? item.laboratorio : item.laboratorio);
            const matchCurso = isEvento ? true : (filtros.cursos.length === 0 || item.cursos?.some(c => filtros.cursos.includes(c)));
            const matchAssunto = !filtros.assunto || (isEvento ? item.titulo : item.title).toLowerCase().includes(filtros.assunto.toLowerCase());
            let matchTurno = true;
            if (filtros.turno.length > 0) {
                const hora = dayjs(item.start).hour();
                matchTurno = (filtros.turno.includes('Manhã') && hora < 12) || (filtros.turno.includes('Tarde') && hora >= 12 && hora < 18) || (filtros.turno.includes('Noite') && hora >= 18);
            }
            return matchLab && matchCurso && matchAssunto && matchTurno && (isEvento ? true : (filtros.status.includes(item.status)));
        };
        setAulasFiltradas(aulas.filter(a => filtrar(a, false)));
        setEventosFiltrados(eventos.filter(e => filtrar(e, true)));
    }, [aulas, eventos, filtros]);

    const getIntervaloTexto = (date) => `${dayjs(date).startOf('week').format('DD/MM')} - ${dayjs(date).endOf('week').format('DD/MM/YYYY')}`;

    return (
        <LocalizationProvider dateAdapter={AdapterDayjs} adapterLocale="pt-br">
            <Container maxWidth="xl">
                {/* --- TOPO E FILTROS --- */}
                <Paper elevation={3} sx={{ p: { xs: 2, sm: 3 }, mb: 4, mt: 2 }}>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2, flexWrap: 'wrap', gap: 2 }}>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, flexWrap: 'nowrap' }}>
                            <IconButton onClick={() => setCurrentDate(d => d.subtract(1, 'week'))}><ChevronLeft /></IconButton>
                            <DatePicker
                                value={currentDate}
                                onChange={(val) => {
                                    if (val) {
                                        setCurrentDate(dayjs(val));
                                        setIsPickerOpen(false);
                                    }
                                }}
                                open={isPickerOpen}
                                onClose={() => setIsPickerOpen(false)}
                                onOpen={() => setIsPickerOpen(true)}
                                enableAccessibleFieldDOMStructure={false}
                                slots={{ textField: (p) => (
                                    <TextField 
                                        {...p} 
                                        onClick={() => setIsPickerOpen(true)}
                                        variant="standard" 
                                        InputProps={{ 
                                            ...p.InputProps, 
                                            disableUnderline: true, 
                                            readOnly: true, 
                                            endAdornment: (
                                                <InputAdornment position="end" sx={{ cursor: 'pointer' }}>
                                                    <CalendarIcon onClick={(e) => { e.stopPropagation(); setIsPickerOpen(true); }} sx={{ fontSize: '1.1rem', color: 'primary.main', mr: 1 }} />
                                                </InputAdornment>
                                            ) 
                                        }} 
                                        value={getIntervaloTexto(currentDate)} 
                                        sx={{ width: { xs: '180px', sm: '230px' }, '& .MuiInputBase-input': { textAlign: 'center', fontWeight: 'bold', color: 'primary.main', cursor: 'pointer', fontSize: { xs: '0.8rem', sm: '1rem' } } }} 
                                    />
                                )}}
                            />
                            <IconButton onClick={() => setCurrentDate(d => d.add(1, 'week'))}><ChevronRight /></IconButton>
                        </Box>
                        <Box sx={{ display: 'flex', gap: 1 }}>
                            <Button onClick={() => setCurrentDate(dayjs())} variant="outlined" size="small">Hoje</Button>
                            <Button 
                                onClick={() => setFiltrosVisiveis(!filtrosVisiveis)} 
                                startIcon={<FilterListIcon />} 
                                variant={filtrosVisiveis ? "contained" : "outlined"} 
                                size="small"
                                color={filtrosVisiveis ? "primary" : "inherit"}
                            >
                                Filtros {filtrosVisiveis ? '(Ativos)' : ''}
                            </Button>
                        </Box>
                    </Box>
                    <Collapse in={filtrosVisiveis}>
                        <Grid container spacing={2} sx={{ pt: 2, alignItems: 'center' }}>
                            <Grid item xs={12} sm={6} md={3}><FormControl fullWidth size="small"><InputLabel>Laboratórios</InputLabel><Select multiple value={filtros.laboratorio} onChange={(e) => setFiltros({...filtros, laboratorio: e.target.value})} input={<OutlinedInput label="Laboratórios" />} renderValue={(s) => <Chip label={`${s.length} sel.`} size="small" />}>{LISTA_LABORATORIOS.map(l => <MenuItem key={l.id} value={l.name}>{l.name}</MenuItem>)}</Select></FormControl></Grid>
                            <Grid item xs={12} sm={6} md={3}><FormControl fullWidth size="small"><InputLabel>Cursos</InputLabel><Select multiple value={filtros.cursos} onChange={(e) => setFiltros({...filtros, cursos: e.target.value})} input={<OutlinedInput label="Cursos" />} renderValue={(s) => <Chip label={`${s.length} sel.`} size="small" />}>{LISTA_CURSOS.map(c => <MenuItem key={c.value} value={c.value}>{c.label}</MenuItem>)}</Select></FormControl></Grid>
                            <Grid item xs={12} sm={6} md={2}><FormControl fullWidth size="small"><InputLabel>Turnos</InputLabel><Select multiple value={filtros.turno} onChange={(e) => setFiltros({...filtros, turno: e.target.value})} input={<OutlinedInput label="Turnos" />} renderValue={(s) => <Chip label={`${s.length} sel.`} size="small" />}>{TURNOS.map(t => <MenuItem key={t} value={t}>{t}</MenuItem>)}</Select></FormControl></Grid>
                            <Grid item xs={12} sm={6} md={3}><TextField fullWidth label="Buscar por nome ou assunto" size="small" value={filtros.assunto} onChange={(e) => setFiltros({...filtros, assunto: e.target.value})} /></Grid>
                            <Grid item xs={12} sm={6} md={1}>
                                <Tooltip title="Limpar Filtros">
                                    <IconButton onClick={limparFiltros} color="error" size="small">
                                        <ClearAllIcon />
                                    </IconButton>
                                </Tooltip>
                            </Grid>
                        </Grid>
                    </Collapse>
                </Paper>

                {/* --- CALENDÁRIO GRID --- */}
                <Grid container spacing={2}>
                    {weekDays.map(day => (
                        <Grid item xs={12} sm={6} md={4} lg={1.7} key={day.toString()}>
                            <Paper elevation={2} sx={{ p: 1.5, height: '100%', minHeight: '400px', borderTop: day.isSame(dayjs(), 'day') ? '4px solid #1976d2' : 'none', bgcolor: holidays.find(h => h.date === day.format('YYYY-MM-DD')) ? 'rgba(244, 67, 54, 0.05)' : 'inherit' }}>
                                <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                                    <Typography variant="subtitle1" fontWeight="bold">{day.format('ddd, DD')}</Typography>
                                    {userInfo?.role === 'coordenador' && (
                                        <Box>
                                            <IconButton size="small" color="secondary" onClick={() => { setEventoParaAcao({ dataInicio: day }); setIsEventModalOpen(true); }}><EventIcon fontSize="small" /></IconButton>
                                            <IconButton size="small" color="primary" onClick={() => { setAulaParaAcao({ dataInicio: day }); setIsAddModalOpen(true); }}><AddIcon fontSize="small" /></IconButton>
                                        </Box>
                                    )}
                                </Box>
                                <Divider sx={{ mb: 1 }} />
                                
                                {eventosFiltrados.filter(e => dayjs(e.start).isSame(day, 'day')).map(evento => (
                                    <EventoCard 
                                        key={evento.id} 
                                        evento={evento} 
                                        isCoordenador={userInfo?.role === 'coordenador'} 
                                        onEdit={() => { 
                                            setEventoParaAcao(evento);
                                            setIsEventModalOpen(true); 
                                        }} 
                                        onDelete={async () => { 
                                            if (window.confirm("Deseja excluir este evento?")) { 
                                                await notificadorTelegram.enviarNotificacao(import.meta.env.VITE_TELEGRAM_CHAT_ID, { 
                                                    titulo: evento.titulo, 
                                                    tipoEvento: evento.tipo, 
                                                    laboratorio: evento.laboratorio, 
                                                    dataInicio: dayjs(evento.start).format('DD/MM/YYYY HH:mm'), 
                                                    dataFim: dayjs(evento.end).format('DD/MM/YYYY HH:mm'),
                                                    dataISO: dayjs(evento.start).format('YYYY-MM-DD')
                                                }, 'evento_excluir');
                                                
                                                await addDoc(collection(db, 'logs'), {
                                                    type: 'exclusao',
                                                    collection: 'eventos',
                                                    aula: {
                                                        assunto: evento.titulo,
                                                        laboratorio: evento.laboratorio,
                                                        status: 'evento',
                                                        dataInicio: evento.start instanceof Date ? Timestamp.fromDate(evento.start) : evento.start
                                                    },
                                                    timestamp: serverTimestamp(),
                                                    user: { nome: userInfo?.name || 'Coordenador' }
                                                });

                                                await deleteDoc(doc(db, 'eventosManutencao', evento.id)); 
                                                fetchDados(); 
                                            } 
                                        }} 
                                    />
                                ))}

                                {aulasFiltradas.filter(a => dayjs(a.start).isSame(day, 'day')).map(aula => (
                                    <AulaCard 
                                        key={aula.id} 
                                        aula={aula} 
                                        isCoordenador={userInfo?.role === 'coordenador'} 
                                        onEdit={() => { 
                                            setAulaParaAcao(aula);
                                            setIsEditModalOpen(true); 
                                        }} 
                                        onDelete={() => { 
                                            setAulaParaAcao(aula); 
                                            setIsDeleteModalOpen(true); 
                                        }} 
                                    />
                                ))}
                            </Paper>
                        </Grid>
                    ))}
                </Grid>

                <Dialog open={isAddModalOpen} onClose={() => setIsAddModalOpen(false)} fullWidth maxWidth="md">
                    <DialogTitle>Nova Aula</DialogTitle>
                    <DialogContent>
                        <ProporAulaForm 
                            userInfo={userInfo} 
                            currentUser={userInfo} 
                            initialDate={aulaParaAcao?.dataInicio} 
                            onSuccess={() => { setIsAddModalOpen(false); fetchDados(); }} 
                            onCancel={() => setIsAddModalOpen(false)} 
                            isModal 
                        />
                    </DialogContent>
                </Dialog>

                <Dialog open={isEventModalOpen} onClose={() => setIsEventModalOpen(false)} fullWidth maxWidth="md">
                    <DialogTitle>{eventoParaAcao?.id ? "Editar Evento" : "Novo Evento"}</DialogTitle>
                    <DialogContent>
                        <ProporEventoForm 
                            userInfo={userInfo} 
                            currentUser={userInfo} 
                            eventoId={eventoParaAcao?.id}
                            initialDate={eventoParaAcao?.start ? dayjs(eventoParaAcao.start) : eventoParaAcao?.dataInicio} 
                            formTitle={eventoParaAcao?.id ? "Editar Evento" : "Novo Evento"}
                            onSuccess={() => { setIsEventModalOpen(false); fetchDados(); }} 
                            onCancel={() => setIsEventModalOpen(false)} 
                            isModal 
                        />
                    </DialogContent>
                </Dialog>

                <Dialog open={isEditModalOpen} onClose={() => setIsEditModalOpen(false)} fullWidth maxWidth="md">
                    <DialogTitle>Editar Aula</DialogTitle>
                    <DialogContent>
                        <ProporAulaForm 
                            userInfo={userInfo} 
                            currentUser={userInfo} 
                            aulaId={aulaParaAcao?.id}
                            initialDate={aulaParaAcao?.start ? dayjs(aulaParaAcao.start) : null}
                            formTitle="Editar Aula"
                            onSuccess={() => { setIsEditModalOpen(false); fetchDados(); }} 
                            onCancel={() => setIsEditModalOpen(false)} 
                            isModal 
                        />
                    </DialogContent>
                </Dialog>

                <DialogConfirmacao 
                    open={isDeleteModalOpen} 
                    onClose={() => setIsDeleteModalOpen(false)} 
                    title="Excluir Aula" 
                    loading={actionLoading} 
                    onConfirm={async () => { 
                        setActionLoading(true); 
                        try {
                            await notificadorTelegram.enviarNotificacao(import.meta.env.VITE_TELEGRAM_CHAT_ID, { 
                                assunto: aulaParaAcao.title, 
                                laboratorio: aulaParaAcao.laboratorio, 
                                cursos: aulaParaAcao.cursos, 
                                data: dayjs(aulaParaAcao.start).format('DD/MM/YYYY'), 
                                horario: `${dayjs(aulaParaAcao.start).format('HH:mm')} - ${dayjs(aulaParaAcao.end).format('HH:mm')}` 
                            }, 'excluir');
                            
                            await addDoc(collection(db, 'logs'), {
                                type: 'exclusao',
                                collection: 'aulas',
                                aula: {
                                    assunto: aulaParaAcao.title,
                                    laboratorio: aulaParaAcao.laboratorio,
                                    cursos: aulaParaAcao.cursos,
                                    status: 'rejeitada',
                                    dataInicio: aulaParaAcao.start instanceof Date ? Timestamp.fromDate(aulaParaAcao.start) : aulaParaAcao.start
                                },
                                timestamp: serverTimestamp(),
                                user: { nome: userInfo?.name || 'Coordenador' }
                            });

                            await deleteDoc(doc(db, 'aulas', aulaParaAcao.id)); 
                            setIsDeleteModalOpen(false); 
                            fetchDados(); 
                        } catch(e) { console.error(e); } 
                        finally { setActionLoading(false); } 
                    }} 
                />
                
                <Snackbar open={feedback.open} autoHideDuration={4000} onClose={() => setFeedback({...feedback, open: false})}><Alert severity={feedback.severity}>{feedback.message}</Alert></Snackbar>
            </Container>
        </LocalizationProvider>
    );
}

export default CalendarioCronograma;