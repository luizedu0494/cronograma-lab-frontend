import React, { useState, useEffect } from 'react';
import {
    Container, Typography, TextField, Button, Grid, MenuItem, FormControl, InputLabel,
    Select, Box, Paper, Snackbar, Alert, CircularProgress, OutlinedInput, Chip, IconButton, Tooltip,
    List, ListItem, ListItemText, FormHelperText, Autocomplete, Dialog, DialogTitle, DialogContent, DialogActions
} from '@mui/material';
import { ArrowBack, Delete as DeleteIcon, Add as AddIcon, Lock as LockIcon } from '@mui/icons-material';
import { AdapterDayjs } from '@mui/x-date-pickers/AdapterDayjs';
import { LocalizationProvider } from '@mui/x-date-pickers';
import { DatePicker } from '@mui/x-date-pickers';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { db } from './firebaseConfig';
import {
    collection, addDoc, serverTimestamp, doc, getDoc, updateDoc, Timestamp, query, where, getDocs, writeBatch
} from 'firebase/firestore';
import dayjs from 'dayjs';
import 'dayjs/locale/pt-br';
import { LISTA_LABORATORIOS, TIPOS_LABORATORIO } from './constants/laboratorios';
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

function ProporAulaForm({ userInfo, currentUser, initialDate, onSuccess, onCancel, isModal, formTitle, aulaId: propAulaId }) {
    const [formData, setFormData] = useState({
        assunto: '', observacoes: '', tipoAtividade: '', cursos: [], liga: '',
        dataInicio: initialDate ? dayjs(initialDate) : null, horarioSlotString: [], dynamicLabs: [{ tipo: '', laboratorios: [] }],
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
    
    // --- MUDANÇA AQUI: Estado agora guarda um Objeto { horario: "Nome da Aula" } ---
    const [infoOcupacao, setInfoOcupacao] = useState({});
    
    const [verificandoDisp, setVerificandoDisp] = useState(false);
    const [diasTotalmenteOcupados, setDiasTotalmenteOcupados] = useState([]);
    const [diasParcialmenteOcupados, setDiasParcialmenteOcupados] = useState([]);
    const [mesVisivel, setMesVisivel] = useState(dayjs());
    const [loadingCalendario, setLoadingCalendario] = useState(false);

    const [secao1Completa, setSecao1Completa] = useState(false);
    const [secao2Completa, setSecao2Completa] = useState(false);

    const navigate = useNavigate();
    const location = useLocation();
    const { aulaId: paramAulaId } = useParams();
    const aulaId = propAulaId || paramAulaId;

    const notificarTelegramBatch = async (aulas, tipoAcao) => {
        if (!TELEGRAM_CHAT_ID) return;
        for (const aula of aulas) {
            let dataFormatada = 'N/A';
            let dataISO = null;
            
            const dateObj = dayjs(aula.dataInicio.toDate ? aula.dataInicio.toDate() : aula.dataInicio);
            if (dateObj.isValid()) {
                dataFormatada = dateObj.format('DD/MM/YYYY');
                dataISO = dateObj.format('YYYY-MM-DD');
            }

            const dadosNotificacao = {
                assunto: aula.assunto,
                data: dataFormatada,
                dataISO: dataISO,
                horario: aula.horarioSlotString,
                laboratorio: aula.laboratorioSelecionado,
                cursos: aula.cursos,
                observacoes: aula.observacoes
            };
            await notificadorTelegram.enviarNotificacao(TELEGRAM_CHAT_ID, dadosNotificacao, tipoAcao);
        }
    };

    useEffect(() => {
        if (aulaId) {
            setSecao1Completa(true);
            return;
        }
        const completa = formData.assunto.trim() !== '' && formData.cursos.length > 0;
        setSecao1Completa(completa);
    }, [formData.assunto, formData.cursos, aulaId]);

    useEffect(() => {
        if (aulaId) {
            setSecao2Completa(true);
            return;
        }
        const labsCompletos = formData.dynamicLabs.every(lab => lab && lab.tipo !== '' && lab.laboratorios.length > 0);
        setSecao2Completa(labsCompletos && secao1Completa);
    }, [formData.dynamicLabs, secao1Completa, aulaId]);

    useEffect(() => {
        const fetchOcupacaoDoMes = async () => {
            setLoadingCalendario(true);
            const inicioDoMes = mesVisivel.startOf('month').toDate();
            const fimDoMes = mesVisivel.endOf('month').toDate();
            try {
                const q = query(collection(db, "aulas"), where("dataInicio", ">=", Timestamp.fromDate(inicioDoMes)), where("dataInicio", "<=", Timestamp.fromDate(fimDoMes)));
                const querySnapshot = await getDocs(q);
                const aulasDoMes = querySnapshot.docs.map(doc => doc.data());
                
                const qEventos = query(collection(db, "eventosManutencao"), where("dataInicio", ">=", Timestamp.fromDate(inicioDoMes)), where("dataInicio", "<=", Timestamp.fromDate(fimDoMes)));
                const querySnapshotEventos = await getDocs(qEventos);
                const eventosDoMes = querySnapshotEventos.docs
                    .map(doc => doc.data())
                    .filter(e => {
                        const start = e.dataInicio instanceof Timestamp ? e.dataInicio.toDate() : new Date(e.dataInicio);
                        return dayjs(start).isAfter(dayjs(inicioDoMes)) || dayjs(start).isSame(dayjs(inicioDoMes));
                    });

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
                        BLOCOS_HORARIO.forEach(bloco => {
                            ocupacaoPorDia[dia].add(`${evento.laboratorio}-${bloco.value}`);
                        });
                    }
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
                console.error("Erro ao buscar ocupação do mes:", error);
            } finally {
                setLoadingCalendario(false);
            }
        };
        fetchOcupacaoDoMes();
    }, [mesVisivel]);

    // --- VERIFICAÇÃO COM DETALHES DE QUEM OCUPA ---
    useEffect(() => {
        const verificarDisponibilidadeHorarios = async () => {
            if (!secao2Completa && !aulaId) {
                setInfoOcupacao({});
                return;
            }
            const laboratoriosParaVerificar = formData.dynamicLabs.flatMap(lab => lab.laboratorios).filter(Boolean);
            if (!formData.dataInicio || laboratoriosParaVerificar.length === 0) {
                setInfoOcupacao({});
                return;
            }
            setVerificandoDisp(true);
            try {
                const diaSelecionado = dayjs(formData.dataInicio).startOf('day');
                
                // 1. Busca Aulas
                const q = query(collection(db, "aulas"), where("laboratorioSelecionado", "in", laboratoriosParaVerificar), where("dataInicio", ">=", Timestamp.fromDate(diaSelecionado.toDate())), where("dataInicio", "<", Timestamp.fromDate(diaSelecionado.add(1, 'day').toDate())));
                const querySnapshot = await getDocs(q);
                
                // 2. Busca Eventos
                const qEventos = query(collection(db, "eventosManutencao"), where("dataInicio", ">=", Timestamp.fromDate(diaSelecionado.startOf('day').toDate())), where("dataInicio", "<=", Timestamp.fromDate(diaSelecionado.endOf('day').toDate())));
                const querySnapshotEventos = await getDocs(qEventos);

                const ocupacaoMap = {};

                // Processa Aulas
                querySnapshot.docs.forEach(doc => {
                    if (doc.id !== aulaId) {
                        const data = doc.data();
                        ocupacaoMap[data.horarioSlotString] = data.assunto; // Guarda o nome da matéria
                    }
                });

                // Processa Eventos
                querySnapshotEventos.docs.forEach(doc => {
                    const data = doc.data();
                    if (data.laboratorio === 'Todos' || laboratoriosParaVerificar.includes(data.laboratorio)) {
                        // Se o evento não tiver slot (dia todo), não marcamos slot específico aqui (mas poderia bloquear tudo)
                        if (data.horarioSlotString) {
                            ocupacaoMap[data.horarioSlotString] = data.titulo || "Evento/Manutenção";
                        }
                    }
                });
                
                setInfoOcupacao(ocupacaoMap);

            } catch (error) {
                console.error("Erro ao verificar disponibilidade:", error);
            } finally {
                setVerificandoDisp(false);
            }
        };
        verificarDisponibilidadeHorarios();
    }, [formData.dataInicio, formData.dynamicLabs, secao2Completa, aulaId]);

    useEffect(() => {
        const loadAulaData = async () => {
            if (aulaId) {
                setIsEditMode(true);
                try {
                    const docRef = doc(db, "aulas", aulaId);
                    const docSnap = await getDoc(docRef);
                    if (docSnap.exists()) {
                        const data = docSnap.data();
                        const labObj = LISTA_LABORATORIOS.find(l => l.name === data.laboratorioSelecionado);
                        setFormData({
                            assunto: data.assunto || '',
                            observacoes: data.observacoes || '',
                            tipoAtividade: data.tipoAtividade || '',
                            cursos: data.cursos || [],
                            liga: data.liga || '',
                            dataInicio: dayjs(data.dataInicio.toDate()),
                            horarioSlotString: Array.isArray(data.horarioSlotString) ? data.horarioSlotString : [data.horarioSlotString],
                            dynamicLabs: [{ tipo: labObj ? labObj.tipo : '', laboratorios: [data.laboratorioSelecionado] }]
                        });
                    }
                } catch (error) {
                    console.error("Erro ao carregar aula:", error);
                }
            }
        };
        loadAulaData();
    }, [aulaId]);

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
        if (!formData.assunto.trim()) newErrors.assunto = 'Obrigatório';
        if (formData.cursos.length === 0) newErrors.cursos = 'Selecione pelo menos um curso';
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
            const aulasParaAgendar = [];
            const dataBase = dayjs(formData.dataInicio);

            for (const slot of formData.horarioSlotString) {
                const [inicioStr, fimStr] = slot.split('-');
                const dataHoraInicio = dataBase.hour(parseInt(inicioStr.split(':')[0])).minute(parseInt(inicioStr.split(':')[1])).second(0).millisecond(0);
                const dataHoraFim = dataBase.hour(parseInt(fimStr.split(':')[0])).minute(parseInt(fimStr.split(':')[1])).second(0).millisecond(0);

                for (const labGroup of formData.dynamicLabs) {
                    for (const labName of labGroup.laboratorios) {
                        aulasParaAgendar.push({
                            assunto: formData.assunto,
                            observacoes: formData.observacoes,
                            tipoAtividade: formData.tipoAtividade,
                            cursos: formData.cursos,
                            liga: formData.liga,
                            laboratorioSelecionado: labName,
                            dataInicio: dataHoraInicio,
                            dataFim: dataHoraFim,
                            horarioSlotString: slot,
                            professorUid: currentUser.uid,
                            professorNome: userInfo?.name || currentUser.displayName || currentUser.email,
                            propostoPorUid: currentUser.uid,
                            propostoPorNome: userInfo?.name || currentUser.displayName || currentUser.email,
                            status: isCoordenador ? 'aprovada' : 'pendente',
                            createdAt: serverTimestamp()
                        });
                    }
                }
            }

            const conflitosEncontrados = [];
            for (const nova of aulasParaAgendar) {
                const q = query(collection(db, "aulas"), where("laboratorioSelecionado", "==", nova.laboratorioSelecionado), where("dataInicio", "==", Timestamp.fromDate(nova.dataInicio.toDate())), where("horarioSlotString", "==", nova.horarioSlotString));
                const querySnapshot = await getDocs(q);
                querySnapshot.docs.forEach(doc => {
                    if (doc.id !== aulaId) conflitosEncontrados.push({ novaAula: nova, conflito: { id: doc.id, ...doc.data() } });
                });
            }

            if (conflitosEncontrados.length > 0) {
                setConflitos(conflitosEncontrados);
                setAulasParaConfirmar(aulasParaAgendar);
                setOpenDuplicateDialog(true);
            } else {
                setAulasParaConfirmar(aulasParaAgendar);
                setOpenConfirmModal(true);
            }
        } catch (error) {
            console.error("Erro ao preparar agendamento:", error);
        } finally {
            setLoadingSubmit(false);
        }
    };

    const handleAulasComConflito = async (substituir) => {
        setOpenDuplicateDialog(false);
        if (substituir) {
            setLoadingSubmit(true);
            try {
                const batch = writeBatch(db);
                conflitos.forEach(c => batch.delete(doc(db, "aulas", c.conflito.id)));
                await batch.commit();
                setOpenConfirmModal(true);
            } catch (error) {
                console.error("Erro ao substituir aulas:", error);
            } finally {
                setLoadingSubmit(false);
            }
        } else {
            setOpenConfirmModal(true);
        }
    };

    const handleConfirmSave = async () => {
        setOpenConfirmModal(false);
        setLoadingSubmit(true);
        try {
            const finalizadas = [];
            if (isEditMode && aulaId) {
                const aula = aulasParaConfirmar[0];
                const finalData = {
                    ...aula,
                    dataInicio: Timestamp.fromDate(aula.dataInicio.toDate()),
                    dataFim: Timestamp.fromDate(aula.dataFim.toDate()),
                    updatedAt: serverTimestamp()
                };
                await updateDoc(doc(db, "aulas", aulaId), finalData);
                finalizadas.push(aula);
            } else {
                for (const aula of aulasParaConfirmar) {
                    const finalData = {
                        ...aula,
                        dataInicio: Timestamp.fromDate(aula.dataInicio.toDate()),
                        dataFim: Timestamp.fromDate(aula.dataFim.toDate())
                    };
                    await addDoc(collection(db, "aulas"), finalData);
                    finalizadas.push(aula);
                }
            }

            await notificarTelegramBatch(finalizadas, isEditMode ? 'editar' : 'adicionar');

            setSnackbarMessage(isEditMode ? 'Aula atualizada com sucesso!' : 'Aula(s) proposta(s) com sucesso!');
            setSnackbarSeverity('success');
            setOpenSnackbar(true);
            if (onSuccess) onSuccess();
            else if (!isEditMode) setOpenKeepDataDialog(true);
        } catch (error) {
            setSnackbarMessage('Erro ao salvar agendamento.');
            setSnackbarSeverity('error');
            setOpenSnackbar(true);
        } finally {
            setLoadingSubmit(false);
        }
    };

    const handleKeepData = (keep) => {
        setOpenKeepDataDialog(false);
        if (!keep) navigate('/calendario');
        else setFormData(prev => ({ ...prev, horarioSlotString: [] }));
    };

    const handleCloseSnackbar = () => setOpenSnackbar(false);

    return (
        <LocalizationProvider dateAdapter={AdapterDayjs} adapterLocale="pt-br">
            <Container maxWidth="md">
                <Typography variant="h4" component="h1" gutterBottom align="center" sx={{ mb: 4, color: '#3f51b5', fontWeight: 'bold', mt: isModal ? 0 : 4 }}>
                    {formTitle || (isEditMode ? "Editar Aula" : "Propor Nova Aula")}
                </Typography>
                <form onSubmit={(e) => { e.preventDefault(); prepareAndConfirm(); }}>
                    <Grid container spacing={3} justifyContent="center">
                        <Grid item xs={12} md={6}>
                            <Paper elevation={3} sx={{ p: 3, borderLeft: '5px solid #3f51b5', height: '100%' }}>
                                <Typography variant="h6" gutterBottom>1. Detalhes da Atividade</Typography>
                                <TextField fullWidth label="Assunto da Aula *" name="assunto" value={formData.assunto} onChange={handleChange} error={!!errors.assunto} helperText={errors.assunto} sx={{ mb: 2 }} />
                                
                                <Autocomplete
                                    multiple
                                    id="cursos-autocomplete"
                                    options={LISTA_CURSOS_CONSTANTS}
                                    getOptionLabel={(option) => option.label || option}
                                    isOptionEqualToValue={(option, value) => option.value === value.value || option.value === value}
                                    value={formData.cursos.map(val => {
                                        return LISTA_CURSOS_CONSTANTS.find(c => c.value === val) || val;
                                    })}
                                    onChange={(event, newValue) => {
                                        const values = newValue.map(item => item.value || item);
                                        setFormData(prev => ({ ...prev, cursos: values }));
                                    }}
                                    renderInput={(params) => (
                                        <TextField 
                                            {...params} 
                                            label="Curso(s) *" 
                                            placeholder={formData.cursos.length === 0 ? "Selecione..." : ""}
                                            error={!!errors.cursos} 
                                            helperText={errors.cursos} 
                                        />
                                    )}
                                    renderTags={(value, getTagProps) =>
                                        value.map((option, index) => {
                                            const label = option.label || option;
                                            return (
                                                <Chip variant="outlined" label={label} {...getTagProps({ index })} size="small" />
                                            );
                                        })
                                    }
                                    sx={{ mb: 2 }}
                                />

                                <TextField fullWidth label="Observações" name="observacoes" value={formData.observacoes} onChange={handleChange} multiline rows={3} />
                            </Paper>
                        </Grid>
                        <Grid item xs={12} md={6}>
                            <Paper elevation={3} sx={{ p: 3, borderLeft: '5px solid #f50057', height: '100%', opacity: (!secao1Completa && !isEditMode) ? 0.8 : 1 }}>
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
                                    <Alert severity="warning" sx={{ mb: 2, mt: 1 }}>
                                        <strong>Seção bloqueada!</strong> Complete a Seção 1 para desbloquear.
                                    </Alert>
                                )}
                                {formData.dynamicLabs.map((labSelection, index) => {
                                    if (!labSelection) return null;
                                    return (
                                        <Grid container spacing={1} key={index} sx={{ mt: index > 0 ? 1 : 0, alignItems: 'center' }}>
                                            <Grid item xs={5}>
                                                <FormControl fullWidth size="small" disabled={!secao1Completa && !isEditMode}>
                                                    <InputLabel>Tipo *</InputLabel>
                                                    <Select value={labSelection.tipo || ''} onChange={(e) => handleLabTipoChange(index, e.target.value)}>
                                                        {TIPOS_LABORATORIO.map(t => <MenuItem key={t.id} value={t.id}>{t.name}</MenuItem>)}
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
                                    );
                                })}
                            </Paper>
                        </Grid>
                        <Grid item xs={12}>
                            <Paper elevation={3} sx={{ p: 3, borderLeft: '5px solid #4caf50', opacity: (!secao2Completa && !isEditMode) ? 0.8 : 1 }}>
                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
                                    <Typography variant="h6" gutterBottom sx={{ mb: 0 }}>3. Data e Horário</Typography>
                                    {!secao2Completa && !isEditMode && <LockIcon color="warning" />}
                                </Box>
                                {!secao2Completa && !isEditMode && (
                                    <Alert severity="warning" sx={{ mb: 2 }}>
                                        <strong>Seção bloqueada!</strong> Complete a Seção 2 para desbloquear.
                                    </Alert>
                                )}
                                <Grid container spacing={2}>
                                    <Grid item xs={12} md={6}>
                                        <DatePicker
                                            label="Data da Aula *"
                                            value={formData.dataInicio}
                                            onChange={(newValue) => {
                                                setFormData(prev => ({ ...prev, dataInicio: newValue }));
                                                if (errors.dataInicio) setErrors(prev => ({ ...prev, dataInicio: null }));
                                            }}
                                            disabled={!secao2Completa && !isEditMode}
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
                                            onMonthChange={(newMonth) => setMesVisivel(newMonth)}
                                            loading={loadingCalendario}
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
                                                input={<OutlinedInput label="Horário(s) *" />}
                                                renderValue={(selected) => (
                                                    <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                                                        {selected.map((value) => (
                                                            <Chip key={value} label={BLOCOS_HORARIO.find(b => b.value === value)?.label || value} size="small" />
                                                        ))}
                                                    </Box>
                                                )}
                                            >
                                                {BLOCOS_HORARIO.map((bloco) => {
                                                    // Verifica se está ocupado
                                                    const isOccupied = infoOcupacao.hasOwnProperty(bloco.value);
                                                    const aulaQueOcupa = infoOcupacao[bloco.value];
                                                    
                                                    return (
                                                        <MenuItem 
                                                            key={bloco.value} 
                                                            value={bloco.value} 
                                                            disabled={isOccupied}
                                                            sx={isOccupied ? { opacity: 0.9 } : {}} // Mantém legível mesmo desabilitado
                                                        >
                                                            <Box>
                                                                <Typography variant="body1">{bloco.label}</Typography>
                                                                {isOccupied && (
                                                                    <Typography variant="caption" color="error" display="block">
                                                                        🚫 Ocupado: {aulaQueOcupa}
                                                                    </Typography>
                                                                )}
                                                            </Box>
                                                        </MenuItem>
                                                    );
                                                })}
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
                            <Button type="submit" variant="contained" color="primary" size="large" disabled={loadingSubmit}>{loadingSubmit ? <CircularProgress size={24} /> : (isEditMode ? "Salvar Alterações" : (isCoordenador ? "Agendar Aula" : "Propor Aula"))}</Button>
                        </Grid>
                    </Grid>
                </form>

                <DialogConfirmacao open={openConfirmModal} onClose={() => setOpenConfirmModal(false)} onConfirm={handleConfirmSave} title="Confirmar Agendamento" message={`Deseja confirmar o agendamento de ${aulasParaConfirmar.length} aula(s)?`} loading={loadingSubmit} />
                <Dialog open={openDuplicateDialog} onClose={() => setOpenDuplicateDialog(false)}>
                    <DialogTitle>Conflito de Horário</DialogTitle>
                    <DialogContent>
                        <Typography>Alguns horários selecionados já possuem agendamentos. O que deseja fazer?</Typography>
                        <List>
                            {conflitos.map((c, i) => (
                                <ListItem key={i} divider>
                                    <ListItemText primary={`Conflito em ${c.novaAula.laboratorioSelecionado} às ${c.novaAula.horarioSlotString}`} secondary={`Existente: ${c.conflito.assunto}`} />
                                </ListItem>
                            ))}
                        </List>
                    </DialogContent>
                    <DialogActions>
                        <Button onClick={() => setOpenDuplicateDialog(false)}>Cancelar</Button>
                        <Button onClick={() => handleAulasComConflito(false)} color="primary">Ignorar Conflitos</Button>
                        <Button onClick={() => handleAulasComConflito(true)} color="error" variant="contained">Substituir Existentes</Button>
                    </DialogActions>
                </Dialog>
                <Dialog open={openKeepDataDialog} onClose={() => handleKeepData(false)}>
                    <DialogTitle>Agendamento Realizado!</DialogTitle>
                    <DialogContent><Typography>Deseja manter os dados do formulário para realizar outro agendamento similar?</Typography></DialogContent>
                    <DialogActions><Button onClick={() => handleKeepData(false)}>Não, ir para o calendário</Button><Button onClick={() => handleKeepData(true)} variant="contained">Sim, manter dados</Button></DialogActions>
                </Dialog>
                <Snackbar open={openSnackbar} autoHideDuration={6000} onClose={handleCloseSnackbar}><Alert onClose={handleCloseSnackbar} severity={snackbarSeverity} sx={{ width: '100%' }}>{snackbarMessage}</Alert></Snackbar>
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
    isModal: PropTypes.bool,
    formTitle: PropTypes.string,
    aulaId: PropTypes.string
};

export default ProporAulaForm;