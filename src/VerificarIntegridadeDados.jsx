import React, { useState, useEffect, useCallback } from 'react';
import {
    Container, Typography, Box, Paper, Grid, CircularProgress,
    List, ListItem, ListItemText, ListItemIcon, Button, Alert,
    Collapse, IconButton, Dialog, DialogTitle, DialogContent, DialogActions, Snackbar, Divider,
    TextField, FormControl, InputLabel, Select, MenuItem, Chip, OutlinedInput, Card, CardContent, CardActions
} from '@mui/material';
import { db } from './firebaseConfig';
import { collection, getDocs, doc, deleteDoc, updateDoc } from 'firebase/firestore';
import { BugReport, CheckCircle, Warning, ExpandMore, Delete, Edit, Bolt, DataObject, Groups } from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import { LISTA_CURSOS } from './constants/cursos';
import { LISTA_LABORATORIOS } from './constants/laboratorios';
import dayjs from 'dayjs';

// --- Constantes de Validação ---
const LISTA_CURSOS_VALIDOS = LISTA_CURSOS.map(c => c.value);
const LISTA_LABORATORIOS_VALIDOS = LISTA_LABORATORIOS.map(l => l.name);
const TIPOS_ATIVIDADE_VALIDOS = ['aula', 'revisao'];
const KEYWORD_MAP = [
    { keywords: ['biomed', 'biomedicina'], value: 'biomedicina' }, { keywords: ['farmacia'], value: 'farmacia' },
    { keywords: ['enf', 'enfermagem'], value: 'enfermagem' }, { keywords: ['odonto', 'odontologia'], value: 'odontologia' },
    { keywords: ['med', 'medicina'], value: 'medicina' }, { keywords: ['fisio', 'fisioterapia'], value: 'fisioterapia' },
    { keywords: ['nutri', 'nutricao'], value: 'nutricao' }, { keywords: ['ed.fisica', 'edfisica'], value: 'ed_fisica' },
    { keywords: ['psico', 'psicologia'], value: 'psicologia' }, { keywords: ['veterinaria', 'vet'], value: 'med_veterinaria' },
    { keywords: ['quimica'], value: 'quimica_tecnologica' }, { keywords: ['eng', 'engenharia'], value: 'engenharia' },
    { keywords: ['cosmetico'], value: 'tec_cosmetico' },
];

function VerificarIntegridadeDados() {
    const [loading, setLoading] = useState(false);
    const [aulas, setAulas] = useState([]);
    const [dadosInvalidos, setDadosInvalidos] = useState([]);
    const [conflitosHorario, setConflitosHorario] = useState([]);
    const [expanded, setExpanded] = useState({});
    const [openDeleteDialog, setOpenDeleteDialog] = useState(false);
    const [aulaToDelete, setAulaToDelete] = useState(null);
    const navigate = useNavigate();
    const [feedback, setFeedback] = useState({ open: false, message: '', severity: 'success' });
    const [hasValidated, setHasValidated] = useState(false);
    const [openQuickEditModal, setOpenQuickEditModal] = useState(false);
    const [aulaParaQuickEdit, setAulaParaQuickEdit] = useState(null);
    const [quickEditFields, setQuickEditFields] = useState({ assunto: '', tipoAtividade: '', cursos: [], laboratorioSelecionado: '' });

    const fetchAulas = useCallback(async () => {
        setLoading(true);
        setHasValidated(true);
        try {
            const aulasSnapshot = await getDocs(collection(db, "aulas"));
            const listaAulas = aulasSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            setAulas(listaAulas);
        } catch (err) {
            console.error("Erro ao buscar aulas:", err);
            setFeedback({ open: true, message: "Erro ao buscar aulas para verificação.", severity: 'error' });
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        if (aulas.length === 0) return;

        const validationErrors = [];
        const scheduleMap = {};
        const conflitos = new Set();

        aulas.forEach(aula => {
            const errorsForAula = [];
            const assuntoLowerCase = aula.assunto?.toLowerCase() || '';
            let suggestedCursos = [];

            // Validação de Dados Faltantes/Inválidos
            if (!aula.assunto?.trim()) errorsForAula.push('Assunto da aula está faltando.');
            if (!TIPOS_ATIVIDADE_VALIDOS.includes(aula.tipoAtividade)) errorsForAula.push(`Tipo de atividade inválido: "${aula.tipoAtividade}".`);
            if (!LISTA_LABORATORIOS_VALIDOS.includes(aula.laboratorioSelecionado)) errorsForAula.push(`Laboratório inválido: "${aula.laboratorioSelecionado}".`);
            if (!aula.cursos?.length || aula.cursos.some(c => !LISTA_CURSOS_VALIDOS.includes(c))) {
                errorsForAula.push('Curso(s) faltando ou inválido(s).');
                KEYWORD_MAP.forEach(map => {
                    if (map.keywords.some(keyword => assuntoLowerCase.includes(keyword)) && !suggestedCursos.includes(map.value)) {
                        suggestedCursos.push(map.value);
                    }
                });
            }
            if (!aula.propostoPorUid) errorsForAula.push('Dados do proponente estão faltando.');
            if (!aula.dataInicio?.toDate) errorsForAula.push('Data de início inválida.');

            if (errorsForAula.length > 0) {
                validationErrors.push({ id: aula.id, ...aula, erros: errorsForAula, sugestoes: { cursos: suggestedCursos } });
            }

            // Mapeamento para Detecção de Conflitos
            if (aula.laboratorioSelecionado && aula.dataInicio?.toDate) {
                const key = `${aula.laboratorioSelecionado}@${dayjs(aula.dataInicio.toDate()).toISOString()}`;
                if (!scheduleMap[key]) {
                    scheduleMap[key] = [];
                }
                scheduleMap[key].push(aula);
            }
        });

        // Identificação de Conflitos
        Object.values(scheduleMap).forEach(aulasNoSlot => {
            if (aulasNoSlot.length > 1) {
                aulasNoSlot.forEach(aula => conflitos.add(aula.id));
            }
        });

        setDadosInvalidos(validationErrors);
        setConflitosHorario(aulas.filter(a => conflitos.has(a.id)));

    }, [aulas]);

    const handleExpandClick = (id) => setExpanded(prev => ({ ...prev, [id]: !prev[id] }));
    const handleEdit = (id) => navigate(`/propor-aula/${id}`);
    const handleDelete = (aula) => { setAulaToDelete(aula); setOpenDeleteDialog(true); };

    const confirmDelete = async () => {
        if (!aulaToDelete) return;
        setLoading(true);
        try {
            await deleteDoc(doc(db, 'aulas', aulaToDelete.id));
            setFeedback({ open: true, message: `Aula "${aulaToDelete.assunto || aulaToDelete.id}" excluída.`, severity: 'success' });
            fetchAulas();
        } catch (error) {
            setFeedback({ open: true, message: `Erro ao excluir: ${error.message}`, severity: 'error' });
        } finally {
            setOpenDeleteDialog(false);
            setAulaToDelete(null);
            setLoading(false);
        }
    };

    const handleQuickEditOpen = (aula) => {
        setAulaParaQuickEdit(aula);
        setQuickEditFields({
            assunto: aula.assunto || '',
            tipoAtividade: aula.tipoAtividade || '',
            cursos: aula.cursos || [],
            laboratorioSelecionado: aula.laboratorioSelecionado || '',
        });
        setOpenQuickEditModal(true);
    };

    const handleQuickEditSave = async () => {
        if (!aulaParaQuickEdit) return;
        setLoading(true);
        try {
            await updateDoc(doc(db, 'aulas', aulaParaQuickEdit.id), quickEditFields);
            setFeedback({ open: true, message: 'Aula corrigida com sucesso!', severity: 'success' });
            fetchAulas();
        } catch (error) {
            setFeedback({ open: true, message: `Erro ao corrigir: ${error.message}`, severity: 'error' });
        } finally {
            setOpenQuickEditModal(false);
            setLoading(false);
        }
    };

    const renderErrorCard = (aula, isConflict = false) => (
        <Card key={aula.id} variant="outlined" sx={{ mb: 2 }}>
            <CardContent>
                <Box display="flex" alignItems="center" mb={1}>
                    <ListItemIcon sx={{ minWidth: 40 }}>
                        {isConflict ? <Groups color="warning" /> : <DataObject color="error" />}
                    </ListItemIcon>
                    <ListItemText
                        primary={aula.assunto || `Aula sem assunto (ID: ${aula.id})`}
                        secondary={`Proponente: ${aula.propostoPorNome || 'Desconhecido'} | Data: ${aula.dataInicio ? dayjs(aula.dataInicio.toDate()).format('DD/MM/YY HH:mm') : 'Inválida'}`}
                    />
                </Box>
                <Divider />
                <Box sx={{ p: 2, bgcolor: 'background.default', borderRadius: 1, mt: 1 }}>
                    <Typography variant="body2" fontWeight="bold">Problemas Encontrados:</Typography>
                    <List dense>
                        {(isConflict ? [`Conflito de horário neste slot com outra(s) aula(s).`] : aula.erros).map((erro, index) => (
                            <ListItem key={index} sx={{ py: 0.2 }}><ListItemText primary={`• ${erro}`} /></ListItem>
                        ))}
                    </List>
                    {!isConflict && aula.sugestoes?.cursos?.length > 0 && (
                        <Button size="small" onClick={() => handleQuickEditOpen(aula)}>Corrigir Cursos Sugeridos</Button>
                    )}
                </Box>
            </CardContent>
            <CardActions sx={{ justifyContent: 'flex-end' }}>
                <Button size="small" startIcon={<Edit />} onClick={() => handleEdit(aula.id)}>Edição Completa</Button>
                <Button size="small" startIcon={<Delete />} color="error" onClick={() => handleDelete(aula)}>Excluir</Button>
            </CardActions>
        </Card>
    );

    return (
        <Container maxWidth="lg">
            <Typography variant="h4" component="h1" gutterBottom align="center" sx={{ my: 4, fontWeight: 'bold' }}>
                Diagnóstico e Integridade de Dados
            </Typography>
            
            {!hasValidated ? (
                <Paper elevation={3} sx={{ p: 4, textAlign: 'center' }}>
                    <BugReport sx={{ fontSize: 60, color: 'primary.main', mb: 2 }} />
                    <Typography variant="h6">Verificar a saúde dos dados do sistema</Typography>
                    <Typography variant="body1" color="text.secondary" sx={{ my: 2 }}>
                        Esta ferramenta analisará todas as aulas em busca de dados faltantes, inconsistências e conflitos de horário.
                    </Typography>
                    <Button variant="contained" size="large" onClick={fetchAulas} disabled={loading}>
                        {loading ? <CircularProgress size={24} /> : "Iniciar Verificação"}
                    </Button>
                </Paper>
            ) : loading ? (
                <Box sx={{ display: 'flex', justifyContent: 'center', my: 5 }}><CircularProgress /></Box>
            ) : (
                <>
                    <Grid container spacing={2} sx={{ mb: 4 }}>
                        <Grid item xs={12} sm={4}><Paper sx={{ p: 2, textAlign: 'center' }}><Typography variant="h6">{aulas.length}</Typography><Typography color="text.secondary">Aulas Verificadas</Typography></Paper></Grid>
                        <Grid item xs={12} sm={4}><Paper sx={{ p: 2, textAlign: 'center', bgcolor: dadosInvalidos.length > 0 ? 'error.light' : 'success.light' }}><Typography variant="h6">{dadosInvalidos.length}</Typography><Typography>Aulas com Dados Inválidos</Typography></Paper></Grid>
                        <Grid item xs={12} sm={4}><Paper sx={{ p: 2, textAlign: 'center', bgcolor: conflitosHorario.length > 0 ? 'warning.light' : 'success.light' }}><Typography variant="h6">{conflitosHorario.length}</Typography><Typography>Aulas em Conflito</Typography></Paper></Grid>
                    </Grid>

                    {dadosInvalidos.length === 0 && conflitosHorario.length === 0 ? (
                        <Alert severity="success" icon={<CheckCircle fontSize="inherit" />}>Nenhum problema encontrado. Todos os dados estão íntegros e sem conflitos.</Alert>
                    ) : (
                        <>
                            {dadosInvalidos.length > 0 && (
                                <Box mb={4}>
                                    <Typography variant="h5" gutterBottom>Aulas com Dados Inválidos ou Faltantes</Typography>
                                    {dadosInvalidos.map(aula => renderErrorCard(aula, false))}
                                </Box>
                            )}
                            {conflitosHorario.length > 0 && (
                                <Box>
                                    <Typography variant="h5" gutterBottom>Aulas com Conflitos de Horário</Typography>
                                    {conflitosHorario.map(aula => renderErrorCard(aula, true))}
                                </Box>
                            )}
                        </>
                    )}
                </>
            )}

            <Dialog open={openDeleteDialog} onClose={() => setOpenDeleteDialog(false)}>
                <DialogTitle>Confirmar Exclusão</DialogTitle>
                <DialogContent><Typography>Tem certeza que deseja excluir a aula "{aulaToDelete?.assunto || 'Sem Assunto'}"? Esta ação não pode ser desfeita.</Typography></DialogContent>
                <DialogActions><Button onClick={() => setOpenDeleteDialog(false)}>Cancelar</Button><Button onClick={confirmDelete} color="error">Excluir</Button></DialogActions>
            </Dialog>

            <Dialog open={openQuickEditModal} onClose={() => setOpenQuickEditModal(false)} maxWidth="sm" fullWidth>
                <DialogTitle>Edição Rápida</DialogTitle>
                <DialogContent dividers>
                    <Grid container spacing={2} sx={{pt: 1}}>
                        <Grid item xs={12}><TextField fullWidth label="Assunto" value={quickEditFields.assunto} onChange={(e) => setQuickEditFields(p => ({...p, assunto: e.target.value}))} /></Grid>
                        <Grid item xs={12}><FormControl fullWidth><InputLabel>Tipo</InputLabel><Select value={quickEditFields.tipoAtividade} label="Tipo" onChange={(e) => setQuickEditFields(p => ({...p, tipoAtividade: e.target.value}))}>{TIPOS_ATIVIDADE_VALIDOS.map(t => <MenuItem key={t} value={t}>{t}</MenuItem>)}</Select></FormControl></Grid>
                        <Grid item xs={12}><FormControl fullWidth><InputLabel>Curso(s)</InputLabel><Select multiple value={quickEditFields.cursos} onChange={(e) => setQuickEditFields(p => ({...p, cursos: e.target.value}))} input={<OutlinedInput label="Curso(s)" />} renderValue={(selected) => (<Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>{selected.map(value => <Chip key={value} label={LISTA_CURSOS.find(c => c.value === value)?.label || value} size="small" />)}</Box>)}>{LISTA_CURSOS.map(c => <MenuItem key={c.value} value={c.value}>{c.label}</MenuItem>)}</Select></FormControl></Grid>
                        <Grid item xs={12}><FormControl fullWidth><InputLabel>Laboratório</InputLabel><Select value={quickEditFields.laboratorioSelecionado} label="Laboratório" onChange={(e) => setQuickEditFields(p => ({...p, laboratorioSelecionado: e.target.value}))}>{LISTA_LABORATORIOS_VALIDOS.map(l => <MenuItem key={l} value={l}>{l}</MenuItem>)}</Select></FormControl></Grid>
                    </Grid>
                </DialogContent>
                <DialogActions><Button onClick={() => setOpenQuickEditModal(false)}>Cancelar</Button><Button onClick={handleQuickEditSave} variant="contained">Salvar Correções</Button></DialogActions>
            </Dialog>

            <Snackbar open={feedback.open} autoHideDuration={6000} onClose={() => setFeedback(p => ({...p, open: false}))}><Alert severity={feedback.severity} sx={{ width: '100%' }}>{feedback.message}</Alert></Snackbar>
        </Container>
    );
}

export default VerificarIntegridadeDados;
