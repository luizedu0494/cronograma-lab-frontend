import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
    Container, Typography, Box, Paper, Grid, CircularProgress,
    List, ListItem, ListItemText, ListItemIcon, Button, Alert,
    IconButton, Dialog, DialogTitle, DialogContent, DialogActions, Snackbar, Divider,
    TextField, FormControl, InputLabel, Select, MenuItem, Chip, OutlinedInput, Card, CardContent, CardActions,
    Checkbox, FormControlLabel, Tooltip, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Stack
} from '@mui/material';
import { db } from '../../firebaseConfig';
import { collection, getDocs, doc, deleteDoc, updateDoc, writeBatch, serverTimestamp, addDoc } from 'firebase/firestore';
import {
    BugReport, CheckCircle, Warning, Delete, Edit, DataObject, Groups,
    FilterList, FileDownload, CleaningServices, HistoryToggleOff, ContentCopy, SelectAll, Refresh
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../AuthContext';
import { LISTA_CURSOS } from '../../constants/cursos';
import { LISTA_LABORATORIOS } from '../../constants/laboratorios';
import dayjs from 'dayjs';
import {
    validarSchemaLegado,
    validarDadosInvalidos,
    detectarDuplicatas,
    detectarVinculosQuebrados,
    exportarRelatorioCSV
} from '../../utils/integridadeUtils';

const LISTA_CURSOS_VALIDOS = LISTA_CURSOS.map(c => c.value);
const LISTA_LABORATORIOS_VALIDOS = LISTA_LABORATORIOS.map(l => l.name);
const TIPOS_ATIVIDADE_VALIDOS = ['aula', 'revisao'];

function VerificarIntegridadeDados() {
    const { currentUser } = useAuth() || {};
    const navigate = useNavigate();

    // Dados principais
    const [loading, setLoading] = useState(false);
    const [aulas, setAulas] = useState([]);
    const [periodos, setPeriodos] = useState([]);
    const [usuariosMap, setUsuariosMap] = useState({});
    const [hasValidated, setHasValidated] = useState(false);

    // Listas categorizadas
    const [dadosInvalidos, setDadosInvalidos] = useState([]);
    const [dadosLegados, setDadosLegados] = useState([]);
    const [conflitosHorario, setConflitosHorario] = useState([]);
    const [duplicatas, setDuplicatas] = useState([]);
    const [vinculosQuebrados, setVinculosQuebrados] = useState([]);

    // Filtros
    const [filtroLaboratorio, setFiltroLaboratorio] = useState('');
    const [filtroCurso, setFiltroCurso] = useState('');
    const [filtroTipo, setFiltroTipo] = useState('');
    const [filtroCategoria, setFiltroCategoria] = useState('todas');
    const [buscaTexto, setBuscaTexto] = useState('');

    // Seleção em massa
    const [selectedIds, setSelectedIds] = useState(new Set());

    // Modais
    const [openDeleteDialog, setOpenDeleteDialog] = useState(false);
    const [aulaToDelete, setAulaToDelete] = useState(null);

    const [openDryRunModal, setOpenDryRunModal] = useState(false);
    const [deletingBatch, setDeletingBatch] = useState(false);

    const [openJsonModal, setOpenJsonModal] = useState(false);
    const [aulaParaJson, setAulaParaJson] = useState(null);

    const [openQuickEditModal, setOpenQuickEditModal] = useState(false);
    const [aulaParaQuickEdit, setAulaParaQuickEdit] = useState(null);
    const [quickEditFields, setQuickEditFields] = useState({ assunto: '', tipoAtividade: '', cursos: [], laboratorioSelecionado: '' });

    // Feedback
    const [feedback, setFeedback] = useState({ open: false, message: '', severity: 'success' });

    // Buscar dados do Firestore
    const fetchAulasEContexto = useCallback(async () => {
        setLoading(true);
        setHasValidated(true);
        setSelectedIds(new Set());

        try {
            // 1. Buscar Aulas
            const aulasSnapshot = await getDocs(collection(db, "aulas"));
            const listaAulas = aulasSnapshot.docs.map(d => ({ id: d.id, ...d.data() }));
            setAulas(listaAulas);

            // 2. Buscar Períodos (para verificação de schema legado fora de semestre)
            try {
                const periodosSnap = await getDocs(collection(db, "periodosSemAtividade"));
                setPeriodos(periodosSnap.docs.map(d => ({ id: d.id, ...d.data() })));
            } catch (pErr) {
                console.warn("Períodos não encontrados ou erro ao ler periodosSemAtividade:", pErr);
            }

            // 3. Buscar Usuários para checar vínculos quebrados
            try {
                const usuariosSnap = await getDocs(collection(db, "usuarios"));
                const mapU = {};
                usuariosSnap.docs.forEach(uDoc => {
                    mapU[uDoc.id] = { id: uDoc.id, ...uDoc.data() };
                });
                setUsuariosMap(mapU);
            } catch (uErr) {
                console.warn("Não foi possível carregar a lista de usuários para checagem de vínculos:", uErr);
            }

        } catch (err) {
            console.error("Erro ao buscar aulas:", err);
            setFeedback({ open: true, message: "Erro ao buscar aulas para verificação.", severity: 'error' });
        } finally {
            setLoading(false);
        }
    }, []);

    // Processamento das regras de integridade
    useEffect(() => {
        if (aulas.length === 0) {
            setDadosInvalidos([]);
            setDadosLegados([]);
            setConflitosHorario([]);
            setDuplicatas([]);
            setVinculosQuebrados([]);
            return;
        }

        const invalidosList = [];
        const legadosList = [];
        const vinculosList = [];
        const scheduleMap = {};
        const conflitoIds = new Set();

        // 1. Identificar Duplicatas
        const duplicatasIdsSet = detectarDuplicatas(aulas);

        aulas.forEach(aula => {
            // Check Schema Legado / Órfão
            const errosLegado = validarSchemaLegado(aula, periodos);
            if (errosLegado.length > 0) {
                legadosList.push({
                    ...aula,
                    erros: errosLegado,
                    categoria: 'Schema Legado / Órfão'
                });
            }

            // Check Dados Inválidos
            const resInvalidos = validarDadosInvalidos(aula);
            if (resInvalidos.erros.length > 0) {
                invalidosList.push({
                    ...aula,
                    erros: resInvalidos.erros,
                    sugestoes: resInvalidos.sugestoes,
                    categoria: 'Dados Inválidos'
                });
            }

            // Check Vínculos Quebrados
            const errosVinculo = detectarVinculosQuebrados(aula, usuariosMap);
            if (errosVinculo.length > 0) {
                vinculosList.push({
                    ...aula,
                    erros: errosVinculo,
                    categoria: 'Vínculo Quebrado'
                });
            }

            // Conflitos de horário
            const labKey = aula.laboratorioSelecionado || aula.laboratorio;
            if (labKey && aula.dataInicio?.toDate) {
                const key = `${labKey}@${dayjs(aula.dataInicio.toDate()).toISOString()}`;
                if (!scheduleMap[key]) scheduleMap[key] = [];
                scheduleMap[key].push(aula);
            }
        });

        // Agrupar conflitos
        Object.values(scheduleMap).forEach(slot => {
            if (slot.length > 1) {
                slot.forEach(a => conflitoIds.add(a.id));
            }
        });

        const conflitosList = aulas
            .filter(a => conflitoIds.has(a.id))
            .map(a => ({
                ...a,
                erros: ['Conflito de horário com outro agendamento no mesmo slot.'],
                categoria: 'Conflito de Horário'
            }));

        const duplicatasList = aulas
            .filter(a => duplicatasIdsSet.has(a.id))
            .map(a => ({
                ...a,
                erros: ['Documento duplicado (mesmo laboratório, data e assunto).'],
                categoria: 'Duplicata'
            }));

        setDadosInvalidos(invalidosList);
        setDadosLegados(legadosList);
        setConflitosHorario(conflitosList);
        setDuplicatas(duplicatasList);
        setVinculosQuebrados(vinculosList);

    }, [aulas, periodos, usuariosMap]);

    // Combinação de todas as falhas encontradas (com deduplicação de cards por id e agregação de categorias)
    const todosProblemas = useMemo(() => {
        const mapProblemas = new Map();

        const adicionar = (lista) => {
            lista.forEach(item => {
                if (!mapProblemas.has(item.id)) {
                    mapProblemas.set(item.id, { ...item, categorias: [item.categoria] });
                } else {
                    const existente = mapProblemas.get(item.id);
                    if (!existente.categorias.includes(item.categoria)) {
                        existente.categorias.push(item.categoria);
                    }
                    existente.erros = Array.from(new Set([...existente.erros, ...item.erros]));
                }
            });
        };

        adicionar(dadosInvalidos);
        adicionar(dadosLegados);
        adicionar(conflitosHorario);
        adicionar(duplicatas);
        adicionar(vinculosQuebrados);

        return Array.from(mapProblemas.values());
    }, [dadosInvalidos, dadosLegados, conflitosHorario, duplicatas, vinculosQuebrados]);

    // Aplicar Filtros client-side
    const problemasFiltrados = useMemo(() => {
        return todosProblemas.filter(item => {
            const lab = item.laboratorioSelecionado || item.laboratorio || '';
            const titulo = item.assunto || item.disciplina || '';
            const idDoc = item.id || '';
            const proponente = item.propostoPorNome || item.propostoPor || '';

            if (filtroLaboratorio && lab !== filtroLaboratorio) return false;
            if (filtroCurso && (!item.cursos || !item.cursos.includes(filtroCurso))) return false;
            if (filtroTipo && item.tipoAtividade !== filtroTipo) return false;

            if (filtroCategoria !== 'todas') {
                if (filtroCategoria === 'invalidos' && !item.categorias.includes('Dados Inválidos')) return false;
                if (filtroCategoria === 'legados' && !item.categorias.includes('Schema Legado / Órfão')) return false;
                if (filtroCategoria === 'conflitos' && !item.categorias.includes('Conflito de Horário')) return false;
                if (filtroCategoria === 'duplicatas' && !item.categorias.includes('Duplicata')) return false;
                if (filtroCategoria === 'vinculos' && !item.categorias.includes('Vínculo Quebrado')) return false;
            }

            if (buscaTexto.trim()) {
                const termo = buscaTexto.toLowerCase();
                const matchAssunto = titulo.toLowerCase().includes(termo);
                const matchId = idDoc.toLowerCase().includes(termo);
                const matchProp = proponente.toLowerCase().includes(termo);
                if (!matchAssunto && !matchId && !matchProp) return false;
            }

            return true;
        });
    }, [todosProblemas, filtroLaboratorio, filtroCurso, filtroTipo, filtroCategoria, buscaTexto]);

    // Gestão da Seleção Múltipla
    const handleToggleSelect = (id) => {
        setSelectedIds(prev => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
        });
    };

    const handleSelectAllFiltered = () => {
        const todosIdsFiltrados = problemasFiltrados.map(p => p.id);
        const jaTodosSelecionados = todosIdsFiltrados.every(id => selectedIds.has(id));

        if (jaTodosSelecionados) {
            setSelectedIds(prev => {
                const next = new Set(prev);
                todosIdsFiltrados.forEach(id => next.delete(id));
                return next;
            });
        } else {
            setSelectedIds(prev => {
                const next = new Set(prev);
                todosIdsFiltrados.forEach(id => next.add(id));
                return next;
            });
        }
    };

    // Ações de Exclusão Individual
    const handleEdit = (id) => navigate(`/propor-aula/${id}`);
    const handleDeleteSingle = (aula) => { setAulaToDelete(aula); setOpenDeleteDialog(true); };

    const confirmDeleteSingle = async () => {
        if (!aulaToDelete) return;
        setLoading(true);
        try {
            await deleteDoc(doc(db, 'aulas', aulaToDelete.id));

            // Log de Auditoria
            await addDoc(collection(db, 'logs_integridade_exclusoes'), {
                timestamp: serverTimestamp(),
                executadoPorUid: currentUser?.uid || 'desconhecido',
                executadoPorEmail: currentUser?.email || 'desconhecido',
                quantidadeExcluidos: 1,
                itensExcluidos: [{ id: aulaToDelete.id, ...aulaToDelete }]
            });

            setFeedback({ open: true, message: `Aula "${aulaToDelete.assunto || aulaToDelete.id}" excluída com sucesso.`, severity: 'success' });
            fetchAulasEContexto();
        } catch (error) {
            setFeedback({ open: true, message: `Erro ao excluir: ${error.message}`, severity: 'error' });
        } finally {
            setOpenDeleteDialog(false);
            setAulaToDelete(null);
            setLoading(false);
        }
    };

    // Exclusão em Massa com Dry-Run e batching de 500 itens
    const confirmMassDelete = async () => {
        const idsParaDeletar = Array.from(selectedIds);
        if (idsParaDeletar.length === 0) return;

        setDeletingBatch(true);
        try {
            const itemsParaDeletar = todosProblemas.filter(p => selectedIds.has(p.id));

            // Firestore Batch tem limite de 500 operações por batch
            const CHUNK_SIZE = 450;
            for (let i = 0; i < idsParaDeletar.length; i += CHUNK_SIZE) {
                const chunk = idsParaDeletar.slice(i, i + CHUNK_SIZE);
                const batch = writeBatch(db);
                chunk.forEach(id => {
                    batch.delete(doc(db, 'aulas', id));
                });
                await batch.commit();
            }

            // Registrar Log de Auditoria no Firestore
            await addDoc(collection(db, 'logs_integridade_exclusoes'), {
                timestamp: serverTimestamp(),
                executadoPorUid: currentUser?.uid || 'desconhecido',
                executadoPorEmail: currentUser?.email || 'desconhecido',
                quantidadeExcluidos: itemsParaDeletar.length,
                itensExcluidos: itemsParaDeletar.map(item => ({
                    id: item.id,
                    assunto: item.assunto || item.disciplina || 'Sem Assunto',
                    laboratorio: item.laboratorioSelecionado || item.laboratorio || 'N/A',
                    categorias: item.categorias,
                    erros: item.erros
                }))
            });

            setFeedback({
                open: true,
                message: `${idsParaDeletar.length} registros excluídos com sucesso e registrados na auditoria.`,
                severity: 'success'
            });

            setOpenDryRunModal(false);
            fetchAulasEContexto();
        } catch (error) {
            console.error("Erro na exclusão em massa:", error);
            setFeedback({ open: true, message: `Erro na exclusão em massa: ${error.message}`, severity: 'error' });
        } finally {
            setDeletingBatch(false);
        }
    };

    // Modal de Edição Rápida
    const handleQuickEditOpen = (aula) => {
        setAulaParaQuickEdit(aula);
        setQuickEditFields({
            assunto: aula.assunto || aula.disciplina || '',
            tipoAtividade: aula.tipoAtividade || 'aula',
            cursos: aula.cursos || [],
            laboratorioSelecionado: aula.laboratorioSelecionado || aula.laboratorio || '',
        });
        setOpenQuickEditModal(true);
    };

    const handleQuickEditSave = async () => {
        if (!aulaParaQuickEdit) return;
        setLoading(true);
        try {
            await updateDoc(doc(db, 'aulas', aulaParaQuickEdit.id), {
                ...quickEditFields,
                // Garantir padronização dos campos novos
                laboratorio: quickEditFields.laboratorioSelecionado,
                status: aulaParaQuickEdit.status || 'agendada'
            });
            setFeedback({ open: true, message: 'Aula atualizada e padronizada com sucesso!', severity: 'success' });
            fetchAulasEContexto();
        } catch (error) {
            setFeedback({ open: true, message: `Erro ao corrigir: ${error.message}`, severity: 'error' });
        } finally {
            setOpenQuickEditModal(false);
            setLoading(false);
        }
    };

    // Modal de Inspeção JSON
    const handleOpenJsonModal = (aula) => {
        setAulaParaJson(aula);
        setOpenJsonModal(true);
    };

    // Exportar CSV
    const handleExportarRelatorio = () => {
        const itensParaExportar = selectedIds.size > 0
            ? problemasFiltrados.filter(p => selectedIds.has(p.id))
            : problemasFiltrados;
        exportarRelatorioCSV(itensParaExportar, `relatorio_integridade_${dayjs().format('YYYY-MM-DD_HHmm')}.csv`);
    };

    // Renderização dos cards de diagnóstico
    const renderCardProblema = (item) => {
        const isSelected = selectedIds.has(item.id);

        return (
            <Card
                key={item.id}
                variant="outlined"
                sx={{
                    mb: 2,
                    borderColor: isSelected ? 'primary.main' : 'divider',
                    borderWidth: isSelected ? 2 : 1,
                    bgcolor: isSelected ? 'action.hover' : 'background.paper',
                    transition: 'all 0.2s'
                }}
            >
                <CardContent>
                    <Box display="flex" alignItems="flex-start" gap={1}>
                        <Checkbox
                            checked={isSelected}
                            onChange={() => handleToggleSelect(item.id)}
                            color="primary"
                            sx={{ mt: 0.5 }}
                        />
                        <Box flexGrow={1}>
                            <Box display="flex" justifyContent="space-between" alignItems="center" flexWrap="wrap" gap={1}>
                                <Typography variant="h6" component="span" fontWeight="bold">
                                    {item.assunto || item.disciplina || `Aula Sem Título (ID: ${item.id})`}
                                </Typography>

                                <Stack direction="row" spacing={0.5} flexWrap="wrap">
                                    {item.categorias.map(cat => {
                                        let color = "default";
                                        let icon = <Warning fontSize="small" />;

                                        if (cat === 'Schema Legado / Órfão') { color = "warning"; icon = <HistoryToggleOff fontSize="small" />; }
                                        else if (cat === 'Dados Inválidos') { color = "error"; icon = <DataObject fontSize="small" />; }
                                        else if (cat === 'Conflito de Horário') { color = "secondary"; icon = <Groups fontSize="small" />; }
                                        else if (cat === 'Duplicata') { color = "info"; icon = <CompareArrows fontSize="small" />; }
                                        else if (cat === 'Vínculo Quebrado') { color = "error"; icon = <PersonOff fontSize="small" />; }

                                        return <Chip key={cat} size="small" icon={icon} label={cat} color={color} variant="outlined" />;
                                    })}
                                </Stack>
                            </Box>

                            <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                                ID: <code>{item.id}</code> | Lab: <strong>{item.laboratorioSelecionado || item.laboratorio || 'Não especificado'}</strong> |
                                Data: <strong>{item.dataInicio?.toDate ? dayjs(item.dataInicio.toDate()).format('DD/MM/YYYY HH:mm') : (item.data || 'Inválida/Ausente')}</strong> |
                                Proponente: <strong>{item.propostoPorNome || item.propostoPor || 'Desconhecido'}</strong>
                            </Typography>
                        </Box>
                    </Box>

                    <Divider sx={{ my: 1.5 }} />

                    <Box sx={{ p: 1.5, bgcolor: 'action.hover', borderRadius: 1 }}>
                        <Typography variant="caption" fontWeight="bold" color="text.secondary">
                            INCONSISTÊNCIAS DETECTADAS:
                        </Typography>
                        <List dense disablePadding sx={{ mt: 0.5 }}>
                            {item.erros.map((erro, index) => (
                                <ListItem key={index} sx={{ py: 0.1, px: 0 }}>
                                    <ListItemText
                                        primary={`• ${erro}`}
                                        primaryTypographyProps={{ variant: 'body2', color: 'error.main' }}
                                    />
                                </ListItem>
                            ))}
                        </List>
                        {item.sugestoes?.cursos?.length > 0 && (
                            <Button size="small" sx={{ mt: 1 }} onClick={() => handleQuickEditOpen(item)}>
                                Corrigir Cursos Sugeridos ({item.sugestoes.cursos.join(', ')})
                            </Button>
                        )}
                    </Box>
                </CardContent>

                <CardActions sx={{ justifyContent: 'flex-end', bgcolor: 'background.default', px: 2, py: 1 }}>
                    <Button size="small" startIcon={<DataObject />} onClick={() => handleOpenJsonModal(item)}>
                        Ver JSON Bruto
                    </Button>
                    <Button size="small" startIcon={<CleaningServices />} color="info" onClick={() => handleQuickEditOpen(item)}>
                        Edição Rápida
                    </Button>
                    <Button size="small" startIcon={<Edit />} onClick={() => handleEdit(item.id)}>
                        Edição Completa
                    </Button>
                    <Button size="small" startIcon={<Delete />} color="error" onClick={() => handleDeleteSingle(item)}>
                        Excluir
                    </Button>
                </CardActions>
            </Card>
        );
    };

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
                        Esta ferramenta analisa toda a coleção de aulas em busca de schemas legados/órfãos, dados inválidos, conflitos de horário, duplicatas e vínculos quebrados.
                    </Typography>
                    <Button variant="contained" size="large" startIcon={<Refresh />} onClick={fetchAulasEContexto} disabled={loading}>
                        {loading ? <CircularProgress size={24} /> : "Iniciar Verificação Completa"}
                    </Button>
                </Paper>
            ) : loading ? (
                <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', my: 5, gap: 2 }}>
                    <CircularProgress />
                    <Typography variant="body2" color="text.secondary">Carregando e analisando dados de integridade...</Typography>
                </Box>
            ) : (
                <>
                    {/* Dashboard de Métricas */}
                    <Grid container spacing={2} sx={{ mb: 3 }}>
                        <Grid item xs={6} sm={4} md={2}>
                            <Paper sx={{ p: 2, textAlign: 'center' }}>
                                <Typography variant="h5" fontWeight="bold">{aulas.length}</Typography>
                                <Typography variant="caption" color="text.secondary">Total Analisado</Typography>
                            </Paper>
                        </Grid>
                        <Grid item xs={6} sm={4} md={2}>
                            <Paper sx={{ p: 2, textAlign: 'center', bgcolor: dadosInvalidos.length > 0 ? 'error.light' : 'success.light' }}>
                                <Typography variant="h5" fontWeight="bold">{dadosInvalidos.length}</Typography>
                                <Typography variant="caption">Dados Inválidos</Typography>
                            </Paper>
                        </Grid>
                        <Grid item xs={6} sm={4} md={2}>
                            <Paper sx={{ p: 2, textAlign: 'center', bgcolor: dadosLegados.length > 0 ? 'warning.light' : 'success.light' }}>
                                <Typography variant="h5" fontWeight="bold">{dadosLegados.length}</Typography>
                                <Typography variant="caption">Schemas Legados</Typography>
                            </Paper>
                        </Grid>
                        <Grid item xs={6} sm={4} md={2}>
                            <Paper sx={{ p: 2, textAlign: 'center', bgcolor: conflitosHorario.length > 0 ? 'secondary.light' : 'success.light' }}>
                                <Typography variant="h5" fontWeight="bold">{conflitosHorario.length}</Typography>
                                <Typography variant="caption">Conflitos Horário</Typography>
                            </Paper>
                        </Grid>
                        <Grid item xs={6} sm={4} md={2}>
                            <Paper sx={{ p: 2, textAlign: 'center', bgcolor: duplicatas.length > 0 ? 'info.light' : 'success.light' }}>
                                <Typography variant="h5" fontWeight="bold">{duplicatas.length}</Typography>
                                <Typography variant="caption">Duplicatas</Typography>
                            </Paper>
                        </Grid>
                        <Grid item xs={6} sm={4} md={2}>
                            <Paper sx={{ p: 2, textAlign: 'center', bgcolor: vinculosQuebrados.length > 0 ? 'error.light' : 'success.light' }}>
                                <Typography variant="h5" fontWeight="bold">{vinculosQuebrados.length}</Typography>
                                <Typography variant="caption">Vínculos Quebrados</Typography>
                            </Paper>
                        </Grid>
                    </Grid>

                    {/* Barra de Filtros */}
                    <Paper sx={{ p: 2, mb: 3 }}>
                        <Box display="flex" alignItems="center" gap={1} mb={2}>
                            <FilterList color="primary" />
                            <Typography variant="h6">Filtros e Pesquisa</Typography>
                        </Box>
                        <Grid container spacing={2}>
                            <Grid item xs={12} sm={6} md={3}>
                                <FormControl fullWidth size="small">
                                    <InputLabel>Categoria de Problema</InputLabel>
                                    <Select value={filtroCategoria} label="Categoria de Problema" onChange={(e) => setFiltroCategoria(e.target.value)}>
                                        <MenuItem value="todas">Todas as Categorias ({todosProblemas.length})</MenuItem>
                                        <MenuItem value="invalidos">Dados Inválidos ({dadosInvalidos.length})</MenuItem>
                                        <MenuItem value="legados">Schema Legado / Órfãos ({dadosLegados.length})</MenuItem>
                                        <MenuItem value="conflitos">Conflitos de Horário ({conflitosHorario.length})</MenuItem>
                                        <MenuItem value="duplicatas">Duplicatas ({duplicatas.length})</MenuItem>
                                        <MenuItem value="vinculos">Vínculos Quebrados ({vinculosQuebrados.length})</MenuItem>
                                    </Select>
                                </FormControl>
                            </Grid>
                            <Grid item xs={12} sm={6} md={3}>
                                <FormControl fullWidth size="small">
                                    <InputLabel>Laboratório</InputLabel>
                                    <Select value={filtroLaboratorio} label="Laboratório" onChange={(e) => setFiltroLaboratorio(e.target.value)}>
                                        <MenuItem value="">Todos os Laboratórios</MenuItem>
                                        {LISTA_LABORATORIOS_VALIDOS.map(lab => (
                                            <MenuItem key={lab} value={lab}>{lab}</MenuItem>
                                        ))}
                                    </Select>
                                </FormControl>
                            </Grid>
                            <Grid item xs={12} sm={6} md={3}>
                                <FormControl fullWidth size="small">
                                    <InputLabel>Curso</InputLabel>
                                    <Select value={filtroCurso} label="Curso" onChange={(e) => setFiltroCurso(e.target.value)}>
                                        <MenuItem value="">Todos os Cursos</MenuItem>
                                        {LISTA_CURSOS.map(c => (
                                            <MenuItem key={c.value} value={c.value}>{c.label}</MenuItem>
                                        ))}
                                    </Select>
                                </FormControl>
                            </Grid>
                            <Grid item xs={12} sm={6} md={3}>
                                <TextField
                                    fullWidth
                                    size="small"
                                    label="Buscar por Assunto, ID ou Proponente"
                                    value={buscaTexto}
                                    onChange={(e) => setBuscaTexto(e.target.value)}
                                />
                            </Grid>
                        </Grid>
                    </Paper>

                    {/* Barra de Ações em Massa */}
                    <Box display="flex" justifyContent="space-between" alignItems="center" flexWrap="wrap" gap={2} mb={2}>
                        <Box display="flex" alignItems="center" gap={1}>
                            <Button
                                variant="outlined"
                                startIcon={<SelectAll />}
                                onClick={handleSelectAllFiltered}
                                size="small"
                            >
                                {problemasFiltrados.every(p => selectedIds.has(p.id)) && problemasFiltrados.length > 0
                                    ? "Desmarcar Todos Visíveis"
                                    : "Marcar Todos Visíveis"}
                            </Button>
                            <Typography variant="body2" color="text.secondary">
                                {selectedIds.size} de {problemasFiltrados.length} selecionados
                            </Typography>
                        </Box>

                        <Stack direction="row" spacing={1}>
                            <Button
                                variant="contained"
                                color="error"
                                startIcon={<Delete />}
                                disabled={selectedIds.size === 0}
                                onClick={() => setOpenDryRunModal(true)}
                            >
                                Excluir Selecionados ({selectedIds.size})
                            </Button>
                            <Button
                                variant="outlined"
                                startIcon={<FileDownload />}
                                onClick={handleExportarRelatorio}
                            >
                                Exportar CSV
                            </Button>
                            <Button
                                variant="outlined"
                                startIcon={<Refresh />}
                                onClick={fetchAulasEContexto}
                            >
                                Re-analisar
                            </Button>
                        </Stack>
                    </Box>

                    {/* Lista de Resultados */}
                    {problemasFiltrados.length === 0 ? (
                        <Alert severity="success" icon={<CheckCircle fontSize="inherit" />} sx={{ my: 3 }}>
                            Nenhum problema encontrado para os filtros selecionados. Os dados estão íntegros!
                        </Alert>
                    ) : (
                        <Box>
                            {problemasFiltrados.map(item => renderCardProblema(item))}
                        </Box>
                    )}
                </>
            )}

            {/* Modal de confirmação Dry-Run para exclusão em massa */}
            <Dialog open={openDryRunModal} onClose={() => setOpenDryRunModal(false)} maxWidth="md" fullWidth>
                <DialogTitle sx={{ color: 'error.main', fontWeight: 'bold' }}>
                    Revisão de Exclusão em Massa (Dry-Run)
                </DialogTitle>
                <DialogContent dividers>
                    <Alert severity="warning" sx={{ mb: 2 }}>
                        Você está prestes a excluir permanentemente <strong>{selectedIds.size}</strong> registros de aulas do banco de dados.
                        Esta ação utilizará lote atômico (`writeBatch`) e será registrada no histórico de auditoria (`logs_integridade_exclusoes`).
                    </Alert>

                    <Typography variant="subtitle2" gutterBottom>Itens selecionados para exclusão:</Typography>
                    <TableContainer component={Paper} variant="outlined" sx={{ maxHeight: 300 }}>
                        <Table size="small" stickyHeader>
                            <TableHead>
                                <TableRow>
                                    <TableCell>ID</TableCell>
                                    <TableCell>Assunto / Disciplina</TableCell>
                                    <TableCell>Laboratório</TableCell>
                                    <TableCell>Categorias</TableCell>
                                </TableRow>
                            </TableHead>
                            <TableBody>
                                {todosProblemas.filter(p => selectedIds.has(p.id)).map(p => (
                                    <TableRow key={p.id}>
                                        <TableCell><code>{p.id}</code></TableCell>
                                        <TableCell>{p.assunto || p.disciplina || 'Sem Assunto'}</TableCell>
                                        <TableCell>{p.laboratorioSelecionado || p.laboratorio || 'N/A'}</TableCell>
                                        <TableCell>{p.categorias.join(', ')}</TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </TableContainer>
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setOpenDryRunModal(false)} disabled={deletingBatch}>Cancelar</Button>
                    <Button
                        onClick={confirmMassDelete}
                        color="error"
                        variant="contained"
                        disabled={deletingBatch}
                        startIcon={deletingBatch ? <CircularProgress size={20} color="inherit" /> : <Delete />}
                    >
                        {deletingBatch ? "Excluindo em Lote..." : `Confirmar Exclusão Definitiva (${selectedIds.size})`}
                    </Button>
                </DialogActions>
            </Dialog>

            {/* Modal de Exclusão Individual */}
            <Dialog open={openDeleteDialog} onClose={() => setOpenDeleteDialog(false)}>
                <DialogTitle>Confirmar Exclusão de Aula</DialogTitle>
                <DialogContent>
                    <Typography>
                        Tem certeza que deseja excluir permanentemente a aula "{aulaToDelete?.assunto || aulaToDelete?.disciplina || aulaToDelete?.id}"?
                    </Typography>
                    <Typography variant="caption" color="text.secondary" display="block" sx={{ mt: 1 }}>
                        Esta ação será registrada nos logs de auditoria de integridade.
                    </Typography>
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setOpenDeleteDialog(false)}>Cancelar</Button>
                    <Button onClick={confirmDeleteSingle} color="error" variant="contained">Excluir</Button>
                </DialogActions>
            </Dialog>

            {/* Modal de Inspeção JSON */}
            <Dialog open={openJsonModal} onClose={() => setOpenJsonModal(false)} maxWidth="sm" fullWidth>
                <DialogTitle display="flex" justifyContent="space-between" alignItems="center">
                    <span>Inspeção JSON Bruto — Documento Firestore</span>
                    <IconButton
                        size="small"
                        onClick={() => {
                            navigator.clipboard.writeText(JSON.stringify(aulaParaJson, null, 2));
                            setFeedback({ open: true, message: 'JSON copiado para a área de transferência!', severity: 'info' });
                        }}
                    >
                        <Tooltip title="Copiar JSON"><ContentCopy /></Tooltip>
                    </IconButton>
                </DialogTitle>
                <DialogContent dividers>
                    <Paper variant="outlined" sx={{ p: 2, bgcolor: '#1e1e1e', color: '#00ff66', fontFamily: 'monospace', fontSize: '0.85rem', overflowX: 'auto' }}>
                        <pre style={{ margin: 0 }}>
                            {JSON.stringify(aulaParaJson, null, 2)}
                        </pre>
                    </Paper>
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setOpenJsonModal(false)}>Fechar</Button>
                </DialogActions>
            </Dialog>

            {/* Modal de Edição Rápida */}
            <Dialog open={openQuickEditModal} onClose={() => setOpenQuickEditModal(false)} maxWidth="sm" fullWidth>
                <DialogTitle>Edição Rápida e Padronização de Schema</DialogTitle>
                <DialogContent dividers>
                    <Grid container spacing={2} sx={{ pt: 1 }}>
                        <Grid item xs={12}>
                            <TextField
                                fullWidth
                                label="Assunto da Aula"
                                value={quickEditFields.assunto}
                                onChange={(e) => setQuickEditFields(p => ({ ...p, assunto: e.target.value }))}
                            />
                        </Grid>
                        <Grid item xs={12}>
                            <FormControl fullWidth>
                                <InputLabel shrink>Tipo de Atividade</InputLabel>
                                <Select
                                    value={quickEditFields.tipoAtividade}
                                    label="Tipo de Atividade"
                                    onChange={(e) => setQuickEditFields(p => ({ ...p, tipoAtividade: e.target.value }))}
                                >
                                    {TIPOS_ATIVIDADE_VALIDOS.map(t => <MenuItem key={t} value={t}>{t}</MenuItem>)}
                                </Select>
                            </FormControl>
                        </Grid>
                        <Grid item xs={12}>
                            <FormControl fullWidth>
                                <InputLabel shrink>Curso(s)</InputLabel>
                                <Select
                                    multiple
                                    value={quickEditFields.cursos}
                                    onChange={(e) => setQuickEditFields(p => ({ ...p, cursos: e.target.value }))}
                                    input={<OutlinedInput notched label="Curso(s)" />}
                                    renderValue={(selected) => (
                                        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                                            {selected.map((val) => (
                                                <Chip key={val} label={LISTA_CURSOS.find(c => c.value === val)?.label || val} size="small" />
                                            ))}
                                        </Box>
                                    )}
                                >
                                    {LISTA_CURSOS.map(c => <MenuItem key={c.value} value={c.value}>{c.label}</MenuItem>)}
                                </Select>
                            </FormControl>
                        </Grid>
                        <Grid item xs={12}>
                            <FormControl fullWidth>
                                <InputLabel shrink>Laboratório Selecionado</InputLabel>
                                <Select
                                    value={quickEditFields.laboratorioSelecionado}
                                    label="Laboratório Selecionado"
                                    onChange={(e) => setQuickEditFields(p => ({ ...p, laboratorioSelecionado: e.target.value }))}
                                >
                                    {LISTA_LABORATORIOS_VALIDOS.map(l => <MenuItem key={l} value={l}>{l}</MenuItem>)}
                                </Select>
                            </FormControl>
                        </Grid>
                    </Grid>
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setOpenQuickEditModal(false)}>Cancelar</Button>
                    <Button onClick={handleQuickEditSave} variant="contained">Salvar e Padronizar</Button>
                </DialogActions>
            </Dialog>

            {/* Snackbar de Feedback */}
            <Snackbar
                open={feedback.open}
                autoHideDuration={6000}
                onClose={() => setFeedback(p => ({ ...p, open: false }))}
            >
                <Alert severity={feedback.severity} sx={{ width: '100%' }}>{feedback.message}</Alert>
            </Snackbar>
        </Container>
    );
}

export default VerificarIntegridadeDados;
