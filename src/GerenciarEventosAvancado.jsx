import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { db } from './firebaseConfig';
import EmptyState from './components/EmptyState';
import DialogConfirmacao from './components/DialogConfirmacao';
import {
  collection, query, where, getDocs, doc, deleteDoc, Timestamp, orderBy,
  updateDoc, writeBatch, limit, startAfter, addDoc, serverTimestamp
} from 'firebase/firestore';
import {
  Button, Container, Paper, Typography, Box, CircularProgress, Alert, Snackbar,
  FormControl, InputLabel, Select, MenuItem, TextField, Grid, OutlinedInput,
  Chip, Checkbox, ListItem, ListItemText, List, Tooltip, IconButton,
  Dialog, DialogTitle, DialogContent, DialogActions, FormHelperText, Divider
} from '@mui/material';
import { LocalizationProvider, DatePicker } from '@mui/x-date-pickers';
import { AdapterDayjs } from '@mui/x-date-pickers/AdapterDayjs';
import dayjs from 'dayjs';
import 'dayjs/locale/pt-br';
import DeleteIcon from '@mui/icons-material/Delete';
import EditIcon from '@mui/icons-material/Edit';
import ClearIcon from '@mui/icons-material/Clear';
import AddIcon from '@mui/icons-material/Add';
import CalendarTodayIcon from '@mui/icons-material/CalendarToday';
import { LISTA_LABORATORIOS, TIPOS_LABORATORIO } from './constants/laboratorios';
import { registrarLogEvento } from './services/loggerService';
import { notificadorTelegram } from './services/NotificadorTelegram';

dayjs.locale('pt-br');

const EVENT_TYPES = ['Manutenção', 'Feriado', 'Evento', 'Giro', 'Outro'];
const STATUS_EVENTO = ['aprovado', 'pendente', 'cancelado'];
const TELEGRAM_CHAT_ID = import.meta.env.VITE_TELEGRAM_CHAT_ID;

const BLOCOS_HORARIO = [
  { value: "07:00-09:10", label: "07:00 - 09:10", turno: "Matutino" },
  { value: "09:30-12:00", label: "09:30 - 12:00", turno: "Matutino" },
  { value: "13:00-15:10", label: "13:00 - 15:10", turno: "Vespertino" },
  { value: "15:30-18:00", label: "15:30 - 18:00", turno: "Vespertino" },
  { value: "18:30-20:10", label: "18:30 - 20:10", turno: "Noturno" },
  { value: "20:30-22:00", label: "20:30 - 22:00", turno: "Noturno" },
];

const ResultadosBuscaEventos = ({ eventos, selectedEventos, onToggleSelectAll, onToggleSelectEvento, onEditEvento }) => (
  <List>
    <ListItem divider sx={{ backgroundColor: 'action.hover' }}>
      <Checkbox
        edge="start"
        onChange={onToggleSelectAll}
        checked={eventos.length > 0 && selectedEventos.length === eventos.length}
        indeterminate={selectedEventos.length > 0 && selectedEventos.length < eventos.length}
      />
      <ListItemText primary="Selecionar Todos" primaryTypographyProps={{ fontWeight: 'bold' }} />
    </ListItem>
    {eventos.map((evento) => (
      <ListItem
        key={evento.id}
        divider
        secondaryAction={
          <IconButton edge="end" aria-label="edit" onClick={(e) => { e.stopPropagation(); onEditEvento(evento); }}>
            <EditIcon />
          </IconButton>
        }
      >
        <Checkbox
          edge="start"
          checked={selectedEventos.includes(evento.id)}
          onChange={() => onToggleSelectEvento(evento.id)}
        />
        <ListItemText
          primary={
            <Box display="flex" alignItems="center" gap={1}>
              <Typography variant="subtitle1" fontWeight="bold">
                {evento.titulo}
              </Typography>
              <Chip
                label={evento.tipo || 'Manutenção'}
                size="small"
                variant="outlined"
                color="primary"
              />
              <Chip
                label={evento.status || 'aprovado'}
                size="small"
                color={evento.status === 'aprovado' ? 'success' : evento.status === 'pendente' ? 'warning' : 'error'}
              />
            </Box>
          }
          secondary={
            <Typography variant="body2" color="text.secondary">
              Lab: <strong>{evento.laboratorio}</strong> | Data: <strong>{dayjs(evento.dataInicio).format('DD/MM/YYYY')}</strong> | Horário: <strong>{evento.horarioSlotString || `${dayjs(evento.dataInicio).format('HH:mm')} - ${dayjs(evento.dataFim).format('HH:mm')}`}</strong>
              {evento.descricao && ` | ${evento.descricao}`}
            </Typography>
          }
        />
      </ListItem>
    ))}
  </List>
);

export default function GerenciarEventosAvancado({ userInfo }) {
  const [eventos, setEventos] = useState([]);
  const [loading, setLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState(null);
  const [selectedEventos, setSelectedEventos] = useState([]);

  // Modais
  const [openCreateDialog, setOpenCreateDialog] = useState(false);
  const [openEditDialog, setOpenEditDialog] = useState(false);
  const [openDeleteDialog, setOpenDeleteDialog] = useState(false);
  const [eventoParaEditar, setEventoParaEditar] = useState(null);

  // Filtros
  const [filtros, setFiltros] = useState({
    dataInicio: dayjs().startOf('month'),
    dataFim: dayjs().endOf('month'),
    laboratorio: 'Todos',
    tipo: '',
    status: '',
    titulo: '',
  });

  // Formulário de Criação/Edição
  const [formData, setFormData] = useState({
    titulo: '',
    descricao: '',
    tipo: EVENT_TYPES[0],
    status: 'aprovado',
    tipoLaboratorio: 'Todos',
    laboratorios: ['Todos'],
    dataInicio: dayjs(),
    horarios: [],
  });
  const [editFields, setEditFields] = useState({
    titulo: '',
    tipo: '',
    status: '',
    laboratorio: '',
  });
  const [formErrors, setFormErrors] = useState({});

  // Paginação
  const [lastVisible, setLastVisible] = useState(null);
  const [pagina, setPagina] = useState(1);
  const [historicoLastVisible, setHistoricoLastVisible] = useState([]);
  const EVENTOS_POR_PAGINA = 25;

  const [feedback, setFeedback] = useState({ open: false, message: '', severity: 'info' });

  const notificarTelegram = async (evento, tipoAcao) => {
    if (!TELEGRAM_CHAT_ID) return;
    try {
      const dadosNotificacao = {
        titulo: evento.titulo,
        tipoEvento: evento.tipo,
        laboratorio: evento.laboratorio,
        dataInicio: dayjs(evento.dataInicio instanceof Timestamp ? evento.dataInicio.toDate() : evento.dataInicio).format('DD/MM/YYYY HH:mm'),
        dataFim: dayjs(evento.dataFim instanceof Timestamp ? evento.dataFim.toDate() : evento.dataFim).format('DD/MM/YYYY HH:mm'),
        descricao: evento.descricao || '',
      };
      await notificadorTelegram.enviarNotificacao(TELEGRAM_CHAT_ID, dadosNotificacao, `evento_${tipoAcao}`);
    } catch (e) {
      console.error("Erro ao enviar notificação Telegram:", e);
    }
  };

  const handleSearch = useCallback(async (direction = 'start') => {
    setLoading(true);
    setError(null);
    try {
      let q = collection(db, 'eventosManutencao');
      const constraints = [];

      if (filtros.dataInicio) {
        constraints.push(where('dataInicio', '>=', Timestamp.fromDate(filtros.dataInicio.startOf('day').toDate())));
      }
      if (filtros.dataFim) {
        constraints.push(where('dataInicio', '<=', Timestamp.fromDate(filtros.dataFim.endOf('day').toDate())));
      }
      if (filtros.laboratorio && filtros.laboratorio !== 'Todos') {
        constraints.push(where('laboratorio', '==', filtros.laboratorio));
      }
      if (filtros.tipo) {
        constraints.push(where('tipo', '==', filtros.tipo));
      }
      if (filtros.status) {
        constraints.push(where('status', '==', filtros.status));
      }

      constraints.push(orderBy('dataInicio', 'asc'));

      if (direction === 'next' && lastVisible) {
        constraints.push(startAfter(lastVisible));
      } else if (direction === 'prev' && historicoLastVisible.length > 1) {
        const novoHistorico = [...historicoLastVisible];
        novoHistorico.pop();
        const prevDoc = novoHistorico[novoHistorico.length - 1];
        setHistoricoLastVisible(novoHistorico);
        if (prevDoc) constraints.push(startAfter(prevDoc));
      } else {
        setHistoricoLastVisible([]);
        setPagina(1);
      }

      constraints.push(limit(EVENTOS_POR_PAGINA));

      const finalQuery = query(q, ...constraints);
      const querySnapshot = await getDocs(finalQuery);

      const docsFetched = querySnapshot.docs.map(docSnap => {
        const data = docSnap.data();
        return {
          id: docSnap.id,
          ...data,
          dataInicio: data.dataInicio instanceof Timestamp ? data.dataInicio.toDate() : new Date(data.dataInicio),
          dataFim: data.dataFim instanceof Timestamp ? data.dataFim.toDate() : new Date(data.dataFim),
        };
      });

      // Filtro local por título (se preenchido)
      let resultadoFinal = docsFetched;
      if (filtros.titulo.trim()) {
        const termo = filtros.titulo.toLowerCase().trim();
        resultadoFinal = resultadoFinal.filter(e => e.titulo?.toLowerCase().includes(termo));
      }

      setEventos(resultadoFinal);
      const lastDoc = querySnapshot.docs[querySnapshot.docs.length - 1];
      setLastVisible(lastDoc || null);

      if (direction === 'next') {
        setHistoricoLastVisible(prev => [...prev, lastDoc]);
        setPagina(p => p + 1);
      } else if (direction === 'prev') {
        setPagina(p => Math.max(1, p - 1));
      } else if (lastDoc) {
        setHistoricoLastVisible([lastDoc]);
      }
    } catch (err) {
      console.error("Erro ao buscar eventos:", err);
      setError("Erro ao carregar os eventos. Verifique sua conexão e os filtros.");
    } finally {
      setLoading(false);
    }
  }, [filtros, lastVisible, historicoLastVisible]);

  useEffect(() => {
    handleSearch('start');
  }, []);

  const handleFilterChange = (field, value) => {
    setFiltros(prev => ({ ...prev, [field]: value }));
  };

  const handleClearFilters = () => {
    setFiltros({
      dataInicio: dayjs().startOf('month'),
      dataFim: dayjs().endOf('month'),
      laboratorio: 'Todos',
      tipo: '',
      status: '',
      titulo: '',
    });
  };

  const handleToggleSelectAll = () => {
    if (selectedEventos.length === eventos.length) {
      setSelectedEventos([]);
    } else {
      setSelectedEventos(eventos.map(e => e.id));
    }
  };

  const handleToggleSelectEvento = (id) => {
    setSelectedEventos(prev =>
      prev.includes(id) ? prev.filter(item => item !== id) : [...prev, id]
    );
  };

  // --- Validação & Criação com writeBatch ---
  const validateForm = () => {
    const errs = {};
    if (!formData.titulo.trim()) errs.titulo = 'Título é obrigatório';
    if (!formData.dataInicio) errs.dataInicio = 'Data de início é obrigatória';
    if (formData.horarios.length === 0) errs.horarios = 'Selecione pelo menos um horário';
    if (formData.laboratorios.length === 0) errs.laboratorios = 'Selecione pelo menos um laboratório';

    setFormErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleCreateSubmit = async () => {
    if (!validateForm()) return;
    setActionLoading(true);

    try {
      const batch = writeBatch(db);
      const novosEventosLog = [];

      for (const lab of formData.laboratorios) {
        for (const slot of formData.horarios) {
          const [inicioStr, fimStr] = slot.split('-');
          const finalStart = formData.dataInicio.hour(parseInt(inicioStr.split(':')[0])).minute(parseInt(inicioStr.split(':')[1])).second(0);
          const finalEnd = formData.dataInicio.hour(parseInt(fimStr.split(':')[0])).minute(parseInt(fimStr.split(':')[1])).second(0);

          const startTs = Timestamp.fromDate(finalStart.toDate());
          const endTs = Timestamp.fromDate(finalEnd.toDate());

          // Checar conflito no intervalo com aulas ativas
          const qAulas = query(
            collection(db, "aulas"),
            where("dataInicio", "<", endTs),
            where("dataInicio", ">=", startTs)
          );
          const snapAulas = await getDocs(qAulas);
          const aulasConflito = snapAulas.docs.filter(d => {
            const a = d.data();
            return lab === 'Todos' || a.laboratorioSelecionado === lab;
          });

          if (aulasConflito.length > 0) {
            console.warn(`Aviso: ${aulasConflito.length} aulas conflitam com o evento no lab ${lab} às ${slot}.`);
          }

          const docRef = doc(collection(db, 'eventosManutencao'));
          const payload = {
            titulo: formData.titulo.trim(),
            descricao: formData.descricao.trim(),
            tipo: formData.tipo,
            status: formData.status || 'aprovado',
            laboratorio: lab,
            laboratorios: formData.laboratorios,
            dataInicio: startTs,
            dataFim: endTs,
            horarioSlotString: slot,
            criadoPorUid: userInfo?.uid || 'desconhecido',
            criadoPorNome: userInfo?.name || userInfo?.displayName || userInfo?.email || 'Usuário',
            criadoEm: serverTimestamp(),
            atualizadoEm: serverTimestamp(),
          };

          batch.set(docRef, payload);
          novosEventosLog.push({ ...payload, id: docRef.id });
        }
      }

      await batch.commit();

      for (const evLog of novosEventosLog) {
        await registrarLogEvento('criacao', evLog, userInfo);
        await notificarTelegram(evLog, 'criado');
      }

      setFeedback({ open: true, message: `${novosEventosLog.length} evento(s) criado(s) com sucesso!`, severity: 'success' });
      setOpenCreateDialog(false);
      handleSearch('start');
    } catch (err) {
      console.error("Erro ao criar evento:", err);
      setFeedback({ open: true, message: 'Erro ao criar evento. Tente novamente.', severity: 'error' });
    } finally {
      setActionLoading(false);
    }
  };

  // --- Edição em Lote ou Único ---
  const handleOpenEdit = (evento = null) => {
    if (evento) {
      setEventoParaEditar(evento);
      setEditFields({
        titulo: evento.titulo || '',
        tipo: evento.tipo || EVENT_TYPES[0],
        status: evento.status || 'aprovado',
        laboratorio: evento.laboratorio || 'Todos',
      });
    } else {
      setEventoParaEditar(null);
      setEditFields({ titulo: '', tipo: '', status: '', laboratorio: '' });
    }
    setOpenEditDialog(true);
  };

  const handleEditSubmit = async () => {
    setActionLoading(true);
    try {
      const idsParaEditar = eventoParaEditar ? [eventoParaEditar.id] : selectedEventos;
      const batch = writeBatch(db);

      const updateData = {};
      if (editFields.titulo.trim()) updateData.titulo = editFields.titulo.trim();
      if (editFields.tipo) updateData.tipo = editFields.tipo;
      if (editFields.status) updateData.status = editFields.status;
      if (editFields.laboratorio) updateData.laboratorio = editFields.laboratorio;
      updateData.atualizadoEm = serverTimestamp();

      for (const id of idsParaEditar) {
        const ref = doc(db, 'eventosManutencao', id);
        batch.update(ref, updateData);
      }

      await batch.commit();

      for (const id of idsParaEditar) {
        const evOriginal = eventos.find(e => e.id === id);
        await registrarLogEvento('edicao', { ...evOriginal, ...updateData }, userInfo);
      }

      setFeedback({ open: true, message: `${idsParaEditar.length} evento(s) atualizado(s) com sucesso!`, severity: 'success' });
      setOpenEditDialog(false);
      setSelectedEventos([]);
      handleSearch('start');
    } catch (err) {
      console.error("Erro ao editar evento(s):", err);
      setFeedback({ open: true, message: 'Erro ao atualizar evento(s).', severity: 'error' });
    } finally {
      setActionLoading(false);
    }
  };

  // --- Exclusão em Lote ---
  const handleDeleteSubmit = async () => {
    setActionLoading(true);
    try {
      const batch = writeBatch(db);
      for (const id of selectedEventos) {
        const ref = doc(db, 'eventosManutencao', id);
        batch.delete(ref);
      }

      await batch.commit();

      for (const id of selectedEventos) {
        const evOriginal = eventos.find(e => e.id === id);
        if (evOriginal) {
          await registrarLogEvento('exclusao', evOriginal, userInfo);
          await notificarTelegram(evOriginal, 'excluido');
        }
      }

      setFeedback({ open: true, message: `${selectedEventos.length} evento(s) excluído(s) com sucesso!`, severity: 'success' });
      setSelectedEventos([]);
      setOpenDeleteDialog(false);
      handleSearch('start');
    } catch (err) {
      console.error("Erro ao excluir eventos:", err);
      setFeedback({ open: true, message: 'Erro ao excluir eventos selecionados.', severity: 'error' });
    } finally {
      setActionLoading(false);
    }
  };

  const laboratoriosFiltradosParaForm = useMemo(() => {
    if (formData.tipoLaboratorio === 'Todos') return LISTA_LABORATORIOS.map(l => l.name);
    return LISTA_LABORATORIOS.filter(l => l.tipo === formData.tipoLaboratorio).map(l => l.name);
  }, [formData.tipoLaboratorio]);

  return (
    <LocalizationProvider dateAdapter={AdapterDayjs} adapterLocale="pt-br">
      <Container maxWidth="xl" sx={{ mt: 4, mb: 4 }}>
        <Paper elevation={3} sx={{ p: 3, mb: 4, borderRadius: 2 }}>
          <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
            <Typography variant="h5" component="h1" fontWeight="bold" color="primary">
              Gerenciamento Avançado de Eventos & Manutenção
            </Typography>
            <Button
              variant="contained"
              color="primary"
              startIcon={<AddIcon />}
              onClick={() => {
                setFormData({
                  titulo: '',
                  descricao: '',
                  tipo: EVENT_TYPES[0],
                  status: 'aprovado',
                  tipoLaboratorio: 'Todos',
                  laboratorios: ['Todos'],
                  dataInicio: dayjs(),
                  horarios: [],
                });
                setFormErrors({});
                setOpenCreateDialog(true);
              }}
            >
              Novo Evento
            </Button>
          </Box>

          {/* Filtros */}
          <Paper variant="outlined" sx={{ p: 2, mb: 3, backgroundColor: 'background.default' }}>
            <Typography variant="subtitle2" fontWeight="bold" mb={2}>
              Filtros Avançados
            </Typography>
            <Grid container spacing={2} alignItems="center">
              <Grid item xs={12} sm={6} md={2}>
                <DatePicker
                  label="Data Início"
                  value={filtros.dataInicio}
                  onChange={(date) => handleFilterChange('dataInicio', date)}
                  slotProps={{ textField: { size: 'small', fullWidth: true } }}
                />
              </Grid>
              <Grid item xs={12} sm={6} md={2}>
                <DatePicker
                  label="Data Fim"
                  value={filtros.dataFim}
                  onChange={(date) => handleFilterChange('dataFim', date)}
                  slotProps={{ textField: { size: 'small', fullWidth: true } }}
                />
              </Grid>
              <Grid item xs={12} sm={6} md={2}>
                <FormControl fullWidth size="small">
                  <InputLabel>Laboratório</InputLabel>
                  <Select
                    value={filtros.laboratorio}
                    label="Laboratório"
                    onChange={(e) => handleFilterChange('laboratorio', e.target.value)}
                  >
                    <MenuItem value="Todos">Todos</MenuItem>
                    {LISTA_LABORATORIOS.map((lab) => (
                      <MenuItem key={lab.id || lab.name} value={lab.name}>{lab.name}</MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Grid>
              <Grid item xs={12} sm={6} md={2}>
                <FormControl fullWidth size="small">
                  <InputLabel>Tipo</InputLabel>
                  <Select
                    value={filtros.tipo}
                    label="Tipo"
                    onChange={(e) => handleFilterChange('tipo', e.target.value)}
                  >
                    <MenuItem value="">Todos os tipos</MenuItem>
                    {EVENT_TYPES.map(t => (
                      <MenuItem key={t} value={t}>{t}</MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Grid>
              <Grid item xs={12} sm={6} md={2}>
                <FormControl fullWidth size="small">
                  <InputLabel>Status</InputLabel>
                  <Select
                    value={filtros.status}
                    label="Status"
                    onChange={(e) => handleFilterChange('status', e.target.value)}
                  >
                    <MenuItem value="">Todos os status</MenuItem>
                    {STATUS_EVENTO.map(s => (
                      <MenuItem key={s} value={s}>{s}</MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Grid>
              <Grid item xs={12} sm={6} md={2}>
                <TextField
                  fullWidth
                  size="small"
                  label="Busca por Título"
                  value={filtros.titulo}
                  onChange={(e) => handleFilterChange('titulo', e.target.value)}
                />
              </Grid>
              <Grid item xs={12} display="flex" justifyContent="flex-end" gap={1}>
                <Button variant="outlined" startIcon={<ClearIcon />} onClick={handleClearFilters}>
                  Limpar
                </Button>
                <Button variant="contained" onClick={() => handleSearch('start')}>
                  Buscar
                </Button>
              </Grid>
            </Grid>
          </Paper>

          {/* Barra de Ações em Lote */}
          {selectedEventos.length > 0 && (
            <Paper elevation={2} sx={{ p: 1.5, mb: 2, backgroundColor: 'primary.light', color: 'primary.contrastText', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <Typography variant="subtitle2">
                {selectedEventos.length} evento(s) selecionado(s)
              </Typography>
              <Box display="flex" gap={1}>
                <Button variant="contained" color="warning" size="small" startIcon={<EditIcon />} onClick={() => handleOpenEdit(null)}>
                  Editar Selecionados
                </Button>
                <Button variant="contained" color="error" size="small" startIcon={<DeleteIcon />} onClick={() => setOpenDeleteDialog(true)}>
                  Excluir Selecionados
                </Button>
              </Box>
            </Paper>
          )}

          {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

          {loading ? (
            <Box display="flex" justifyContent="center" my={4}>
              <CircularProgress />
            </Box>
          ) : eventos.length === 0 ? (
            <EmptyState title="Nenhum evento encontrado" description="Tente ajustar os filtros acima para encontrar eventos ou agende um novo." />
          ) : (
            <>
              <ResultadosBuscaEventos
                eventos={eventos}
                selectedEventos={selectedEventos}
                onToggleSelectAll={handleToggleSelectAll}
                onToggleSelectEvento={handleToggleSelectEvento}
                onEditEvento={(ev) => handleOpenEdit(ev)}
              />

              {/* Paginação Cursor-based */}
              <Box display="flex" justifyContent="space-between" alignItems="center" mt={3} pt={2} borderTop="1px solid #eee">
                <Typography variant="body2" color="text.secondary">
                  Página {pagina}
                </Typography>
                <Box display="flex" gap={1}>
                  <Button
                    variant="outlined"
                    disabled={pagina === 1 || loading}
                    onClick={() => handleSearch('prev')}
                  >
                    Anterior
                  </Button>
                  <Button
                    variant="outlined"
                    disabled={!lastVisible || eventos.length < EVENTOS_POR_PAGINA || loading}
                    onClick={() => handleSearch('next')}
                  >
                    Próxima
                  </Button>
                </Box>
              </Box>
            </>
          )}
        </Paper>

        {/* Modal de Criação de Evento */}
        <Dialog open={openCreateDialog} onClose={() => setOpenCreateDialog(false)} maxWidth="md" fullWidth>
          <DialogTitle>Agendar Novo Evento de Manutenção</DialogTitle>
          <DialogContent dividers>
            <Grid container spacing={2} sx={{ pt: 1 }}>
              <Grid item xs={12} sm={8}>
                <TextField
                  fullWidth
                  label="Título do Evento *"
                  value={formData.titulo}
                  onChange={(e) => setFormData(prev => ({ ...prev, titulo: e.target.value }))}
                  error={!!formErrors.titulo}
                  helperText={formErrors.titulo}
                />
              </Grid>
              <Grid item xs={12} sm={4}>
                <FormControl fullWidth>
                  <InputLabel>Tipo *</InputLabel>
                  <Select
                    value={formData.tipo}
                    label="Tipo *"
                    onChange={(e) => setFormData(prev => ({ ...prev, tipo: e.target.value }))}
                  >
                    {EVENT_TYPES.map(t => <MenuItem key={t} value={t}>{t}</MenuItem>)}
                  </Select>
                </FormControl>
              </Grid>
              <Grid item xs={12}>
                <TextField
                  fullWidth
                  multiline
                  rows={2}
                  label="Descrição"
                  value={formData.descricao}
                  onChange={(e) => setFormData(prev => ({ ...prev, descricao: e.target.value }))}
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <FormControl fullWidth>
                  <InputLabel>Área do Laboratório</InputLabel>
                  <Select
                    value={formData.tipoLaboratorio}
                    label="Área do Laboratório"
                    onChange={(e) => setFormData(prev => ({ ...prev, tipoLaboratorio: e.target.value, laboratorios: ['Todos'] }))}
                  >
                    <MenuItem value="Todos">Todas as áreas</MenuItem>
                    {TIPOS_LABORATORIO.map(t => <MenuItem key={t.id} value={t.id}>{t.name}</MenuItem>)}
                  </Select>

                </FormControl>
              </Grid>
              <Grid item xs={12} sm={6}>
                <FormControl fullWidth error={!!formErrors.laboratorios}>
                  <InputLabel>Laboratório(s) *</InputLabel>
                  <Select
                    multiple
                    value={formData.laboratorios}
                    onChange={(e) => {
                      const val = e.target.value;
                      setFormData(prev => ({ ...prev, laboratorios: typeof val === 'string' ? val.split(',') : val }));
                    }}
                    input={<OutlinedInput label="Laboratório(s) *" />}
                    renderValue={(selected) => selected.join(', ')}
                  >
                    <MenuItem value="Todos">
                      <Checkbox checked={formData.laboratorios.includes('Todos')} />
                      <ListItemText primary="Todos da Área/Geral" />
                    </MenuItem>
                    {laboratoriosFiltradosParaForm.map((lab) => (
                      <MenuItem key={lab} value={lab}>
                        <Checkbox checked={formData.laboratorios.includes(lab)} />
                        <ListItemText primary={lab} />
                      </MenuItem>
                    ))}
                  </Select>
                  {formErrors.laboratorios && <FormHelperText>{formErrors.laboratorios}</FormHelperText>}
                </FormControl>
              </Grid>
              <Grid item xs={12} sm={6}>
                <DatePicker
                  label="Data *"
                  value={formData.dataInicio}
                  onChange={(date) => setFormData(prev => ({ ...prev, dataInicio: date }))}
                  slotProps={{ textField: { fullWidth: true, error: !!formErrors.dataInicio, helperText: formErrors.dataInicio } }}
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <FormControl fullWidth error={!!formErrors.horarios}>
                  <InputLabel>Horário(s) *</InputLabel>
                  <Select
                    multiple
                    value={formData.horarios}
                    onChange={(e) => setFormData(prev => ({ ...prev, horarios: e.target.value }))}
                    input={<OutlinedInput label="Horário(s) *" />}
                    renderValue={(selected) => selected.join(', ')}
                  >
                    {BLOCOS_HORARIO.map((b) => (
                      <MenuItem key={b.value} value={b.value}>
                        <Checkbox checked={formData.horarios.includes(b.value)} />
                        <ListItemText primary={`${b.label} (${b.turno})`} />
                      </MenuItem>
                    ))}
                  </Select>
                  {formErrors.horarios && <FormHelperText>{formErrors.horarios}</FormHelperText>}
                </FormControl>
              </Grid>
            </Grid>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setOpenCreateDialog(false)}>Cancelar</Button>
            <Button variant="contained" onClick={handleCreateSubmit} disabled={actionLoading}>
              {actionLoading ? <CircularProgress size={24} /> : 'Salvar Evento'}
            </Button>
          </DialogActions>
        </Dialog>

        {/* Modal de Edição */}
        <Dialog open={openEditDialog} onClose={() => setOpenEditDialog(false)} maxWidth="sm" fullWidth>
          <DialogTitle>
            {eventoParaEditar ? 'Editar Evento' : `Editar ${selectedEventos.length} Evento(s) Selecionado(s)`}
          </DialogTitle>
          <DialogContent dividers>
            <Box display="flex" flexDirection="column" gap={2} pt={1}>
              <TextField
                label="Novo Título (deixe em branco para manter)"
                value={editFields.titulo}
                onChange={(e) => setEditFields(prev => ({ ...prev, titulo: e.target.value }))}
                fullWidth
              />
              <FormControl fullWidth>
                <InputLabel>Tipo</InputLabel>
                <Select
                  value={editFields.tipo}
                  label="Tipo"
                  onChange={(e) => setEditFields(prev => ({ ...prev, tipo: e.target.value }))}
                >
                  <MenuItem value="">Manter atual</MenuItem>
                  {EVENT_TYPES.map(t => <MenuItem key={t} value={t}>{t}</MenuItem>)}
                </Select>
              </FormControl>
              <FormControl fullWidth>
                <InputLabel>Status</InputLabel>
                <Select
                  value={editFields.status}
                  label="Status"
                  onChange={(e) => setEditFields(prev => ({ ...prev, status: e.target.value }))}
                >
                  <MenuItem value="">Manter atual</MenuItem>
                  {STATUS_EVENTO.map(s => <MenuItem key={s} value={s}>{s}</MenuItem>)}
                </Select>
              </FormControl>
              <FormControl fullWidth>
                <InputLabel>Laboratório</InputLabel>
                <Select
                  value={editFields.laboratorio}
                  label="Laboratório"
                  onChange={(e) => setEditFields(prev => ({ ...prev, laboratorio: e.target.value }))}
                >
                  <MenuItem value="">Manter atual</MenuItem>
                  <MenuItem value="Todos">Todos</MenuItem>
                  {LISTA_LABORATORIOS.map(l => <MenuItem key={l.name} value={l.name}>{l.name}</MenuItem>)}
                </Select>
              </FormControl>
            </Box>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setOpenEditDialog(false)}>Cancelar</Button>
            <Button variant="contained" onClick={handleEditSubmit} disabled={actionLoading}>
              {actionLoading ? <CircularProgress size={24} /> : 'Salvar Alterações'}
            </Button>
          </DialogActions>
        </Dialog>

        {/* Modal de Exclusão */}
        <DialogConfirmacao
          open={openDeleteDialog}
          title="Confirmar Exclusão"
          message={`Tem certeza que deseja excluir ${selectedEventos.length} evento(s) selecionado(s)? Esta ação não pode ser desfeita.`}
          onConfirm={handleDeleteSubmit}
          onCancel={() => setOpenDeleteDialog(false)}
          loading={actionLoading}
        />

        {/* Feedback Snackbar */}
        <Snackbar
          open={feedback.open}
          autoHideDuration={6000}
          onClose={() => setFeedback(prev => ({ ...prev, open: false }))}
        >
          <Alert severity={feedback.severity} onClose={() => setFeedback(prev => ({ ...prev, open: false }))}>
            {feedback.message}
          </Alert>
        </Snackbar>
      </Container>
    </LocalizationProvider>
  );
}
