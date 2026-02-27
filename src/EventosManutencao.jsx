import { useState, useEffect } from 'react';
import { db } from './firebaseConfig';
import { collection, query, onSnapshot, doc, addDoc, updateDoc, deleteDoc, Timestamp, serverTimestamp, getDocs, where } from 'firebase/firestore';
import {
  Container, Typography, Box, Paper, CircularProgress, Alert,
  List, ListItem, ListItemText, ListItemSecondaryAction, IconButton, Chip,
  Dialog, DialogTitle, DialogContent, DialogActions, Button,
  TextField, Tooltip, Snackbar, Grid, Select, MenuItem, FormControl, InputLabel, Divider, FormHelperText
} from '@mui/material';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import AddIcon from '@mui/icons-material/Add';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import { LocalizationProvider } from '@mui/x-date-pickers';
import { AdapterDayjs } from '@mui/x-date-pickers/AdapterDayjs';
import dayjs from 'dayjs';
import 'dayjs/locale/pt-br';
import EmptyState from './components/EmptyState';
import { LISTA_LABORATORIOS, TIPOS_LABORATORIO } from './constants/laboratorios';
import { CalendarOff } from 'lucide-react';
import DialogConfirmacao from './components/DialogConfirmacao';
import { notificadorTelegram } from './ia-estruturada/NotificadorTelegram';

dayjs.locale('pt-br');

const EVENT_TYPES = ['Manutenção', 'Feriado', 'Evento', 'Giro', 'Outro'];
const TELEGRAM_CHAT_ID = import.meta.env.VITE_TELEGRAM_CHAT_ID;

const BLOCOS_HORARIO = [
    { "value": "07:00-09:10", "label": "07:00 - 09:10", "turno": "Matutino" },
    { "value": "09:30-12:00", "label": "09:30 - 12:00", "turno": "Matutino" },
    { "value": "13:00-15:10", "label": "13:00 - 15:10", "turno": "Vespertino" },
    { "value": "15:30-18:00", "label": "15:30 - 18:00", "turno": "Vespertino" },
    { "value": "18:30-20:10", "label": "18:30 - 20:10", "turno": "Noturno" },
    { "value": "20:30-22:00", "label": "20:30 - 22:00", "turno": "Noturno" },
];

function EventosManutencao() {
  const [eventos, setEventos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [openDialog, setOpenDialog] = useState(false);
  const [openDeleteDialog, setOpenDeleteDialog] = useState(false);
  const [eventoParaEditar, setEventoParaEditar] = useState(null);
  const [eventoParaExcluir, setEventoParaExcluir] = useState(null);
  const [feedback, setFeedback] = useState({ open: false, message: '', severity: 'success' });
  const [actionLoading, setActionLoading] = useState(false);

  // Formulário
  const [formData, setFormData] = useState({
    titulo: '',
    descricao: '',
    tipo: EVENT_TYPES[0],
    tipoLaboratorio: 'Todos',
    laboratorio: 'Todos',
    dataInicio: dayjs(),
    horarios: []
  });
  const [errors, setErrors] = useState({});

  useEffect(() => {
    const q = query(collection(db, 'eventosManutencao'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const eventosList = snapshot.docs.map(doc => {
        const data = doc.data();
        return {
          id: doc.id,
          ...data,
          dataInicio: data.dataInicio instanceof Timestamp ? data.dataInicio.toDate() : new Date(data.dataInicio),
          dataFim: data.dataFim instanceof Timestamp ? data.dataFim.toDate() : new Date(data.dataFim),
        };
      });
      setEventos(eventosList.sort((a, b) => b.dataInicio - a.dataInicio));
      setLoading(false);
    }, (err) => {
      console.error("Erro ao carregar eventos:", err);
      setError("Não foi possível carregar os eventos de manutenção.");
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  const notificarTelegramEvento = async (evento, tipoAcao) => {
    if (!TELEGRAM_CHAT_ID) return;
    
    const dadosNotificacao = {
      titulo: evento.titulo,
      tipoEvento: evento.tipo,
      laboratorio: evento.laboratorio,
      dataInicio: dayjs(evento.dataInicio instanceof Timestamp ? evento.dataInicio.toDate() : evento.dataInicio).format('DD/MM/YYYY HH:mm'),
      dataFim: dayjs(evento.dataFim instanceof Timestamp ? evento.dataFim.toDate() : evento.dataFim).format('DD/MM/YYYY HH:mm'),
      descricao: evento.descricao
    };

    await notificadorTelegram.enviarNotificacao(TELEGRAM_CHAT_ID, dadosNotificacao, `evento_${tipoAcao}`);
  };

  const resetForm = () => {
    setFormData({
      titulo: '',
      descricao: '',
      tipo: EVENT_TYPES[0],
      tipoLaboratorio: 'Todos',
      laboratorio: 'Todos',
      dataInicio: dayjs(),
      horarios: []
    });
    setErrors({});
    setEventoParaEditar(null);
  };

  const handleOpenDialog = (evento = null) => {
    if (evento) {
      setEventoParaEditar(evento);
      
      // Tentar encontrar o tipo de laboratório baseado no nome do laboratório
      let tipoLab = 'Todos';
      if (evento.laboratorio !== 'Todos') {
        const labObj = LISTA_LABORATORIOS.find(l => l.name === evento.laboratorio);
        if (labObj) tipoLab = labObj.tipo;
      }

      // Tentar mapear os horários de volta para os slots
      const start = dayjs(evento.dataInicio);
      const end = dayjs(evento.dataFim);
      const slotString = `${start.format('HH:mm')}-${end.format('HH:mm')}`;
      
      setFormData({
        titulo: evento.titulo,
        descricao: evento.descricao || '',
        tipo: evento.tipo,
        tipoLaboratorio: tipoLab,
        laboratorio: evento.laboratorio,
        dataInicio: start,
        horarios: [slotString]
      });
    } else {
      resetForm();
    }
    setOpenDialog(true);
  };

  const handleCloseDialog = () => {
    setOpenDialog(false);
    resetForm();
  };

  const validate = () => {
    const newErrors = {};
    if (!formData.titulo.trim()) newErrors.titulo = 'Obrigatório';
    if (!formData.dataInicio) newErrors.dataInicio = 'Obrigatório';
    if (formData.horarios.length === 0) newErrors.horarios = 'Selecione pelo menos um horário';
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async () => {
    if (!validate()) return;

    setActionLoading(true);
    try {
      // Para cada horário selecionado, criamos um evento ou validamos conflitos
      // O usuário quer que eventos tenham prioridade, então vamos avisar se houver aulas
      
      for (const slot of formData.horarios) {
        const [inicioStr, fimStr] = slot.split('-');
        const finalStart = formData.dataInicio.hour(parseInt(inicioStr.split(':')[0])).minute(parseInt(inicioStr.split(':')[1])).second(0);
        const finalEnd = formData.dataInicio.hour(parseInt(fimStr.split(':')[0])).minute(parseInt(fimStr.split(':')[1])).second(0);

        const eventoData = {
          titulo: formData.titulo,
          descricao: formData.descricao,
          tipo: formData.tipo,
          laboratorio: formData.laboratorio,
          dataInicio: Timestamp.fromDate(finalStart.toDate()),
          dataFim: Timestamp.fromDate(finalEnd.toDate()),
          horarioSlotString: slot,
          criadoEm: serverTimestamp ? serverTimestamp() : new Date(),
        };

        // Verificar se existem aulas no mesmo horário e laboratório
        const qAulas = query(
          collection(db, "aulas"),
          where("dataInicio", "==", eventoData.dataInicio)
        );
        const querySnapshotAulas = await getDocs(qAulas);
        const aulasConflitantes = querySnapshotAulas.docs.filter(doc => {
          const aula = doc.data();
          return formData.laboratorio === 'Todos' || aula.laboratorioSelecionado === formData.laboratorio;
        });

        if (aulasConflitantes.length > 0) {
          // Se houver aulas, vamos avisar (ou poderíamos cancelar as aulas automaticamente)
          // Por enquanto, vamos apenas prosseguir pois o evento tem prioridade conforme solicitado
          console.log(`Aviso: Existem ${aulasConflitantes.length} aulas que conflitam com este evento.`);
        }

        if (eventoParaEditar) {
          const docRef = doc(db, 'eventosManutencao', eventoParaEditar.id);
          await updateDoc(docRef, eventoData);
          await notificarTelegramEvento(eventoData, 'editar');
        } else {
          await addDoc(collection(db, 'eventosManutencao'), eventoData);
          await notificarTelegramEvento(eventoData, 'adicionar');
        }
      }

      setFeedback({ 
        open: true, 
        message: eventoParaEditar ? 'Evento atualizado com sucesso!' : 'Evento(s) adicionado(s) com sucesso!', 
        severity: 'success' 
      });
      handleCloseDialog();
    } catch (err) {
      console.error("Erro ao salvar evento:", err);
      setFeedback({ open: true, message: `Erro ao salvar o evento: ${err.message}`, severity: 'error' });
    } finally {
      setActionLoading(false);
    }
  };

  const handleOpenDeleteDialog = (evento) => {
    setEventoParaExcluir(evento);
    setOpenDeleteDialog(true);
  };

  const handleDeleteConfirm = async () => {
    if (!eventoParaExcluir) return;
    setActionLoading(true);
    try {
      await deleteDoc(doc(db, 'eventosManutencao', eventoParaExcluir.id));
      await notificarTelegramEvento(eventoParaExcluir, 'excluir');
      setFeedback({ open: true, message: 'Evento excluído com sucesso!', severity: 'success' });
      setOpenDeleteDialog(false);
      setEventoParaExcluir(null);
    } catch (err) {
      console.error("Erro ao excluir evento:", err);
      setFeedback({ open: true, message: `Erro ao excluir o evento: ${err.message}`, severity: 'error' });
    } finally {
      setActionLoading(false);
    }
  };

  const handleCloseSnackbar = (event, reason) => {
    if (reason === 'clickaway') return;
    setFeedback(prev => ({ ...prev, open: false }));
  };

  const getChipColor = (tipo) => {
    switch (tipo) {
      case 'Manutenção': return 'error';
      case 'Feriado': return 'warning';
      case 'Evento': return 'primary';
      case 'Giro': return 'secondary';
      default: return 'default';
    }
  };

  if (loading) return (<Container sx={{ textAlign: 'center', mt: 4 }}><CircularProgress /></Container>);
  if (error) return (<Container sx={{ mt: 4 }}><Alert severity="error">{error}</Alert></Container>);

  return (
    <LocalizationProvider dateAdapter={AdapterDayjs} adapterLocale="pt-br">
      <Container maxWidth="lg">
        <Paper elevation={3} sx={{ p: { xs: 2, md: 4 }, mt: 4 }}>
          <Box display="flex" justifyContent="space-between" alignItems="center" mb={3} flexDirection={{ xs: 'column', sm: 'row' }} gap={2}>
            <Typography variant="h4" component="h1">Gerenciar Eventos</Typography>
            <Button variant="contained" startIcon={<AddIcon />} onClick={() => handleOpenDialog()}>
              Novo Evento
            </Button>
          </Box>

          <Divider sx={{ mb: 3 }} />

          {eventos.length === 0 ? (
            <EmptyState
              icon={CalendarOff}
              title="Nenhum evento cadastrado"
              message="Adicione eventos como manutenções de laboratório ou feriados para organizar o cronograma."
            />
          ) : (
            <List>
              {eventos.map((evento) => (
                <ListItem key={evento.id} divider sx={{ py: 2 }}>
                  <ListItemText
                    primary={
                      <Box display="flex" alignItems="center" flexWrap="wrap" gap={1}>
                        <Chip label={evento.tipo} size="small" color={getChipColor(evento.tipo)} />
                        <Typography variant="subtitle1" fontWeight="bold">{evento.titulo}</Typography>
                      </Box>
                    }
                    secondary={
                      <Box component="span" sx={{ display: 'block', mt: 0.5 }}>
                        <Typography component="span" variant="body2" color="text.primary" sx={{ fontWeight: 'medium' }}>
                          {evento.laboratorio === 'Todos' ? 'Todos os Laboratórios' : `Laboratório: ${evento.laboratorio}`}
                        </Typography>
                        <br />
                        <Typography component="span" variant="body2" color="text.secondary">
                          {dayjs(evento.dataInicio).format('DD/MM/YYYY HH:mm')} até {dayjs(evento.dataFim).format('DD/MM/YYYY HH:mm')}
                        </Typography>
                        {evento.descricao && (
                          <Typography component="span" variant="body2" color="text.secondary" sx={{ display: 'block', mt: 0.5, fontStyle: 'italic' }}>
                            {evento.descricao}
                          </Typography>
                        )}
                      </Box>
                    }
                  />
                  <ListItemSecondaryAction>
                    <Tooltip title="Editar">
                      <IconButton edge="end" onClick={() => handleOpenDialog(evento)} sx={{ mr: 1 }} color="info">
                        <EditIcon />
                      </IconButton>
                    </Tooltip>
                    <Tooltip title="Excluir">
                      <IconButton edge="end" onClick={() => handleOpenDeleteDialog(evento)} color="error">
                        <DeleteIcon />
                      </IconButton>
                    </Tooltip>
                  </ListItemSecondaryAction>
                </ListItem>
              ))}
            </List>
          )}
        </Paper>

        <Dialog open={openDialog} onClose={handleCloseDialog} fullWidth maxWidth="sm">
          <DialogTitle>{eventoParaEditar ? 'Editar Evento' : 'Novo Evento'}</DialogTitle>
          <DialogContent dividers>
            <Grid container spacing={2} sx={{ mt: 0.5 }}>
              <Grid item xs={12}>
                <TextField 
                  autoFocus 
                  label="Título do Evento *" 
                  fullWidth 
                  variant="outlined" 
                  value={formData.titulo} 
                  onChange={(e) => setFormData({...formData, titulo: e.target.value})} 
                  error={!!errors.titulo}
                  helperText={errors.titulo}
                  required 
                />
              </Grid>
              <Grid item xs={12}>
                <TextField 
                  label="Descrição (Opcional)" 
                  fullWidth 
                  variant="outlined" 
                  multiline 
                  rows={2} 
                  value={formData.descricao} 
                  onChange={(e) => setFormData({...formData, descricao: e.target.value})} 
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <FormControl sx={{ minWidth: 120 }}>
                  <InputLabel shrink>Tipo</InputLabel>
                  <Select 
                    value={formData.tipo} 
                    label="Tipo" 
                    onChange={(e) => setFormData({...formData, tipo: e.target.value})}
                  >
                    {EVENT_TYPES.map(t => <MenuItem key={t} value={t}>{t}</MenuItem>)}
                  </Select>
                </FormControl>
              </Grid>
              
              <Grid item xs={12} sm={6}>
                <FormControl sx={{ minWidth: 160 }}>
                  <InputLabel shrink>Área do Laboratório</InputLabel>
                  <Select 
                    value={formData.tipoLaboratorio} 
                    label="Área do Laboratório" 
                    onChange={(e) => setFormData({...formData, tipoLaboratorio: e.target.value, laboratorio: 'Todos'})}
                  >
                    <MenuItem value="Todos">Todas as Áreas</MenuItem>
                    {TIPOS_LABORATORIO.map(t => (
                      <MenuItem key={t.id} value={t.id}>{t.name}</MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Grid>

              <Grid item xs={12}>
                <FormControl sx={{ minWidth: 160 }} disabled={formData.tipoLaboratorio === 'Todos'}>
                  <InputLabel shrink>Laboratório Específico</InputLabel>
                  <Select 
                    value={formData.laboratorio} 
                    label="Laboratório Específico" 
                    onChange={(e) => setFormData({...formData, laboratorio: e.target.value})}
                  >
                    <MenuItem value="Todos">Todos desta Área</MenuItem>
                    {LISTA_LABORATORIOS.filter(l => l.tipo === formData.tipoLaboratorio).map(lab => (
                      <MenuItem key={lab.id} value={lab.name}>{lab.name}</MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Grid>

              <Grid item xs={12} sm={6}>
                <DatePicker 
                  label="Data *" 
                  value={formData.dataInicio} 
                  onChange={(newValue) => setFormData({...formData, dataInicio: newValue})} 
                  format="DD/MM/YYYY" 
                  slotProps={{ textField: { fullWidth: true, error: !!errors.dataInicio, helperText: errors.dataInicio } }} 
                />
              </Grid>

              <Grid item xs={12} sm={6}>
                <FormControl sx={{ minWidth: 150 }} error={!!errors.horarios}>
                  <InputLabel shrink>Horário(s) *</InputLabel>
                  <Select
                    multiple
                    value={formData.horarios}
                    onChange={(e) => setFormData({...formData, horarios: e.target.value})}
                    label="Horário(s) *"
                    renderValue={(selected) => (
                      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                        {selected.map((value) => (
                          <Chip key={value} label={value} size="small" />
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
                  {errors.horarios && <FormHelperText>{errors.horarios}</FormHelperText>}
                </FormControl>
              </Grid>
            </Grid>
          </DialogContent>
          <DialogActions>
            <Button onClick={handleCloseDialog}>Cancelar</Button>
            <Button onClick={handleSubmit} variant="contained" disabled={actionLoading}>
              {actionLoading ? <CircularProgress size={24} /> : (eventoParaEditar ? 'Salvar Alterações' : 'Adicionar Evento')}
            </Button>
          </DialogActions>
        </Dialog>

        <DialogConfirmacao
          open={openDeleteDialog}
          onClose={() => setOpenDeleteDialog(false)}
          onConfirm={handleDeleteConfirm}
          title="Excluir Evento"
          message={`Tem certeza que deseja excluir o evento "${eventoParaExcluir?.titulo}"?`}
          confirmText="Excluir"
          confirmColor="error"
          loading={actionLoading}
        />

        <Snackbar open={feedback.open} autoHideDuration={6000} onClose={handleCloseSnackbar} anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}>
          <Alert onClose={handleCloseSnackbar} severity={feedback.severity} sx={{ width: '100%' }}>{feedback.message}</Alert>
        </Snackbar>
      </Container>
    </LocalizationProvider>
  );
}

export default EventosManutencao;
