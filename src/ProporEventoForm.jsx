import React, { useState, useEffect } from 'react';
import {
    Container, Typography, TextField, Button, Grid, MenuItem, FormControl, InputLabel,
    Select, Box, Paper, Snackbar, Alert, CircularProgress, OutlinedInput, Chip, IconButton, Tooltip,
    List, ListItem, ListItemText, FormHelperText, Dialog, DialogTitle, DialogContent, DialogActions
} from '@mui/material';
import { ArrowBack, Delete as DeleteIcon, Add as AddIcon, Lock as LockIcon } from '@mui/icons-material';
import { AdapterDayjs } from '@mui/x-date-pickers/AdapterDayjs';
import { LocalizationProvider } from '@mui/x-date-pickers';
import { DatePicker } from '@mui/x-date-pickers';
import { useNavigate, useParams } from 'react-router-dom';
import { db } from './firebaseConfig';
import {
    collection, addDoc, serverTimestamp, doc, getDoc, updateDoc, Timestamp, query, where, getDocs, writeBatch
} from 'firebase/firestore';
import dayjs from 'dayjs';
import 'dayjs/locale/pt-br';
import { LISTA_LABORATORIOS, TIPOS_LABORATORIO } from './constants/laboratorios';
import PropTypes from 'prop-types';
import DialogConfirmacao from './components/DialogConfirmacao';
import { notificadorTelegram } from './ia-estruturada/NotificadorTelegram';

dayjs.locale('pt-br');

const EVENT_TYPES = ['Manutenção', 'Feriado', 'Evento', 'Giro', 'Outro'];
const BLOCOS_HORARIO = [
    { "value": "07:00-09:10", "label": "07:00 - 09:10", "turno": "Matutino" },
    { "value": "09:30-12:00", "label": "09:30 - 12:00", "turno": "Matutino" },
    { "value": "13:00-15:10", "label": "13:00 - 15:10", "turno": "Vespertino" },
    { "value": "15:30-18:00", "label": "15:30 - 18:00", "turno": "Vespertino" },
    { "value": "18:30-20:10", "label": "18:30 - 20:10", "turno": "Noturno" },
    { "value": "20:30-22:00", "label": "20:30 - 22:00", "turno": "Noturno" },
];

const TELEGRAM_CHAT_ID = import.meta.env.VITE_TELEGRAM_CHAT_ID;

// Função auxiliar para evitar erros de data inválida
const safeDayjs = (val) => {
    if (!val) return null;
    if (dayjs.isDayjs(val)) return val;
    if (val.toDate && typeof val.toDate === 'function') return dayjs(val.toDate());
    const parsed = dayjs(val);
    return parsed.isValid() ? parsed : null;
};

function ProporEventoForm({ userInfo, currentUser, initialDate, onSuccess, onCancel, isModal, formTitle, eventoId: propEventoId }) {
    const [formData, setFormData] = useState({
        titulo: '', descricao: '', tipo: EVENT_TYPES[0],
        dataInicio: safeDayjs(initialDate) || null, horarioSlotString: [], dynamicLabs: [{ tipo: '', laboratorios: [] }],
    });
    const [errors, setErrors] = useState({});
    const [loadingSubmit, setLoadingSubmit] = useState(false);
    const [isEditMode, setIsEditMode] = useState(false);
    const [openSnackbar, setOpenSnackbar] = useState(false);
    const [snackbarMessage, setSnackbarMessage] = useState('');
    const [snackbarSeverity, setSnackbarSeverity] = useState('success');
    const [openDuplicateDialog, setOpenDuplicateDialog] = useState(false);
    const [conflitos, setConflitos] = useState([]);
    
    const [openConfirmModal, setOpenConfirmModal] = useState(false);
    const [eventosParaConfirmar, setEventosParaConfirmar] = useState([]);
    const [horariosOcupados, setHorariosOcupados] = useState([]);
    const [verificandoDisp, setVerificandoDisp] = useState(false);
    const [diasTotalmenteOcupados, setDiasTotalmenteOcupados] = useState([]);
    const [diasParcialmenteOcupados, setDiasParcialmenteOcupados] = useState([]);
    const [mesVisivel, setMesVisivel] = useState(dayjs());
    const [loadingCalendario, setLoadingCalendario] = useState(false);

    const [secao1Completa, setSecao1Completa] = useState(false);
    const [secao2Completa, setSecao2Completa] = useState(false);

    const navigate = useNavigate();
    const { eventoId: paramEventoId } = useParams();
    const eventoId = propEventoId || paramEventoId;

    // Efeito para Seção 1
    useEffect(() => {
        if (eventoId) {
            setSecao1Completa(true);
            return;
        }
        const completa = formData.titulo.trim() !== '' && formData.tipo !== '';
        setSecao1Completa(completa);
    }, [formData.titulo, formData.tipo, eventoId]);

    // Efeito para Seção 2
    useEffect(() => {
        if (eventoId) {
            setSecao2Completa(true);
            return;
        }
        const labsCompletos = formData.dynamicLabs.every(lab => lab && lab.tipo !== '' && lab.laboratorios.length > 0);
        setSecao2Completa(labsCompletos && secao1Completa);
    }, [formData.dynamicLabs, secao1Completa, eventoId]);

    // Busca ocupação do mês para o DatePicker
    useEffect(() => {
        const fetchOcupacaoDoMes = async () => {
            setLoadingCalendario(true);
            const inicioDoMes = mesVisivel.startOf('month').toDate();
            const fimDoMes = mesVisivel.endOf('month').toDate();
            try {
                const qAulas = query(collection(db, "aulas"), where("dataInicio", ">=", Timestamp.fromDate(inicioDoMes)), where("dataInicio", "<=", Timestamp.fromDate(fimDoMes)));
                const querySnapshotAulas = await getDocs(qAulas);
                const aulasDoMes = querySnapshotAulas.docs.map(doc => doc.data());
                
                const qEventos = query(collection(db, "eventosManutencao"), where("dataInicio", ">=", Timestamp.fromDate(inicioDoMes)), where("dataInicio", "<=", Timestamp.fromDate(fimDoMes)));
                const querySnapshotEventos = await getDocs(qEventos);
                const eventosDoMes = querySnapshotEventos.docs.map(doc => doc.data());

                const ocupacaoPorDia = {};
                
                aulasDoMes.forEach(aula => {
                    const dia = dayjs(aula.dataInicio.toDate()).format('YYYY-MM-DD');
                    if (!ocupacaoPorDia[dia]) ocupacaoPorDia[dia] = new Set();
                    ocupacaoPorDia[dia].add(`${aula.laboratorioSelecionado}-${aula.horarioSlotString}`);
                });

                eventosDoMes.forEach(evento => {
                    const dia = dayjs(evento.dataInicio.toDate()).format('YYYY-MM-DD');
                    if (!ocupacaoPorDia[dia]) ocupacaoPorDia[dia] = new Set();
                    if (evento.laboratorio === 'Todos') {
                        LISTA_LABORATORIOS.forEach(lab => {
                            BLOCOS_HORARIO.forEach(bloco => {
                                ocupacaoPorDia[dia].add(`${lab.name}-${bloco.value}`);
                            });
                        });
                    } else {
                        ocupacaoPorDia[dia].add(`${evento.laboratorio}-${evento.horarioSlotString}`);
                    }
                });

                const totalSlotsPossiveis = LISTA_LABORATORIOS.length * BLOCOS_HORARIO.length;
                const diasTotalmenteLotados = [];
                const diasComAlgumaOcupacao = [];
                for (const dia in ocupacaoPorDia) {
                    diasComAlgumaOcupacao.push(dia);
                    if (ocupacaoPorDia[dia].size >= totalSlotsPossiveis) diasTotalmenteLotados.push(dia);
                }
                setDiasTotalmenteOcupados(diasTotalmenteLotados);
                setDiasParcialmenteOcupados(diasComAlgumaOcupacao);
            } catch (error) {
                console.error("Erro ao buscar ocupação do mês:", error);
            } finally {
                setLoadingCalendario(false);
            }
        };
        fetchOcupacaoDoMes();
    }, [mesVisivel]);

    // Verifica disponibilidade de horários para o dia selecionado
    useEffect(() => {
        const verificarDisponibilidade = async () => {
            if (!secao2Completa && !eventoId) {
                setHorariosOcupados([]);
                return;
            }
            const laboratoriosParaVerificar = formData.dynamicLabs.flatMap(lab => lab.laboratorios).filter(Boolean);
            if (!formData.dataInicio || laboratoriosParaVerificar.length === 0) {
                setHorariosOcupados([]);
                return;
            }
            setVerificandoDisp(true);
            try {
                const diaSelecionado = dayjs(formData.dataInicio).startOf('day');
                
                // Busca Aulas
                const qAulas = query(collection(db, "aulas"), 
                    where("laboratorioSelecionado", "in", laboratoriosParaVerificar), 
                    where("dataInicio", ">=", Timestamp.fromDate(diaSelecionado.toDate())), 
                    where("dataInicio", "<", Timestamp.fromDate(diaSelecionado.add(1, 'day').toDate()))
                );
                const snapAulas = await getDocs(qAulas);
                const slotsAulas = snapAulas.docs.map(doc => doc.data().horarioSlotString);

                // Busca Eventos
                const qEventos = query(collection(db, "eventosManutencao"), 
                    where("dataInicio", ">=", Timestamp.fromDate(diaSelecionado.toDate())), 
                    where("dataInicio", "<", Timestamp.fromDate(diaSelecionado.add(1, 'day').toDate()))
                );
                const snapEventos = await getDocs(qEventos);
                const slotsEventos = snapEventos.docs
                    .filter(doc => doc.id !== eventoId)
                    .map(doc => doc.data())
                    .filter(e => e.laboratorio === 'Todos' || laboratoriosParaVerificar.includes(e.laboratorio))
                    .map(e => e.horarioSlotString);
                
                setHorariosOcupados([...new Set([...slotsAulas, ...slotsEventos])]);
            } catch (error) {
                console.error("Erro ao verificar disponibilidade:", error);
            } finally {
                setVerificandoDisp(false);
            }
        };
        verificarDisponibilidade();
    }, [formData.dataInicio, formData.dynamicLabs, secao2Completa, eventoId]);

    // Carrega dados iniciais se for edição
    useEffect(() => {
        const loadInitialData = async () => {
            if (eventoId) {
                setIsEditMode(true);
                try {
                    const docRef = doc(db, "eventosManutencao", eventoId);
                    const docSnap = await getDoc(docRef);
                    if (docSnap.exists()) {
                        const data = docSnap.data();
                        let tipoLab = '';
                        if (data.laboratorio !== 'Todos') {
                            const labObj = LISTA_LABORATORIOS.find(l => l.name === data.laboratorio);
                            if (labObj) tipoLab = labObj.tipo;
                        }
                        setFormData({
                            titulo: data.titulo || '', 
                            descricao: data.descricao || '', 
                            tipo: data.tipo || EVENT_TYPES[0],
                            dataInicio: safeDayjs(data.dataInicio), 
                            horarioSlotString: Array.isArray(data.horarioSlotString) ? data.horarioSlotString : [data.horarioSlotString],
                            dynamicLabs: [{ 
                                tipo: tipoLab, 
                                laboratorios: data.laboratorio === 'Todos' ? [] : [data.laboratorio] 
                            }]
                        });
                    }
                } catch (error) { console.error("Erro ao carregar:", error); }
            }
        };
        loadInitialData();
    }, [eventoId]);

    const handleChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
        if (errors[name]) setErrors(prev => ({ ...prev, [name]: null }));
    };

    const handleLabTipoChange = (index, tipo) => {
        const newLabs = [...formData.dynamicLabs];
        newLabs[index] = { ...newLabs[index], tipo, laboratorios: [] };
        setFormData(prev => ({ ...prev, dynamicLabs: newLabs }));
    };

    const handleLabSelectionChange = (index, laboratorios) => {
        const newLabs = [...formData.dynamicLabs];
        newLabs[index] = { ...newLabs[index], laboratorios };
        setFormData(prev => ({ ...prev, dynamicLabs: newLabs }));
    };

    const handleAddLabField = () => {
        setFormData(prev => ({ ...prev, dynamicLabs: [...prev.dynamicLabs, { tipo: '', laboratorios: [] }] }));
    };

    const handleRemoveLabField = (index) => {
        const newLabs = formData.dynamicLabs.filter((_, i) => i !== index);
        setFormData(prev => ({ ...prev, dynamicLabs: newLabs.length ? newLabs : [{ tipo: '', laboratorios: [] }] }));
    };

    const validate = () => {
        const newErrors = {};
        if (!formData.titulo.trim()) newErrors.titulo = 'Obrigatório';
        if (!formData.dataInicio) newErrors.dataInicio = 'Selecione a data';
        if (formData.horarioSlotString.length === 0) newErrors.horarioSlotString = 'Selecione o horário';
        const labsValidos = formData.dynamicLabs.every(lab => lab.tipo && lab.laboratorios.length > 0);
        if (!labsValidos) newErrors.dynamicLabs = 'Preencha todos os campos de laboratório';
        setErrors(newErrors);
        return Object.keys(newErrors).length === 0;
    };

    const prepareAndConfirm = async () => {
        if (!validate()) return;
        setLoadingSubmit(true);
        try {
            const eventosParaAgendar = [];
            const dataBase = dayjs(formData.dataInicio);

            for (const slot of formData.horarioSlotString) {
                const [inicioStr, fimStr] = slot.split('-');
                const dataHoraInicio = dataBase.hour(parseInt(inicioStr.split(':')[0])).minute(parseInt(inicioStr.split(':')[1])).second(0).millisecond(0);
                const dataHoraFim = dataBase.hour(parseInt(fimStr.split(':')[0])).minute(parseInt(fimStr.split(':')[1])).second(0).millisecond(0);

                for (const labGroup of formData.dynamicLabs) {
                    for (const labName of labGroup.laboratorios) {
                        eventosParaAgendar.push({
                            titulo: formData.titulo,
                            descricao: formData.descricao,
                            tipo: formData.tipo,
                            laboratorio: labName,
                            dataInicio: dataHoraInicio,
                            dataFim: dataHoraFim,
                            horarioSlotString: slot,
                            criadoPorUid: currentUser.uid,
                            criadoPorNome: userInfo?.name || currentUser.displayName || currentUser.email,
                            createdAt: serverTimestamp()
                        });
                    }
                }
            }

            // Verifica conflitos com Aulas ou outros Eventos
            const conflitosEncontrados = [];
            for (const novo of eventosParaAgendar) {
                // Conflito com Aulas
                const qA = query(collection(db, "aulas"), 
                    where("laboratorioSelecionado", "==", novo.laboratorio),
                    where("dataInicio", "==", Timestamp.fromDate(novo.dataInicio.toDate())),
                    where("horarioSlotString", "==", novo.horarioSlotString)
                );
                const snapA = await getDocs(qA);
                snapA.docs.forEach(doc => conflitosEncontrados.push({ novo, conflito: { id: doc.id, ...doc.data(), tipoConflito: 'Aula' } }));

                // Conflito com Eventos
                const qE = query(collection(db, "eventosManutencao"), 
                    where("laboratorio", "==", novo.laboratorio),
                    where("dataInicio", "==", Timestamp.fromDate(novo.dataInicio.toDate())),
                    where("horarioSlotString", "==", novo.horarioSlotString)
                );
                const snapE = await getDocs(qE);
                snapE.docs.forEach(doc => {
                    if (doc.id !== eventoId) conflitosEncontrados.push({ novo, conflito: { id: doc.id, ...doc.data(), tipoConflito: 'Evento' } });
                });
            }

            if (conflitosEncontrados.length > 0) {
                setConflitos(conflitosEncontrados);
                setEventosParaConfirmar(eventosParaAgendar);
                setOpenDuplicateDialog(true);
            } else {
                setEventosParaConfirmar(eventosParaAgendar);
                setOpenConfirmModal(true);
            }
        } catch (error) {
            console.error("Erro ao preparar:", error);
        } finally {
            setLoadingSubmit(false);
        }
    };

    const handleConflitos = async (substituir) => {
        setOpenDuplicateDialog(false);
        if (substituir) {
            setLoadingSubmit(true);
            try {
                const batch = writeBatch(db);
                conflitos.forEach(c => {
                    const coll = c.conflito.tipoConflito === 'Aula' ? 'aulas' : 'eventosManutencao';
                    batch.delete(doc(db, coll, c.conflito.id));
                });
                await batch.commit();
                setOpenConfirmModal(true);
            } catch (error) { console.error(error); }
            finally { setLoadingSubmit(false); }
        } else {
            setOpenConfirmModal(true);
        }
    };

    const handleConfirmSave = async () => {
        setOpenConfirmModal(false);
        setLoadingSubmit(true);
        try {
            const finalizados = [];
            if (isEditMode && eventoId) {
                const ev = eventosParaConfirmar[0];
                const finalData = {
                    ...ev,
                    dataInicio: Timestamp.fromDate(ev.dataInicio.toDate()),
                    dataFim: Timestamp.fromDate(ev.dataFim.toDate()),
                    updatedAt: serverTimestamp()
                };
                await updateDoc(doc(db, "eventosManutencao", eventoId), finalData);
                finalizados.push(ev);
            } else {
                for (const ev of eventosParaConfirmar) {
                    const finalData = {
                        ...ev,
                        dataInicio: Timestamp.fromDate(ev.dataInicio.toDate()),
                        dataFim: Timestamp.fromDate(ev.dataFim.toDate())
                    };
                    await addDoc(collection(db, "eventosManutencao"), finalData);
                    finalizados.push(ev);
                }
            }

            // Notificação Telegram
            if (TELEGRAM_CHAT_ID) {
                for (const ev of finalizados) {
                    const payload = {
                        titulo: ev.titulo,
                        tipoEvento: ev.tipo,
                        laboratorio: ev.laboratorio,
                        dataInicio: ev.dataInicio.format('DD/MM/YYYY HH:mm'),
                        dataFim: ev.dataFim.format('DD/MM/YYYY HH:mm'),
                        dataISO: ev.dataInicio.format('YYYY-MM-DD'),
                        descricao: ev.descricao
                    };
                    await notificadorTelegram.enviarNotificacao(TELEGRAM_CHAT_ID, payload, isEditMode ? 'evento_editar' : 'evento_adicionar');
                }
            }

            setSnackbarMessage(isEditMode ? 'Evento atualizado!' : 'Evento(s) criado(s) com sucesso!');
            setSnackbarSeverity('success');
            setOpenSnackbar(true);
            if (onSuccess) onSuccess();
        } catch (error) {
            setSnackbarMessage('Erro ao salvar.');
            setSnackbarSeverity('error');
            setOpenSnackbar(true);
        } finally {
            setLoadingSubmit(false);
        }
    };

    return (
        <LocalizationProvider dateAdapter={AdapterDayjs} adapterLocale="pt-br">
            <Container maxWidth="md">
                <Typography variant="h4" component="h1" gutterBottom align="center" sx={{ mb: 4, color: '#3f51b5', fontWeight: 'bold', mt: isModal ? 0 : 4 }}>
                    {formTitle || (isEditMode ? "Editar Evento" : "Propor Novo Evento")}
                </Typography>
                <form onSubmit={(e) => { e.preventDefault(); prepareAndConfirm(); }}>
                    <Grid container spacing={3} justifyContent="center">
                        <Grid item xs={12} md={6}>
                            <Paper elevation={3} sx={{ p: 3, borderLeft: '5px solid #1976d2', height: '100%' }}>
                                <Typography variant="h6" gutterBottom>1. Detalhes do Evento</Typography>
                                <FormControl fullWidth sx={{ mb: 2 }}>
                                    <InputLabel>Tipo *</InputLabel>
                                    <Select name="tipo" value={formData.tipo} label="Tipo *" onChange={handleChange}>
                                        {EVENT_TYPES.map(t => <MenuItem key={t} value={t}>{t}</MenuItem>)}
                                    </Select>
                                </FormControl>
                                <TextField fullWidth label="Título do Evento *" name="titulo" value={formData.titulo} onChange={handleChange} error={!!errors.titulo} helperText={errors.titulo} sx={{ mb: 2 }} />
                                <TextField fullWidth label="Descrição/Observações" name="descricao" value={formData.descricao} onChange={handleChange} multiline rows={3} />
                            </Paper>
                        </Grid>
                        <Grid item xs={12} md={6}>
                            <Paper elevation={3} sx={{ p: 3, borderLeft: '5px solid #ff9800', height: '100%', opacity: (!secao1Completa && !isEditMode) ? 0.8 : 1 }}>
                                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                        <Typography variant="h6" gutterBottom sx={{ mb: 0 }}>2. Laboratório(s)</Typography>
                                        {!secao1Completa && !isEditMode && <LockIcon color="warning" />}
                                    </Box>
                                    <Tooltip title="Adicionar outro tipo de laboratório">
                                        <IconButton onClick={handleAddLabField} color="primary" disabled={formData.dynamicLabs.length >= 5 || (!secao1Completa && !isEditMode)}>
                                            <AddIcon />
                                        </IconButton>
                                    </Tooltip>
                                </Box>
                                {!secao1Completa && !isEditMode && (
                                    <Alert severity="warning" sx={{ mt: 1, mb: 2 }}>Complete a Seção 1 para desbloquear.</Alert>
                                )}
                                {errors.dynamicLabs && <Alert severity="error" sx={{ mb: 1, fontSize: '0.8rem' }}>{errors.dynamicLabs}</Alert>}
                                {formData.dynamicLabs.map((labSelection, index) => (
                                    <Grid container spacing={1} key={index} sx={{ mt: index > 0 ? 1 : 0, alignItems: 'center' }}>
                                        <Grid item xs={5}>
                                            <FormControl fullWidth size="small" disabled={!secao1Completa && !isEditMode}>
                                                <InputLabel>Tipo *</InputLabel>
                                                <Select value={labSelection.tipo || ''} onChange={(e) => handleLabTipoChange(index, e.target.value)}>
                                                    {TIPOS_LABORATORIO.map(t => (
                                                        <MenuItem key={t.id} value={t.id}>{t.name}</MenuItem>
                                                    ))}
                                                </Select>
                                            </FormControl>
                                        </Grid>
                                        <Grid item xs={6}>
                                            <FormControl fullWidth size="small" disabled={!labSelection.tipo || (!secao1Completa && !isEditMode)}>
                                                <InputLabel>Lab(s) *</InputLabel>
                                                <Select
                                                    multiple
                                                    value={labSelection.laboratorios || []}
                                                    onChange={(e) => handleLabSelectionChange(index, e.target.value)}
                                                    renderValue={(selected) => (
                                                        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                                                            {selected.map((value) => (
                                                                <Chip key={value} label={value} size="small" />
                                                            ))}
                                                        </Box>
                                                    )}
                                                >
                                                    {LISTA_LABORATORIOS.filter(l => l.tipo === labSelection.tipo).map(l => (
                                                        <MenuItem key={l.id} value={l.name}>{l.name}</MenuItem>
                                                    ))}
                                                </Select>
                                            </FormControl>
                                        </Grid>
                                        <Grid item xs={1}>
                                            <IconButton size="small" onClick={() => handleRemoveLabField(index)} disabled={formData.dynamicLabs.length === 1 || (!secao1Completa && !isEditMode)}>
                                                <DeleteIcon fontSize="small" />
                                            </IconButton>
                                        </Grid>
                                    </Grid>
                                ))}
                            </Paper>
                        </Grid>
                        <Grid item xs={12}>
                            <Paper elevation={3} sx={{ p: 3, borderLeft: '5px solid #4caf50', opacity: (!secao2Completa && !isEditMode) ? 0.8 : 1 }}>
                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
                                    <Typography variant="h6" gutterBottom sx={{ mb: 0 }}>3. Data e Horário</Typography>
                                    {!secao2Completa && !isEditMode && <LockIcon color="warning" />}
                                </Box>
                                <Grid container spacing={2}>
                                    <Grid item xs={12} md={6}>
                                        <DatePicker
                                            label="Data do Evento *"
                                            value={formData.dataInicio}
                                            onChange={(newValue) => setFormData(prev => ({ ...prev, dataInicio: newValue }))}
                                            disabled={!secao2Completa && !isEditMode}
                                            onMonthChange={(newMonth) => setMesVisivel(newMonth)}
                                            loading={loadingCalendario}
                                            slotProps={{
                                                textField: { fullWidth: true, error: !!errors.dataInicio, helperText: errors.dataInicio },
                                                day: {
                                                    sx: (day) => {
                                                        const dateObj = dayjs(day);
                                                        if (!dateObj.isValid()) return {};
                                                        const dateStr = dateObj.format('YYYY-MM-DD');
                                                        if (diasTotalmenteOcupados.includes(dateStr)) return { backgroundColor: 'rgba(244, 67, 54, 0.2)', borderRadius: '50%' };
                                                        if (diasParcialmenteOcupados.includes(dateStr)) return { border: '1px solid #1976d2', borderRadius: '50%' };
                                                        return {};
                                                    }
                                                }
                                            }}
                                        />
                                    </Grid>
                                    <Grid item xs={12} md={6}>
                                        <FormControl fullWidth error={!!errors.horarioSlotString} disabled={!formData.dataInicio || (!secao2Completa && !isEditMode)}>
                                            <InputLabel>Horário(s) *</InputLabel>
                                            <Select
                                                multiple
                                                name="horarioSlotString"
                                                value={formData.horarioSlotString}
                                                onChange={handleChange}
                                                renderValue={(selected) => (
                                                    <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                                                        {selected.map((value) => (
                                                            <Chip key={value} label={BLOCOS_HORARIO.find(b => b.value === value)?.label || value} size="small" />
                                                        ))}
                                                    </Box>
                                                )}
                                            >
                                                {BLOCOS_HORARIO.map((bloco) => (
                                                    <MenuItem key={bloco.value} value={bloco.value} disabled={horariosOcupados.includes(bloco.value)}>
                                                        {bloco.label} {horariosOcupados.includes(bloco.value) ? '(Ocupado)' : ''}
                                                    </MenuItem>
                                                ))}
                                            </Select>
                                            {errors.horarioSlotString && <FormHelperText>{errors.horarioSlotString}</FormHelperText>}
                                            {verificandoDisp && <CircularProgress size={20} sx={{ mt: 1 }} />}
                                        </FormControl>
                                    </Grid>
                                </Grid>
                            </Paper>
                        </Grid>
                        <Grid item xs={12} sx={{ display: 'flex', justifyContent: 'center', gap: 2, mt: 2, mb: 4 }}>
                            <Button variant="outlined" startIcon={<ArrowBack />} onClick={onCancel || (() => navigate('/calendario'))}>Voltar</Button>
                            <Button type="submit" variant="contained" color="primary" size="large" disabled={loadingSubmit || (!secao2Completa && !isEditMode)}>
                                {loadingSubmit ? <CircularProgress size={24} /> : (isEditMode ? "Salvar Alterações" : "Criar Evento")}
                            </Button>
                        </Grid>
                    </Grid>
                </form>

                <DialogConfirmacao open={openConfirmModal} onClose={() => setOpenConfirmModal(false)} onConfirm={handleConfirmSave} title="Confirmar Evento" message={`Deseja confirmar a criação de ${eventosParaConfirmar.length} evento(s)?`} loading={loadingSubmit} />
                
                <Dialog open={openDuplicateDialog} onClose={() => setOpenDuplicateDialog(false)}>
                    <DialogTitle>Conflito Detectado</DialogTitle>
                    <DialogContent>
                        <Typography>Alguns horários já possuem agendamentos (Aulas ou Eventos). O que deseja fazer?</Typography>
                        <List>
                            {conflitos.map((c, i) => (
                                <ListItem key={i} divider>
                                    <ListItemText 
                                        primary={`Conflito em ${c.novo.laboratorio} às ${c.novo.horarioSlotString}`} 
                                        secondary={`${c.conflito.tipoConflito}: ${c.conflito.assunto || c.conflito.titulo}`} 
                                    />
                                </ListItem>
                            ))}
                        </List>
                    </DialogContent>
                    <DialogActions>
                        <Button onClick={() => setOpenDuplicateDialog(false)}>Cancelar</Button>
                        <Button onClick={() => handleConflitos(false)} color="primary">Ignorar e Manter Ambos</Button>
                        <Button onClick={() => handleConflitos(true)} color="error" variant="contained">Substituir Existentes</Button>
                    </DialogActions>
                </Dialog>

                <Snackbar open={openSnackbar} autoHideDuration={6000} onClose={() => setOpenSnackbar(false)}>
                    <Alert severity={snackbarSeverity} onClose={() => setOpenSnackbar(false)}>{snackbarMessage}</Alert>
                </Snackbar>
            </Container>
        </LocalizationProvider>
    );
}

ProporEventoForm.propTypes = {
    userInfo: PropTypes.object,
    currentUser: PropTypes.object,
    initialDate: PropTypes.object,
    onSuccess: PropTypes.func,
    onCancel: PropTypes.func,
    isModal: PropTypes.bool,
    formTitle: PropTypes.string,
    eventoId: PropTypes.string
};

export default ProporEventoForm;
