import React, { useState, useEffect, useCallback } from 'react';
import { useTheme, alpha } from '@mui/material/styles';
import {
    Container, Typography, TextField, Button, Grid, MenuItem, FormControl, InputLabel,
    Select, Box, Paper, Snackbar, Alert, CircularProgress, OutlinedInput, Chip, IconButton, Tooltip,
    List, ListItem, ListItemText, FormHelperText, Autocomplete, Dialog, DialogTitle, DialogContent,
    DialogActions, ToggleButton, ToggleButtonGroup, Collapse, Accordion, AccordionSummary, AccordionDetails
} from '@mui/material';
import { ArrowBack, Delete as DeleteIcon, Add as AddIcon, Lock as LockIcon, MenuBook as MenuBookIcon, Assignment as AssignmentIcon, ExpandMore as ExpandMoreIcon } from '@mui/icons-material';
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
import GradeDisponibilidade from './components/GradeDisponibilidade';
import { notificadorTelegram } from './services/NotificadorTelegram';
import { toDataLocal } from './utils/dateHelper';
import { buscarAulasPorDia } from './utils/aulaQueries';

dayjs.locale('pt-br');

const BLOCOS_HORARIO = [
    { "value": "07:00-09:10", "label": "07:00 - 09:10", "turno": "Matutino" },
    { "value": "09:30-12:00", "label": "09:30 - 12:00", "turno": "Matutino" },
    { "value": "13:00-15:10", "label": "13:00 - 15:10", "turno": "Vespertino" },
    { "value": "15:30-18:00", "label": "15:30 - 18:00", "turno": "Vespertino" },
    { "value": "18:30-20:10", "label": "18:30 - 20:10", "turno": "Noturno" },
    { "value": "20:30-22:00", "label": "20:30 - 22:00", "turno": "Noturno" },
];

const TIPOS_REVISAO = [
    { value: 'revisao_conteudo',  label: 'Revisão de Conteúdo',  icon: '📖' },
    { value: 'revisao_pre_prova', label: 'Revisão Pré-Prova',    icon: '📝' },
    { value: 'aula_reforco',      label: 'Aula de Reforço',      icon: '💡' },
    { value: 'pratica_extra',     label: 'Prática Extra',        icon: '🔬' },
    { value: 'monitoria',         label: 'Monitoria',            icon: '🎓' },
    { value: 'outro',             label: 'Outro',                icon: '📌' },
];

const TELEGRAM_CHAT_ID = import.meta.env.VITE_TELEGRAM_CHAT_ID;

function ProporAulaForm({ userInfo, currentUser, initialDate, onSuccess, onCancel, isModal, formTitle, aulaId: propAulaId }) {
    const theme = useTheme();
    const isDarkMode = theme.palette.mode === 'dark';

    // 'aula' | 'revisao' | 'prova' — escolha antes de preencher o resto
    const [tipoEntrada, setTipoEntrada] = useState('aula');

    const [formData, setFormData] = useState({
        assunto: '', observacoes: '', tipoAtividade: '', cursos: [], liga: '',
        dataInicio: initialDate ? dayjs(initialDate) : null, horarioSlotString: [], dynamicLabs: [{ tipo: '', laboratorios: [] }],
        // Campos exclusivos de revisão
        tipoRevisao: 'revisao_conteudo',
        professorRevisao: '',
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
    const [secaoDataCompleta, setSecaoDataCompleta] = useState(false);
    const [secao2Completa, setSecao2Completa] = useState(false);
    const [refreshDisp, setRefreshDisp] = useState(0);

    const [gradeAberta, setGradeAberta] = useState(false);
    const [aulasDoMesState, setAulasDoMesState] = useState([]);

    const statusLab = useCallback((labParam) => {
        if (!formData.dataInicio) return 'indefinido';
        const dataStr = dayjs(formData.dataInicio).format('YYYY-MM-DD');
        const horariosForm = formData.horarioSlotString || [];

        // Suporta receber ou o id (ex: 'multidisciplinar_2') ou o objeto lab
        const targetLab = typeof labParam === 'object' ? labParam : LISTA_LABORATORIOS.find(l => l.id === labParam || l.name === labParam);
        const targetId = targetLab?.id || labParam;
        const targetName = targetLab?.name || labParam;

        const aulasDoLab = aulasDoMesState.filter(a => {
            const dataAula = toDataLocal(a.dataInicio);
            const labMatch = a.laboratorioSelecionado === targetId || a.laboratorioSelecionado === targetName || a.laboratorio === targetName || a.laboratorio === targetId;
            const statusValido = !a.status || ['aprovada', 'pendente'].includes(a.status);
            return labMatch && dataAula === dataStr && statusValido;
        });

        if (aulasDoLab.length === 0) return 'livre';

        const horariosOcupadosLab = aulasDoLab.flatMap(a =>
            Array.isArray(a.horarioSlotString) ? a.horarioSlotString : [a.horarioSlotString]
        );

        if (horariosForm.length === 0) {
            // Se nenhum horário foi selecionado no formulário ainda, indica que o lab tem reservas no dia ('parcial')
            return 'parcial';
        }

        const temConflito = horariosForm.some(h => horariosOcupadosLab.includes(h));
        return temConflito ? 'ocupado' : 'livre';
    }, [formData.dataInicio, formData.horarioSlotString, aulasDoMesState]);

    const navigate = useNavigate();
    const location = useLocation();
    const { aulaId: paramAulaId } = useParams();
    const aulaId = propAulaId || paramAulaId;

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
            setSecaoDataCompleta(true);
            return;
        }
        setSecaoDataCompleta(Boolean(formData.dataInicio) && secao1Completa);
    }, [formData.dataInicio, secao1Completa, aulaId]);

    useEffect(() => {
        if (aulaId) {
            setSecao2Completa(true);
            return;
        }
        const dataEHorarioValidos = Boolean(formData.dataInicio) && (formData.horarioSlotString || []).length > 0;
        setSecao2Completa(secao1Completa && dataEHorarioValidos);
    }, [formData.dataInicio, formData.horarioSlotString, secao1Completa, aulaId]);

    // Salva rascunho em localStorage para resiliencia offline
    const handleSalvarRascunhoLocal = useCallback((dados) => {
        try {
            if (!isEditMode && dados.assunto.trim()) {
                localStorage.setItem('cronolab_rascunho_proposta', JSON.stringify({
                    ...dados,
                    dataInicio: dados.dataInicio ? dayjs(dados.dataInicio).toISOString() : null
                }));
            }
        } catch (e) {
            console.warn('Erro ao salvar rascunho:', e);
        }
    }, [isEditMode]);

    useEffect(() => {
        handleSalvarRascunhoLocal(formData);
    }, [formData, handleSalvarRascunhoLocal]);

    const handleRestaurarRascunhoLocal = () => {
        try {
            const raw = localStorage.getItem('cronolab_rascunho_proposta');
            if (raw) {
                const parsed = JSON.parse(raw);
                setFormData({
                    ...parsed,
                    dataInicio: parsed.dataInicio ? dayjs(parsed.dataInicio) : null
                });
                setSnackbarMessage('✅ Rascunho salvo restaurado!');
                setSnackbarSeverity('info');
                setOpenSnackbar(true);
            }
        } catch (e) {
            console.error('Erro ao restaurar rascunho:', e);
        }
    };

    const handleRepetirUltimaProposta = async () => {
        try {
            if (!currentUser?.uid) return;
            const q = query(
                collection(db, 'aulas'),
                where('propostoPorUid', '==', currentUser.uid),
                orderBy('createdAt', 'desc')
            );
            const snap = await getDocs(q);
            if (!snap.empty) {
                const ultima = snap.docs[0].data();
                const labObj = LISTA_LABORATORIOS.find(l => l.name === ultima.laboratorioSelecionado || l.id === ultima.laboratorioSelecionado);
                if (ultima.isRevisao) setTipoEntrada('revisao');
                else if (ultima.isProva) setTipoEntrada('prova');

                setFormData(prev => ({
                    ...prev,
                    assunto: ultima.assunto || '',
                    observacoes: ultima.observacoes || '',
                    tipoAtividade: ultima.tipoAtividade || '',
                    cursos: ultima.cursos || [],
                    liga: ultima.liga || '',
                    dataInicio: null, // Limpa data para nova seleção
                    horarioSlotString: Array.isArray(ultima.horarioSlotString) ? ultima.horarioSlotString : [ultima.horarioSlotString],
                    dynamicLabs: [{ tipo: labObj ? labObj.tipo : '', laboratorios: [ultima.laboratorioSelecionado] }],
                    tipoRevisao: ultima.tipoRevisao || 'revisao_conteudo',
                    professorRevisao: ultima.professorRevisao || '',
                }));
                setSnackbarMessage('🔄 Proposta anterior duplicada com sucesso! Selecione a nova data.');
                setSnackbarSeverity('success');
                setOpenSnackbar(true);
            } else {
                setSnackbarMessage('Nenhuma proposta anterior encontrada para repetir.');
                setSnackbarSeverity('warning');
                setOpenSnackbar(true);
            }
        } catch (e) {
            console.error('Erro ao repetir proposta:', e);
            setSnackbarMessage('Erro ao buscar última proposta.');
            setSnackbarSeverity('error');
            setOpenSnackbar(true);
        }
    };

    // Reseta seleção de laboratórios e horários ao mudar de data no modo de inclusão
    useEffect(() => {
        if (isEditMode || !formData.dataInicio) return;
        setFormData(prev => ({
            ...prev,
            horarioSlotString: [],
            dynamicLabs: [{ tipo: '', laboratorios: [] }],
        }));
        setInfoOcupacao({});
    }, [formData.dataInicio, isEditMode]);

    const notificarTelegramBatch = useCallback(async (aulas, tipoAcao) => {
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
                observacoes: aula.observacoes,
                propostoPorNome: aula.propostoPorNome || '',
                isRevisao: aula.isRevisao || false,
                tipoRevisaoLabel: aula.tipoRevisaoLabel || '',
            };

            let tipoFinal;
            if (tipoAcao === 'adicionar') {
                tipoFinal = (!isCoordenador) ? 'pendente' : 'adicionar';
            } else if (tipoAcao === 'editar') {
                tipoFinal = 'editar';
            } else {
                tipoFinal = tipoAcao;
            }

            // Passa flag isProva para o notificador
            dadosNotificacao.isProva = aula.isProva || false;

            await notificadorTelegram.enviarNotificacao(TELEGRAM_CHAT_ID, dadosNotificacao, tipoFinal);
        }
    }, [isCoordenador]);

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
        const dataEHorarioValidos = Boolean(formData.dataInicio) && (formData.horarioSlotString || []).length > 0;
        setSecao2Completa(secao1Completa && dataEHorarioValidos);
    }, [formData.dataInicio, formData.horarioSlotString, secao1Completa, aulaId]);

    useEffect(() => {
        const fetchOcupacaoDoMes = async () => {
            setLoadingCalendario(true);
            const inicioDoMes = mesVisivel.startOf('month').toDate();
            const fimDoMes = mesVisivel.endOf('month').toDate();
            try {
                const q = query(collection(db, "aulas"), where("dataInicio", ">=", Timestamp.fromDate(inicioDoMes)), where("dataInicio", "<=", Timestamp.fromDate(fimDoMes)));
                const querySnapshot = await getDocs(q);
                const aulasDoMes = querySnapshot.docs.map(doc => doc.data());
                setAulasDoMesState(aulasDoMes);
                
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

    useEffect(() => {
        if (!formData.dataInicio || !dayjs(formData.dataInicio).isValid()) return;
        const dataStr = dayjs(formData.dataInicio).format('YYYY-MM-DD');
        buscarAulasPorDia(dataStr).then(aulasDia => {
            if (aulasDia && aulasDia.length > 0) {
                setAulasDoMesState(prev => {
                    const filtradas = prev.filter(a => toDataLocal(a.dataInicio) !== dataStr);
                    return [...filtradas, ...aulasDia];
                });
            }
        });
    }, [formData.dataInicio]);

    // --- VERIFICAÇÃO COM DETALHES DE QUEM OCUPA ---
    useEffect(() => {
        const verificarDisponibilidadeHorarios = async () => {
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
    }, [formData.dataInicio, formData.dynamicLabs, aulaId, refreshDisp]);

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
                        if (data.isRevisao) setTipoEntrada('revisao');
                        else if (data.isProva) setTipoEntrada('prova');
                        setFormData({
                            assunto: data.assunto || '',
                            observacoes: data.observacoes || '',
                            tipoAtividade: data.tipoAtividade || '',
                            cursos: data.cursos || [],
                            liga: data.liga || '',
                            dataInicio: dayjs(data.dataInicio.toDate()),
                            horarioSlotString: Array.isArray(data.horarioSlotString) ? data.horarioSlotString : [data.horarioSlotString],
                            dynamicLabs: [{ tipo: labObj ? labObj.tipo : '', laboratorios: [data.laboratorioSelecionado] }],
                            tipoRevisao: data.tipoRevisao || 'revisao_conteudo',
                            professorRevisao: data.professorRevisao || '',
                        });
                    }
                } catch (error) {
                    console.error("Erro ao carregar aula:", error);
                }
            }
        };
        loadAulaData();
    }, [aulaId]);

    useEffect(() => {
        if (location.state && !aulaId) {
            const { labIdPreSelecionado, horarioPreSelecionado, dataPreSelecionada } = location.state;
            if (dataPreSelecionada || horarioPreSelecionado || labIdPreSelecionado) {
                setFormData(prev => {
                    const newData = { ...prev };
                    if (dataPreSelecionada) newData.dataInicio = dayjs(dataPreSelecionada);
                    if (horarioPreSelecionado) newData.horarioSlotString = [horarioPreSelecionado];
                    if (labIdPreSelecionado) {
                        const labObj = LISTA_LABORATORIOS.find(l => l.id === labIdPreSelecionado || l.name === labIdPreSelecionado);
                        if (labObj) {
                            newData.dynamicLabs = [{ tipo: labObj.tipo, laboratorios: [labObj.name] }];
                        }
                    }
                    return newData;
                });
            }
        }
    }, [location.state, aulaId]);

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

        // Verifica se algum horário selecionado está ocupado
        const horariosOcupados = formData.horarioSlotString.filter(slot => infoOcupacao.hasOwnProperty(slot));
        if (horariosOcupados.length > 0) {
            const detalhes = horariosOcupados.map(slot => {
                const bloco = BLOCOS_HORARIO.find(b => b.value === slot);
                return `${bloco?.label || slot} (ocupado por: ${infoOcupacao[slot]})`;
            }).join('; ');
            newErrors.horarioSlotString = `Horário(s) indisponível(is): ${detalhes}`;
        }

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
                            status: (userInfo?.role === 'coordenador') ? 'aprovada' : 'pendente',
                            createdAt: serverTimestamp(),
                            // Campos de revisão
                            isRevisao: tipoEntrada === 'revisao',
                            tipoRevisao: tipoEntrada === 'revisao' ? formData.tipoRevisao : null,
                            tipoRevisaoLabel: tipoEntrada === 'revisao'
                                ? (TIPOS_REVISAO.find(t => t.value === formData.tipoRevisao)?.label || '')
                                : null,
                            professorRevisao: tipoEntrada === 'revisao' ? (formData.professorRevisao || '') : null,
                            isProva: tipoEntrada === 'prova',
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

            try {
                if (TELEGRAM_CHAT_ID) {
                    for (const aula of finalizadas) {
                        const dateObj = dayjs(aula.dataInicio.toDate ? aula.dataInicio.toDate() : aula.dataInicio);
                        const dadosNotificacao = {
                            assunto: aula.assunto,
                            data: dateObj.isValid() ? dateObj.format('DD/MM/YYYY') : 'N/A',
                            dataISO: dateObj.isValid() ? dateObj.format('YYYY-MM-DD') : null,
                            horario: aula.horarioSlotString,
                            laboratorio: aula.laboratorioSelecionado,
                            cursos: aula.cursos,
                            observacoes: aula.observacoes,
                            propostoPorNome: aula.propostoPorNome || '',
                            isRevisao: aula.isRevisao || false,
                            tipoRevisaoLabel: aula.tipoRevisaoLabel || '',
                            isProva: aula.isProva || false,
                        };
                        const tipoFinal = isEditMode ? 'editar' : (!isCoordenador ? 'pendente' : 'adicionar');
                        await notificadorTelegram.enviarNotificacao(TELEGRAM_CHAT_ID, dadosNotificacao, tipoFinal);
                    }
                }
            } catch (errTelegram) {
                console.warn('Alerta Telegram não enviado:', errTelegram);
            }

            // Atualiza imediatamente a ocupação local para refletir os novos agendamentos sem requerer navegação de data
            if (formData.dataInicio && dayjs(formData.dataInicio).isValid()) {
                const novasAulasFormatadas = finalizadas.map(a => ({
                    ...a,
                    dataInicio: a.dataInicio instanceof Timestamp ? a.dataInicio : Timestamp.fromDate(dayjs(a.dataInicio.toDate ? a.dataInicio.toDate() : a.dataInicio).toDate()),
                    laboratorioSelecionado: a.laboratorioSelecionado || a.laboratorio,
                    horarioSlotString: a.horarioSlotString
                }));

                setAulasDoMesState(prev => [...prev, ...novasAulasFormatadas]);
            }

            setRefreshDisp(v => v + 1);

            setSnackbarMessage(isEditMode ? 'Aula atualizada com sucesso!' : 'Aula(s) proposta(s) com sucesso!');
            setSnackbarSeverity('success');
            setOpenSnackbar(true);
            if (onSuccess) onSuccess();
            else if (!isEditMode) setOpenKeepDataDialog(true);
        } catch (error) {
            console.error("Erro no envio do agendamento:", error);
            setSnackbarMessage('Erro ao salvar agendamento.');
            setSnackbarSeverity('error');
            setOpenSnackbar(true);
        } finally {
            setLoadingSubmit(false);
        }
    };

    const handleKeepData = (keep) => {
        setOpenKeepDataDialog(false);
        if (!keep) {
            navigate('/calendario');
        } else {
            // Limpa o horário e os laboratórios específicos selecionados, mantendo o tipo do laboratório para nova escolha
            setFormData(prev => ({
                ...prev,
                horarioSlotString: [],
                dynamicLabs: prev.dynamicLabs.map(lab => ({
                    ...lab,
                    laboratorios: []
                }))
            }));
            setRefreshDisp(v => v + 1);
        }
    };

    const handleCloseSnackbar = () => setOpenSnackbar(false);

    return (
        <LocalizationProvider dateAdapter={AdapterDayjs} adapterLocale="pt-br">
            <Container maxWidth="md">
                <Paper
                    elevation={isDarkMode ? 4 : 2}
                    sx={{
                        p: { xs: 2.5, sm: 4 },
                        my: isModal ? 0 : 3,
                        borderRadius: 3,
                        bgcolor: theme.palette.background.paper,
                        transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                        border: tipoEntrada === 'revisao'
                            ? `3px solid ${isDarkMode ? '#ce93d8' : '#7b1fa2'}`
                            : tipoEntrada === 'prova'
                            ? `3px solid ${isDarkMode ? '#ff9800' : '#e65100'}`
                            : `1px solid ${theme.palette.divider}`,
                        boxShadow: tipoEntrada === 'revisao'
                            ? `0 0 24px ${alpha('#7b1fa2', isDarkMode ? 0.5 : 0.25)}`
                            : tipoEntrada === 'prova'
                            ? `0 0 24px ${alpha('#e65100', isDarkMode ? 0.5 : 0.25)}`
                            : undefined
                    }}
                >
                    {/* Barra de destaque no topo da moldura */}
                    {tipoEntrada === 'revisao' && (
                        <Box sx={{ bgcolor: isDarkMode ? '#7b1fa2' : '#7b1fa2', color: '#fff', py: 0.75, px: 2, borderRadius: 2, textAlign: 'center', fontWeight: 'bold', fontSize: '0.85rem', letterSpacing: 0.5, textTransform: 'uppercase', mb: 2, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 1, boxShadow: 2 }}>
                            <MenuBookIcon fontSize="small" /> MODO REVISÃO / REFORÇO ATIVO
                        </Box>
                    )}
                    {tipoEntrada === 'prova' && (
                        <Box sx={{ bgcolor: isDarkMode ? '#e65100' : '#d32f2f', color: '#fff', py: 0.75, px: 2, borderRadius: 2, textAlign: 'center', fontWeight: 'bold', fontSize: '0.85rem', letterSpacing: 0.5, textTransform: 'uppercase', mb: 2, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 1, boxShadow: 2 }}>
                            <AssignmentIcon fontSize="small" /> MODO PROVA / AVALIAÇÃO ATIVO
                        </Box>
                    )}
                <Box sx={{ textAlign: 'center', mb: 3, mt: isModal ? 0 : 4 }}>
                    <Typography variant="h4" component="h1" gutterBottom sx={{ color: theme.palette.text.primary, fontWeight: 'bold', mb: 1 }}>
                        {formTitle || (isEditMode ? "Editar Atividade" : (isCoordenador ? "Agendar Atividade" : "Propor Atividade"))}
                    </Typography>

                    {!isEditMode && (
                        <Box display="flex" justifyContent="center" gap={1.5} flexWrap="wrap" sx={{ mb: 2 }}>
                            <Button
                                size="small"
                                variant="outlined"
                                color="primary"
                                onClick={handleRepetirUltimaProposta}
                            >
                                🔄 Repetir Última Proposta
                            </Button>
                            {localStorage.getItem('cronolab_rascunho_proposta') && (
                                <Button
                                    size="small"
                                    variant="outlined"
                                    color="info"
                                    onClick={handleRestaurarRascunhoLocal}
                                >
                                    💾 Restaurar Rascunho Salvo
                                </Button>
                            )}
                        </Box>
                    )}

                    <Box sx={{ mt: 1 }}>
                        {tipoEntrada === 'revisao' && (
                            <Chip icon={<MenuBookIcon />} label="MODO REVISÃO / REFORÇO ATIVO" color="secondary" sx={{ fontWeight: 'bold', fontSize: '0.8rem', py: 1.5, px: 1, boxShadow: 1 }} />
                        )}
                        {tipoEntrada === 'prova' && (
                            <Chip icon={<AssignmentIcon />} label="MODO PROVA / AVALIAÇÃO ATIVO" color="error" sx={{ fontWeight: 'bold', fontSize: '0.8rem', py: 1.5, px: 1, boxShadow: 1 }} />
                        )}
                        {tipoEntrada === 'aula' && (
                            <Chip label="📅 MODO AULA NORMAL" color="primary" variant="outlined" sx={{ fontWeight: 'bold', fontSize: '0.8rem' }} />
                        )}
                    </Box>
                </Box>

                {/* ── Seletor de tipo de agendamento ── */}
                <Box sx={{ display: 'flex', justifyContent: 'center', mb: 3 }}>
                    <ToggleButtonGroup
                        value={tipoEntrada}
                        exclusive
                        onChange={(_, v) => { if (v) setTipoEntrada(v); }}
                        size="large"
                        sx={{ bgcolor: theme.palette.background.paper, boxShadow: 1, borderRadius: 2 }}
                    >
                        <ToggleButton
                            value="aula"
                            sx={{
                                px: 3, gap: 1, fontWeight: 'bold',
                                color: theme.palette.text.secondary,
                                '&.Mui-selected': {
                                    bgcolor: isDarkMode ? alpha(theme.palette.primary.main, 0.25) : '#e3f2fd',
                                    color: isDarkMode ? theme.palette.primary.light : '#1976d2',
                                    borderColor: theme.palette.primary.main
                                }
                            }}
                        >
                            📅 Aula Normal
                        </ToggleButton>
                        <ToggleButton
                            value="revisao"
                            sx={{
                                px: 3, gap: 1, fontWeight: 'bold',
                                color: theme.palette.text.secondary,
                                '&.Mui-selected': {
                                    bgcolor: isDarkMode ? alpha('#ab47bc', 0.25) : '#f3e5f5',
                                    color: isDarkMode ? '#ce93d8' : '#7b1fa2',
                                    borderColor: isDarkMode ? '#ce93d8' : '#7b1fa2'
                                }
                            }}
                        >
                            <MenuBookIcon fontSize="small" /> Revisão / Reforço
                        </ToggleButton>
                        <ToggleButton
                            value="prova"
                            sx={{
                                px: 3, gap: 1, fontWeight: 'bold',
                                color: theme.palette.text.secondary,
                                '&.Mui-selected': {
                                    bgcolor: isDarkMode ? alpha('#f44336', 0.25) : '#ffebee',
                                    color: isDarkMode ? '#ef5350' : '#c62828',
                                    borderColor: isDarkMode ? '#ef5350' : '#c62828'
                                }
                            }}
                        >
                            <AssignmentIcon fontSize="small" /> Prova
                        </ToggleButton>
                    </ToggleButtonGroup>
                </Box>

                {/* Card Informativo do Modo Selecionado */}
                {tipoEntrada === 'revisao' && (
                    <Paper
                        elevation={2}
                        sx={{
                            p: 2.5, mb: 3,
                            background: isDarkMode
                                ? 'linear-gradient(135deg, rgba(123, 31, 162, 0.25) 0%, rgba(94, 53, 177, 0.25) 100%)'
                                : 'linear-gradient(135deg, #f3e5f5 0%, #ede7f6 100%)',
                            borderLeft: `6px solid ${isDarkMode ? '#ce93d8' : '#7b1fa2'}`,
                            borderRadius: 2
                        }}
                    >
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 1 }}>
                            <MenuBookIcon sx={{ color: isDarkMode ? '#ce93d8' : '#7b1fa2', fontSize: 28 }} />
                            <Typography variant="h6" sx={{ color: isDarkMode ? '#e1bee7' : '#4a148c', fontWeight: 'bold' }}>
                                Modo Revisão / Reforço Ativo
                            </Typography>
                        </Box>
                        <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                            Este agendamento é específico para sessões de estudo, revisão de conteúdos ou aulas práticas extras.
                        </Typography>
                        <Box component="ul" sx={{ m: 0, pl: 2.5, fontSize: '0.85rem', color: isDarkMode ? '#e1bee7' : '#4a148c' }}>
                            <li>Permite classificar o tipo de revisão (Pré-Prova, Reforço, Prática Extra, Monitoria).</li>
                            <li>Permite registrar o professor/monitor responsável pela condução.</li>
                            <li>{!isCoordenador && !isEditMode ? 'Envia notificação via Telegram identificando a proposta como Revisão.' : 'Notificação no Telegram parametrizada para Revisão.'}</li>
                        </Box>
                    </Paper>
                )}

                {tipoEntrada === 'prova' && (
                    <Paper
                        elevation={2}
                        sx={{
                            p: 2.5, mb: 3,
                            background: isDarkMode
                                ? 'linear-gradient(135deg, rgba(230, 81, 0, 0.25) 0%, rgba(198, 40, 40, 0.25) 100%)'
                                : 'linear-gradient(135deg, #fff3e0 0%, #ffe0b2 100%)',
                            borderLeft: `6px solid ${isDarkMode ? '#ff9800' : '#e65100'}`,
                            borderRadius: 2
                        }}
                    >
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 1 }}>
                            <AssignmentIcon sx={{ color: isDarkMode ? '#ff9800' : '#e65100', fontSize: 28 }} />
                            <Typography variant="h6" sx={{ color: isDarkMode ? '#ffb74d' : '#e65100', fontWeight: 'bold' }}>
                                Modo Prova / Avaliação Ativo
                            </Typography>
                        </Box>
                        <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                            Este agendamento é sinalizado como avaliação presencial oficial no laboratório.
                        </Typography>
                        <Box component="ul" sx={{ m: 0, pl: 2.5, fontSize: '0.85rem', color: isDarkMode ? '#ffcc80' : '#bf360c' }}>
                            <li>Agendamento com destaque de prioridade no cronograma geral dos laboratórios.</li>
                            <li>Identificado em relatórios para alocação preferencial de equipamentos e insumos.</li>
                            <li>Notificação de alta prioridade enviada ao Telegram da equipe.</li>
                        </Box>
                    </Paper>
                )}

                {tipoEntrada === 'aula' && (
                    <Paper
                        elevation={0}
                        sx={{
                            p: 2, mb: 3,
                            bgcolor: isDarkMode ? alpha(theme.palette.primary.main, 0.15) : '#f4f6f8',
                            borderLeft: `4px solid ${theme.palette.primary.main}`,
                            borderRadius: 2
                        }}
                    >
                        <Typography variant="subtitle2" color="primary" fontWeight="bold">
                            📅 Modo Aula Normal
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                            Agendamento padrão de aula regular de disciplinas da grade curricular.
                        </Typography>
                    </Paper>
                )}

                <form onSubmit={(e) => { e.preventDefault(); prepareAndConfirm(); }}>
                    <Grid container spacing={3} justifyContent="center">
                        <Grid item xs={12} md={6}>
                            <Paper
                                elevation={3}
                                sx={{
                                    p: 3,
                                    borderLeft: `5px solid ${
                                        tipoEntrada === 'revisao'
                                            ? (isDarkMode ? '#ce93d8' : '#7b1fa2')
                                            : tipoEntrada === 'prova'
                                            ? (isDarkMode ? '#ff9800' : '#e65100')
                                            : theme.palette.primary.main
                                    }`,
                                    height: '100%'
                                }}
                            >
                                <Typography variant="h6" gutterBottom>1. Detalhes da {tipoEntrada === 'revisao' ? 'Revisão' : (tipoEntrada === 'prova' ? 'Prova / Avaliação' : 'Atividade')}</Typography>
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
                                            const { key, ...tagProps } = getTagProps({ index });
                                            return (
                                                <Chip key={key} variant="outlined" label={label} {...tagProps} size="small" />
                                            );
                                        })
                                    }
                                    sx={{ mb: 2 }}
                                />

                                <TextField fullWidth label="Observações" name="observacoes" value={formData.observacoes} onChange={handleChange} multiline rows={3} />

                                {/* Campos extras — só aparecem quando for revisão */}
                                <Collapse in={tipoEntrada === 'revisao'}>
                                    <Box
                                        sx={{
                                            mt: 2.5, p: 2,
                                            bgcolor: isDarkMode ? alpha('#ab47bc', 0.15) : '#faf5fb',
                                            border: `1px solid ${isDarkMode ? 'rgba(206, 147, 216, 0.3)' : '#ce93d8'}`,
                                            borderRadius: 2
                                        }}
                                    >
                                        <Typography variant="subtitle2" sx={{ color: isDarkMode ? '#ce93d8' : '#7b1fa2', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: 0.5, mb: 1.5 }}>
                                            <MenuBookIcon fontSize="small" /> Classificação da Revisão
                                        </Typography>
                                        <FormControl fullWidth sx={{ mb: 2 }}>
                                            <InputLabel>Tipo de Revisão</InputLabel>
                                            <Select
                                                value={formData.tipoRevisao}
                                                onChange={(e) => setFormData(p => ({ ...p, tipoRevisao: e.target.value }))}
                                                label="Tipo de Revisão"
                                            >
                                                {TIPOS_REVISAO.map(t => (
                                                    <MenuItem key={t.value} value={t.value}>
                                                        {t.icon} {t.label}
                                                    </MenuItem>
                                                ))}
                                            </Select>
                                        </FormControl>
                                        <TextField
                                            fullWidth
                                            label="Professor responsável (opcional)"
                                            value={formData.professorRevisao}
                                            onChange={(e) => setFormData(p => ({ ...p, professorRevisao: e.target.value }))}
                                            placeholder="Nome do professor que vai conduzir"
                                            size="small"
                                        />
                                    </Box>
                                </Collapse>
                            </Paper>
                        </Grid>

                        {/* ── SEÇÃO 2: Data e Horário ── */}
                        <Grid item xs={12} md={6}>
                            <Paper elevation={3} sx={{ p: 3, borderLeft: '5px solid #4caf50', height: '100%', opacity: (!secao1Completa && !isEditMode) ? 0.8 : 1 }}>
                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
                                    <Typography variant="h6" gutterBottom sx={{ mb: 0 }}>2. Data e Horário</Typography>
                                    {!secao1Completa && !isEditMode && <LockIcon color="warning" />}
                                </Box>
                                {!secao1Completa && !isEditMode && (
                                    <Alert severity="warning" sx={{ mb: 2 }}>
                                        <strong>Seção bloqueada!</strong> Complete a Seção 1 para desbloquear.
                                    </Alert>
                                )}
                                <Grid container spacing={2}>
                                    <Grid item xs={12} sm={6}>
                                        <DatePicker
                                            label="Data da Aula *"
                                            value={formData.dataInicio}
                                            onChange={(newValue) => {
                                                setFormData(prev => ({
                                                    ...prev,
                                                    dataInicio: newValue,
                                                    horarioSlotString: []
                                                }));
                                                if (errors.dataInicio) setErrors(prev => ({ ...prev, dataInicio: null }));
                                            }}
                                            disabled={!secao1Completa && !isEditMode}
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
                                    <Grid item xs={12} sm={6}>
                                        <FormControl fullWidth error={!!errors.horarioSlotString} disabled={!formData.dataInicio || (!secao1Completa && !isEditMode)}>
                                            <InputLabel>{isEditMode ? 'Horário *' : 'Horário(s) *'}</InputLabel>
                                            {isEditMode ? (
                                                /* EDIÇÃO: select simples, 1 horário */
                                                <Select
                                                    name="horarioSlotString"
                                                    value={formData.horarioSlotString[0] || ''}
                                                    onChange={(e) => setFormData(prev => ({ ...prev, horarioSlotString: [e.target.value] }))}
                                                    label="Horário *"
                                                >
                                                    {BLOCOS_HORARIO.map((bloco) => {
                                                        const isOccupied = infoOcupacao.hasOwnProperty(bloco.value);
                                                        const aulaQueOcupa = infoOcupacao[bloco.value];
                                                        return (
                                                            <MenuItem key={bloco.value} value={bloco.value} disabled={isOccupied} sx={isOccupied ? { opacity: 0.9 } : {}}>
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
                                            ) : (
                                                /* CRIAÇÃO: select múltiplo */
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
                                                        const isOccupied = infoOcupacao.hasOwnProperty(bloco.value);
                                                        const aulaQueOcupa = infoOcupacao[bloco.value];
                                                        return (
                                                            <MenuItem key={bloco.value} value={bloco.value} disabled={isOccupied} sx={isOccupied ? { opacity: 0.9 } : {}}>
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
                                            )}
                                            {errors.horarioSlotString && <FormHelperText>{errors.horarioSlotString}</FormHelperText>}
                                            {verificandoDisp && <CircularProgress size={20} sx={{ mt: 1 }} />}
                                        </FormControl>
                                    </Grid>
                                </Grid>

                                {/* Grade de Disponibilidade Informativa / Auxiliar */}
                                {formData.dataInicio && dayjs(formData.dataInicio).isValid() && (
                                    <Accordion sx={{ mt: 3 }} expanded={gradeAberta} onChange={() => setGradeAberta(!gradeAberta)}>
                                        <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                                            <Typography variant="subtitle2" color="primary" fontWeight="bold">
                                                📊 Consulta de Grade de Disponibilidade ({dayjs(formData.dataInicio).format('DD/MM/YYYY')})
                                            </Typography>
                                        </AccordionSummary>
                                        <AccordionDetails>
                                            <GradeDisponibilidade
                                                aulas={aulasDoMesState}
                                                dataFoco={dayjs(formData.dataInicio).format('YYYY-MM-DD')}
                                                tiposLab={formData.dynamicLabs.map(l => l.tipo).filter(Boolean)}
                                            />
                                        </AccordionDetails>
                                    </Accordion>
                                )}
                            </Paper>
                        </Grid>

                        {/* ── SEÇÃO 3: Seleção Múltipla de Laboratórios ── */}
                        <Grid xs={12}>
                            <Paper elevation={3} sx={{ p: 3, borderLeft: '5px solid #f50057', opacity: (!secaoDataCompleta && !isEditMode) ? 0.8 : 1 }}>
                                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                        <Typography variant="h6" gutterBottom sx={{ mb: 0 }}>3. Laboratório(s)</Typography>
                                        {!secaoDataCompleta && !isEditMode && <LockIcon color="warning" />}
                                    </Box>
                                    {!isEditMode && (
                                        <Tooltip title="Adicionar outro tipo de laboratório">
                                            <span>
                                                <IconButton onClick={handleAddLabField} color="primary" disabled={formData.dynamicLabs.length >= 5 || !secaoDataCompleta}>
                                                    <AddIcon />
                                                </IconButton>
                                            </span>
                                        </Tooltip>
                                    )}
                                </Box>
                                {!secaoDataCompleta && !isEditMode && (
                                    <Alert severity="warning" sx={{ mb: 2, mt: 1 }}>
                                        <strong>Seção bloqueada!</strong> Selecione uma data na Seção 2 para desbloquear a seleção de laboratórios.
                                    </Alert>
                                )}

                                {isEditMode ? (
                                    <Grid container spacing={1} sx={{ mt: 0.5 }}>
                                        <Grid item xs={5}>
                                            <FormControl fullWidth size="small">
                                                <InputLabel>Tipo *</InputLabel>
                                                <Select value={formData.dynamicLabs[0]?.tipo || ''} onChange={(e) => handleLabTipoChange(0, e.target.value)}>
                                                    {TIPOS_LABORATORIO.map(t => <MenuItem key={t.id} value={t.id}>{t.name}</MenuItem>)}
                                                </Select>
                                            </FormControl>
                                        </Grid>
                                        <Grid item xs={7}>
                                            <FormControl fullWidth size="small">
                                                <InputLabel>Laboratório *</InputLabel>
                                                <Select value={formData.dynamicLabs[0]?.laboratorios[0] || ''} onChange={(e) => handleLabSelectionChange(0, [e.target.value])}>
                                                    {LISTA_LABORATORIOS.filter(l => l.tipo === formData.dynamicLabs[0]?.tipo).map(l => (
                                                        <MenuItem key={l.id} value={l.name}>{l.name}</MenuItem>
                                                    ))}
                                                </Select>
                                            </FormControl>
                                        </Grid>
                                    </Grid>
                                ) : (
                                    formData.dynamicLabs.map((labSelection, index) => (
                                        <Grid container spacing={1} key={index} alignItems="center" sx={{ mb: 2 }}>
                                            <Grid item xs={5}>
                                                <FormControl fullWidth size="small" disabled={!secaoDataCompleta}>
                                                    <InputLabel>Tipo *</InputLabel>
                                                    <Select value={labSelection.tipo} onChange={(e) => handleLabTipoChange(index, e.target.value)}>
                                                        {TIPOS_LABORATORIO.map(t => <MenuItem key={t.id} value={t.id}>{t.name}</MenuItem>)}
                                                    </Select>
                                                </FormControl>
                                            </Grid>
                                            <Grid item xs={6}>
                                                <FormControl fullWidth size="small" disabled={!labSelection.tipo || !secaoDataCompleta}>
                                                    <InputLabel>Laboratório(s) *</InputLabel>
                                                    <Select
                                                        multiple
                                                        value={labSelection.laboratorios || []}
                                                        onChange={(e) => handleLabSelectionChange(index, e.target.value)}
                                                        renderValue={(selected) => (
                                                            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                                                                {selected.map((value) => <Chip key={value} label={value} size="small" />)}
                                                            </Box>
                                                        )}
                                                    >
                                                        {LISTA_LABORATORIOS.filter(l => l.tipo === labSelection.tipo).map(l => {
                                                            const st = statusLab(l.id);
                                                            const isBlocked = st === 'ocupado';
                                                            const chipInfo = {
                                                                livre:     { label: 'Livre',    color: 'success' },
                                                                parcial:   { label: 'Parcial',  color: 'warning' },
                                                                ocupado:   { label: 'Ocupado',  color: 'error'   },
                                                                indefinido:{ label: '—',        color: 'default'  },
                                                            }[st];
                                                            return (
                                                                <MenuItem key={l.id} value={l.name} disabled={isBlocked}>
                                                                    <Box display="flex" justifyContent="space-between" alignItems="center" width="100%" gap={1}>
                                                                        <Typography variant="body2" color={isBlocked ? 'text.disabled' : 'text.primary'}>{l.name}</Typography>
                                                                        <Chip label={chipInfo.label} color={chipInfo.color} size="small" variant={st === 'livre' ? 'filled' : 'outlined'} sx={{ fontSize: '0.65rem', minWidth: 62 }} />
                                                                    </Box>
                                                                </MenuItem>
                                                            );
                                                        })}
                                                    </Select>
                                                </FormControl>
                                            </Grid>
                                            <Grid item xs={1}>
                                                <IconButton size="small" onClick={() => handleRemoveLabField(index)} disabled={formData.dynamicLabs.length === 1 || !secaoDataCompleta}>
                                                    <DeleteIcon fontSize="small" />
                                                </IconButton>
                                            </Grid>
                                        </Grid>
                                    ))
                                )}
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
                </Paper>
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