import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { db } from './firebaseConfig';
import { collection, query, where, getDocs, Timestamp, orderBy, doc, updateDoc, deleteDoc, addDoc, serverTimestamp } from 'firebase/firestore';
import {
    Container, Typography, Box, CircularProgress, Alert, Paper, Grid,
    Button, IconButton, Tooltip, Collapse, FormControl, InputLabel,
    Select, MenuItem, OutlinedInput, Chip, TextField, Divider, Snackbar, Menu, Badge,
    Dialog, DialogTitle, DialogContent, DialogActions // ADICIONADOS
} from '@mui/material';
import {
    ChevronLeft, ChevronRight, FilterList as FilterListIcon, Edit as EditIcon,
    Delete as DeleteIcon, MoreVert as MoreVertIcon, Add as AddIcon // Adicionado MoreVertIcon e AddIcon
} from '@mui/icons-material';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { DndContext, useDraggable, useDroppable } from '@dnd-kit/core';
import { restrictToParentElement } from '@dnd-kit/modifiers';

import { AdapterDayjs } from '@mui/x-date-pickers/AdapterDayjs';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import dayjs from 'dayjs';
import 'dayjs/locale/pt-br';


import { LISTA_LABORATORIOS } from './constants/laboratorios';
import ProporAulaForm from './ProporAulaForm'; // Importar o formulário de proposta/agendamento
    import DialogConfirmacao from './components/DialogConfirmacao'; // Componente de diálogo reutilizável
import { LISTA_CURSOS } from './constants/cursos';
import { getHolidays } from './utils/holiday-api'; // Importa a função de feriados

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

// Componente de Visualização de Ocupação por Hora (Mapa de Calor Simplificado)
const OcupacaoPorHora = ({ aulasDoDia }) => {
    const horas = Array.from({ length: 24 }, (_, i) => i);
    const ocupacao = horas.map(hora => {
        const count = aulasDoDia.filter(aula => {
            const startHour = dayjs(aula.start).hour();
            const endHour = dayjs(aula.end).hour();
            // Verifica se a aula está ativa durante a hora
            return startHour <= hora && endHour > hora;
        }).length;
        return { hora, count };
    });

    const maxOcupacao = Math.max(...ocupacao.map(o => o.count), 1); // Evita divisão por zero

    return (
        <Box sx={{ mb: 2, p: 1, border: '1px solid #eee', borderRadius: 1 }}>
            <Typography variant="caption" display="block" gutterBottom>Ocupação por Hora (Aulas Simultâneas)</Typography>
            <Box sx={{ display: 'flex', gap: '2px', height: '20px' }}>
                {ocupacao.map(({ hora, count }) => (
                    <Tooltip key={hora} title={`${hora}:00 - ${hora + 1}:00: ${count} aula(s)`}>
                        <Box
                            sx={{
                                flexGrow: 1,
                                height: '100%',
                                bgcolor: 'grey.300',
                                position: 'relative',
                                '&:hover': { opacity: 0.8 },
                            }}
                        >
                            <Box
                                sx={{
                                    height: '100%',
                                    width: '100%',
                                    bgcolor: count > 0 ? `rgba(255, 87, 34, ${count / maxOcupacao})` : 'transparent', // Cor de calor (Laranja/Vermelho)
                                    transition: 'background-color 0.3s',
                                }}
                            />
                        </Box>
                    </Tooltip>
                ))}
            </Box>
        </Box>
    );
};

// Componente Droppable para o dia
const DiaDroppable = ({ day, children, onDrop }) => {
    const dayId = day.format('YYYY-MM-DD');
    const { isOver, setNodeRef } = useDroppable({
        id: dayId,
        data: { day: dayId },
    });

    const style = {
        backgroundColor: isOver ? 'rgba(0, 150, 136, 0.1)' : 'transparent',
        transition: 'background-color 0.2s',
        minHeight: '100px', // Garante que a área de drop seja visível
    };

    return (
        <Box ref={setNodeRef} sx={style}>
            {children}
        </Box>
    );
};

// Componente Draggable para a Aula (apenas propostas pendentes)
const AulaDraggableCard = ({ aula, onEdit, onDelete, isCoordenador }) => {
    const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
        id: aula.id,
        data: { aula, isPending: aula.status === 'pendente' },
        disabled: aula.status !== 'pendente', // Apenas propostas pendentes são arrastáveis
    });

    const style = transform ? {
        transform: `translate3d(${transform.x}px, ${transform.y}px, 0)`,
        zIndex: 100,
        opacity: isDragging ? 0.5 : 1,
        cursor: aula.status === 'pendente' ? 'grab' : 'default',
    } : {
        cursor: aula.status === 'pendente' ? 'grab' : 'default',
    };

    return (
        <div ref={setNodeRef} style={style} {...listeners} {...attributes}>
            <AulaCard aula={aula} onEdit={onEdit} onDelete={onDelete} isCoordenador={isCoordenador} />
        </div>
    );
};

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

    const logActivity = async (type, aulaData, user) => {
        try {
            await addDoc(collection(db, "logs"), {
                type: type,
                aula: {
                    disciplina: aulaData.disciplina || aulaData.assunto,
                    curso: aulaData.curso,
                    ano: aulaData.ano,
                    status: aulaData.status,
                    dataInicio: aulaData.dataInicio,
                    laboratorioSelecionado: aulaData.laboratorioSelecionado,
                },
                timestamp: serverTimestamp(),
                user: {
                    uid: user.uid,
                    nome: user.nome || user.displayName || user.email,
                }
            });
        } catch (error) {
            console.error("Erro ao registrar log:", error);
        }
    };
    const [aulas, setAulas] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [currentDate, setCurrentDate] = useState(dayjs());
    const [holidays, setHolidays] = useState([]); // Novo estado para feriados
    const [selectedDayFilter, setSelectedDayFilter] = useState(''); // Novo estado para o filtro de dia da semana

    const [filtros, setFiltros] = useState({ laboratorio: [], cursos: [], assunto: '', turno: [], status: ['aprovada'] });
    const [aulasFiltradas, setAulasFiltradas] = useState([]);
    const [filtrosVisiveis, setFiltrosVisiveis] = useState(false);
    const [isAddModalOpen, setIsAddModalOpen] = useState(false); // Estado para o modal de adição
    const [draggedAula, setDraggedAula] = useState(null); // Estado para a aula sendo arrastada

    const [isEditModalOpen, setIsEditModalOpen] = useState(false);
    const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
    const [aulaParaAcao, setAulaParaAcao] = useState(null);
    const [actionLoading, setActionLoading] = useState(false);
    const [feedback, setFeedback] = useState({ open: false, message: '', severity: 'info' });

    const week = useMemo(() => currentDate.startOf('week'), [currentDate]);
    const weekDays = useMemo(() => Array.from({ length: 7 }, (_, i) => week.add(i, 'day')), [week]);

    // Efeito para buscar feriados do ano atual
    useEffect(() => {
        const fetchHolidays = async () => {
            try {
                // Hardcoded para Alagoas/Maceió, conforme o mock
                const year = dayjs().year();
                const fetchedHolidays = await getHolidays(year, 'AL', 'Maceió');
                setHolidays(fetchedHolidays.map(h => ({
                    date: dayjs(h.date).format('YYYY-MM-DD'),
                    name: h.name,
                    type: h.type
                })));
            } catch (err) {
                console.error("Erro ao buscar feriados:", err);
            }
        };
        fetchHolidays();
    }, []);
	
	    const fetchAulasDaSemana = useCallback(async () => {
        setLoading(true);
        const inicioSemana = week.startOf('day').toDate();
        const fimSemana = week.endOf('week').endOf('day').toDate();
        try {
            let q = query(collection(db, 'aulas'), where('dataInicio', '>=', Timestamp.fromDate(inicioSemana)), where('dataInicio', '<=', Timestamp.fromDate(fimSemana)), orderBy('dataInicio', 'asc'));
            
            // Se houver filtros de status, aplica-os
            if (filtros.status.length > 0) {
                q = query(q, where('status', 'in', filtros.status));
            }

            const querySnapshot = await getDocs(q);
            const aulasData = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data(), start: doc.data().dataInicio.toDate(), end: doc.data().dataFim.toDate(), title: doc.data().assunto, laboratorio: doc.data().laboratorioSelecionado }));
            setAulas(aulasData);
        } catch (err) {
            setError("Falha ao carregar o cronograma.");
        } finally {
            setLoading(false);
        }
    }, [week]); // Removido 'filtros' da dependência, pois a query agora é baseada apenas na semana. A filtragem de status é tratada localmente ou na query inicial.

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
    const handleLimparFiltros = () => setFiltros({ laboratorio: [], cursos: [], assunto: '', turno: [], status: ['aprovada'] });

    const handleOpenEditModal = (aula) => { setAulaParaAcao({ ...aula, title: aula.assunto }); setIsEditModalOpen(true); };
    const handleOpenDeleteModal = (aula) => { setAulaParaAcao(aula); setIsDeleteModalOpen(true); };
    const handleCloseModals = () => { setIsEditModalOpen(false); setIsDeleteModalOpen(false); setIsAddModalOpen(false); setAulaParaAcao(null); };
    const handleEditFormChange = (field, value) => setAulaParaAcao(prev => ({ ...prev, [field]: value }));

    const handleSaveChanges = async () => {
        if (!aulaParaAcao) return;
        setActionLoading(true);
        try {
            const aulaDocRef = doc(db, 'aulas', aulaParaAcao.id);
            await updateDoc(aulaDocRef, { 
                assunto: aulaParaAcao.title, 
                laboratorioSelecionado: aulaParaAcao.laboratorio, 
                cursos: aulaParaAcao.cursos,
                // Se for uma proposta pendente, a edição rápida pode ser usada para aprovar
                ...(aulaParaAcao.status === 'pendente' && { status: 'aprovada' })
            });
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
            logActivity('exclusao', aulaParaAcao, { uid: userInfo.uid, nome: userInfo.name });
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
	
	    const handleDragEnd = async (event) => {
	        const { active, over } = event;
	
	        if (!over || active.data.current.isPending !== true) return; // Só permite drop se for uma proposta pendente
	
	        const draggedAula = active.data.current.aula;
	        const newDay = dayjs(over.data.current.day);
	
	        // Calcula a diferença de dias
	        const oldDay = dayjs(draggedAula.start);
	        const diffDays = newDay.diff(oldDay, 'day');
	
	        if (diffDays === 0) return; // Não houve mudança de dia
	
	        // Calcula as novas datas de início e fim
	        const newStart = dayjs(draggedAula.start).add(diffDays, 'day').toDate();
	        const newEnd = dayjs(draggedAula.end).add(diffDays, 'day').toDate();
	
	        setActionLoading(true);
	        try {
	            const aulaDocRef = doc(db, 'aulas', draggedAula.id);
	            await updateDoc(aulaDocRef, {
	                dataInicio: Timestamp.fromDate(newStart),
	                dataFim: Timestamp.fromDate(newEnd),
	                // Opcional: Mudar o status para 'aprovada' se for movida por um coordenador
	                ...(userInfo?.role === 'coordenador' && { status: 'aprovada' })
	            });
	            setFeedback({ open: true, message: `Proposta de aula movida e ${userInfo?.role === 'coordenador' ? 'aprovada' : 'atualizada'} com sucesso!`, severity: 'success' });
	            fetchAulasDaSemana();
	        } catch (err) {
	            setFeedback({ open: true, message: `Erro ao mover a aula: ${err.message}`, severity: 'error' });
	        } finally {
	            setActionLoading(false);
	        }
	    };
	
	    return (
	        <LocalizationProvider dateAdapter={AdapterDayjs} adapterLocale="pt-br">
	            <DndContext onDragEnd={handleDragEnd} modifiers={[restrictToParentElement]}>
	                <Container maxWidth="xl">
                <Paper elevation={3} sx={{ p: 3, mb: 4 }}>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2, flexWrap: 'wrap' }}>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                            <IconButton onClick={() => setCurrentDate(d => d.subtract(1, 'week'))}><ChevronLeft /></IconButton>
                            <Button onClick={() => setCurrentDate(dayjs())} variant="outlined" size="small">Hoje</Button>
                        </Box>
                        <Typography variant="h5" component="h2" textAlign="center">Semana de {week.format('DD/MM')} a {week.endOf('week').format('DD/MM/YYYY')}</Typography>
                        <IconButton onClick={() => setCurrentDate(d => d.add(1, 'week'))}><ChevronRight /></IconButton>
                    </Box>
                    <Box sx={{ my: 2, p: 2, border: '1px solid', borderColor: 'divider', borderRadius: 2 }}>
                        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
                            <Box sx={{ display: 'flex', gap: 2, alignItems: 'center' }}>
                                <Button onClick={() => setFiltrosVisiveis(!filtrosVisiveis)} startIcon={<FilterListIcon />} size="small">
                                    {filtrosVisiveis ? 'Ocultar Filtros Avançados' : 'Exibir Filtros Avançados'}
                                </Button>
                                <DatePicker
                                    label="Ir para Data"
                                    value={currentDate}
                                    onChange={(newValue) => {
                                        if (newValue) {
                                            setCurrentDate(newValue);
                                        }
                                    }}
                                    slotProps={{ textField: { size: 'small', sx: { width: '150px' } } }}
                                />
                            </Box>
                            <Badge color="error" variant="dot" invisible={Object.keys(filtros).every(key => (key === 'status' ? filtros.status.length === 1 && filtros.status[0] === 'aprovada' : Array.isArray(filtros[key]) ? filtros[key].length === 0 : !filtros[key]))}>
                                {/* O botão Limpar Filtros será movido para dentro da Collapse, se necessário, ou removido se a intenção for apenas ter um botão de filtro */}
                            </Badge>
                        </Box>
                        <Collapse in={filtrosVisiveis} timeout="auto" unmountOnExit>
                            
                            {/* ===== INÍCIO DA SEÇÃO CORRIGIDA ===== */}
                            <Grid container spacing={2} sx={{ mt: 1 }}>
                                <Grid item xs={12} sm={6} md={3}><FormControl fullWidth size="small"><InputLabel>Laboratório(s)</InputLabel><Select multiple value={filtros.laboratorio} onChange={(e) => handleFiltroChange('laboratorio', e.target.value)} input={<OutlinedInput label="Laboratório(s)" />} renderValue={(selected) => <Chip label={`${selected.length} sel.`} size="small" />}>{LISTA_LABORATORIOS.map(l => <MenuItem key={l.id} value={l.name}>{l.name}</MenuItem>)}</Select></FormControl></Grid>
                                <Grid item xs={12} sm={6} md={3}><FormControl fullWidth size="small"><InputLabel>Curso(s)</InputLabel><Select multiple value={filtros.cursos} onChange={(e) => handleFiltroChange('cursos', e.target.value)} input={<OutlinedInput label="Curso(s)" />} renderValue={(selected) => <Chip label={`${selected.length} sel.`} size="small" />}>{LISTA_CURSOS.map(c => <MenuItem key={c.value} value={c.value}>{c.label}</MenuItem>)}</Select></FormControl></Grid>
                                <Grid item xs={12} sm={6} md={3}><FormControl fullWidth size="small"><InputLabel>Turno(s)</InputLabel><Select multiple value={filtros.turno} onChange={(e) => handleFiltroChange('turno', e.target.value)} input={<OutlinedInput label="Turno(s)" />} renderValue={(selected) => <Chip label={`${selected.length} sel.`} size="small" />}>{TURNOS.map(t => <MenuItem key={t} value={t}>{t}</MenuItem>)}</Select></FormControl></Grid>
                                <Grid item xs={12} sm={6} md={3}><FormControl fullWidth size="small"><InputLabel>Status</InputLabel><Select multiple value={filtros.status} onChange={(e) => handleFiltroChange('status', e.target.value)} input={<OutlinedInput label="Status" />} renderValue={(selected) => <Chip label={`${selected.length} sel.`} size="small" />}>{STATUS_AULA.map(s => <MenuItem key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</MenuItem>)}</Select></FormControl></Grid>
                                <Grid item xs={12} sm={6} md={3}><TextField fullWidth label="Buscar Assunto" value={filtros.assunto} onChange={(e) => handleFiltroChange('assunto', e.target.value)} size="small" /></Grid>
                                
                                {/* BOTÃO MOVIDO PARA DENTRO DO CONTAINER */}
                                <Grid item xs={12} sx={{ display: 'flex', justifyContent: 'flex-end' }}>
                                    <Button onClick={handleLimparFiltros} variant="outlined">Limpar Filtros</Button>
                                </Grid>

                            </Grid> 
                            {/* TAG DE FECHAMENTO </Grid> (LINHA 236 E 238) REORGANIZADA PARA AQUI */}
                            {/* ===== FIM DA SEÇÃO CORRIGIDA ===== */}

                        </Collapse>
                    </Box>
                </Paper>

                <Grid container spacing={2}>
                        {/* Filtro por Dia da Semana */}
                        <Grid item xs={12}>
                            <FormControl sx={{ minWidth: 150 }} size="small">
                                <InputLabel>Visualizar Dia</InputLabel>
                                <Select
                                    value={selectedDayFilter}
                                    label="Visualizar Dia"
                                    onChange={(e) => setSelectedDayFilter(e.target.value)}
                                >
                                    <MenuItem value="">Todos os Dias</MenuItem>
                                    {weekDays.map((day, index) => (
                                        <MenuItem key={index} value={day.format('dddd')}>
                                            {day.format('dddd')}
                                        </MenuItem>
                                    ))}
                                </Select>
                            </FormControl>
                        </Grid>
                    {weekDays.map(day => {
                        const dayName = day.format('dddd');
                        // Lógica de filtro por dia da semana
                        if (selectedDayFilter && selectedDayFilter !== dayName) {
                            return null; // Não renderiza se o filtro estiver ativo e não for o dia selecionado
                        }

	                        const aulasDoDia = aulasFiltradas.filter(a => dayjs(a.start).isSame(day, 'day'));
	                        const isHoliday = holidays.find(h => h.date === day.format('YYYY-MM-DD')); // Verifica se é feriado
	                        
	                        return (
	                            <Grid item xs={12} sm={6} md={4} lg={selectedDayFilter ? 12 : 3} key={day.toString()}>
	                                <Paper elevation={2} sx={{ p: 2, height: '100%', position: 'relative', border: isHoliday ? '2px solid #F44336' : 'none' }}>
	                                    <DiaDroppable day={day}>
	                                        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
	                                            <Typography variant="h6" component="h3" sx={{ textTransform: 'capitalize', color: isHoliday ? 'error.main' : 'text.primary' }}>
	                                                {day.format('dddd, DD')}
	                                            </Typography>
	                                            {isHoliday && <Tooltip title={isHoliday.name}><Chip label="Feriado" color="error" size="small" /></Tooltip>}
	                                            {userInfo?.role === 'coordenador' && (
	                                                <Tooltip title={`Adicionar aula em ${day.format('DD/MM')}`}>
	                                                    <IconButton size="small" color="primary" onClick={() => { setAulaParaAcao({ dataInicio: day }); setIsAddModalOpen(true); }}>
	                                                        <AddIcon />
	                                                    </IconButton>
	                                                </Tooltip>
	                                            )}
	                                        </Box>
	                                        <Divider sx={{ my: 1 }} />
	                                        <OcupacaoPorHora aulasDoDia={aulasDoDia} />
	                                        <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', minHeight: '50px' }}>
	                                            {aulasDoDia.length > 0 ? aulasDoDia.map(aula => <AulaDraggableCard key={aula.id} aula={aula} onEdit={handleOpenEditModal} onDelete={handleOpenDeleteModal} isCoordenador={userInfo?.role === 'coordenador'} />) : <Typography variant="body2" color="text.secondary" sx={{ p: 1 }}>Nenhuma aula agendada.</Typography>}
	                                        </Box>
	                                    </DiaDroppable>
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

<DialogConfirmacao
                    open={isDeleteModalOpen}
                    onClose={handleCloseModals}
                    onConfirm={handleDeleteConfirm}
                    title="Confirmar Exclusão"
                    message={`Tem certeza que deseja excluir a aula "${aulaParaAcao?.title}"? Esta ação não pode ser desfeita.`}
                    confirmText="Excluir"
                    confirmColor="error"
                    loading={actionLoading}
                />

	                <Snackbar open={feedback.open} autoHideDuration={4000} onClose={() => setFeedback(prev => ({...prev, open: false}))}><Alert severity={feedback.severity} sx={{ width: '100%' }}>{feedback.message}</Alert></Snackbar>
	            </Container>
	            </DndContext>
	        </LocalizationProvider>
	    );
	}

export default CalendarioCronograma;