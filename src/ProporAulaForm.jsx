import React, { useState, useEffect } from 'react';
import {
    Container, Typography, TextField, Button, Grid, MenuItem, FormControl, InputLabel,
    Select, Box, Paper, Snackbar, Alert, CircularProgress, OutlinedInput, Chip, IconButton, Tooltip,
    List, ListItem, ListItemText, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, FormHelperText, Badge, Autocomplete
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
import DialogConfirmacao from './components/DialogConfirmacao';
import { notificadorTelegram } from './ia-estruturada/NotificadorTelegram';

dayjs.locale('pt-br');

const BLOCOS_HORARIO = [
    { "value": "07:00-09:10", "label": "07:00 - 09:10", "turno": "Matutino" },
    { "value": "09:30-12:00", "label": "09:30 - 12:00", "turno": "Matutino" },
    { "value": "13:00-15:10", "label": "13:00 - 15:10", "turno": "Vespertino" },
    { "value": "15:30-18:00", "label": "15:30 - 18:00", "turno": "Vespertino" },
    { "value": "18:30-20:10", "label": "18:30 - 20:10", "turno": "Noturno" },
    { "value": "20:30-22:00", "label": "20:30 - 22:00", "turno": "Noturno" },
];

const TELEGRAM_CHAT_ID = import.meta.env.VITE_TELEGRAM_CHAT_ID;

function ProporAulaForm({ userInfo, currentUser, initialDate, onSuccess, onCancel, isModal, formTitle }) {
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

    const [secao1Completa, setSecao1Completa] = useState(false);
    const [secao2Completa, setSecao2Completa] = useState(false);

    const navigate = useNavigate();
    const location = useLocation();
    const { aulaId } = useParams();

    // --- FUNÇÃO DE NOTIFICAÇÃO CORRIGIDA ---
    const notificarTelegramBatch = async (aulas, tipoAcao) => {
        if (!TELEGRAM_CHAT_ID) return;
        
        for (const aula of aulas) {
            let dataFormatada = 'N/A';
            let dataISO = null;
            
            // Verifica se é um objeto Dayjs
            if (dayjs.isDayjs(aula.dataInicio)) {
                dataFormatada = aula.dataInicio.format('DD/MM/YYYY');
                dataISO = aula.dataInicio.format('YYYY-MM-DD');
            } 
            // Verifica se é Timestamp do Firebase
            else if (aula.dataInicio && typeof aula.dataInicio.toDate === 'function') {
                const dateObj = dayjs(aula.dataInicio.toDate());
                dataFormatada = dateObj.format('DD/MM/YYYY');
                dataISO = dateObj.format('YYYY-MM-DD');
            }
            // Verifica se é Date nativo ou string
            else if (aula.dataInicio) {
                const dateObj = dayjs(aula.dataInicio);
                if (dateObj.isValid()) {
                    dataFormatada = dateObj.format('DD/MM/YYYY');
                    dataISO = dateObj.format('YYYY-MM-DD');
                }
            }

            const dadosNotificacao = {
                assunto: aula.assunto,
                data: dataFormatada,
                dataISO: dataISO, // Envia a data para o link
                horario: aula.horarioSlotString,
                laboratorio: aula.laboratorioSelecionado,
                cursos: aula.cursos,
                observacoes: aula.observacoes
            };

            await notificadorTelegram.enviarNotificacao(TELEGRAM_CHAT_ID, dadosNotificacao, tipoAcao);
        }
    };

    useEffect(() => {
        if (isEditMode) {
            setSecao1Completa(true);
            return;
        }
        const completa = formData.tipoAtividade !== '' && 
                         formData.assunto.trim() !== '' && 
                         formData.cursos.length > 0;
        setSecao1Completa(completa);
    }, [formData.tipoAtividade, formData.assunto, formData.cursos, isEditMode]);

    useEffect(() => {
        if (isEditMode) {
            setSecao2Completa(true);
            return;
        }
        const labsCompletos = formData.dynamicLabs.every(lab => lab && lab.tipo !== '' && lab.laboratorios.length > 0);
        setSecao2Completa(labsCompletos && secao1Completa);
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
            if (!secao2Completa && !isEditMode) {
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
    }, [formData.dataInicio, formData.dynamicLabs, aulaId, secao2Completa, isEditMode]);

    const validate = (fieldValues = formData) => {
        let tempErrors = { ...errors };
        if ('assunto' in fieldValues) tempErrors.assunto = fieldValues.assunto ? "" : "O assunto é obrigatório.";
        if ('tipoAtividade' in fieldValues) tempErrors.tipoAtividade = fieldValues.tipoAtividade ? "" : "O tipo de atividade é obrigatório.";
        if ('cursos' in fieldValues) tempErrors.cursos = fieldValues.cursos.length > 0 ? "" : "Selecione pelo menos um curso.";
        if ('dataInicio' in fieldValues) tempErrors.dataInicio = fieldValues.dataInicio ? "" : "A data é obrigatória.";
        if ('horarioSlotString' in fieldValues) tempErrors.horarioSlotString = fieldValues.horarioSlotString.length > 0 ? "" : "Selecione pelo menos um horário.";
        if ('dynamicLabs' in fieldValues) {
            const labError = fieldValues.dynamicLabs.some(lab => !lab || !lab.tipo || lab.laboratorios.length === 0);
            tempErrors.dynamicLabs = labError ? "Todos os campos de laboratório são obrigatórios." : "";
        }
        setErrors(tempErrors);
        return Object.values(tempErrors).every(x => x === "");
    };

    const handleChange = (e) => {
        const { name, value } = e.target;
        const newValue = name === 'cursos' ? value : (Array.isArray(value) ? value : value);

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
                const aulaAtualizada = { ...aulasParaConfirmar[0], updatedAt: serverTimestamp() };
                await updateDoc(docRef, aulaAtualizada);
                
                await notificarTelegramBatch([aulaAtualizada], 'editar');

                setSnackbarMessage("Aula atualizada com sucesso!");
            } else {
                const batch = writeBatch(db);
                const aulasCollection = collection(db, "aulas");
                aulasParaConfirmar.forEach(aula => {
                    const newDocRef = doc(aulasCollection);
                    batch.set(newDocRef, { ...aula, createdAt: serverTimestamp() });
                });
                await batch.commit();

                await notificarTelegramBatch(aulasParaConfirmar, 'adicionar');

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
            const novas = conflitos.map(c => c.novaAula);
            aulasParaAdicionar.push(...novas);
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

            await notificarTelegramBatch(aulasParaAdicionar, 'adicionar');

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

    return (
        <LocalizationProvider dateAdapter={AdapterDayjs} adapterLocale="pt-br">
            <Container maxWidth="md">
                <Typography variant="h4" component="h1" gutterBottom align="center" sx={{ mb: 4, color: '#3f51b5', fontWeight: 'bold', mt: 4 }}>
                    {formTitle || (isEditMode ? "Editar Aula" : "Propor Nova Aula")}
                </Typography>
                <form onSubmit={(e) => { e.preventDefault(); prepareAndConfirm(); }}>
                    <Grid container spacing={3} justifyContent="center">
                        {/* SEÇÃO 1: DETALHES */}
                        <Grid item xs={12} md={6}>
                            <Paper elevation={3} sx={{ p: 3, borderLeft: '5px solid #1976d2', height: '100%' }}>
                                <Typography variant="h6" gutterBottom>1. Detalhes da Aula</Typography>
                                <FormControl fullWidth variant="outlined" sx={{ mb: 2 }} error={!!errors.tipoAtividade}>
                                    <InputLabel>Tipo *</InputLabel>
                                    <Select name="tipoAtividade" value={formData.tipoAtividade} label="Tipo *" onChange={handleChange}>
                                        <MenuItem value="aula">Aula</MenuItem>
                                        <MenuItem value="revisao">Revisão</MenuItem>
                                    </Select>
                                    {errors.tipoAtividade && <FormHelperText>{errors.tipoAtividade}</FormHelperText>}
                                </FormControl>
                                <TextField fullWidth label="Assunto da Aula *" name="assunto" value={formData.assunto} onChange={handleChange} error={!!errors.assunto} helperText={errors.assunto} sx={{ mb: 2 }} />
                                <Autocomplete
                                    multiple
                                    id="cursos-autocomplete"
                                    options={LISTA_CURSOS_CONSTANTS}
                                    getOptionLabel={(option) => option.label}
                                    isOptionEqualToValue={(option, value) => option.value === value.value}
                                    value={formData.cursos.map(value => LISTA_CURSOS_CONSTANTS.find(c => c.value === value)).filter(Boolean)}
                                    onChange={(event, newValue) => {
                                        const syntheticEvent = { target: { name: 'cursos', value: newValue.map(item => item.value) } };
                                        handleChange(syntheticEvent);
                                    }}
                                    renderInput={(params) => (
                                        <TextField
                                            {...params}
                                            label="Curso(s) Relacionado(s) *"
                                            placeholder="Selecione os cursos"
                                            error={!!errors.cursos}
                                            helperText={errors.cursos}
                                        />
                                    )}
                                    renderTags={(value, getTagProps) =>
                                        value.map((option, index) => (
                                            <Chip variant="outlined" label={option.label} {...getTagProps({ index })} size="small" />
                                        ))
                                    }
                                    sx={{ mb: 2 }}
                                />
                                {formData.tipoAtividade === 'revisao' && (
                                    <FormControl fullWidth sx={{ mb: 2 }}>
                                        <InputLabel>Liga</InputLabel>
                                        <Select name="liga" value={formData.liga} label="Liga" onChange={handleChange}>
                                            <MenuItem value=""><em>Nenhuma</em></MenuItem>
                                            {LISTA_CURSOS_CONSTANTS.map(c => <MenuItem key={c.value} value={c.value}>{c.label}</MenuItem>)}
                                        </Select>
                                    </FormControl>
                                )}
                                <TextField fullWidth label="Observações" name="observacoes" value={formData.observacoes} onChange={handleChange} multiline rows={1} />
                            </Paper>
                        </Grid>

                        {/* SEÇÃO 2: LABORATÓRIOS */}
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
                                    <Alert severity="warning" sx={{ mt: 1, mb: 2 }}>
                                        <strong>Seção bloqueada!</strong> Complete todos os campos obrigatórios (*) da Seção 1 para desbloquear.
                                    </Alert>
                                )}

                                {errors.dynamicLabs && <Alert severity="error" sx={{ mb: 1, fontSize: '0.8rem' }}>{errors.dynamicLabs}</Alert>}
                                
                                {formData.dynamicLabs.map((labSelection, index) => {
                                    if (!labSelection) return null;

                                    return (
                                        <Grid container spacing={1} key={index} sx={{ mt: index > 0 ? 1 : 0, alignItems: 'center' }}>
                                            <Grid item xs={5}>
                                                <FormControl fullWidth size="small" disabled={!secao1Completa && !isEditMode}>
                                                    <InputLabel>Tipo *</InputLabel>
                                                    <Select value={labSelection.tipo || ''} onChange={(e) => handleLabTipoChange(index, e.target.value)}>
                                                        {Array.from(new Set(LISTA_LABORATORIOS.filter(l => l && l.tipo).map(l => l.tipo))).map(t => (
                                                            <MenuItem key={t} value={t}>{t.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}</MenuItem>
                                                        ))}
                                                    </Select>
                                                </FormControl>
                                            </Grid>
                                            <Grid item xs={5}>
                                                <FormControl fullWidth size="small" disabled={(!labSelection.tipo) || (!secao1Completa && !isEditMode)}>
                                                    <InputLabel>Específico *</InputLabel>
                                                    <Select multiple value={labSelection.laboratorios || []} onChange={(e) => handleLabEspecificoChange(index, e.target.value)} input={<OutlinedInput label="Específico *" />} renderValue={(selected) => (<Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>{selected.map((value) => (<Chip key={value} label={value} size="small" />))}</Box>)}>
                                                        {LISTA_LABORATORIOS.filter(lab => lab && lab.tipo === labSelection.tipo).map(l => <MenuItem key={l.id} value={l.name}>{l.name}</MenuItem>)}
                                                    </Select>
                                                </FormControl>
                                            </Grid>
                                            {formData.dynamicLabs.length > 1 && (
                                                <Grid item xs={2} sx={{ textAlign: 'center' }}>
                                                    <IconButton size="small" color="error" onClick={() => handleRemoveLabField(index)} disabled={!secao1Completa && !isEditMode}>
                                                        <DeleteIcon />
                                                    </IconButton>
                                                </Grid>
                                            )}
                                        </Grid>
                                    );
                                })}
                            </Paper>
                        </Grid>

                        {/* SEÇÃO 3: DATA E HORÁRIO */}
                        <Grid item xs={12}>
                            <Paper elevation={3} sx={{ p: 3, borderLeft: '5px solid #00acc1', opacity: (!secao2Completa && !isEditMode) ? 0.8 : 1 }}>
                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
                                    <Typography variant="h6" sx={{ mb: 0 }}>3. Data e Horário</Typography>
                                    {!secao2Completa && !isEditMode && <LockIcon color="warning" />}
                                </Box>

                                {!secao2Completa && !isEditMode && (
                                    <Alert severity="warning" sx={{ mb: 2 }}>
                                        <strong>Seção bloqueada!</strong> Complete os campos obrigatórios (*) das Seções 1 e 2 para desbloquear.
                                    </Alert>
                                )}

                                <Grid container spacing={2}>
                                    <Grid item xs={12} sm={6}>
                                        <DatePicker
                                            label="Data da Aula *"
                                            value={formData.dataInicio}
                                            onChange={handleDateChange}
                                            format="DD/MM/YYYY"
                                            disabled={!secao2Completa && !isEditMode}
                                            onMonthChange={(newMonth) => setMesVisivel(newMonth)}
                                            loading={loadingCalendario}
                                            slots={{
                                                day: (props) => {
                                                    const diaFormatado = props.day.format('YYYY-MM-DD');
                                                    const isTotalmenteOcupado = diasTotalmenteOcupados.includes(diaFormatado);
                                                    const isParcialmenteOcupado = diasParcialmenteOcupados.includes(diaFormatado);
                                                    return (<Badge key={props.day.toString()} overlap="circular" badgeContent={isParcialmenteOcupado && !isTotalmenteOcupado ? ' ' : 0} color="warning" variant="dot"><PickersDay {...props} disabled={isTotalmenteOcupado} /></Badge>);
                                                }
                                            }}
                                            slotProps={{ textField: { fullWidth: true, variant: 'outlined', error: !!errors.dataInicio, helperText: errors.dataInicio } }}
                                        />
                                    </Grid>
                                    <Grid item xs={12} sm={6}>
                                        <FormControl fullWidth variant="outlined" error={!!errors.horarioSlotString} disabled={!secao2Completa && !isEditMode}>
                                            <InputLabel>Bloco de Horário *</InputLabel>
                                            <Select multiple name="horarioSlotString" value={formData.horarioSlotString} onChange={handleChange} input={<OutlinedInput label="Bloco de Horário *" />} renderValue={(selected) => selected.join(', ')}>
                                                {verificandoDisp && <MenuItem disabled><em>Verificando disponibilidade...</em></MenuItem>}
                                                {BLOCOS_HORARIO.map(bloco => {
                                                    const isOcupado = horariosOcupados.includes(bloco.value);
                                                    return (<MenuItem key={bloco.value} value={bloco.value} disabled={isOcupado}>
                                                        <ListItemText primary={bloco.label} sx={{ color: isOcupado ? 'error.main' : 'inherit' }} />
                                                        {isOcupado && <Chip label="Ocupado" color="error" size="small" />}
                                                    </MenuItem>);
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

                <Snackbar open={openSnackbar} autoHideDuration={6000} onClose={() => setOpenSnackbar(false)}>
                    <Alert onClose={() => setOpenSnackbar(false)} severity={snackbarSeverity} sx={{ width: '100%' }}>{snackbarMessage}</Alert>
                </Snackbar>

                <DialogConfirmacao
                    open={openConfirmModal}
                    onClose={() => setOpenConfirmModal(false)}
                    onConfirm={handleConfirmSave}
                    title="Confirmação de Agendamento"
                    message={
                        <Box>
                            <Typography variant="body1" gutterBottom>Você está prestes a {isEditMode ? 'atualizar' : 'agendar'} {aulasParaConfirmar.length} aula(s):</Typography>
                            <TableContainer component={Paper} elevation={0} sx={{ maxHeight: 200, overflow: 'auto', mb: 2 }}>
                                <Table size="small" stickyHeader>
                                    <TableHead><TableRow><TableCell>Assunto</TableCell><TableCell>Laboratório</TableCell><TableCell>Data/Hora</TableCell></TableRow></TableHead>
                                    <TableBody>{aulasParaConfirmar.map((aula, index) => (<TableRow key={index}><TableCell>{aula.assunto}</TableCell><TableCell>{aula.laboratorioSelecionado}</TableCell><TableCell>{dayjs(aula.dataInicio.toDate()).format('DD/MM HH:mm')}</TableCell></TableRow>))}</TableBody>
                                </Table>
                            </TableContainer>
                            <Typography variant="body2" color="text.secondary">Confirme para prosseguir.</Typography>
                        </Box>
                    }
                    confirmText={isEditMode ? "Atualizar" : "Agendar"}
                    loading={loadingSubmit}
                />

                <DialogConfirmacao
                    open={openDuplicateDialog}
                    onClose={() => setOpenDuplicateDialog(false)}
                    onConfirm={() => handleAulasComConflito(false)}
                    title="Conflito de Agendamento Detectado"
                    message={
                        <Box>
                            <Typography variant="body1" gutterBottom>Foram detectados {conflitos.length} conflito(s) de horário/laboratório. As aulas em conflito estão listadas abaixo. Você pode optar por **substituir** as aulas existentes pelas novas propostas (apenas para coordenadores) ou **ignorar** os conflitos e agendar apenas as aulas disponíveis ({aulasParaConfirmar.length}).</Typography>
                            <TableContainer component={Paper} elevation={0} sx={{ maxHeight: 200, overflow: 'auto', mb: 2 }}>
                                <Table size="small" stickyHeader>
                                    <TableHead><TableRow><TableCell>Assunto (Novo)</TableCell><TableCell>Laboratório</TableCell><TableCell>Data/Hora</TableCell><TableCell>Assunto (Existente)</TableCell></TableRow></TableHead>
                                    <TableBody>{conflitos.map((c, index) => (<TableRow key={index}><TableCell>{c.novaAula.assunto}</TableCell><TableCell>{c.novaAula.laboratorioSelecionado}</TableCell><TableCell>{dayjs(c.novaAula.dataInicio.toDate()).format('DD/MM HH:mm')}</TableCell><TableCell>{c.conflito.assunto}</TableCell></TableRow>))}</TableBody>
                                </Table>
                            </TableContainer>
                            {aulasParaConfirmar.length > 0 && <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>**{aulasParaConfirmar.length}** aula(s) sem conflito serão agendadas de qualquer forma.</Typography>}
                        </Box>
                    }
                    confirmText="Ignorar Conflitos e Agendar Disponíveis"
                    cancelText={isCoordenador ? "Substituir e Agendar" : "Cancelar"}
                    onCancel={isCoordenador ? () => handleAulasComConflito(true) : () => setOpenDuplicateDialog(false)}
                    loading={loadingSubmit}
                    confirmColor="primary"
                />

                <DialogConfirmacao
                    open={openKeepDataDialog}
                    onClose={() => setOpenKeepDataDialog(false)}
                    onConfirm={() => { setOpenKeepDataDialog(false); clearForm(true); }}
                    title="Agendamento Concluído!"
                    message="Deseja manter os dados preenchidos para agendar outra aula?"
                    confirmText="Sim, Manter Dados"
                    cancelText="Não, Limpar Tudo"
                    onCancel={() => { setOpenKeepDataDialog(false); clearForm(false); navigate('/calendario'); }}
                />
            </Container>
        </LocalizationProvider>
    );
}

ProporAulaForm.propTypes = {
    userInfo: PropTypes.object.isRequired,
    currentUser: PropTypes.object.isRequired,
    initialDate: PropTypes.object,
    onSuccess: PropTypes.func,
    onCancel: PropTypes.func,
    isModal: PropTypes.bool,
    formTitle: PropTypes.string,
};

export default ProporAulaForm;