import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { db } from './firebaseConfig';
import {
    collection, query, where, getDocs, Timestamp, orderBy,
    doc, deleteDoc, addDoc, updateDoc, serverTimestamp
} from 'firebase/firestore';
import {
    Container, Typography, Box, CircularProgress, Paper, Grid,
    Button, IconButton, Tooltip, TextField, Divider, Snackbar, Alert,
    Dialog, DialogTitle, DialogContent, DialogActions, DialogContentText,
    Chip, useTheme, FormControl, InputLabel, Select, MenuItem,
    InputAdornment, Autocomplete, Badge, ToggleButton, ToggleButtonGroup
} from '@mui/material';
import {
    ChevronLeft, ChevronRight, Add as AddIcon,
    Delete as DeleteIcon, Edit as EditIcon, Close as CloseIcon,
    Today as TodayIcon, Search as SearchIcon,
    MenuBook as MenuBookIcon, Visibility as VisibilityIcon,
    Schedule as ScheduleIcon, Group as GroupIcon,
    WbSunny as MorningIcon, WbTwilight as AfternoonIcon, NightlightRound as NightIcon
} from '@mui/icons-material';
import { LocalizationProvider, DatePicker } from '@mui/x-date-pickers';
import { AdapterDayjs } from '@mui/x-date-pickers/AdapterDayjs';
import dayjs from 'dayjs';
import 'dayjs/locale/pt-br';
import isBetween from 'dayjs/plugin/isBetween';
import { LISTA_LABORATORIOS } from './constants/laboratorios';
import { LISTA_CURSOS } from './constants/cursos';
import PropTypes from 'prop-types';

dayjs.locale('pt-br');
dayjs.extend(isBetween);

const COLECAO_REVISOES = 'revisoesTecnicos';

// Mesmos blocos do cronograma principal
const BLOCOS_HORARIO = [
    { value: '07:00-09:10', label: '07:00 - 09:10', turno: 'Matutino'    },
    { value: '09:30-12:00', label: '09:30 - 12:00', turno: 'Matutino'    },
    { value: '13:00-15:10', label: '13:00 - 15:10', turno: 'Vespertino'  },
    { value: '15:30-18:00', label: '15:30 - 18:00', turno: 'Vespertino'  },
    { value: '18:30-20:10', label: '18:30 - 20:10', turno: 'Noturno'     },
    { value: '20:30-22:00', label: '20:30 - 22:00', turno: 'Noturno'     },
];

const TURNO_CONFIG = {
    Matutino:   { cor: '#f57f17', icon: '🌅' },
    Vespertino: { cor: '#1565c0', icon: '☀️'  },
    Noturno:    { cor: '#4a148c', icon: '🌙' },
};

const TIPOS_REVISAO = [
    { value: 'revisao_conteudo',  label: 'Revisão de Conteúdo',  color: '#1976d2', icon: '📖' },
    { value: 'revisao_pre_prova', label: 'Revisão Pré-Prova',    color: '#7b1fa2', icon: '📝' },
    { value: 'aula_reforco',      label: 'Aula de Reforço',      color: '#388e3c', icon: '💡' },
    { value: 'pratica_extra',     label: 'Prática Extra',        color: '#f57c00', icon: '🔬' },
    { value: 'monitoria',         label: 'Monitoria',            color: '#0288d1', icon: '🎓' },
    { value: 'outro',             label: 'Outro',                color: '#616161', icon: '📌' },
];

// Status reformulados: mais claros para o técnico
const STATUS_REVISAO = [
    {
        value: 'planejada',
        label: 'Planejada',
        descricao: 'A revisão foi registrada mas ainda não foi confirmada com o professor ou turma.',
        color: 'default',
        chip: 'default',
    },
    {
        value: 'confirmada',
        label: 'Confirmada',
        descricao: 'O professor e a turma já foram avisados. A revisão vai acontecer.',
        color: '#0288d1',
        chip: 'info',
    },
    {
        value: 'realizada',
        label: 'Realizada ✓',
        descricao: 'A revisão já aconteceu com sucesso.',
        color: '#2e7d32',
        chip: 'success',
    },
    {
        value: 'cancelada',
        label: 'Cancelada',
        descricao: 'A revisão foi cancelada e não vai mais acontecer.',
        color: '#c62828',
        chip: 'error',
    },
];

const getTipoInfo   = (v) => TIPOS_REVISAO.find(t => t.value === v)  || TIPOS_REVISAO[TIPOS_REVISAO.length - 1];
const getStatusInfo = (v) => STATUS_REVISAO.find(s => s.value === v) || STATUS_REVISAO[0];

// ─── Card de Revisão ─────────────────────────────────────────────────────────
function RevisaoCard({ revisao, onEdit, onDelete, userInfo }) {
    const [expanded, setExpanded] = useState(false);
    const theme = useTheme();
    const tipo   = getTipoInfo(revisao.tipo);
    const status = getStatusInfo(revisao.status);
    const isCriador = revisao.criadoPorUid === userInfo?.uid;

    const cursosLabel = useMemo(() =>
        revisao.cursos?.length
            ? revisao.cursos.map(v => LISTA_CURSOS.find(c => c.value === v)?.label || v).join(', ')
            : null,
    [revisao.cursos]);

    const blocoLabel = useMemo(() =>
        BLOCOS_HORARIO.find(b => b.value === revisao.horarioSlot)?.label || revisao.horarioSlot || null,
    [revisao.horarioSlot]);

    return (
        <Paper
            elevation={expanded ? 4 : 1}
            onClick={() => setExpanded(!expanded)}
            sx={{
                width: '100%', mb: 1, p: 1.5, cursor: 'pointer',
                borderLeft: `4px solid ${tipo.color}`,
                borderRadius: 2,
                transition: 'all 0.2s',
                bgcolor: theme.palette.mode === 'dark' ? `${tipo.color}22` : `${tipo.color}11`,
                '&:hover': { transform: 'translateY(-1px)', boxShadow: 3 }
            }}
        >
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 1 }}>
                <Box sx={{ flex: 1, minWidth: 0 }}>
                    <Typography variant="caption" sx={{ color: tipo.color, fontWeight: 'bold' }}>
                        {tipo.icon} {tipo.label}
                    </Typography>
                    <Typography variant="body2" fontWeight="bold"
                        sx={{ mt: 0.2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: expanded ? 'normal' : 'nowrap' }}>
                        {revisao.titulo}
                    </Typography>
                    {blocoLabel && (
                        <Typography variant="caption" color="text.secondary" sx={{ display: 'flex', alignItems: 'center', gap: 0.3, mt: 0.2 }}>
                            <ScheduleIcon sx={{ fontSize: 11 }} /> {blocoLabel}
                        </Typography>
                    )}
                </Box>
                <Chip label={status.label} color={status.chip} size="small" sx={{ height: 20, fontSize: '0.6rem', flexShrink: 0 }} />
            </Box>

            {expanded && (
                <Box sx={{ mt: 1.5 }} onClick={e => e.stopPropagation()}>
                    {cursosLabel && (
                        <Typography variant="caption" color="text.secondary" display="block">
                            <GroupIcon sx={{ fontSize: 12, mr: 0.3 }} /><strong>Cursos:</strong> {cursosLabel}
                        </Typography>
                    )}
                    {revisao.laboratorio && (
                        <Typography variant="caption" color="text.secondary" display="block" sx={{ mt: 0.3 }}>
                            🏛️ <strong>Lab:</strong> {revisao.laboratorio}
                        </Typography>
                    )}
                    {revisao.professor && (
                        <Typography variant="caption" color="text.secondary" display="block" sx={{ mt: 0.3 }}>
                            👨‍🏫 <strong>Professor:</strong> {revisao.professor}
                        </Typography>
                    )}
                    {revisao.descricao && (
                        <Typography variant="caption" color="text.secondary" display="block" sx={{ mt: 0.3 }}>
                            📝 {revisao.descricao}
                        </Typography>
                    )}

                    {/* Explicação clara do status */}
                    <Box sx={{ mt: 1, p: 1, bgcolor: 'action.hover', borderRadius: 1 }}>
                        <Typography variant="caption" color="text.secondary" fontStyle="italic">
                            ℹ️ <strong>{status.label}:</strong> {status.descricao}
                        </Typography>
                    </Box>

                    <Typography variant="caption" color="text.disabled" display="block" sx={{ mt: 0.5 }}>
                        Registrado por: {revisao.criadoPorNome || 'Técnico'}
                    </Typography>
                    <Box sx={{ display: 'flex', gap: 0.5, mt: 1 }}>
                        <Button size="small" variant="outlined" startIcon={<EditIcon />}
                            onClick={() => onEdit(revisao)} sx={{ fontSize: '0.7rem', py: 0.2 }}>
                            Editar
                        </Button>
                        {isCriador && (
                            <Button size="small" variant="outlined" color="error" startIcon={<DeleteIcon />}
                                onClick={() => onDelete(revisao)} sx={{ fontSize: '0.7rem', py: 0.2 }}>
                                Excluir
                            </Button>
                        )}
                    </Box>
                </Box>
            )}
        </Paper>
    );
}

// ─── Formulário de Revisão ────────────────────────────────────────────────────
function FormRevisao({ revisaoInicial, dataInicial, onSalvar, onCancelar, loading }) {
    const [form, setForm] = useState({
        titulo:      revisaoInicial?.titulo      || '',
        tipo:        revisaoInicial?.tipo        || 'revisao_conteudo',
        cursos:      revisaoInicial?.cursos      || [],
        laboratorio: revisaoInicial?.laboratorio || '',
        professor:   revisaoInicial?.professor   || '',
        horarioSlot: revisaoInicial?.horarioSlot || '',
        descricao:   revisaoInicial?.descricao   || '',
        status:      revisaoInicial?.status      || 'planejada',
        data: revisaoInicial?.data
            ? dayjs(revisaoInicial.data.toDate ? revisaoInicial.data.toDate() : revisaoInicial.data)
            : (dataInicial ? dayjs(dataInicial) : dayjs()),
    });
    const [errors, setErrors] = useState({});

    const validar = () => {
        const e = {};
        if (!form.titulo.trim())                e.titulo = 'Título obrigatório';
        if (!form.data || !form.data.isValid()) e.data   = 'Data inválida';
        setErrors(e);
        return Object.keys(e).length === 0;
    };

    const f = (field) => (e) => setForm(p => ({ ...p, [field]: e.target.value }));

    // Agrupa blocos por turno para exibição
    const blocosPorTurno = useMemo(() => {
        const grupos = {};
        BLOCOS_HORARIO.forEach(b => {
            if (!grupos[b.turno]) grupos[b.turno] = [];
            grupos[b.turno].push(b);
        });
        return grupos;
    }, []);

    const statusSelecionado = getStatusInfo(form.status);

    return (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 1 }}>
            <TextField label="Título da Revisão *" value={form.titulo} onChange={f('titulo')}
                error={!!errors.titulo} helperText={errors.titulo} fullWidth size="small"
                placeholder="Ex: Revisão de Bioquímica — Turma 3" />

            <Grid container spacing={2}>
                <Grid item xs={12} sm={6}>
                    <FormControl fullWidth size="small">
                        <InputLabel>Tipo de Revisão</InputLabel>
                        <Select value={form.tipo} onChange={f('tipo')} label="Tipo de Revisão">
                            {TIPOS_REVISAO.map(t => <MenuItem key={t.value} value={t.value}>{t.icon} {t.label}</MenuItem>)}
                        </Select>
                    </FormControl>
                </Grid>
                <Grid item xs={12} sm={6}>
                    <FormControl fullWidth size="small">
                        <InputLabel>Situação</InputLabel>
                        <Select value={form.status} onChange={f('status')} label="Situação">
                            {STATUS_REVISAO.map(s => (
                                <MenuItem key={s.value} value={s.value}>
                                    <Box>
                                        <Typography variant="body2">{s.label}</Typography>
                                        <Typography variant="caption" color="text.secondary">{s.descricao}</Typography>
                                    </Box>
                                </MenuItem>
                            ))}
                        </Select>
                    </FormControl>
                    {/* Descrição do status selecionado */}
                    <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5, display: 'block', fontStyle: 'italic' }}>
                        ℹ️ {statusSelecionado.descricao}
                    </Typography>
                </Grid>
            </Grid>

            <Autocomplete multiple options={LISTA_CURSOS} getOptionLabel={o => o.label}
                isOptionEqualToValue={(o, v) => o.value === v.value || o.value === v}
                value={form.cursos.map(v => LISTA_CURSOS.find(c => c.value === v) || { value: v, label: v })}
                onChange={(_, nv) => setForm(p => ({ ...p, cursos: nv.map(o => o.value || o) }))}
                renderInput={params => <TextField {...params} size="small" label="Cursos envolvidos" placeholder="Selecione..." />}
                renderTags={(val, getTagProps) =>
                    val.map((opt, i) => <Chip key={opt.value} label={opt.label} size="small" {...getTagProps({ index: i })} />)
                }
            />

            <Grid container spacing={2}>
                <Grid item xs={12} sm={6}>
                    <LocalizationProvider dateAdapter={AdapterDayjs} adapterLocale="pt-br">
                        <DatePicker label="Data *" value={form.data}
                            onChange={val => setForm(p => ({ ...p, data: val }))}
                            enableAccessibleFieldDOMStructure={false}
                            slotProps={{ textField: { size: 'small', fullWidth: true, error: !!errors.data, helperText: errors.data } }}
                        />
                    </LocalizationProvider>
                </Grid>
                <Grid item xs={12} sm={6}>
                    <FormControl fullWidth size="small">
                        <InputLabel>Bloco de Horário</InputLabel>
                        <Select value={form.horarioSlot} onChange={f('horarioSlot')} label="Bloco de Horário">
                            <MenuItem value=""><em>Não definido</em></MenuItem>
                            {Object.entries(blocosPorTurno).map(([turno, blocos]) => [
                                <MenuItem key={`header-${turno}`} disabled sx={{ fontWeight: 'bold', opacity: 1, color: TURNO_CONFIG[turno]?.cor || 'text.primary' }}>
                                    {TURNO_CONFIG[turno]?.icon} {turno}
                                </MenuItem>,
                                ...blocos.map(b => (
                                    <MenuItem key={b.value} value={b.value} sx={{ pl: 3 }}>
                                        {b.label}
                                    </MenuItem>
                                ))
                            ])}
                        </Select>
                    </FormControl>
                </Grid>
            </Grid>

            <Grid container spacing={2}>
                <Grid item xs={12} sm={6}>
                    <FormControl fullWidth size="small">
                        <InputLabel>Laboratório (opcional)</InputLabel>
                        <Select value={form.laboratorio} onChange={f('laboratorio')} label="Laboratório (opcional)">
                            <MenuItem value="">Nenhum</MenuItem>
                            {LISTA_LABORATORIOS.map(l => <MenuItem key={l.id} value={l.name}>{l.name}</MenuItem>)}
                        </Select>
                    </FormControl>
                </Grid>
                <Grid item xs={12} sm={6}>
                    <TextField label="Professor responsável (opcional)" value={form.professor} onChange={f('professor')}
                        fullWidth size="small" placeholder="Nome do professor" />
                </Grid>
            </Grid>

            <TextField label="Observações" value={form.descricao} onChange={f('descricao')}
                fullWidth size="small" multiline rows={3}
                placeholder="Conteúdos a revisar, turma, materiais necessários..." />

            <Box sx={{ display: 'flex', gap: 1, justifyContent: 'flex-end' }}>
                <Button onClick={onCancelar} disabled={loading}>Cancelar</Button>
                <Button variant="contained" onClick={() => { if (validar()) onSalvar(form); }} disabled={loading}
                    startIcon={loading ? <CircularProgress size={16} /> : null}>
                    {revisaoInicial?.id ? 'Salvar Alterações' : 'Adicionar Revisão'}
                </Button>
            </Box>
        </Box>
    );
}

// ─── Componente Principal ─────────────────────────────────────────────────────
function CalendarioRevisoesTecnico({ userInfo }) {
    const theme = useTheme();
    const [currentDate, setCurrentDate]     = useState(dayjs());
    const [revisoes, setRevisoes]           = useState([]);
    const [loading, setLoading]             = useState(true);
    const [actionLoading, setActionLoading] = useState(false);
    const [isPickerOpen, setIsPickerOpen]   = useState(false);

    const [isFormOpen, setIsFormOpen]     = useState(false);
    const [isDeleteOpen, setIsDeleteOpen] = useState(false);
    const [revisaoSelecionada, setRevisaoSelecionada] = useState(null);
    const [dataSelecionada, setDataSelecionada]       = useState(null);

    const [filtroBusca,  setFiltroBusca]  = useState('');
    const [filtroStatus, setFiltroStatus] = useState('');
    const [filtroTipo,   setFiltroTipo]   = useState('');

    const [feedback, setFeedback] = useState({ open: false, message: '', severity: 'success' });

    const weekStart = useMemo(() => currentDate.startOf('week'), [currentDate]);
    const weekEnd   = useMemo(() => currentDate.endOf('week'),   [currentDate]);
    const weekDays  = useMemo(() => Array.from({ length: 7 }, (_, i) => weekStart.add(i, 'day')), [weekStart]);

    const fetchRevisoes = useCallback(async () => {
        setLoading(true);
        try {
            const q = query(
                collection(db, COLECAO_REVISOES),
                where('data', '>=', Timestamp.fromDate(weekStart.toDate())),
                where('data', '<=', Timestamp.fromDate(weekEnd.toDate())),
                orderBy('data', 'asc')
            );
            const snap = await getDocs(q);
            setRevisoes(snap.docs.map(d => ({ id: d.id, ...d.data() })));
        } catch (e) {
            console.error(e);
            setFeedback({ open: true, message: 'Erro ao carregar revisões.', severity: 'error' });
        } finally {
            setLoading(false);
        }
    }, [weekStart, weekEnd]);

    useEffect(() => { fetchRevisoes(); }, [fetchRevisoes]);

    const revisoesDoDia = useCallback((day) => {
        return revisoes.filter(r => {
            const d = r.data?.toDate ? r.data.toDate() : new Date(r.data);
            if (!dayjs(d).isSame(day, 'day')) return false;
            if (filtroBusca  && !r.titulo?.toLowerCase().includes(filtroBusca.toLowerCase())) return false;
            if (filtroStatus && r.status !== filtroStatus) return false;
            if (filtroTipo   && r.tipo   !== filtroTipo)   return false;
            return true;
        });
    }, [revisoes, filtroBusca, filtroStatus, filtroTipo]);

    const handleSalvar = async (form) => {
        setActionLoading(true);
        try {
            const dados = {
                titulo: form.titulo, tipo: form.tipo, cursos: form.cursos,
                laboratorio: form.laboratorio || '', professor: form.professor || '',
                horarioSlot: form.horarioSlot || '', descricao: form.descricao || '',
                status: form.status, data: Timestamp.fromDate(form.data.toDate()),
                criadoPorUid:  userInfo?.uid,
                criadoPorNome: userInfo?.name || userInfo?.email || 'Técnico',
                atualizadoEm:  serverTimestamp(),
            };
            if (revisaoSelecionada?.id) {
                await updateDoc(doc(db, COLECAO_REVISOES, revisaoSelecionada.id), dados);
                setFeedback({ open: true, message: 'Revisão atualizada!', severity: 'success' });
            } else {
                dados.criadoEm = serverTimestamp();
                await addDoc(collection(db, COLECAO_REVISOES), dados);
                setFeedback({ open: true, message: 'Revisão adicionada!', severity: 'success' });
            }
            setIsFormOpen(false);
            setRevisaoSelecionada(null);
            fetchRevisoes();
        } catch (e) {
            console.error(e);
            setFeedback({ open: true, message: 'Erro ao salvar.', severity: 'error' });
        } finally {
            setActionLoading(false);
        }
    };

    const handleDeletar = async () => {
        if (!revisaoSelecionada?.id) return;
        setActionLoading(true);
        try {
            await deleteDoc(doc(db, COLECAO_REVISOES, revisaoSelecionada.id));
            setFeedback({ open: true, message: 'Revisão excluída.', severity: 'info' });
            setIsDeleteOpen(false);
            setRevisaoSelecionada(null);
            fetchRevisoes();
        } catch (e) {
            setFeedback({ open: true, message: 'Erro ao excluir.', severity: 'error' });
        } finally {
            setActionLoading(false);
        }
    };

    const abrirForm = (revisao = null, data = null) => {
        setRevisaoSelecionada(revisao);
        setDataSelecionada(data || dayjs());
        setIsFormOpen(true);
    };

    const totalPlanejadas  = useMemo(() => revisoes.filter(r => r.status === 'planejada').length,  [revisoes]);
    const totalConfirmadas = useMemo(() => revisoes.filter(r => r.status === 'confirmada').length, [revisoes]);
    const totalRealizadas  = useMemo(() => revisoes.filter(r => r.status === 'realizada').length,  [revisoes]);

    return (
        <LocalizationProvider dateAdapter={AdapterDayjs} adapterLocale="pt-br">
            <Container maxWidth="xl">
                <Box sx={{ mb: 3, display: 'flex', alignItems: 'center', gap: 2, flexWrap: 'wrap' }}>
                    <MenuBookIcon sx={{ fontSize: 36, color: 'primary.main' }} />
                    <Box>
                        <Typography variant="h5" fontWeight="bold">Calendário de Revisões</Typography>
                        <Typography variant="body2" color="text.secondary">
                            Aulas de revisão e reforço para alunos — visível só para técnicos
                        </Typography>
                    </Box>
                    <Chip icon={<VisibilityIcon />} label="Visível apenas para técnicos"
                        color="primary" variant="outlined" size="small" sx={{ ml: 'auto' }} />
                </Box>

                <Grid container spacing={2} sx={{ mb: 3 }}>
                    {[
                        { label: 'Total na semana', value: revisoes.length,  color: '#1976d2' },
                        { label: 'Planejadas',      value: totalPlanejadas,  color: '#757575' },
                        { label: 'Confirmadas',     value: totalConfirmadas, color: '#0288d1' },
                        { label: 'Realizadas',      value: totalRealizadas,  color: '#2e7d32' },
                    ].map(item => (
                        <Grid item xs={6} sm={3} key={item.label}>
                            <Paper elevation={2} sx={{ p: 2, textAlign: 'center', borderTop: `3px solid ${item.color}` }}>
                                <Typography variant="h4" fontWeight="bold" sx={{ color: item.color }}>{item.value}</Typography>
                                <Typography variant="caption" color="text.secondary">{item.label}</Typography>
                            </Paper>
                        </Grid>
                    ))}
                </Grid>

                <Paper elevation={2} sx={{ p: 2, mb: 2, borderRadius: 2 }}>
                    <Grid container spacing={2} alignItems="center">
                        <Grid item xs={12} md={4} sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 1 }}>
                            <IconButton onClick={() => setCurrentDate(d => d.subtract(1, 'week'))}><ChevronLeft /></IconButton>
                            <Button variant="outlined" size="small" onClick={() => setCurrentDate(dayjs())} startIcon={<TodayIcon />}>Hoje</Button>
                            <Box sx={{ position: 'relative' }}>
                                <Typography variant="h6"
                                    sx={{ minWidth: 200, textAlign: 'center', fontWeight: 'medium', cursor: 'pointer', '&:hover': { color: 'primary.main' } }}
                                    onClick={() => setIsPickerOpen(true)}>
                                    {weekStart.format('DD MMM')} – {weekEnd.format('DD MMM YYYY')}
                                </Typography>
                                <DatePicker enableAccessibleFieldDOMStructure={false} open={isPickerOpen}
                                    onClose={() => setIsPickerOpen(false)} value={currentDate}
                                    onChange={val => { if (val) { setCurrentDate(dayjs(val)); setIsPickerOpen(false); } }}
                                    slots={{ textField: () => null }} />
                            </Box>
                            <IconButton onClick={() => setCurrentDate(d => d.add(1, 'week'))}><ChevronRight /></IconButton>
                        </Grid>
                        <Grid item xs={12} md={5}>
                            <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                                <TextField size="small" placeholder="Buscar..." value={filtroBusca}
                                    onChange={e => setFiltroBusca(e.target.value)}
                                    InputProps={{ startAdornment: <InputAdornment position="start"><SearchIcon fontSize="small" /></InputAdornment> }}
                                    sx={{ flex: 1, minWidth: 120 }} />
                                <FormControl size="small" sx={{ minWidth: 130 }}>
                                    <InputLabel>Situação</InputLabel>
                                    <Select value={filtroStatus} onChange={e => setFiltroStatus(e.target.value)} label="Situação">
                                        <MenuItem value="">Todas</MenuItem>
                                        {STATUS_REVISAO.map(s => <MenuItem key={s.value} value={s.value}>{s.label}</MenuItem>)}
                                    </Select>
                                </FormControl>
                                <FormControl size="small" sx={{ minWidth: 140 }}>
                                    <InputLabel>Tipo</InputLabel>
                                    <Select value={filtroTipo} onChange={e => setFiltroTipo(e.target.value)} label="Tipo">
                                        <MenuItem value="">Todos</MenuItem>
                                        {TIPOS_REVISAO.map(t => <MenuItem key={t.value} value={t.value}>{t.icon} {t.label}</MenuItem>)}
                                    </Select>
                                </FormControl>
                            </Box>
                        </Grid>
                        <Grid item xs={12} md={3} sx={{ display: 'flex', justifyContent: 'flex-end' }}>
                            <Button variant="contained" startIcon={<AddIcon />} onClick={() => abrirForm()}>Nova Revisão</Button>
                        </Grid>
                    </Grid>
                </Paper>

                {loading ? (
                    <Box sx={{ display: 'flex', justifyContent: 'center', py: 10 }}><CircularProgress /></Box>
                ) : (
                    <Grid container spacing={1.5}>
                        {weekDays.map(day => {
                            const isToday = day.isSame(dayjs(), 'day');
                            const lista   = revisoesDoDia(day);
                            return (
                                <Grid item xs={12} md={1.71} key={day.format('YYYY-MM-DD')}>
                                    <Paper elevation={isToday ? 4 : 1} sx={{
                                        p: 1, minHeight: '60vh',
                                        bgcolor: isToday ? (theme.palette.mode === 'dark' ? 'rgba(25,118,210,0.12)' : 'rgba(25,118,210,0.04)') : 'background.paper',
                                        borderTop: isToday ? '4px solid #1976d2' : '4px solid transparent',
                                        borderRadius: 2,
                                    }}>
                                        <Box sx={{ p: 1, mb: 1 }}>
                                            <Typography variant="subtitle2" align="center"
                                                sx={{ fontWeight: 'bold', color: isToday ? 'primary.main' : 'text.secondary', textTransform: 'capitalize' }}>
                                                {day.format('ddd, DD/MM')}
                                            </Typography>
                                            {lista.length > 0 && (
                                                <Box sx={{ display: 'flex', justifyContent: 'center', mt: 0.3 }}>
                                                    <Badge badgeContent={lista.length} color="primary" />
                                                </Box>
                                            )}
                                        </Box>
                                        <Divider sx={{ mb: 1 }} />
                                        <Box sx={{ display: 'flex', flexDirection: 'column' }}>
                                            {lista.map(r => (
                                                <RevisaoCard key={r.id} revisao={r} userInfo={userInfo}
                                                    onEdit={rev => abrirForm(rev)}
                                                    onDelete={rev => { setRevisaoSelecionada(rev); setIsDeleteOpen(true); }} />
                                            ))}
                                        </Box>
                                        <Box sx={{ display: 'flex', justifyContent: 'center', mt: 1, opacity: 0.3, '&:hover': { opacity: 1 } }}>
                                            <Tooltip title={`Adicionar revisão em ${day.format('DD/MM')}`}>
                                                <IconButton size="small" onClick={() => abrirForm(null, day)}><AddIcon fontSize="small" /></IconButton>
                                            </Tooltip>
                                        </Box>
                                    </Paper>
                                </Grid>
                            );
                        })}
                    </Grid>
                )}

                <Dialog open={isFormOpen} onClose={() => { setIsFormOpen(false); setRevisaoSelecionada(null); }} maxWidth="sm" fullWidth>
                    <DialogTitle sx={{ m: 0, p: 2, bgcolor: 'primary.main', color: 'white', display: 'flex', alignItems: 'center', gap: 1 }}>
                        <MenuBookIcon /> {revisaoSelecionada?.id ? 'Editar Revisão' : 'Nova Revisão de Conteúdo'}
                        <IconButton onClick={() => { setIsFormOpen(false); setRevisaoSelecionada(null); }} sx={{ position: 'absolute', right: 8, top: 8, color: 'white' }}>
                            <CloseIcon />
                        </IconButton>
                    </DialogTitle>
                    <DialogContent sx={{ mt: 2 }}>
                        <FormRevisao revisaoInicial={revisaoSelecionada} dataInicial={dataSelecionada}
                            onSalvar={handleSalvar}
                            onCancelar={() => { setIsFormOpen(false); setRevisaoSelecionada(null); }}
                            loading={actionLoading} />
                    </DialogContent>
                </Dialog>

                <Dialog open={isDeleteOpen} onClose={() => setIsDeleteOpen(false)} maxWidth="xs" fullWidth>
                    <DialogTitle>Excluir Revisão?</DialogTitle>
                    <DialogContent>
                        <DialogContentText>
                            Tem certeza que deseja excluir <strong>"{revisaoSelecionada?.titulo}"</strong>? Esta ação não pode ser desfeita.
                        </DialogContentText>
                    </DialogContent>
                    <DialogActions>
                        <Button onClick={() => setIsDeleteOpen(false)} disabled={actionLoading}>Cancelar</Button>
                        <Button variant="contained" color="error" onClick={handleDeletar} disabled={actionLoading}
                            startIcon={actionLoading ? <CircularProgress size={16} /> : <DeleteIcon />}>
                            Excluir
                        </Button>
                    </DialogActions>
                </Dialog>

                <Snackbar open={feedback.open} autoHideDuration={4000} onClose={() => setFeedback(p => ({ ...p, open: false }))}>
                    <Alert severity={feedback.severity}>{feedback.message}</Alert>
                </Snackbar>
            </Container>
        </LocalizationProvider>
    );
}

CalendarioRevisoesTecnico.propTypes = { userInfo: PropTypes.object.isRequired };
export default CalendarioRevisoesTecnico;
