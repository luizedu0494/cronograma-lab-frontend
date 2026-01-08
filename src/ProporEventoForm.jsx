import React, { useState, useEffect } from 'react';
import {
    Container, Typography, TextField, Button, Grid, MenuItem, FormControl, InputLabel,
    Select, Box, Paper, Snackbar, Alert, CircularProgress, Chip, IconButton, Tooltip,
    FormHelperText
} from '@mui/material';
import { 
    Lock as LockIcon, 
    Add as AddIcon, 
    Delete as DeleteIcon 
} from '@mui/icons-material';
import { AdapterDayjs } from '@mui/x-date-pickers/AdapterDayjs';
import { LocalizationProvider, DatePicker } from '@mui/x-date-pickers';
import { useNavigate, useParams } from 'react-router-dom';
import { db } from './firebaseConfig';
import {
    collection, addDoc, serverTimestamp, doc, getDoc, updateDoc, Timestamp
} from 'firebase/firestore';
import dayjs from 'dayjs';
import 'dayjs/locale/pt-br';
import { LISTA_LABORATORIOS, TIPOS_LABORATORIO } from './constants/laboratorios';
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
    
    const [secao1Completa, setSecao1Completa] = useState(false);
    const [secao2Completa, setSecao2Completa] = useState(false);

    const navigate = useNavigate();
    const { eventoId: paramEventoId } = useParams();
    const eventoId = propEventoId || paramEventoId;

    useEffect(() => {
        if (eventoId) {
            setSecao1Completa(true);
            return;
        }
        const completa = formData.titulo.trim() !== '' && formData.tipo !== '';
        setSecao1Completa(completa);
    }, [formData.titulo, formData.tipo, eventoId]);

    useEffect(() => {
        if (eventoId) {
            setSecao2Completa(true);
            return;
        }
        const labsCompletos = formData.dynamicLabs.every(lab => lab && lab.tipo !== '' && lab.laboratorios.length > 0);
        setSecao2Completa(labsCompletos && secao1Completa);
    }, [formData.dynamicLabs, secao1Completa, eventoId]);

    useEffect(() => {
        const loadInitialData = async () => {
            if (eventoId) {
                setIsEditMode(true);
                setSecao1Completa(true);
                setSecao2Completa(true);
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
                    } else if (!isModal) { navigate('/calendario'); }
                } catch (error) { 
                    console.error("Erro ao carregar:", error);
                    if (!isModal) navigate('/calendario'); 
                }
            }
        };
        if (currentUser) { loadInitialData(); }
    }, [eventoId, navigate, currentUser, isModal]);

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
        if (!formData.dataInicio || !formData.dataInicio.isValid()) newErrors.dataInicio = 'Selecione uma data válida';
        if (formData.horarioSlotString.length === 0) newErrors.horarioSlotString = 'Selecione pelo menos um horário';
        const labsValidos = formData.dynamicLabs.filter(lab => lab.tipo && lab.laboratorios.length > 0);
        if (labsValidos.length === 0) newErrors.dynamicLabs = 'Selecione pelo menos um laboratório';
        setErrors(newErrors);
        return Object.keys(newErrors).length === 0;
    };

    const handleSubmit = async () => {
        if (!validate()) return;
        setLoadingSubmit(true);
        
        try {
            let jaAtualizouOriginal = false;
            let dadosParaNotificacao = null;

            // Cálculos para a notificação correta (Fim e Link)
            let menorHora = "23:59";
            let maiorHora = "00:00";
            formData.horarioSlotString.forEach(slot => {
                const [inicio, fim] = slot.split('-');
                if (inicio < menorHora) menorHora = inicio;
                if (fim > maiorHora) maiorHora = fim;
            });

            for (const slot of formData.horarioSlotString) {
                const [inicioStr, fimStr] = slot.split('-');
                const dataHoraInicio = formData.dataInicio.hour(parseInt(inicioStr.split(':')[0])).minute(parseInt(inicioStr.split(':')[1])).second(0).millisecond(0);
                const dataHoraFim = formData.dataInicio.hour(parseInt(fimStr.split(':')[0])).minute(parseInt(fimStr.split(':')[1])).second(0).millisecond(0);
                
                for (const labGroup of formData.dynamicLabs) {
                    for (const labName of labGroup.laboratorios) {
                        const eventoData = {
                            titulo: formData.titulo,
                            descricao: formData.descricao,
                            tipo: formData.tipo,
                            laboratorio: labName,
                            dataInicio: Timestamp.fromDate(dataHoraInicio.toDate()),
                            dataFim: Timestamp.fromDate(dataHoraFim.toDate()),
                            horarioSlotString: slot,
                            criadoPorUid: currentUser.uid,
                            criadoPorNome: userInfo?.name || currentUser.displayName || currentUser.email,
                            createdAt: serverTimestamp()
                        };

                        if (eventoId && !jaAtualizouOriginal) {
                            await updateDoc(doc(db, "eventosManutencao", eventoId), eventoData);
                            jaAtualizouOriginal = true;
                            dadosParaNotificacao = { ...eventoData, acao: 'editar' };
                        } else {
                            await addDoc(collection(db, "eventosManutencao"), eventoData);
                            if (!dadosParaNotificacao) dadosParaNotificacao = { ...eventoData, acao: 'adicionar' };
                        }
                    }
                }
            }

            // Notificação com dados corrigidos (Link e Horários)
            if (TELEGRAM_CHAT_ID && dadosParaNotificacao) {
                const labsFormatados = formData.dynamicLabs.flatMap(l => l.laboratorios).join(', ');
                
                const payloadTelegram = {
                    titulo: formData.titulo,
                    tipoEvento: formData.tipo,
                    laboratorio: labsFormatados || 'Vários',
                    // Formata a data para leitura humana
                    dataInicio: `${formData.dataInicio.format('DD/MM/YYYY')} às ${menorHora}`,
                    // Formata a data fim corretamente (sem N/A)
                    dataFim: `${formData.dataInicio.format('DD/MM/YYYY')} às ${maiorHora}`, 
                    // IMPORTANTE: dataISO permite que o link abra na semana certa
                    dataISO: formData.dataInicio.format('YYYY-MM-DD'),
                    descricao: formData.descricao
                };

                const tipoAcao = dadosParaNotificacao.acao === 'editar' ? 'evento_editar' : 'evento_adicionar';
                
                notificadorTelegram.enviarNotificacao(TELEGRAM_CHAT_ID, payloadTelegram, tipoAcao)
                    .catch(err => console.error("Erro telegram:", err));
            }

            setSnackbarMessage(eventoId ? 'Evento atualizado!' : 'Evento(s) criado(s) com sucesso!');
            setSnackbarSeverity('success');
            setOpenSnackbar(true);
            if (onSuccess) onSuccess();
            if (!isModal) setTimeout(() => navigate('/calendario'), 1500);
        } catch (error) {
            console.error("Erro ao salvar:", error);
            setSnackbarMessage('Erro ao salvar evento.');
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
                <form onSubmit={(e) => { e.preventDefault(); handleSubmit(); }}>
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
                                <TextField 
                                    fullWidth 
                                    label="Título do Evento *" 
                                    name="titulo" 
                                    value={formData.titulo} 
                                    onChange={handleChange} 
                                    error={!!errors.titulo} 
                                    helperText={errors.titulo} 
                                    sx={{ mb: 2 }} 
                                />
                                <TextField 
                                    fullWidth 
                                    label="Descrição/Observações" 
                                    name="descricao" 
                                    value={formData.descricao} 
                                    onChange={handleChange} 
                                    multiline 
                                    rows={3} 
                                />
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
                                        Complete a Seção 1 para desbloquear.
                                    </Alert>
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
                                            slotProps={{ textField: { fullWidth: true, error: !!errors.dataInicio, helperText: errors.dataInicio } }}
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
                                                    <MenuItem key={bloco.value} value={bloco.value}>
                                                        {bloco.label} ({bloco.turno})
                                                    </MenuItem>
                                                ))}
                                            </Select>
                                            {errors.horarioSlotString && <FormHelperText>{errors.horarioSlotString}</FormHelperText>}
                                        </FormControl>
                                    </Grid>
                                </Grid>
                            </Paper>
                        </Grid>
                        <Grid item xs={12} sx={{ textAlign: 'center', mt: 2, mb: 4 }}>
                            <Button 
                                type="submit" 
                                variant="contained" 
                                size="large" 
                                disabled={loadingSubmit || (!secao2Completa && !isEditMode)} 
                                sx={{ minWidth: 200, py: 1.5, fontWeight: 'bold', borderRadius: 2 }}
                            >
                                {loadingSubmit ? <CircularProgress size={24} /> : (isEditMode ? "Salvar Alterações" : "Criar Evento")}
                            </Button>
                            {onCancel && (
                                <Button onClick={onCancel} sx={{ ml: 2 }}>Cancelar</Button>
                            )}
                        </Grid>
                    </Grid>
                </form>
                <Snackbar open={openSnackbar} autoHideDuration={6000} onClose={() => setOpenSnackbar(false)}>
                    <Alert severity={snackbarSeverity} onClose={() => setOpenSnackbar(false)}>{snackbarMessage}</Alert>
                </Snackbar>
            </Container>
        </LocalizationProvider>
    );
}

export default ProporEventoForm;