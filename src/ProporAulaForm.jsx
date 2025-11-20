import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
        Container, Typography, TextField, Button, Grid, MenuItem, FormControl, InputLabel,
        Select, Box, Paper, Snackbar, Alert, CircularProgress, OutlinedInput, Chip, IconButton, Tooltip,
        List, ListItem, ListItemText, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, FormHelperText, Badge, Autocomplete
    } from '@mui/material';
import { ArrowBack, Delete as DeleteIcon, Add as AddIcon } from '@mui/icons-material';
import { AdapterDayjs } from '@mui/x-date-pickers/AdapterDayjs';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { DatePicker, PickersDay } from '@mui/x-date-pickers';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { db } from './firebaseConfig';
import {
    collection, addDoc, serverTimestamp, doc, getDoc, updateDoc, Timestamp, query, where, getDocs, writeBatch // <-- CORREÇÃO APLICADA AQUI
} from 'firebase/firestore';
import dayjs from 'dayjs';
import 'dayjs/locale/pt-br';
import { LISTA_LABORATORIOS } from './constants/laboratorios';
import { LISTA_CURSOS as LISTA_CURSOS_CONSTANTS } from './constants/cursos';
    import PropTypes from 'prop-types';
    import DialogConfirmacao from './components/DialogConfirmacao';

dayjs.locale('pt-br');

const BLOCOS_HORARIO = [
    { "value": "07:00-09:10", "label": "07:00 - 09:10", "turno": "Matutino" },
    { "value": "09:30-12:00", "label": "09:30 - 12:00", "turno": "Matutino" },
    { "value": "13:00-15:10", "label": "13:00 - 15:10", "turno": "Vespertino" },
    { "value": "15:30-18:00", "label": "15:30 - 18:00", "turno": "Vespertino" },
    { "value": "18:30-20:10", "label": "18:30 - 20:10", "turno": "Noturno" },
    { "value": "20:30-22:00", "label": "20:30 - 22:00", "turno": "Noturno" },
];

function ProporAulaForm({ userInfo, currentUser, initialDate, onSuccess, onCancel, isModal, formTitle }) { // <-- 1. CORREÇÃO AQUI
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
    const [currentStep, setCurrentStep] = useState(1); // 1: Detalhes, 2: Laboratório, 3: Data/Horário
    const [horariosOcupados, setHorariosOcupados] = useState([]);
    const [verificandoDisp, setVerificandoDisp] = useState(false);
    // Adicionado para forçar a revalidação do passo 2 quando o passo 1 muda
    const [step1DataChanged, setStep1DataChanged] = useState(false);
    const [diasTotalmenteOcupados, setDiasTotalmenteOcupados] = useState([]);
    const [diasParcialmenteOcupados, setDiasParcialmenteOcupados] = useState([]);
    const [mesVisivel, setMesVisivel] = useState(dayjs());
    const [loadingCalendario, setLoadingCalendario] = useState(false);
    const [step1Completed, setStep1Completed] = useState(false);
    const [step2Completed, setStep2Completed] = useState(false);

    const navigate = useNavigate();
    const location = useLocation();
    const { aulaId } = useParams();

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
            // A verificação só deve ocorrer se o passo 2 estiver completo
            if (!step2Completed) {
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
                // 1. Otimização: A consulta agora inclui o status para buscar apenas aulas que causam conflito (aprovadas ou pendentes)
                const q = query(
                    collection(db, "aulas"),
                    where("laboratorioSelecionado", "in", laboratoriosParaVerificar),
                    where("dataInicio", ">=", Timestamp.fromDate(diaSelecionado.toDate())),
                    where("dataInicio", "<", Timestamp.fromDate(diaSelecionado.add(1, 'day').toDate())),
                    where("status", "in", ["aprovada", "pendente"]) // Aulas aprovadas ou pendentes causam conflito
                );
                const querySnapshot = await getDocs(q);
                
                // 2. Normalização: A validação agora considera que o campo horarioSlotString pode ser um array ou uma string
                const slotsOcupados = querySnapshot.docs
                    .filter(doc => doc.id !== aulaId) // Exclui a própria aula em modo de edição
                    .flatMap(doc => {
                        const data = doc.data();
                        return Array.isArray(data.horarioSlotString) ? data.horarioSlotString : [data.horarioSlotString];
                    });
                setHorariosOcupados([...new Set(slotsOcupados)]);
            } catch (error) {
                console.error("Erro ao verificar disponibilidade de horários:", error);
            } finally {
                setVerificandoDisp(false);
            }
        };
        verificarDisponibilidadeHorarios();
    }, [formData.dataInicio, formData.dynamicLabs, aulaId, step2Completed, step1DataChanged]); // Adicionado step2Completed e step1DataChanged como dependências

    const validateStep = (step) => {
        let tempErrors = { ...errors };
        let isValid = true;

        // Validação do Passo 1: Detalhes da Aula
        if (step === 1 || step === 'all') {
            tempErrors.assunto = formData.assunto ? "" : "O assunto é obrigatório.";
            tempErrors.tipoAtividade = formData.tipoAtividade ? "" : "O tipo de atividade é obrigatório.";
            tempErrors.cursos = formData.cursos.length > 0 ? "" : "Selecione pelo menos um curso.";
            
            const step1Errors = [tempErrors.assunto, tempErrors.tipoAtividade, tempErrors.cursos].filter(Boolean);
            if (step1Errors.length > 0) isValid = false;
            if (step === 1) {
                setErrors(prev => ({ ...prev, ...tempErrors }));
                return isValid;
            }
        }

        // Validação do Passo 2: Laboratório(s)
        if (step === 2 || step === 'all') {
            const labError = formData.dynamicLabs.some(lab => !lab.tipo || lab.laboratorios.length === 0);
            tempErrors.dynamicLabs = labError ? "Todos os campos de laboratório são obrigatórios." : "";
            
            if (tempErrors.dynamicLabs) isValid = false;
            if (step === 2) {
                setErrors(prev => ({ ...prev, ...tempErrors }));
                return isValid;
            }
        }

        // Validação do Passo 3: Data e Horário
        if (step === 3 || step === 'all') {
            tempErrors.dataInicio = formData.dataInicio ? "" : "A data é obrigatória.";
            tempErrors.horarioSlotString = formData.horarioSlotString.length > 0 ? "" : "Selecione pelo menos um horário.";
            
            const step3Errors = [tempErrors.dataInicio, tempErrors.horarioSlotString].filter(Boolean);
            if (step3Errors.length > 0) isValid = false;
            if (step === 3) {
                setErrors(prev => ({ ...prev, ...tempErrors }));
                return isValid;
            }
        }

        setErrors(tempErrors);
        return isValid;
    };

    const validate = () => {
        const isValid = validateStep('all');
        if (!isValid) {
            // Encontra o primeiro passo com erro para focar a atenção do usuário
            if (!validateStep(1)) setCurrentStep(1);
            else if (!validateStep(2)) setCurrentStep(2);
            else if (!validateStep(3)) setCurrentStep(3);
        }
        return isValid;
    };

    const handleNextStep = (step) => {
        if (validateStep(step)) {
            if (step === 1) {
                setStep1Completed(true);
                setCurrentStep(2);
                setSnackbarMessage("Detalhes da Aula preenchidos com sucesso! Prossiga para a seleção do Laboratório.");
                setSnackbarSeverity("success");
                setOpenSnackbar(true);
            } else if (step === 2) {
                setStep2Completed(true);
                setCurrentStep(3);
                setSnackbarMessage("Laboratório(s) selecionado(s) com sucesso! Prossiga para a Data e Horário.");
                setSnackbarSeverity("success");
                setOpenSnackbar(true);
            }
        } else {
            setSnackbarMessage(`Por favor, preencha todos os campos obrigatórios na Etapa ${step}.`);
            setSnackbarSeverity("error");
            setOpenSnackbar(true);
        }
    };

    const handlePrevStep = (step) => {
        setCurrentStep(step);
    };

    const handleChange = (e) => {
        const { name, value } = e.target;
        // Se o passo 1 for alterado, o passo 2 e 3 devem ser invalidados
        if (['assunto', 'tipoAtividade', 'cursos', 'liga', 'observacoes'].includes(name)) {
            setStep1Completed(false);
            setStep2Completed(false);
            setStep1DataChanged(prev => !prev); // Força revalidação do passo 2
        }
        // Se o passo 2 for alterado, o passo 3 deve ser invalidado
        if (name === 'dynamicLabs') {
            setStep2Completed(false);
        }
        // Se o passo 3 for alterado, apenas a validação final é afetada
        if (name === 'horarioSlotString') {
            const semOcupados = value.filter(slot => !horariosOcupados.includes(slot) || (isEditMode && formData.horarioSlotString.includes(slot)));
            setFormData(prev => ({ ...prev, [name]: semOcupados }));
            return;
        }
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    const handleDateChange = (date) => {
        setFormData(prev => ({ ...prev, dataInicio: date, horarioSlotString: [] }));
        // Invalida o passo 3 se a data mudar
        setStep2Completed(false);
    };
    const handleLabTipoChange = (index, tipo) => {
        const newLabs = [...formData.dynamicLabs];
        newLabs[index] = { tipo, laboratorios: [] };
        setFormData(prev => ({ ...prev, dynamicLabs: newLabs, horarioSlotString: [] }));
        setStep2Completed(false);
    };
    const handleLabEspecificoChange = (index, laboratorios) => {
        const newLabs = [...formData.dynamicLabs];
        newLabs[index].laboratorios = laboratorios;
        setFormData(prev => ({ ...prev, dynamicLabs: newLabs, horarioSlotString: [] }));
        setStep2Completed(false);
    };
    const handleAddLabField = () => {
        setFormData(prev => ({ ...prev, dynamicLabs: [...prev.dynamicLabs, { tipo: '', laboratorios: [] }] }));
        setStep2Completed(false);
    };
    const handleRemoveLabField = (index) => {
        setFormData(prev => ({ ...prev, dynamicLabs: prev.dynamicLabs.filter((_, i) => i !== index) }));
        setStep2Completed(false);
    };

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
                    // Em modo de edição, todas as etapas são consideradas completas para permitir a edição
                    setStep1Completed(true);
                    setStep2Completed(true);
                    setCurrentStep(3);
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
                // Em modo de cópia, o passo 1 e 2 são considerados completos
                setStep1Completed(true);
                setStep2Completed(true);
                setCurrentStep(3);
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
        setStep1Completed(false);
        setStep2Completed(false);
        setCurrentStep(1);
    };

    const prepareAndConfirm = async () => {
        if (!validate()) {
            setSnackbarMessage('Por favor, corrija os erros no formulário.');
            setSnackbarSeverity('warning');
            setOpenSnackbar(true);
            return;
        }
        setLoadingSubmit(true);
        
        // 1. Normalização de Dados
        const normalizedFormData = { ...formData };
        normalizedFormData.assunto = normalizedFormData.assunto.trim();
        normalizedFormData.observacoes = normalizedFormData.observacoes.trim();
        normalizedFormData.tipoAtividade = normalizedFormData.tipoAtividade.trim();
        normalizedFormData.cursos = normalizedFormData.cursos.map(c => c.toLowerCase().trim()); // Normaliza cursos para minúsculas
        normalizedFormData.liga = normalizedFormData.liga.trim();
        normalizedFormData.dynamicLabs = normalizedFormData.dynamicLabs.map(lab => ({
            tipo: lab.tipo.trim(),
            laboratorios: lab.laboratorios.map(l => l.trim())
        }));
        
        const aulasSemConflito = [];
        const conflitosDetectados = [];
        
        // Usar normalizedFormData para o restante da função
        const verificacoes = normalizedFormData.horarioSlotString.flatMap(slot => {
            const [inicioStr, fimStr] = slot.split('-');
            const dataHoraInicio = normalizedFormData.dataInicio.hour(parseInt(inicioStr.split(':')[0])).minute(parseInt(inicioStr.split(':')[1]));
            const dataHoraFim = normalizedFormData.dataInicio.hour(parseInt(fimStr.split(':')[0])).minute(parseInt(fimStr.split(':')[1]));
            return normalizedFormData.dynamicLabs.flatMap(lab => 
                lab.laboratorios.map(async (labName) => {
                    const novaAula = {
                        tipoAtividade: normalizedFormData.tipoAtividade, assunto: normalizedFormData.assunto, observacoes: normalizedFormData.observacoes, tipoLaboratorio: lab.tipo, laboratorioSelecionado: labName, cursos: normalizedFormData.cursos, liga: normalizedFormData.liga, disciplina: normalizedFormData.assunto, curso: normalizedFormData.cursos.join(', '), ano: dayjs().year().toString(),
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

    const logActivity = async (type, aulaData, user) => {
        try {
            await addDoc(collection(db, "logs"), {
                type: type, // 'adicao' ou 'exclusao'
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
                    nome: user.propostoPorNome || user.name || user.displayName || user.email,
                }
            });
        } catch (error) {
            console.error("Erro ao registrar log:", error);
        }
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
                const logs = [];
                aulasParaConfirmar.forEach(aula => {
                    const newDocRef = doc(aulasCollection);
                    batch.set(newDocRef, { ...aula, createdAt: serverTimestamp() });
                    logs.push(logActivity('adicao', aula, { uid: currentUser.uid, nome: userInfo?.name || currentUser.displayName || currentUser.email }));
                });
                await batch.commit();
                await Promise.all(logs); // Espera todos os logs serem registrados
                setSnackbarMessage(`${aulasParaConfirmar.length} aula(s) ${isCoordenador ? 'agendada(s)!' : 'proposta(s)!'}`);
            }
            setSnackbarSeverity('success');
            setOpenSnackbar(true);
            if (isModal) {
                onSuccess();
            } else {
                setOpenKeepDataDialog(true);
            }
            setCurrentStep(1); // Volta para o passo 1 após o sucesso
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
            conflitos.forEach(c => {
                // Adiciona a nova aula para ser salva
                aulasParaAdicionar.push(c.novaAula);
                // Se for para substituir, a aula em conflito será excluída no batch
            });
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
            const logs = [];
            if (shouldReplace) {
                conflitos.forEach(c => {
                    batch.delete(doc(db, 'aulas', c.conflito.id));
                    logs.push(logActivity('exclusao', c.conflito, { uid: currentUser.uid, nome: userInfo?.name || currentUser.displayName || currentUser.email }));
                });
            }
            aulasParaAdicionar.forEach(aula => {
                const newDocRef = doc(aulasCollection);
                batch.set(newDocRef, { ...aula, createdAt: serverTimestamp() });
                logs.push(logActivity('adicao', aula, { uid: currentUser.uid, nome: userInfo?.name || currentUser.displayName || currentUser.email }));
            });
            await batch.commit();
            await Promise.all(logs); // Espera todos os logs serem registrados
            setSnackbarMessage(mensagemSucesso);
            setSnackbarSeverity('success');
            setOpenSnackbar(true);
            if (isModal) {
                onSuccess();
            } else {
                setOpenKeepDataDialog(true);
            }
            setCurrentStep(1); // Volta para o passo 1 após o sucesso
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
                {/* 2. CORREÇÃO AQUI: Adicionado fallback para o título */}
                <Typography variant="h4" component="h1" gutterBottom align="center" sx={{ mb: 4, color: '#3f51b5', fontWeight: 'bold', mt: 4 }}>
                    {formTitle || (isEditMode ? "Editar Aula" : "Propor Nova Aula")}
                </Typography>
                <form onSubmit={(e) => { e.preventDefault(); prepareAndConfirm(); }}>
                    <Grid container spacing={3} justifyContent="center">
                        {/* PASSO 1: Detalhes da Aula */}
                        <Grid item xs={12} md={6}>
                            <Paper elevation={3} sx={{ p: 3, borderLeft: '5px solid #1976d2', height: '100%', opacity: currentStep === 1 ? 1 : 0.5, pointerEvents: currentStep === 1 ? 'auto' : 'none' }}>
                                <Typography variant="h6" gutterBottom>1. Detalhes da Aula</Typography>
                                <FormControl fullWidth variant="outlined" sx={{ mb: 2 }} error={!!errors.tipoAtividade}>
                                    <InputLabel>Tipo</InputLabel>
                                    <Select name="tipoAtividade" value={formData.tipoAtividade} label="Tipo" onChange={handleChange}>
                                        <MenuItem value="aula">Aula</MenuItem>
                                        <MenuItem value="revisao">Revisão</MenuItem>
                                    </Select>
                                    {errors.tipoAtividade && <FormHelperText>{errors.tipoAtividade}</FormHelperText>}
                                </FormControl>
                                <TextField fullWidth label="Assunto da Aula" name="assunto" value={formData.assunto} onChange={handleChange} error={!!errors.assunto} helperText={errors.assunto} sx={{ mb: 2 }} />
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
            label="Curso(s) Relacionado(s)"
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
                                <Box sx={{ mt: 2, display: 'flex', justifyContent: 'flex-end' }}>
                                    <Button variant="contained" onClick={() => handleNextStep(1)} disabled={loadingSubmit || currentStep !== 1}>
                                        Próxima Etapa (2/3)
                                    </Button>
                                </Box>
                            </Paper>
                        </Grid>

                        {/* PASSO 2: Laboratório(s) */}
                        <Grid item xs={12} md={6}>
                            <Paper elevation={3} sx={{ p: 3, borderLeft: '5px solid #ff9800', height: '100%', opacity: currentStep === 2 ? 1 : 0.5, pointerEvents: currentStep === 2 ? 'auto' : 'none' }}>
                                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                    <Typography variant="h6" gutterBottom>2. Laboratório(s)</Typography>
                                    <Tooltip title="Adicionar outro tipo de laboratório">
                                        <IconButton onClick={handleAddLabField} color="primary" disabled={formData.dynamicLabs.length >= 5}>
                                            <AddIcon />
                                        </IconButton>
                                    </Tooltip>
                                </Box>
                                {currentStep < 2 && <Alert severity="info" sx={{ mb: 2 }}>A Etapa 1 (Detalhes da Aula) deve ser preenchida completamente para desbloquear a seleção do Laboratório.</Alert>}
                                {errors.dynamicLabs && <Alert severity="error" sx={{ mb: 1, fontSize: '0.8rem' }}>{errors.dynamicLabs}</Alert>}
                                {formData.dynamicLabs.map((labSelection, index) => (
                                    <Grid container spacing={1} key={index} sx={{ mt: index > 0 ? 1 : 0, alignItems: 'center' }}>
                                        <Grid item xs={5}>
                                            <FormControl fullWidth size="small" disabled={currentStep !== 2}>
                                                <InputLabel>Tipo</InputLabel>
                                                <Select value={labSelection.tipo} onChange={(e) => handleLabTipoChange(index, e.target.value)}>
                                                    {Array.from(new Set(LISTA_LABORATORIOS.map(l => l.tipo))).map(t => <MenuItem key={t} value={t}>{t.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}</MenuItem>)}
                                                </Select>
                                            </FormControl>
                                        </Grid>
                                        <Grid item xs={5}>
                                            <FormControl fullWidth size="small" disabled={!labSelection.tipo || currentStep !== 2}>
                                                <InputLabel>Específico</InputLabel>
                                                <Select multiple value={labSelection.laboratorios} onChange={(e) => handleLabEspecificoChange(index, e.target.value)} input={<OutlinedInput label="Específico" />} renderValue={(selected) => (<Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>{selected.map((value) => (<Chip key={value} label={value} size="small" />))}</Box>)}>
                                                    {LISTA_LABORATORIOS.filter(lab => lab.tipo === labSelection.tipo).map(l => <MenuItem key={l.id} value={l.name}>{l.name}</MenuItem>)}
                                                </Select>
                                            </FormControl>
                                        </Grid>
                                        {formData.dynamicLabs.length > 1 && (
                                            <Grid item xs={2} sx={{ textAlign: 'center' }}>
                                                <IconButton size="small" color="error" onClick={() => handleRemoveLabField(index)} disabled={currentStep !== 2}>
                                                    <DeleteIcon />
                                                </IconButton>
                                            </Grid>
                                        )}
                                    </Grid>
                                ))}
                                <Box sx={{ mt: 2, display: 'flex', justifyContent: 'space-between' }}>
                                    <Button variant="outlined" onClick={() => handlePrevStep(1)} disabled={loadingSubmit || currentStep !== 2}>
                                        Voltar
                                    </Button>
                                    <Button variant="contained" onClick={() => handleNextStep(2)} disabled={loadingSubmit || currentStep !== 2}>
                                        Próxima Etapa (3/3)
                                    </Button>
                                </Box>
                            </Paper>
                        </Grid>

                        {/* PASSO 3: Data e Horário */}
                        <Grid item xs={12}>
                            <Paper elevation={3} sx={{ p: 3, borderLeft: '5px solid #00acc1', opacity: currentStep === 3 ? 1 : 0.5, pointerEvents: currentStep === 3 ? 'auto' : 'none' }}>
                                <Typography variant="h6" gutterBottom>3. Data e Horário</Typography>
                                {currentStep < 3 && <Alert severity="info" sx={{ mb: 2 }}>A Etapa 2 (Laboratório(s)) deve ser preenchida completamente para desbloquear a seleção de Data e Horário.</Alert>}
                                <Grid container spacing={2}>
                            <Grid item xs={12} sm={6}>
                                <DatePicker label="Data da Aula" value={formData.dataInicio} onChange={handleDateChange} format="DD/MM/YYYY" onMonthChange={(newMonth) => setMesVisivel(newMonth)} loading={loadingCalendario}
                                    slots={{ day: (props) => {
                                        const diaFormatado = props.day.format('YYYY-MM-DD');
                                        const isTotalmenteOcupado = diasTotalmenteOcupados.includes(diaFormatado);
                                        const isParcialmenteOcupado = diasParcialmenteOcupados.includes(diaFormatado);
                                        return (<Badge key={props.day.toString()} overlap="circular" badgeContent={isParcialmenteOcupado && !isTotalmenteOcupado ? ' ' : 0} color="warning" variant="dot"><PickersDay {...props} disabled={isTotalmenteOcupado} /></Badge>);
                                    }}}
                                    slotProps={{ textField: { fullWidth: true, variant: 'outlined', error: !!errors.dataInicio, helperText: errors.dataInicio } }}
                                    disabled={currentStep !== 3}
                                />
                            </Grid>
                            <Grid item xs={12} sm={6}>
                                <FormControl fullWidth variant="outlined" error={!!errors.horarioSlotString} disabled={currentStep !== 3}>
                                    <InputLabel>Bloco de Horário</InputLabel>
                                    <Select multiple name="horarioSlotString" value={formData.horarioSlotString} onChange={handleChange} input={<OutlinedInput label="Bloco de Horário" />} renderValue={(selected) => selected.join(', ')}>
                                        {verificandoDisp && <MenuItem disabled><em>Verificando disponibilidade...</em></MenuItem>}
                                        {BLOCOS_HORARIO.map(bloco => { 
                                            const isOcupado = horariosOcupados.includes(bloco.value); 
                                            return (<MenuItem key={bloco.value} value={bloco.value} disabled={isOcupado || currentStep !== 3}>
                                                <ListItemText primary={bloco.label} sx={{ color: isOcupado ? 'error.main' : 'inherit' }} />
                                                {isOcupado && <Chip label="Ocupado" color="error" size="small" />}
                                            </MenuItem>);
                                        })}
                                    </Select>
                                    {errors.horarioSlotString && <FormHelperText>{errors.horarioSlotString}</FormHelperText>}
                                </FormControl>
                            </Grid>
                        </Grid>
                        <Box sx={{ mt: 2, display: 'flex', justifyContent: 'flex-start' }}>
                            <Button variant="outlined" onClick={() => handlePrevStep(2)} disabled={loadingSubmit || currentStep !== 3}>
                                Voltar
                            </Button>
                        </Box>
                    </Paper>
                </Grid>
                <Grid item xs={12}>
                    <Box mt={2} sx={{ display: 'flex', justifyContent: 'center', gap: 2, flexWrap: 'wrap' }}>
                        {!isModal && <Button onClick={() => navigate('/calendario')} variant="outlined" size="large" startIcon={<ArrowBack />}>Voltar</Button>}
                        {isModal && <Button onClick={onCancel} variant="outlined" size="large">Cancelar</Button>}
                        <Button type="submit" variant="contained" size="large" disabled={loadingSubmit || currentStep !== 3 || !step2Completed}>
                            {loadingSubmit ? <CircularProgress size={24} /> : (isEditMode ? "Salvar Alterações" : "Verificar e Agendar")}
                        </Button>
                    </Box>
                </Grid>
                    </Grid>
                </form>
                <Snackbar open={openSnackbar} autoHideDuration={6000} onClose={() => setOpenSnackbar(false)}><Alert onClose={() => setOpenSnackbar(false)} severity={snackbarSeverity} sx={{ width: '100%' }}>{snackbarMessage}</Alert></Snackbar>
                <DialogConfirmacao
                        open={openConfirmModal}
                        onClose={() => setOpenConfirmModal(false)}
                        onConfirm={handleConfirmSave}
                        title={isEditMode ? "Confirmar Atualização" : "Confirmar Agendamento"}
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
    initialDate: PropTypes.object, // dayjs object
    onSuccess: PropTypes.func,
    onCancel: PropTypes.func,
    isModal: PropTypes.bool,
    formTitle: PropTypes.string, // <-- 3. CORREÇÃO AQUI
};

export default ProporAulaForm;
