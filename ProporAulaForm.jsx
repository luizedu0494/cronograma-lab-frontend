import React, { useState, useEffect } from 'react';
import {
    Container, Typography, TextField, Button, Grid, MenuItem, FormControl, InputLabel,
    Select, Box, Paper, Snackbar, Alert, CircularProgress, Dialog, DialogActions,
    DialogContent, DialogTitle, OutlinedInput, Chip, IconButton, Tooltip,
    List, ListItem, ListItemText, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, FormHelperText, Badge
} from '@mui/material';
import { ArrowBack, Delete as DeleteIcon, Add as AddIcon, Lock as LockIcon } from '@mui/icons-material';
import { AdapterDayjs } from '@mui/x-date-pickers/AdapterDayjs';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { DatePicker, PickersDay } from '@mui/x-date-pickers';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { db } from './firebaseConfig';
import {
    collection, addDoc, serverTimestamp, doc, getDoc, updateDoc, Timestamp, query, where, getDocs, writeBatch
} from 'firebase/firestore';
import dayjs from 'dayjs';
import 'dayjs/locale/pt-br';
import { LISTA_LABORATORIOS } from './constants/laboratorios';
import { LISTA_CURSOS as LISTA_CURSOS_CONSTANTS } from './constants/cursos';
import PropTypes from 'prop-types';

dayjs.locale('pt-br');

const BLOCOS_HORARIO = [
    { "value": "07:00-09:10", "label": "07:00 - 09:10", "turno": "Matutino" },
    { "value": "09:30-12:00", "label": "09:30 - 12:00", "turno": "Matutino" },
    { "value": "13:00-15:10", "label": "13:00 - 15:10", "turno": "Vespertino" },
    { "value": "15:30-18:00", "label": "15:30 - 18:00", "turno": "Vespertino" },
    { "value": "18:30-20:10", "label": "18:30 - 20:10", "turno": "Noturno" },
    { "value": "20:30-22:00", "label": "20:30 - 22:00", "turno": "Noturno" },
];

function ProporAulaForm({ userInfo, currentUser, initialDate, onSuccess, onCancel, isModal }) {
    const [formData, setFormData] = useState({
        assunto: '', observacoes: '', tipoAtividade: '', cursos: [], liga: '',
        dataInicio: initialDate || null, horarioSlotString: [], dynamicLabs: [{ tipo: '', laboratorios: [] }],
    });
    const [errors, setErrors] = useState({});
    const [loadingSubmit, setLoadingSubmit] = useState(false);
    const [isEditMode, setIsEditMode] = useState(false);
    const [openSnackbar, setOpenSnackbar] = useState(false);
    const [snackbarMessage, setSnackbarMessage] = useState('');
    const [snackbarSeverity, setSnackbarSeverity] = useState('success');
    const [openDuplicateDialog, setOpenDuplicateDialog] = useState(false);
    const [conflitos, setConflitos] = useState([]);
    const [copiedTecnicos, setCopiedTecnicos] = useState(null);
    const isCoordenador = userInfo?.role === 'coordenador';
    const [openConfirmModal, setOpenConfirmModal] = useState(false);
    const [aulasParaConfirmar, setAulasParaConfirmar] = useState([]);
    const [openKeepDataDialog, setOpenKeepDataDialog] = useState(false);
    const [horariosOcupados, setHorariosOcupados] = useState([]);
    const [verificandoDisp, setVerificandoDisp] = useState(false);
    const [diasTotalmenteOcupados, setDiasTotalmenteOcupados] = useState([]);
    const [diasParcialmenteOcupados, setDiasParcialmenteOcupados] = useState([]);
    const [mesVisivel, setMesVisivel] = useState(dayjs());
    const [loadingCalendario, setLoadingCalendario] = useState(false);

    const navigate = useNavigate();
    const location = useLocation();
    const { aulaId } = useParams();

    // ========== VALIDAÇÃO PROGRESSIVA: Estados ==========
    const [secao1Completa, setSecao1Completa] = useState(false);
    const [secao2Completa, setSecao2Completa] = useState(false);

    // ========== VALIDAÇÃO PROGRESSIVA: Verificar Seção 1 ==========
    useEffect(() => {
        // No modo de edição, considerar sempre completo
        if (isEditMode) {
            setSecao1Completa(true);
            return;
        }
        
        const detalhesCompletos = 
            formData.tipoAtividade !== '' && 
            formData.assunto.trim() !== '' && 
            formData.cursos.length > 0;
        setSecao1Completa(detalhesCompletos);
    }, [formData.tipoAtividade, formData.assunto, formData.cursos, isEditMode]);

    // ========== VALIDAÇÃO PROGRESSIVA: Verificar Seção 2 ==========
    useEffect(() => {
        // No modo de edição, considerar sempre completo
        if (isEditMode) {
            setSecao2Completa(true);
            return;
        }
        
        const laboratoriosCompletos = formData.dynamicLabs.every(lab => 
            lab.tipo !== '' && lab.laboratorios.length > 0
        );
        setSecao2Completa(laboratoriosCompletos && secao1Completa);
    }, [formData.dynamicLabs, secao1Completa, isEditMode]);

    useEffect(() => {
        const fetchOcupacaoDoMes = async () => {
            setLoadingCalendario(true);
            const inicioDoMes = mesVisivel.startOf('month').toDate();
            const fimDoMes = mesVisivel.endOf('month').toDate();
            try {
                const q = query(collection(db, "aulas"), where("dataInicio", ">=", Timestamp.fromDate(inicioDoMes)), where("dataInicio", "<=", Timestamp.fromDate(fimDoMes)));
                const querySnapshot = await getDocs(q);
                const aulasDoMes = querySnapshot.docs.map(doc => doc.data());
                const ocupacaoPorDia = {};
                aulasDoMes.forEach(aula => {
                    const dia = dayjs(aula.dataInicio.toDate()).format('YYYY-MM-DD');
                    if (!ocupacaoPorDia[dia]) ocupacaoPorDia[dia] = new Set();
                    ocupacaoPorDia[dia].add(`${aula.laboratorioSelecionado}-${aula.horarioSlotString}`);
                });
                const totalSlotsPossiveis = LISTA_LABORATORIOS.length * BLOCOS_HORARIO.length;
                const diasTotalmenteLotados = [];
                const diasComAlgumaAula = [];
                for (const dia in ocupacaoPorDia) {
                    diasComAlgumaAula.push(dia);
                    if (ocupacaoPorDia[dia].size >= totalSlotsPossiveis) diasTotalmenteLotados.push(dia);
                }
                setDiasTotalmenteOcupados(diasTotalmenteLotados);
                setDiasParcialmenteOcupados(diasComAlgumaAula);
            } catch (error) {
                console.error("Erro ao buscar ocupação do mês:", error);
            } finally {
                setLoadingCalendario(false);
            }
        };
        fetchOcupacaoDoMes();
    }, [mesVisivel]);

    useEffect(() => {
        const verificarDisponibilidadeHorarios = async () => {
            const laboratoriosParaVerificar = formData.dynamicLabs.flatMap(lab => lab.laboratorios).filter(Boolean);
            if (!formData.dataInicio || laboratoriosParaVerificar.length === 0) {
                setHorariosOcupados([]);
                return;
            }
            setVerificandoDisp(true);
            try {
                const diaSelecionado = formData.dataInicio.startOf('day');
                const q = query(collection(db, "aulas"), where("laboratorioSelecionado", "in", laboratoriosParaVerificar), where("dataInicio", ">=", Timestamp.fromDate(diaSelecionado.toDate())), where("dataInicio", "<", Timestamp.fromDate(diaSelecionado.add(1, 'day').toDate())));
                const querySnapshot = await getDocs(q);
                const slotsOcupados = querySnapshot.docs.filter(doc => doc.id !== aulaId).map(doc => doc.data().horarioSlotString);
                setHorariosOcupados([...new Set(slotsOcupados)]);
            } catch (error) {
                console.error("Erro ao verificar disponibilidade de horários:", error);
            } finally {
                setVerificandoDisp(false);
            }
        };
        verificarDisponibilidadeHorarios();
    }, [formData.dataInicio, formData.dynamicLabs, aulaId]);

    const validate = (fieldValues = formData) => {
        let tempErrors = { ...errors };
        if ('assunto' in fieldValues) tempErrors.assunto = fieldValues.assunto ? "" : "O assunto é obrigatório.";
        if ('tipoAtividade' in fieldValues) tempErrors.tipoAtividade = fieldValues.tipoAtividade ? "" : "O tipo de atividade é obrigatório.";
        if ('cursos' in fieldValues) tempErrors.cursos = fieldValues.cursos.length > 0 ? "" : "Selecione pelo menos um curso.";
        if ('dataInicio' in fieldValues) tempErrors.dataInicio = fieldValues.dataInicio ? "" : "A data é obrigatória.";
        if ('horarioSlotString' in fieldValues) tempErrors.horarioSlotString = fieldValues.horarioSlotString.length > 0 ? "" : "Selecione pelo menos um horário.";
        if ('dynamicLabs' in fieldValues) {
            const labError = fieldValues.dynamicLabs.some(lab => !lab.tipo || lab.laboratorios.length === 0);
            tempErrors.dynamicLabs = labError ? "Todos os campos de laboratório são obrigatórios." : "";
        }
        setErrors(tempErrors);
        return Object.values(tempErrors).every(x => x === "");
    };

    const handleChange = (e) => {
        const { name, value } = e.target;
        const newValue = Array.isArray(value) ? value : value;
        if (name === 'horarioSlotString') {
            const semOcupados = newValue.filter(slot => !horariosOcupados.includes(slot) || (isEditMode && formData.horarioSlotString.includes(slot)));
            setFormData(prev => ({ ...prev, [name]: semOcupados }));
        } else {
            setFormData(prev => ({ ...prev, [name]: newValue }));
        }
    };
    
    const handleDateChange = (date) => setFormData(prev => ({ ...prev, dataInicio: date, horarioSlotString: [] }));
    const handleLabTipoChange = (index, tipo) => {
        const newLabs = [...formData.dynamicLabs];
        newLabs[index] = { tipo, laboratorios: [] };
        setFormData(prev => ({ ...prev, dynamicLabs: newLabs, horarioSlotString: [] }));
    };
    const handleLabEspecificoChange = (index, laboratorios) => {
        const newLabs = [...formData.dynamicLabs];
        newLabs[index].laboratorios = laboratorios;
        setFormData(prev => ({ ...prev, dynamicLabs: newLabs, horarioSlotString: [] }));
    };
    const handleAddLabField = () => setFormData(prev => ({ ...prev, dynamicLabs: [...prev.dynamicLabs, { tipo: '', laboratorios: [] }] }));
    const handleRemoveLabField = (index) => setFormData(prev => ({ ...prev, dynamicLabs: prev.dynamicLabs.filter((_, i) => i !== index) }));

    useEffect(() => {
        const loadInitialData = async () => {
            if (aulaId) {
                setIsEditMode(true);
                const docRef = doc(db, "aulas", aulaId);
                const docSnap = await getDoc(docRef);
                if (docSnap.exists()) {
                    const data = docSnap.data();
                    setFormData({
                        assunto: data.assunto || '', observacoes: data.observacoes || '', tipoAtividade: data.tipoAtividade || '',
                        cursos: Array.isArray(data.cursos) ? data.cursos : (data.cursos ? [data.cursos] : []), liga: data.liga || '',
                        dynamicLabs: [{ tipo: data.tipoLaboratorio || '', laboratorios: Array.isArray(data.laboratorioSelecionado) ? data.laboratorioSelecionado : [data.laboratorioSelecionado] }],
                        dataInicio: data.dataInicio ? dayjs(data.dataInicio.toDate()) : null,
                        horarioSlotString: Array.isArray(data.horarioSlotString) ? data.horarioSlotString : (data.horarioSlotString ? [data.horarioSlotString] : [])
                    });
                } else { navigate('/calendario'); }
            } else if (location.state?.aulaParaCopiar) {
                const { aulaParaCopiar } = location.state;
                setFormData(prev => ({
                    ...prev, assunto: aulaParaCopiar.assunto || '', observacoes: aulaParaCopiar.observacoes || '', tipoAtividade: aulaParaCopiar.tipoAtividade || '',
                    cursos: aulaParaCopiar.cursos || [], liga: aulaParaCopiar.liga || '',
                    dynamicLabs: [{ tipo: aulaParaCopiar.tipoLaboratorio, laboratorios: Array.isArray(aulaParaCopiar.laboratorioSelecionado) ? aulaParaCopiar.laboratorioSelecionado : [aulaParaCopiar.laboratorioSelecionado] }]
                }));
                if (aulaParaCopiar.tecnicos && aulaParaCopiar.tecnicosInfo) setCopiedTecnicos({ tecnicos: aulaParaCopiar.tecnicos, tecnicosInfo: aulaParaCopiar.tecnicosInfo });
                navigate('.', { replace: true, state: {} });
                setSnackbarMessage("Dados carregados. Defina a nova data e horário.");
                setSnackbarSeverity("info");
                setOpenSnackbar(true);
            }
        };
        if (currentUser) { loadInitialData(); }
    }, [aulaId, navigate, currentUser, location.state]);

    const clearForm = (keepData = false) => {
        if (keepData) {
            setFormData(prev => ({ ...prev, dataInicio: null, horarioSlotString: [] }));
            return;
        }
        setFormData({ assunto: '', observacoes: '', tipoAtividade: '', cursos: [], liga: '', dataInicio: null, horarioSlotString: [], dynamicLabs: [{ tipo: '', laboratorios: [] }] });
        setCopiedTecnicos(null);
        setErrors({});
    };

    const prepareAndConfirm = async () => {
        if (!validate()) {
            setSnackbarMessage('Por favor, corrija os erros no formulário.');
            setSnackbarSeverity('warning');
            setOpenSnackbar(true);
            return;
        }
        setLoadingSubmit(true);
        const aulasSemConflito = [];
        const conflitosDetectados = [];
        const verificacoes = formData.horarioSlotString.flatMap(slot => {
            const [inicioStr, fimStr] = slot.split('-');
            const dataHoraInicio = formData.dataInicio.hour(parseInt(inicioStr.split(':')[0])).minute(parseInt(inicioStr.split(':')[1]));
            const dataHoraFim = formData.dataInicio.hour(parseInt(fimStr.split(':')[0])).minute(parseInt(fimStr.split(':')[1]));
            return formData.dynamicLabs.flatMap(lab => 
                lab.laboratorios.map(async (labName) => {
                    const novaAula = {
                        tipoAtividade: formData.tipoAtividade, assunto: formData.assunto, observacoes: formData.observacoes, tipoLaboratorio: lab.tipo, laboratorioSelecionado: labName, cursos: formData.cursos, liga: formData.liga,
                        dataInicio: Timestamp.fromDate(dataHoraInicio.toDate()), dataFim: Timestamp.fromDate(dataHoraFim.toDate()), horarioSlotString: slot,
                        status: isCoordenador ? 'aprovada' : 'pendente', propostoPorUid: currentUser.uid, propostoPorNome: userInfo?.name || currentUser.displayName || currentUser.email,
                        tecnicos: copiedTecnicos ? copiedTecnicos.tecnicos : [], tecnicosInfo: copiedTecnicos ? copiedTecnicos.tecnicosInfo : []
                    };
                    const q = query(collection(db, "aulas"), where("laboratorioSelecionado", "==", labName), where("dataInicio", "==", novaAula.dataInicio));
                    const querySnapshot = await getDocs(q);
                    const hasConflict = querySnapshot.docs.some(doc => doc.id !== aulaId);
                    if (!hasConflict) return { status: 'sem-conflito', aula: novaAula };
                    else return { status: 'conflito', dados: { novaAula, conflito: { id: querySnapshot.docs[0].id, ...querySnapshot.docs[0].data() } } };
                })
            );
        });
        const resultados = await Promise.all(verificacoes);
        resultados.forEach(res => {
            if (res.status === 'sem-conflito') aulasSemConflito.push(res.aula);
            else conflitosDetectados.push(res.dados);
        });
        setAulasParaConfirmar(aulasSemConflito);
        setConflitos(conflitosDetectados);
        if (conflitosDetectados.length > 0) setOpenDuplicateDialog(true);
        else if (aulasSemConflito.length > 0) setOpenConfirmModal(true);
        setLoadingSubmit(false);
    };

    const handleConfirmSave = async () => {
        setLoadingSubmit(true);
        setOpenConfirmModal(false);
        try {
            if (isEditMode && aulaId) {
                const docRef = doc(db, "aulas", aulaId);
                await updateDoc(docRef, { ...aulasParaConfirmar[0], updatedAt: serverTimestamp() });
                setSnackbarMessage("Aula atualizada com sucesso!");
            } else {
                const batch = writeBatch(db);
                const aulasCollection = collection(db, "aulas");
                aulasParaConfirmar.forEach(aula => {
                    const newDocRef = doc(aulasCollection);
                    batch.set(newDocRef, { ...aula, createdAt: serverTimestamp() });
                });
                await batch.commit();
                setSnackbarMessage(`${aulasParaConfirmar.length} aula(s) ${isCoordenador ? 'agendada(s)!' : 'proposta(s)!'}`);
            }
            setSnackbarSeverity('success');
            setOpenSnackbar(true);
            if (isModal) {
                onSuccess();
            } else {
                setOpenKeepDataDialog(true);
            }
        } catch (error) {
            setSnackbarMessage(`Erro ao salvar: ${error.message}`);
            setSnackbarSeverity('error');
            setOpenSnackbar(true);
        } finally {
            setLoadingSubmit(false);
        }
    };

    const handleAulasComConflito = async (shouldReplace) => {
        setLoadingSubmit(true);
        setOpenDuplicateDialog(false);
        const aulasParaAdicionar = [...aulasParaConfirmar];
        let mensagemSucesso = aulasParaConfirmar.length > 0 ? `${aulasParaConfirmar.length} aula(s) disponível(is) foi(ram) agendada(s). ` : "";
        if (shouldReplace) {
            aulasParaAdicionar.push(...conflitos.map(c => c.novaAula));
            mensagemSucesso += `${conflitos.length} aula(s) com conflito foram substituídas.`;
        } else if (conflitos.length > 0) {
            mensagemSucesso += `${conflitos.length} agendamento(s) com conflito foram ignorados.`;
        }
        if (aulasParaAdicionar.length === 0) {
            setSnackbarMessage("Nenhuma ação foi realizada.");
            setSnackbarSeverity("info");
            setOpenSnackbar(true);
            setLoadingSubmit(false);
            return;
        }
        try {
            const batch = writeBatch(db);
            const aulasCollection = collection(db, "aulas");
            if (shouldReplace) conflitos.forEach(c => batch.delete(doc(db, 'aulas', c.conflito.id)));
            aulasParaAdicionar.forEach(aula => batch.set(doc(aulasCollection), { ...aula, createdAt: serverTimestamp() }));
            await batch.commit();
            setSnackbarMessage(mensagemSucesso);
            setSnackbarSeverity('success');
            setOpenSnackbar(true);
            if (isModal) {
                onSuccess();
            } else {
                setOpenKeepDataDialog(true);
            }
        } catch (error) {
            setSnackbarMessage(`Erro ao salvar: ${error.message}`);
            setSnackbarSeverity('error');
            setOpenSnackbar(true);
        } finally {
            setLoadingSubmit(false);
            setConflitos([]);
            setAulasParaConfirmar([]);
        }
    };

    const formTitle = isEditMode ? 'Editar Aula' : (isCoordenador ? 'Agendar Nova Aula' : 'Propor Nova Aula');

    return (
        <LocalizationProvider dateAdapter={AdapterDayjs} adapterLocale="pt-br">
            <Container maxWidth="md">
                <Typography variant="h4" component="h1" gutterBottom align="center" sx={{ mb: 4, color: '#3f51b5', fontWeight: 'bold', mt: 4 }}>{formTitle}</Typography>
                <form onSubmit={(e) => { e.preventDefault(); prepareAndConfirm(); }}>
                    <Grid container spacing={3} justifyContent="center">
                        {/* ========== SEÇÃO 1: Detalhes da Aula (SEMPRE HABILITADA) ========== */}
                        <Grid item xs={12} md={6}>
                            <Paper elevation={3} sx={{ p: 3, borderLeft: '5px solid #1976d2', height: '100%' }}>
                                <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                    1. Detalhes da Aula
                                </Typography>
                                <FormControl fullWidth variant="outlined" sx={{ mb: 2 }} error={!!errors.tipoAtividade}>
                                    <InputLabel>Tipo *</InputLabel>
                                    <Select name="tipoAtividade" value={formData.tipoAtividade} label="Tipo *" onChange={handleChange}>
                                        <MenuItem value="aula">Aula</MenuItem>
                                        <MenuItem value="revisao">Revisão</MenuItem>
                                    </Select>
                                    {errors.tipoAtividade && <FormHelperText>{errors.tipoAtividade}</FormHelperText>}
                                </FormControl>
                                <TextField 
                                    fullWidth 
                                    label="Assunto da Aula *" 
                                    name="assunto" 
                                    value={formData.assunto} 
                                    onChange={handleChange} 
                                    error={!!errors.assunto} 
                                    helperText={errors.assunto} 
                                    sx={{ mb: 2 }} 
                                />
                                <FormControl fullWidth sx={{ mb: 2 }} error={!!errors.cursos}>
                                    <InputLabel>Curso(s) Relacionado(s) *</InputLabel>
                                    <Select 
                                        multiple 
                                        name="cursos" 
                                        value={formData.cursos} 
                                        onChange={handleChange} 
                                        input={<OutlinedInput label="Curso(s) Relacionado(s) *" />} 
                                        renderValue={(selected) => (
                                            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                                                {selected.map((value) => (
                                                    <Chip key={value} label={LISTA_CURSOS_CONSTANTS.find(c => c.value === value)?.label} size="small" />
                                                ))}
                                            </Box>
                                        )}
                                    >
                                        {LISTA_CURSOS_CONSTANTS.map(c => <MenuItem key={c.value} value={c.value}>{c.label}</MenuItem>)}
                                    </Select>
                                    {errors.cursos && <FormHelperText>{errors.cursos}</FormHelperText>}
                                </FormControl>
                                {formData.tipoAtividade === 'revisao' && (
                                    <FormControl fullWidth sx={{ mb: 2 }}>
                                        <InputLabel>Liga</InputLabel>
                                        <Select name="liga" value={formData.liga} label="Liga" onChange={handleChange}>
                                            <MenuItem value=""><em>Nenhuma</em></MenuItem>
                                            {LISTA_CURSOS_CONSTANTS.map(c => <MenuItem key={c.value} value={c.value}>{c.label}</MenuItem>)}
                                        </Select>
                                    </FormControl>
                                )}
                                <TextField 
                                    fullWidth 
                                    label="Observações" 
                                    name="observacoes" 
                                    value={formData.observacoes} 
                                    onChange={handleChange} 
                                    multiline 
                                    rows={1} 
                                />
                            </Paper>
                        </Grid>

                        {/* ========== SEÇÃO 2: Laboratório(s) ========== */}
                        <Grid item xs={12} md={6}>
                            <Paper elevation={3} sx={{ p: 3, borderLeft: '5px solid #ff9800', height: '100%' }}>
                                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                                    <Typography variant="h6" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                        2. Laboratório(s)
                                        {!secao1Completa && <LockIcon fontSize="small" color="disabled" />}
                                    </Typography>
                                    <Tooltip title={secao1Completa ? "Adicionar outro tipo de laboratório" : "Complete a Seção 1 primeiro"}>
                                        <span>
                                            <IconButton 
                                                onClick={handleAddLabField} 
                                                color="primary" 
                                                disabled={!secao1Completa || formData.dynamicLabs.length >= 5}
                                            >
                                                <AddIcon />
                                            </IconButton>
                                        </span>
                                    </Tooltip>
                                </Box>
                                
                                {!secao1Completa && (
                                    <Alert severity="warning" icon={<LockIcon />} sx={{ mb: 2 }}>
                                        <strong>Seção bloqueada!</strong><br />
                                        Complete todos os campos obrigatórios (*) da Seção 1 para desbloquear esta seção.
                                    </Alert>
                                )}
                                
                                {errors.dynamicLabs && <Alert severity="error" sx={{ mb: 1, fontSize: '0.8rem' }}>{errors.dynamicLabs}</Alert>}
                                
                                {formData.dynamicLabs.map((labSelection, index) => (
                                    <Grid container spacing={1} key={index} sx={{ mt: index > 0 ? 1 : 0, alignItems: 'center' }}>
                                        <Grid item xs={5}>
                                            <FormControl fullWidth size="small" disabled={!secao1Completa}>
                                                <InputLabel>Tipo *</InputLabel>
                                                <Select value={labSelection.tipo} onChange={(e) => handleLabTipoChange(index, e.target.value)} label="Tipo *">
                                                    {Array.from(new Set(LISTA_LABORATORIOS.map(l => l.tipo))).map(t => 
                                                        <MenuItem key={t} value={t}>{t.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}</MenuItem>
                                                    )}
                                                </Select>
                                            </FormControl>
                                        </Grid>
                                        <Grid item xs={5}>
                                            <FormControl fullWidth size="small" disabled={!secao1Completa || !labSelection.tipo}>
                                                <InputLabel>Específico *</InputLabel>
                                                <Select 
                                                    multiple 
                                                    value={labSelection.laboratorios} 
                                                    onChange={(e) => handleLabEspecificoChange(index, e.target.value)} 
                                                    input={<OutlinedInput label="Específico *" />} 
                                                    renderValue={(selected) => (
                                                        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                                                            {selected.map((value) => (
                                                                <Chip key={value} label={value} size="small" />
                                                            ))}
                                                        </Box>
                                                    )}
                                                >
                                                    {LISTA_LABORATORIOS.filter(lab => lab.tipo === labSelection.tipo).map(l => 
                                                        <MenuItem key={l.id} value={l.name}>{l.name}</MenuItem>
                                                    )}
                                                </Select>
                                            </FormControl>
                                        </Grid>
                                        {formData.dynamicLabs.length > 1 && (
                                            <Grid item xs={2} sx={{ textAlign: 'center' }}>
                                                <IconButton 
                                                    size="small" 
                                                    color="error" 
                                                    onClick={() => handleRemoveLabField(index)}
                                                    disabled={!secao1Completa}
                                                >
                                                    <DeleteIcon />
                                                </IconButton>
                                            </Grid>
                                        )}
                                    </Grid>
                                ))}
                            </Paper>
                        </Grid>

                        {/* ========== SEÇÃO 3: Data e Horário ========== */}
                        <Grid item xs={12}>
                            <Paper elevation={3} sx={{ p: 3, borderLeft: '5px solid #00acc1' }}>
                                <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                    3. Data e Horário
                                    {!secao2Completa && <LockIcon fontSize="small" color="disabled" />}
                                </Typography>
                                
                                {!secao2Completa && (
                                    <Alert severity="warning" icon={<LockIcon />} sx={{ mb: 2 }}>
                                        <strong>Seção bloqueada!</strong><br />
                                        Complete todos os campos obrigatórios (*) das Seções 1 e 2 para desbloquear esta seção.
                                    </Alert>
                                )}
                                
                                <Grid container spacing={2}>
                                    <Grid item xs={12} sm={6}>
                                        <DatePicker 
                                            label="Data da Aula *" 
                                            value={formData.dataInicio} 
                                            onChange={handleDateChange} 
                                            format="DD/MM/YYYY" 
                                            onMonthChange={(newMonth) => setMesVisivel(newMonth)} 
                                            loading={loadingCalendario}
                                            disabled={!secao2Completa}
                                            slots={{ day: (props) => {
                                                const diaFormatado = props.day.format('YYYY-MM-DD');
                                                const isTotalmenteOcupado = diasTotalmenteOcupados.includes(diaFormatado);
                                                const isParcialmenteOcupado = diasParcialmenteOcupados.includes(diaFormatado);
                                                return (
                                                    <Badge 
                                                        key={props.day.toString()} 
                                                        overlap="circular" 
                                                        badgeContent={isParcialmenteOcupado && !isTotalmenteOcupado ? ' ' : 0} 
                                                        color="warning" 
                                                        variant="dot"
                                                    >
                                                        <PickersDay {...props} disabled={isTotalmenteOcupado || !secao2Completa} />
                                                    </Badge>
                                                );
                                            }}}
                                            slotProps={{ 
                                                textField: { 
                                                    fullWidth: true, 
                                                    variant: 'outlined', 
                                                    error: !!errors.dataInicio, 
                                                    helperText: errors.dataInicio 
                                                } 
                                            }}
                                        />
                                    </Grid>
                                    <Grid item xs={12} sm={6}>
                                        <FormControl fullWidth variant="outlined" error={!!errors.horarioSlotString} disabled={!secao2Completa}>
                                            <InputLabel>Bloco de Horário *</InputLabel>
                                            <Select 
                                                multiple 
                                                name="horarioSlotString" 
                                                value={formData.horarioSlotString} 
                                                onChange={handleChange} 
                                                input={<OutlinedInput label="Bloco de Horário *" />} 
                                                renderValue={(selected) => selected.join(', ')}
                                            >
                                                {verificandoDisp && <MenuItem disabled><em>Verificando disponibilidade...</em></MenuItem>}
                                                {BLOCOS_HORARIO.map(bloco => { 
                                                    const isOcupado = horariosOcupados.includes(bloco.value); 
                                                    return (
                                                        <MenuItem key={bloco.value} value={bloco.value} disabled={isOcupado}>
                                                            <ListItemText primary={bloco.label} sx={{ color: isOcupado ? 'error.main' : 'inherit' }} />
                                                            {isOcupado && <Chip label="Ocupado" color="error" size="small" />}
                                                        </MenuItem>
                                                    );
                                                })}
                                            </Select>
                                            {errors.horarioSlotString && <FormHelperText>{errors.horarioSlotString}</FormHelperText>}
                                        </FormControl>
                                    </Grid>
                                </Grid>
                            </Paper>
                        </Grid>

                        <Grid item xs={12}>
                            <Box mt={2} sx={{ display: 'flex', justifyContent: 'center', gap: 2, flexWrap: 'wrap' }}>
                                {!isModal && <Button onClick={() => navigate('/calendario')} variant="outlined" size="large" startIcon={<ArrowBack />}>Voltar</Button>}
                                {isModal && <Button onClick={onCancel} variant="outlined" size="large">Cancelar</Button>}
                                <Button type="submit" variant="contained" size="large" disabled={loadingSubmit}>
                                    {loadingSubmit ? <CircularProgress size={24} /> : (isEditMode ? "Salvar Alterações" : "Verificar e Agendar")}
                                </Button>
                            </Box>
                        </Grid>
                    </Grid>
                </form>

                {/* Snackbar */}
                <Snackbar open={openSnackbar} autoHideDuration={6000} onClose={() => setOpenSnackbar(false)}>
                    <Alert onClose={() => setOpenSnackbar(false)} severity={snackbarSeverity} sx={{ width: '100%' }}>{snackbarMessage}</Alert>
                </Snackbar>

                {/* Dialog de Confirmação */}
                <Dialog open={openConfirmModal} onClose={() => setOpenConfirmModal(false)}>
                    <DialogTitle>Confirmar Agendamento</DialogTitle>
                    <DialogContent>
                        <Typography>Você está prestes a agendar {aulasParaConfirmar.length} aula(s). Deseja continuar?</Typography>
                    </DialogContent>
                    <DialogActions>
                        <Button onClick={() => setOpenConfirmModal(false)} color="secondary">Cancelar</Button>
                        <Button onClick={handleConfirmSave} color="primary" variant="contained">Confirmar</Button>
                    </DialogActions>
                </Dialog>

                {/* Dialog de Conflitos */}
                <Dialog open={openDuplicateDialog} onClose={() => setOpenDuplicateDialog(false)} maxWidth="md" fullWidth>
                    <DialogTitle>Conflitos Detectados</DialogTitle>
                    <DialogContent>
                        <Typography variant="body1" gutterBottom>
                            {aulasParaConfirmar.length > 0 && `${aulasParaConfirmar.length} aula(s) podem ser agendadas sem conflito. `}
                            {conflitos.length} agendamento(s) possuem conflito:
                        </Typography>
                        <TableContainer component={Paper} sx={{ mt: 2 }}>
                            <Table size="small">
                                <TableHead>
                                    <TableRow>
                                        <TableCell><strong>Lab</strong></TableCell>
                                        <TableCell><strong>Data/Hora</strong></TableCell>
                                        <TableCell><strong>Conflito com</strong></TableCell>
                                    </TableRow>
                                </TableHead>
                                <TableBody>
                                    {conflitos.map((c, idx) => (
                                        <TableRow key={idx}>
                                            <TableCell>{c.novaAula.laboratorioSelecionado}</TableCell>
                                            <TableCell>{dayjs(c.novaAula.dataInicio.toDate()).format('DD/MM/YYYY HH:mm')}</TableCell>
                                            <TableCell>{c.conflito.assunto} ({c.conflito.propostoPorNome})</TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </TableContainer>
                    </DialogContent>
                    <DialogActions>
                        <Button onClick={() => setOpenDuplicateDialog(false)} color="secondary">Cancelar</Button>
                        <Button onClick={() => handleAulasComConflito(false)} color="primary">Ignorar Conflitos</Button>
                        <Button onClick={() => handleAulasComConflito(true)} color="error" variant="contained">Substituir</Button>
                    </DialogActions>
                </Dialog>

                {/* Dialog de Manter Dados */}
                <Dialog open={openKeepDataDialog} onClose={() => setOpenKeepDataDialog(false)}>
                    <DialogTitle>Sucesso!</DialogTitle>
                    <DialogContent>
                        <Typography>Deseja manter os dados da aula para agendar em outra data/horário?</Typography>
                    </DialogContent>
                    <DialogActions>
                        <Button onClick={() => { clearForm(false); setOpenKeepDataDialog(false); navigate('/calendario'); }} color="secondary">Não, voltar ao calendário</Button>
                        <Button onClick={() => { clearForm(true); setOpenKeepDataDialog(false); }} color="primary" variant="contained">Sim, manter dados</Button>
                    </DialogActions>
                </Dialog>
            </Container>
        </LocalizationProvider>
    );
}

ProporAulaForm.propTypes = {
    userInfo: PropTypes.object,
    currentUser: PropTypes.object,
    initialDate: PropTypes.object,
    onSuccess: PropTypes.func,
    onCancel: PropTypes.func,
    isModal: PropTypes.bool
};

export default ProporAulaForm;
