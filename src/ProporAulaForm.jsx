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
    const { aulaId: paramAulaId } = useParams();
    const aulaId = propAulaId || paramAulaId;

    const notificarTelegramBatch = async (aulas, tipoAcao) => {
        if (!TELEGRAM_CHAT_ID) return;
        for (const aula of aulas) {
            let dataFormatada = 'N/A';
            let dataISO = null;
            if (dayjs.isDayjs(aula.dataInicio)) {
                dataFormatada = aula.dataInicio.format('DD/MM/YYYY');
                dataISO = aula.dataInicio.format('YYYY-MM-DD');
            } else if (aula.dataInicio && typeof aula.dataInicio.toDate === 'function') {
                const dateObj = dayjs(aula.dataInicio.toDate());
                dataFormatada = dateObj.format('DD/MM/YYYY');
                dataISO = dateObj.format('YYYY-MM-DD');
            } else if (aula.dataInicio) {
                const dateObj = dayjs(aula.dataInicio);
                if (dateObj.isValid()) {
                    dataFormatada = dateObj.format('DD/MM/YYYY');
                    dataISO = dateObj.format('YYYY-MM-DD');
                }
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
        const completa = formData.tipoAtividade !== '' && 
                         formData.assunto.trim() !== '' && 
                         formData.cursos.length > 0;
        setSecao1Completa(completa);
    }, [formData.tipoAtividade, formData.assunto, formData.cursos, aulaId]);

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
                console.error("Erro ao buscar ocupação do mês:", error);
            } finally {
                setLoadingCalendario(false);
            }
        };
        fetchOcupacaoDoMes();
    }, [mesVisivel]);

    useEffect(() => {
        const verificarDisponibilidadeHorarios = async () => {
            if (!secao2Completa && !aulaId) {
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
                
                const qEventos = query(collection(db, "eventosManutencao"), where("dataInicio", ">=", Timestamp.fromDate(diaSelecionado.startOf('day').toDate())), where("dataInicio", "<=", Timestamp.fromDate(diaSelecionado.endOf('day').toDate())));
                const querySnapshotEventos = await getDocs(qEventos);
                const eventosDoDia = querySnapshotEventos.docs
                    .map(doc => doc.data())
                    .filter(e => {
                        const end = e.dataFim instanceof Timestamp ? e.dataFim.toDate() : new Date(e.dataFim);
                        const isNoDia = dayjs(end).isAfter(diaSelecionado) || dayjs(end).isSame(diaSelecionado);
                        const isLabRelacionado = e.laboratorio === 'Todos' || laboratoriosParaVerificar.includes(e.laboratorio);
                        return isNoDia && isLabRelacionado;
                    });

                const slotsBloqueadosPorEvento = [];
                eventosDoDia.forEach(evento => {
                    BLOCOS_HORARIO.forEach(bloco => {
                        const [inicioStr, fimStr] = bloco.value.split('-');
                        const blocoInicio = diaSelecionado.hour(parseInt(inicioStr.split(':')[0])).minute(parseInt(inicioStr.split(':')[1]));
                        const blocoFim = diaSelecionado.hour(parseInt(fimStr.split(':')[0])).minute(parseInt(fimStr.split(':')[1]));
                        const eventoInicio = dayjs(evento.dataInicio instanceof Timestamp ? evento.dataInicio.toDate() : new Date(evento.dataInicio));
                        const eventoFim = dayjs(evento.dataFim instanceof Timestamp ? evento.dataFim.toDate() : new Date(evento.dataFim));
                        if (blocoInicio.isBefore(eventoFim) && blocoFim.isAfter(eventoInicio)) {
                            slotsBloqueadosPorEvento.push(bloco.value);
                        }
                    });
                });

                setHorariosOcupados([...new Set([...slotsOcupados, ...slotsBloqueadosPorEvento])]);
            } catch (error) {
                console.error("Erro ao verificar disponibilidade:", error);
            } finally {
                setVerificandoDisp(false);
            }
        };
        verificarDisponibilidadeHorarios();
    }, [formData.dataInicio, formData.dynamicLabs, secao2Completa, aulaId]);

    useEffect(() => {
        const loadInitialData = async () => {
            if (aulaId) {
                setIsEditMode(true);
                setSecao1Completa(true);
                setSecao2Completa(true);
                try {
                    const docRef = doc(db, "aulas", aulaId);
                    const docSnap = await getDoc(docRef);
                    if (docSnap.exists()) {
                        const data = docSnap.data();
                        setFormData({
                            assunto: data.assunto || '', 
                            observacoes: data.observacoes || '', 
                            tipoAtividade: data.tipoAtividade || '',
                            cursos: data.cursos || [], 
                            liga: data.liga || '',
                            dataInicio: dayjs(data.dataInicio.toDate()), 
                            horarioSlotString: Array.isArray(data.horarioSlotString) ? data.horarioSlotString : [data.horarioSlotString],
                            dynamicLabs: [{ 
                                tipo: data.tipoLaboratorio, 
                                laboratorios: Array.isArray(data.laboratorioSelecionado) ? data.laboratorioSelecionado : [data.laboratorioSelecionado] 
                            }]
                        });
                        if (data.tecnicos && data.tecnicosInfo) setCopiedTecnicos({ tecnicos: data.tecnicos, tecnicosInfo: data.tecnicosInfo });
                    } else { navigate('/calendario'); }
                } catch (error) { navigate('/calendario'); }
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
        if (!formData.tipoAtividade) newErrors.tipoAtividade = 'Obrigatório';
        if (!formData.assunto.trim()) newErrors.assunto = 'Obrigatório';
        if (formData.cursos.length === 0) newErrors.cursos = 'Selecione pelo menos um curso';
        if (!formData.dataInicio) newErrors.dataInicio = 'Selecione uma data';
        if (formData.horarioSlotString.length === 0) newErrors.horarioSlotString = 'Selecione pelo menos um horário';
        
        const labsValidos = formData.dynamicLabs.filter(lab => lab.tipo && lab.laboratorios.length > 0);
        if (labsValidos.length === 0) newErrors.dynamicLabs = 'Selecione pelo menos um laboratório';
        
        setErrors(newErrors);
        return Object.keys(newErrors).length === 0;
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
        
        const qEventos = query(collection(db, "eventosManutencao"), where("dataInicio", "<=", Timestamp.fromDate(formData.dataInicio.endOf('day').toDate())));
        const querySnapshotEventos = await getDocs(qEventos);
        const eventosDoDia = querySnapshotEventos.docs
            .map(doc => doc.data())
            .filter(e => {
                const end = e.dataFim instanceof Timestamp ? e.dataFim.toDate() : new Date(e.dataFim);
                return dayjs(end).isAfter(formData.dataInicio.startOf('day')) || dayjs(end).isSame(formData.dataInicio.startOf('day'));
            });

        const verificacoes = [];
        formData.horarioSlotString.forEach(slot => {
            const [inicioStr, fimStr] = slot.split('-');
            const dataHoraInicio = formData.dataInicio.hour(parseInt(inicioStr.split(':')[0])).minute(parseInt(inicioStr.split(':')[1])).second(0).millisecond(0);
            const dataHoraFim = formData.dataInicio.hour(parseInt(fimStr.split(':')[0])).minute(parseInt(fimStr.split(':')[1])).second(0).millisecond(0);
            
            formData.dynamicLabs.forEach(lab => {
                lab.laboratorios.forEach(labName => {
                    const checkPromise = (async () => {
                        const eventoBloqueante = eventosDoDia.find(evento => {
                            if (evento.laboratorio === 'Todos' || evento.laboratorio === labName) {
                                const eventoInicio = dayjs(evento.dataInicio.toDate());
                                const eventoFim = dayjs(evento.dataFim.toDate());
                                return dataHoraInicio.isBefore(eventoFim) && dataHoraFim.isAfter(eventoInicio);
                            }
                            return false;
                        });

                        if (eventoBloqueante) {
                            return { status: 'bloqueado', mensagem: `O laboratório ${labName} está bloqueado por um evento: ${eventoBloqueante.titulo}` };
                        }

                        const novaAula = {
                            tipoAtividade: formData.tipoAtividade, assunto: formData.assunto, observacoes: formData.observacoes, tipoLaboratorio: lab.tipo, laboratorioSelecionado: labName, cursos: formData.cursos, liga: formData.liga,
                            dataInicio: Timestamp.fromDate(dataHoraInicio.toDate()), dataFim: Timestamp.fromDate(dataHoraFim.toDate()), horarioSlotString: slot,
                            status: isCoordenador ? 'aprovada' : 'pendente', propostoPorUid: currentUser.uid, propostoPorNome: userInfo?.name || currentUser.displayName || currentUser.email,
                            tecnicos: copiedTecnicos ? copiedTecnicos.tecnicos : [], tecnicosInfo: copiedTecnicos ? copiedTecnicos.tecnicosInfo : []
                        };
                        
                        const q = query(
                            collection(db, "aulas"), 
                            where("laboratorioSelecionado", "==", labName), 
                            where("dataInicio", "==", novaAula.dataInicio)
                        );
                        const querySnapshot = await getDocs(q);
                        const conflictDoc = querySnapshot.docs.find(doc => doc.id !== aulaId);
                        
                        if (!conflictDoc) return { status: 'sem-conflito', aula: novaAula };
                        else return { status: 'conflito', dados: { novaAula, conflito: { id: conflictDoc.id, ...conflictDoc.data() } } };
                    })();
                    verificacoes.push(checkPromise);
                });
            });
        });

        const resultados = await Promise.all(verificacoes);
        
        const bloqueios = resultados.filter(res => res.status === 'bloqueado');
        if (bloqueios.length > 0) {
            setSnackbarMessage(bloqueios[0].mensagem);
            setSnackbarSeverity('error');
            setOpenSnackbar(true);
            setLoadingSubmit(false);
            return;
        }

        resultados.forEach(res => {
            if (res.status === 'sem-conflito') aulasSemConflito.push(res.aula);
            else if (res.status === 'conflito') conflitosDetectados.push(res.dados);
        });
        
        setAulasParaConfirmar(aulasSemConflito);
        setConflitos(conflitosDetectados);
        
        if (conflitosDetectados.length > 0) {
            setOpenDuplicateDialog(true);
        } else if (aulasSemConflito.length > 0) {
            setOpenConfirmModal(true);
        } else {
            setSnackbarMessage('Nenhuma aula para agendar.');
            setSnackbarSeverity('info');
            setOpenSnackbar(true);
        }
        setLoadingSubmit(false);
    };

    const handleConfirmSave = async () => {
        setLoadingSubmit(true);
        setOpenConfirmModal(false);
        try {
            const batch = writeBatch(db);
            const aulasCollection = collection(db, "aulas");
            
            // Controle para saber se já atualizamos o original
            let originalAtualizado = false;
            const aulasNotificar = [];

            // Se estamos editando (tem aulaId), precisamos tratar o primeiro item da lista como atualização
            // e os demais (se o usuário selecionou mais horários) como novos.
            
            aulasParaConfirmar.forEach((aula) => {
                if (isEditMode && aulaId && !originalAtualizado) {
                    // ATUALIZA A AULA EXISTENTE
                    const docRef = doc(db, "aulas", aulaId);
                    batch.update(docRef, { ...aula, updatedAt: serverTimestamp() });
                    originalAtualizado = true;
                    aulasNotificar.push({ ...aula, acao: 'editar' });
                } else {
                    // CRIA NOVAS AULAS (Horários extras adicionados na edição ou criação normal)
                    const newDocRef = doc(aulasCollection);
                    batch.set(newDocRef, { ...aula, createdAt: serverTimestamp() });
                    aulasNotificar.push({ ...aula, acao: 'adicionar' });
                }
            });

            await batch.commit();

            // Notifica Telegram separado
            const editadas = aulasNotificar.filter(a => a.acao === 'editar');
            const adicionadas = aulasNotificar.filter(a => a.acao === 'adicionar');

            if (editadas.length > 0) await notificarTelegramBatch(editadas, 'editar');
            if (adicionadas.length > 0) await notificarTelegramBatch(adicionadas, 'adicionar');

            setSnackbarMessage(
                isEditMode 
                ? (adicionadas.length > 0 ? "Aula atualizada e novos horários adicionados!" : "Aula atualizada com sucesso!") 
                : `${aulasParaConfirmar.length} aula(s) ${isCoordenador ? 'agendada(s)!' : 'proposta(s)!'}`
            );
            
            setSnackbarSeverity('success');
            setOpenSnackbar(true);
            
            if (isModal) onSuccess();
            else setOpenKeepDataDialog(true);

        } catch (error) {
            console.error(error);
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
            if (isModal) onSuccess();
            else setOpenKeepDataDialog(true);
        } catch (error) {
            setSnackbarMessage(`Erro ao salvar: ${error.message}`);
            setSnackbarSeverity('error');
            setOpenSnackbar(true);
        } finally {
            setLoadingSubmit(false);
        }
    };

    const handleCloseSnackbar = (event, reason) => { if (reason === 'clickaway') return; setOpenSnackbar(false); };
    const handleKeepData = (keep) => { setOpenKeepDataDialog(false); if (keep) clearForm(true); else navigate('/calendario'); };

    const clearForm = (keepData = false) => {
        if (keepData) {
            setFormData(prev => ({ ...prev, dataInicio: null, horarioSlotString: [] }));
            return;
        }
        setFormData({ assunto: '', observacoes: '', tipoAtividade: '', cursos: [], liga: '', dataInicio: null, horarioSlotString: [], dynamicLabs: [{ tipo: '', laboratorios: [] }] });
        setCopiedTecnicos(null);
        setErrors({});
    };

    return (
        <LocalizationProvider dateAdapter={AdapterDayjs} adapterLocale="pt-br">
            <Container maxWidth="md">
                <Typography variant="h4" component="h1" gutterBottom align="center" sx={{ mb: 4, color: '#3f51b5', fontWeight: 'bold', mt: 4 }}>
                    {formTitle || (isEditMode ? "Editar Aula" : "Propor Nova Aula")}
                </Typography>
                <form onSubmit={(e) => { e.preventDefault(); prepareAndConfirm(); }}>
                    <Grid container spacing={3} justifyContent="center">
                        <Grid item xs={12} md={6}>
                            <Paper elevation={3} sx={{ p: 3, borderLeft: '5px solid #1976d2', height: '100%' }}>
                                <Typography variant="h6" gutterBottom>1. Detalhes da Aula</Typography>
                                <FormControl fullWidth sx={{ mb: 2 }} error={!!errors.tipoAtividade}>
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
                                        <TextField {...params} label="Curso(s) Relacionado(s) *" placeholder="Selecione os cursos" error={!!errors.cursos} helperText={errors.cursos} />
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
                                                        const dateStr = day.format('YYYY-MM-DD');
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