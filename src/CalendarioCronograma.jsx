import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { db } from './firebaseConfig';
import { collection, query, where, getDocs, Timestamp, orderBy, doc, deleteDoc, addDoc, serverTimestamp, writeBatch } from 'firebase/firestore';
import {
    Container, Typography, Box, CircularProgress, Alert, Paper, Grid,
    Button, IconButton, Tooltip, Collapse, FormControl, InputLabel,
    Select, MenuItem, OutlinedInput, Chip, TextField, Divider, Snackbar, Menu,
    Dialog, DialogTitle, DialogContent, InputAdornment, Checkbox, Fade, useTheme
} from '@mui/material';
import {
    ChevronLeft, ChevronRight, FilterList as FilterListIcon, Edit as EditIcon,
    Delete as DeleteIcon, MoreVert as MoreVertIcon, Add as AddIcon,
    EventNote as EventIcon, CalendarMonth as CalendarIcon, ClearAll as ClearAllIcon,
    CheckBox as CheckBoxIcon, CheckBoxOutlineBlank as CheckBoxOutlineBlankIcon,
    Close as CloseIcon, Block as BlockIcon, Search as SearchIcon, 
    Today as TodayIcon, ViewWeek as ViewWeekIcon
} from '@mui/icons-material';
import { LocalizationProvider, DatePicker } from '@mui/x-date-pickers';
import { AdapterDayjs } from '@mui/x-date-pickers/AdapterDayjs';
import dayjs from 'dayjs';
import 'dayjs/locale/pt-br';
import isBetween from 'dayjs/plugin/isBetween';

import { LISTA_LABORATORIOS, TIPOS_LABORATORIO } from './constants/laboratorios';
import ProporAulaForm from './ProporAulaForm';
import ProporEventoForm from './ProporEventoForm';
import DialogConfirmacao from './components/DialogConfirmacao';
import { LISTA_CURSOS } from './constants/cursos';
import EventoCard from './components/EventoCard';
import { useSearchParams } from 'react-router-dom';
import { notificadorTelegram } from './ia-estruturada/NotificadorTelegram';

dayjs.locale('pt-br');
dayjs.extend(isBetween);

const TURNOS = ['Manhã', 'Tarde', 'Noite'];
const CURSO_COLORS = {
    'biomedicina': '#4CAF50', 'farmacia': '#F44336', 'enfermagem': '#2196F3',
    'odontologia': '#FF9800', 'medicina': '#9C27B0', 'fisioterapia': '#FFC107',
    'nutricao': '#00BCD4', 'ed_fisica': '#795548', 'psicologia': '#E91E63',
    'med_veterinaria': '#8BC34A', 'quimica_tecnologica': '#607D8B', 'engenharia': '#9E9E9E',
    'tec_cosmetico': '#3F51B5', 'default': '#616161'
};

const STORAGE_KEY_FILTROS = 'cronograma_filtros_v1';

const AulaCard = ({ aula, onEdit, onDelete, isCoordenador, isSelectionMode, isSelected, onToggleSelect }) => {
    const [expanded, setExpanded] = useState(false);
    const [anchorEl, setAnchorEl] = useState(null);
    const theme = useTheme();
    const openMenu = Boolean(anchorEl);

    const handleMenuClick = (event) => { event.stopPropagation(); setAnchorEl(event.currentTarget); };
    
    const cursosNomes = useMemo(() => {
        if (!aula.cursos || !Array.isArray(aula.cursos)) return 'Nenhum curso';
        return aula.cursos.map(c => {
            if (typeof c === 'string') return LISTA_CURSOS.find(lc => lc.value === c)?.label || c;
            return c.label || c.name || JSON.stringify(c);
        }).join(', ');
    }, [aula.cursos]);

    const horarioFormatado = useMemo(() => {
        const start = dayjs(aula.start);
        const end = dayjs(aula.end);
        return `${start.isValid() ? start.format('HH:mm') : '--:--'} - ${end.isValid() ? end.format('HH:mm') : '--:--'}`;
    }, [aula.start, aula.end]);

    const handleCardClick = () => {
        if (isSelectionMode) onToggleSelect(aula.id);
        else setExpanded(!expanded);
    };

    const corBorda = CURSO_COLORS[aula.cursos?.[0]] || CURSO_COLORS.default;

    return (
        <Paper 
            elevation={expanded ? 6 : 2} 
            sx={{ 
                width: '100%', mb: 1, position: 'relative', 
                borderLeft: `4px solid ${corBorda}`,
                transition: 'all 0.2s',
                transform: isSelected ? 'scale(0.98)' : 'scale(1)',
                bgcolor: isSelected ? (theme.palette.mode === 'dark' ? 'rgba(25, 118, 210, 0.2)' : 'rgba(25, 118, 210, 0.08)') : 'background.paper',
                border: isSelected ? '1px solid #1976d2' : undefined,
                color: 'text.primary'
            }}
        >
            {isSelectionMode && (
                <Box sx={{ position: 'absolute', top: 4, left: 4, zIndex: 2 }}>
                    <Checkbox size="small" checked={isSelected} onChange={() => onToggleSelect(aula.id)} onClick={(e) => e.stopPropagation()} />
                </Box>
            )}

            {isCoordenador && !isSelectionMode && (
                <>
                    <IconButton size="small" onClick={handleMenuClick} sx={{ position: 'absolute', top: 4, right: 4, zIndex: 2 }}><MoreVertIcon fontSize="small" /></IconButton>
                    <Menu anchorEl={anchorEl} open={openMenu} onClose={() => setAnchorEl(null)}>
                        <MenuItem onClick={() => { onEdit(aula); setAnchorEl(null); }}><EditIcon fontSize="small" sx={{ mr: 1 }}/> Editar</MenuItem>
                        <MenuItem onClick={() => { onDelete(aula); setAnchorEl(null); }} sx={{ color: 'error.main' }}><DeleteIcon fontSize="small" sx={{ mr: 1 }}/> Excluir</MenuItem>
                    </Menu>
                </>
            )}

            <Box onClick={handleCardClick} sx={{ p: 1.5, pl: isSelectionMode ? 5 : 1.5, cursor: 'pointer' }}>
                <Typography variant="subtitle2" fontWeight="bold" sx={{ color: 'text.primary' }}>{aula.title || 'Sem Título'}</Typography>
                <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block', mb: 0.5 }}>{horarioFormatado}</Typography>
                <Collapse in={expanded && !isSelectionMode} timeout="auto" unmountOnExit>
                    <Divider sx={{ my: 1 }} />
                    <Typography variant="body2" sx={{ color: 'text.primary' }}><strong>Lab:</strong> {aula.laboratorio || 'N/A'}</Typography>
                    <Typography variant="body2" sx={{ color: 'text.primary' }}><strong>Cursos:</strong> {cursosNomes}</Typography>
                </Collapse>
            </Box>
        </Paper>
    );
};

function CalendarioCronograma({ userInfo }) {
    const theme = useTheme();
    const [searchParams, setSearchParams] = useSearchParams();
    
    // --- ESTADO DE VISUALIZAÇÃO ('week' ou 'day') ---
    const [viewMode, setViewMode] = useState('week'); 

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
    const [periodosBloqueio, setPeriodosBloqueio] = useState([]); 
    
    const [filtros, setFiltros] = useState(() => {
        const saved = localStorage.getItem(STORAGE_KEY_FILTROS);
        return saved ? JSON.parse(saved) : { laboratorio: [], cursos: [], assunto: '', turno: [], status: ['aprovada'] };
    });
    
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
    const [isBulkDeleteModalOpen, setIsBulkDeleteModalOpen] = useState(false);
    
    const [aulaParaAcao, setAulaParaAcao] = useState(null);
    const [eventoParaAcao, setEventoParaAcao] = useState(null);
    const [actionLoading, setActionLoading] = useState(false);
    const [feedback, setFeedback] = useState({ open: false, message: '', severity: 'info' });

    // Seleção
    const [isSelectionMode, setIsSelectionMode] = useState(false);
    const [selectedAulasIds, setSelectedAulasIds] = useState([]);

    // --- CÁLCULOS DE DATA ---
    const weekStart = useMemo(() => currentDate.startOf('week'), [currentDate]);
    const weekEnd = useMemo(() => currentDate.endOf('week'), [currentDate]);
    const weekDays = useMemo(() => Array.from({ length: 7 }, (_, i) => weekStart.add(i, 'day')), [weekStart]);

    // Define quais dias mostrar com base no modo
    const daysToShow = useMemo(() => {
        if (viewMode === 'day') return [currentDate]; // Mostra só o dia selecionado (expandido)
        return weekDays; // Mostra os 7 dias
    }, [viewMode, currentDate, weekDays]);

    useEffect(() => {
        localStorage.setItem(STORAGE_KEY_FILTROS, JSON.stringify(filtros));
    }, [filtros]);

    const limparFiltros = () => {
        setFiltros({ laboratorio: [], cursos: [], assunto: '', turno: [], status: ['aprovada'] });
    };

    const fetchDados = useCallback(async () => {
        setLoading(true);
        // Busca sempre a semana inteira para garantir que, se voltar para 'week', os dados já estão lá
        const start = weekStart.toDate();
        const end = weekEnd.toDate();
        
        try {
            const qAulas = query(collection(db, 'aulas'), where('dataInicio', '>=', Timestamp.fromDate(start)), where('dataInicio', '<=', Timestamp.fromDate(end)), orderBy('dataInicio', 'asc'));
            const qEventos = query(collection(db, 'eventosManutencao'), where('dataInicio', '>=', Timestamp.fromDate(start)), where('dataInicio', '<=', Timestamp.fromDate(end)));
            const qPeriodos = query(collection(db, 'periodosSemAtividade'), where('dataFim', '>=', Timestamp.fromDate(start)));

            const [aulasSnap, eventosSnap, periodosSnap] = await Promise.all([getDocs(qAulas), getDocs(qEventos), getDocs(qPeriodos)]);
            
            setAulas(aulasSnap.docs.map(doc => {
                const data = doc.data();
                return { id: doc.id, ...data, start: data.dataInicio?.toDate() || new Date(), end: data.dataFim?.toDate() || new Date(), title: data.assunto || 'Sem Título', laboratorio: data.laboratorioSelecionado };
            }));

            setEventos(eventosSnap.docs.map(doc => {
                const data = doc.data();
                return { id: doc.id, ...data, start: data.dataInicio?.toDate() || new Date(), end: data.dataFim?.toDate() || new Date() };
            }));
            
            setPeriodosBloqueio(periodosSnap.docs.map(doc => {
                const data = doc.data();
                return { id: doc.id, ...data, start: dayjs(data.dataInicio?.toDate()), end: dayjs(data.dataFim?.toDate()) };
            }));

        } catch (err) { console.error(err); } finally { setLoading(false); }
    }, [weekStart, weekEnd]);

    useEffect(() => { fetchDados(); }, [fetchDados]);

    useEffect(() => {
        const filtrar = (item, isEvento = false) => {
            const matchLab = filtros.laboratorio.length === 0 || filtros.laboratorio.includes(isEvento ? item.laboratorio : item.laboratorio);
            const matchCurso = isEvento ? true : (filtros.cursos.length === 0 || item.cursos?.some(c => filtros.cursos.includes(c)));
            const matchAssunto = !filtros.assunto || (isEvento ? (item.titulo || '') : (item.title || '')).toLowerCase().includes(filtros.assunto.toLowerCase());
            let matchTurno = true;
            if (filtros.turno.length > 0) {
                const hora = dayjs(item.start).hour();
                const turnoItem = hora < 12 ? 'Manhã' : hora < 18 ? 'Tarde' : 'Noite';
                matchTurno = filtros.turno.includes(turnoItem);
            }
            return matchLab && matchCurso && matchAssunto && matchTurno;
        };
        setAulasFiltradas(aulas.filter(a => filtrar(a)));
        setEventosFiltrados(eventos.filter(e => filtrar(e, true)));
    }, [aulas, eventos, filtros]);

    // Navegação
    const handlePrev = () => {
        const unit = viewMode === 'day' ? 'day' : 'week';
        const newDate = currentDate.subtract(1, unit);
        setCurrentDate(newDate);
        setSearchParams({ date: newDate.format('YYYY-MM-DD') });
    };

    const handleNext = () => {
        const unit = viewMode === 'day' ? 'day' : 'week';
        const newDate = currentDate.add(1, unit);
        setCurrentDate(newDate);
        setSearchParams({ date: newDate.format('YYYY-MM-DD') });
    };

    const handleToday = () => {
        const today = dayjs();
        setCurrentDate(today);
        setSearchParams({ date: today.format('YYYY-MM-DD') });
    };

    const handleDayClick = (day) => {
        setCurrentDate(day);
        setViewMode('day');
    };

    const handleBackToWeek = () => {
        setViewMode('week');
    };

    const handleBulkDelete = async () => {
        setActionLoading(true);
        try {
            const batch = writeBatch(db);
            selectedAulasIds.forEach(id => batch.delete(doc(db, 'aulas', id)));
            await batch.commit();
            setFeedback({ open: true, message: `${selectedAulasIds.length} aulas excluídas!`, severity: 'success' });
            setIsSelectionMode(false);
            setSelectedAulasIds([]);
            fetchDados();
        } catch (e) {
            setFeedback({ open: true, message: 'Erro ao excluir aulas.', severity: 'error' });
        } finally {
            setActionLoading(false);
            setIsBulkDeleteModalOpen(false);
        }
    };

    return (
        <LocalizationProvider dateAdapter={AdapterDayjs} adapterLocale="pt-br">
            <Container maxWidth="xl" sx={{ mt: 4, mb: 4, color: 'text.primary' }}>
                <Paper elevation={3} sx={{ p: 2, mb: 3, borderRadius: 2 }}>
                    <Grid container spacing={2} alignItems="center">
                        <Grid item xs={12} md={4}>
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                                <Typography variant="h5" fontWeight="bold" color="primary" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                    <CalendarIcon /> Cronograma
                                </Typography>
                                {viewMode === 'day' && (
                                    <Button variant="outlined" size="small" onClick={handleBackToWeek} startIcon={<ViewWeekIcon />}>
                                        Voltar à Semana
                                    </Button>
                                )}
                            </Box>
                        </Grid>
                        <Grid item xs={12} md={4} sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 1 }}>
                            <Tooltip title={viewMode === 'day' ? "Dia Anterior" : "Semana Anterior"}><IconButton onClick={handlePrev}><ChevronLeft /></IconButton></Tooltip>
                            <Button variant="outlined" size="small" onClick={handleToday} startIcon={<TodayIcon />}>Hoje</Button>
                            
                            <Box sx={{ position: 'relative' }}>
                                <Typography 
                                    variant="h6" 
                                    sx={{ minWidth: 220, textAlign: 'center', fontWeight: 'medium', cursor: 'pointer', '&:hover': { color: 'primary.main' } }} 
                                    onClick={() => setIsPickerOpen(true)}
                                >
                                    {viewMode === 'week' 
                                        ? `${weekStart.format('DD MMM')} - ${weekEnd.format('DD MMM YYYY')}`
                                        : currentDate.format('dddd, DD [de] MMMM [de] YYYY')
                                    }
                                </Typography>
                                <DatePicker 
                                    enableAccessibleFieldDOMStructure={false} // <--- CORREÇÃO AQUI
                                    open={isPickerOpen}
                                    onClose={() => setIsPickerOpen(false)}
                                    onOpen={() => setIsPickerOpen(true)}
                                    value={currentDate}
                                    onChange={(val) => { if(val) { setCurrentDate(dayjs(val)); setIsPickerOpen(false); setSearchParams({ date: dayjs(val).format('YYYY-MM-DD') }); } }}
                                    slots={{ textField: () => null }}
                                />
                            </Box>
                            
                            <Tooltip title={viewMode === 'day' ? "Próximo Dia" : "Próxima Semana"}><IconButton onClick={handleNext}><ChevronRight /></IconButton></Tooltip>
                        </Grid>
                        <Grid item xs={12} md={4} sx={{ display: 'flex', justifyContent: 'flex-end', gap: 1 }}>
                            <Button variant={filtrosVisiveis ? "contained" : "outlined"} startIcon={<FilterListIcon />} onClick={() => setFiltrosVisiveis(!filtrosVisiveis)}>Filtros</Button>
                            
                            {userInfo?.role === 'coordenador' && (
                                <Tooltip title="Gerenciamento em Massa">
                                    <Button 
                                        onClick={() => setIsSelectionMode(!isSelectionMode)} 
                                        variant={isSelectionMode ? "contained" : "outlined"} 
                                        color="secondary" 
                                        startIcon={isSelectionMode ? <CloseIcon /> : <CheckBoxIcon />}
                                    >
                                        {isSelectionMode ? "Cancelar" : "Selecionar"}
                                    </Button>
                                </Tooltip>
                            )}
                            
                            <Button variant="contained" startIcon={<AddIcon />} onClick={() => setIsAddModalOpen(true)}>Nova Aula</Button>
                        </Grid>
                    </Grid>

                    <Fade in={isSelectionMode}>
                        <Box sx={{ mt: 2, p: 1, bgcolor: theme.palette.mode === 'dark' ? 'rgba(144, 202, 249, 0.1)' : '#e3f2fd', borderRadius: 1, display: isSelectionMode ? 'flex' : 'none', alignItems: 'center', justifyContent: 'space-between', border: '1px solid', borderColor: 'primary.main' }}>
                            <Typography variant="body2" sx={{ ml: 1 }}>{selectedAulasIds.length} selecionadas</Typography>
                            <Button size="small" variant="contained" color="error" startIcon={<DeleteIcon />} disabled={selectedAulasIds.length === 0} onClick={() => setIsBulkDeleteModalOpen(true)}>Excluir Selecionadas</Button>
                        </Box>
                    </Fade>

                    <Collapse in={filtrosVisiveis}>
                        <Box sx={{ mt: 2, pt: 2, borderTop: '1px solid', borderColor: 'divider' }}>
                            <Grid container spacing={2}>
                                <Grid item xs={12} md={3}>
                                    <TextField fullWidth size="small" label="Buscar Assunto" value={filtros.assunto} onChange={(e) => setFiltros({...filtros, assunto: e.target.value})} InputProps={{ startAdornment: <InputAdornment position="start"><SearchIcon fontSize="small" /></InputAdornment> }} />
                                </Grid>
                                <Grid item xs={12} md={3}>
                                    <FormControl fullWidth size="small">
                                        <InputLabel>Laboratórios</InputLabel>
                                        <Select multiple value={filtros.laboratorio} onChange={(e) => setFiltros({...filtros, laboratorio: e.target.value})} input={<OutlinedInput label="Laboratórios" />} renderValue={(selected) => <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>{selected.map(v => <Chip key={v} label={v} size="small" />)}</Box>}>
                                            {LISTA_LABORATORIOS.map(l => <MenuItem key={l.id} value={l.name}>{l.name}</MenuItem>)}
                                        </Select>
                                    </FormControl>
                                </Grid>
                                <Grid item xs={12} md={3}>
                                    <FormControl fullWidth size="small">
                                        <InputLabel>Cursos</InputLabel>
                                        <Select multiple value={filtros.cursos} onChange={(e) => setFiltros({...filtros, cursos: e.target.value})} input={<OutlinedInput label="Cursos" />} renderValue={(selected) => <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>{selected.map(v => <Chip key={v} label={LISTA_CURSOS.find(lc => lc.value === v)?.label || v} size="small" />)}</Box>}>
                                            {LISTA_CURSOS.map(c => <MenuItem key={c.value} value={c.value}>{c.label}</MenuItem>)}
                                        </Select>
                                    </FormControl>
                                </Grid>
                                <Grid item xs={12} md={3}>
                                    <Button fullWidth variant="outlined" color="inherit" onClick={limparFiltros} startIcon={<ClearAllIcon />}>Limpar</Button>
                                </Grid>
                            </Grid>
                        </Box>
                    </Collapse>
                </Paper>

                {loading ? (
                    <Box sx={{ display: 'flex', justifyContent: 'center', py: 10 }}><CircularProgress /></Box>
                ) : (
                    <Grid container spacing={1.5}>
                        {daysToShow.map((day) => {
                            const isToday = day.isSame(dayjs(), 'day');
                            const periodoInativo = periodosBloqueio.find(p => day.isBetween(p.start, p.end, 'day', '[]'));
                            const isBlocked = !!periodoInativo;

                            return (
                                <Grid item xs={12} md={viewMode === 'day' ? 12 : 1.71} key={day.format('YYYY-MM-DD')}>
                                    <Paper 
                                        elevation={isToday ? 4 : 1}
                                        sx={{ 
                                            p: 1, minHeight: '70vh', 
                                            bgcolor: isBlocked 
                                                ? (theme.palette.mode === 'dark' ? 'rgba(211, 47, 47, 0.1)' : 'rgba(244, 67, 54, 0.05)') 
                                                : (isToday ? (theme.palette.mode === 'dark' ? 'rgba(25, 118, 210, 0.1)' : 'rgba(25, 118, 210, 0.04)') : 'background.paper'),
                                            borderTop: isToday ? '4px solid #1976d2' : 'none',
                                            borderRadius: 2,
                                            position: 'relative'
                                        }}
                                    >
                                        <Tooltip title={viewMode === 'week' ? "Clique para ampliar este dia" : ""}>
                                            <Box 
                                                onClick={() => handleDayClick(day)}
                                                sx={{ 
                                                    cursor: viewMode === 'week' ? 'pointer' : 'default',
                                                    p: 1, mb: 1, borderRadius: 1,
                                                    transition: 'background-color 0.2s',
                                                    '&:hover': viewMode === 'week' ? { bgcolor: 'action.hover' } : {}
                                                }}
                                            >
                                                <Typography variant={viewMode === 'day' ? "h6" : "subtitle2"} align="center" sx={{ fontWeight: 'bold', color: isToday ? 'primary.main' : 'text.secondary', textTransform: 'capitalize' }}>
                                                    {day.format('ddd, DD/MM')}
                                                </Typography>
                                                {isBlocked && (
                                                    <Box sx={{ textAlign: 'center', mt: 0.5 }}>
                                                        <Chip label={periodoInativo.descricao} size="small" color="error" variant="outlined" sx={{ height: 20, fontSize: '0.65rem' }} />
                                                    </Box>
                                                )}
                                            </Box>
                                        </Tooltip>
                                        <Divider sx={{ mb: 1.5 }} />
                                        
                                        {!isBlocked && (
                                            <Box sx={viewMode === 'day' ? { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 2 } : { display: 'flex', flexDirection: 'column', gap: 1 }}>
                                                {eventosFiltrados.filter(e => dayjs(e.start).isSame(day, 'day')).map(evento => (
                                                    <EventoCard 
                                                        key={evento.id} 
                                                        evento={evento} 
                                                        isCoordenador={userInfo?.role === 'coordenador'}
                                                        onEdit={() => { setEventoParaAcao(evento); setIsEventModalOpen(true); }}
                                                        onDelete={async () => {
                                                            if(window.confirm("Excluir evento?")) {
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
                                                        onEdit={(a) => { setAulaParaAcao(a); setIsEditModalOpen(true); }}
                                                        onDelete={(a) => { setAulaParaAcao(a); setIsDeleteModalOpen(true); }}
                                                        isSelectionMode={isSelectionMode} 
                                                        isSelected={selectedAulasIds.includes(aula.id)}
                                                        onToggleSelect={(id) => setSelectedAulasIds(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id])}
                                                    />
                                                ))}
                                            </Box>
                                        )}
                                        
                                        {userInfo?.role === 'coordenador' && !isBlocked && !isSelectionMode && (
                                            <Box sx={{ display: 'flex', justifyContent: 'center', mt: 2, opacity: 0.3, '&:hover': { opacity: 1 } }}>
                                                <IconButton size="small" onClick={() => { setAulaParaAcao({ dataInicio: day }); setIsAddModalOpen(true); }}>
                                                    <AddIcon fontSize="small" />
                                                </IconButton>
                                            </Box>
                                        )}
                                    </Paper>
                                </Grid>
                            );
                        })}
                    </Grid>
                )}

                {/* MODAIS */}
                <Dialog open={isAddModalOpen} onClose={() => setIsAddModalOpen(false)} maxWidth="md" fullWidth>
                    <DialogTitle sx={{ m: 0, p: 2, bgcolor: 'primary.main', color: 'white' }}>
                        Agendar Nova Aula 
                        <IconButton onClick={() => setIsAddModalOpen(false)} sx={{ position: 'absolute', right: 8, top: 8, color: 'white' }}><CloseIcon /></IconButton>
                    </DialogTitle>
                    <DialogContent sx={{ mt: 2 }}>
                        <ProporAulaForm userInfo={userInfo} currentUser={{uid: userInfo?.uid || 'user'}} initialDate={aulaParaAcao?.dataInicio} onCancel={() => setIsAddModalOpen(false)} onSuccess={() => { setIsAddModalOpen(false); fetchDados(); }} />
                    </DialogContent>
                </Dialog>

                <Dialog open={isEventModalOpen} onClose={() => setIsEventModalOpen(false)} maxWidth="md" fullWidth>
                    <DialogTitle sx={{ m: 0, p: 2, bgcolor: 'secondary.main', color: 'white' }}>
                        {eventoParaAcao?.id ? "Editar Evento" : "Novo Evento"}
                        <IconButton onClick={() => setIsEventModalOpen(false)} sx={{ position: 'absolute', right: 8, top: 8, color: 'white' }}><CloseIcon /></IconButton>
                    </DialogTitle>
                    <DialogContent sx={{ mt: 2 }}>
                        <ProporEventoForm userInfo={userInfo} currentUser={{uid: userInfo?.uid || 'user'}} eventoId={eventoParaAcao?.id} initialDate={eventoParaAcao?.dataInicio} onCancel={() => setIsEventModalOpen(false)} onSuccess={() => { setIsEventModalOpen(false); fetchDados(); }} />
                    </DialogContent>
                </Dialog>

                <Dialog open={isEditModalOpen} onClose={() => setIsEditModalOpen(false)} maxWidth="md" fullWidth>
                    <DialogTitle sx={{ m: 0, p: 2, bgcolor: 'primary.main', color: 'white' }}>
                        Editar Aula
                        <IconButton onClick={() => setIsEditModalOpen(false)} sx={{ position: 'absolute', right: 8, top: 8, color: 'white' }}><CloseIcon /></IconButton>
                    </DialogTitle>
                    <DialogContent sx={{ mt: 2 }}>
                        <ProporAulaForm userInfo={userInfo} currentUser={{uid: userInfo?.uid || 'user'}} aulaId={aulaParaAcao?.id} onCancel={() => setIsEditModalOpen(false)} onSuccess={() => { setIsEditModalOpen(false); fetchDados(); }} />
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
                                data: dayjs(aulaParaAcao.start).format('DD/MM/YYYY') 
                            }, 'excluir');
                            await deleteDoc(doc(db, 'aulas', aulaParaAcao.id)); 
                            setIsDeleteModalOpen(false); 
                            fetchDados(); 
                            setFeedback({ open: true, message: 'Aula excluída com sucesso!', severity: 'success' });
                        } catch(e) { console.error(e); } 
                        finally { setActionLoading(false); } 
                    }} 
                />

                <DialogConfirmacao 
                    open={isBulkDeleteModalOpen} 
                    onClose={() => setIsBulkDeleteModalOpen(false)} 
                    title={`Excluir ${selectedAulasIds.length} Aulas?`} 
                    message="Tem certeza? Esta ação não pode ser desfeita."
                    confirmText="Excluir Tudo"
                    confirmColor="error"
                    loading={actionLoading} 
                    onConfirm={handleBulkDelete}
                />

                <Snackbar open={feedback.open} autoHideDuration={4000} onClose={() => setFeedback({...feedback, open: false})}><Alert severity={feedback.severity}>{feedback.message}</Alert></Snackbar>
            </Container>
        </LocalizationProvider>
    );
}

export default CalendarioCronograma;