import { useState, useEffect } from 'react';
import { db } from './firebaseConfig';
import { collection, query, onSnapshot, doc, addDoc, updateDoc, deleteDoc } from 'firebase/firestore';
import {
  Container, Typography, Box, Paper, CircularProgress, Alert,
  List, ListItem, ListItemText, ListItemSecondaryAction, IconButton, Chip,
  Dialog, DialogTitle, DialogContent, DialogActions, Button,
  TextField, Tooltip, Snackbar, Grid, Select, MenuItem, FormControl, InputLabel
} from '@mui/material';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import AddIcon from '@mui/icons-material/Add';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import dayjs from 'dayjs';
import EmptyState from './components/EmptyState';
// MODIFICAÇÃO 1: Importando a lista correta e usando 'as'
import { LISTA_LABORATORIOS as laboratorios } from './constants/laboratorios';
import { CalendarOff } from 'lucide-react';

const EVENT_TYPES = ['Manutenção', 'Feriado', 'Outro'];

function EventosManutencao() {
  const [eventos, setEventos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [openDialog, setOpenDialog] = useState(false);
  const [eventoParaEditar, setEventoParaEditar] = useState(null);
  const [feedback, setFeedback] = useState({ open: false, message: '', severity: 'success' });

  // Formulário
  const [titulo, setTitulo] = useState('');
  const [descricao, setDescricao] = useState('');
  const [tipo, setTipo] = useState(EVENT_TYPES[0]);
  const [laboratorio, setLaboratorio] = useState('Todos');
  const [dataInicio, setDataInicio] = useState(dayjs());
  const [dataFim, setDataFim] = useState(dayjs());

  useEffect(() => {
    const q = query(collection(db, 'eventosManutencao'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const eventosList = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        dataInicio: doc.data().dataInicio.toDate(),
        dataFim: doc.data().dataFim.toDate(),
      }));
      setEventos(eventosList.sort((a, b) => a.dataInicio - b.dataInicio));
      setLoading(false);
    }, (err) => {
      setError("Não foi possível carregar os eventos de manutenção.");
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  const resetForm = () => {
    setTitulo('');
    setDescricao('');
    setTipo(EVENT_TYPES[0]);
    setLaboratorio('Todos');
    setDataInicio(dayjs());
    setDataFim(dayjs());
    setEventoParaEditar(null);
  };

  const handleOpenDialog = (evento = null) => {
    if (evento) {
      setEventoParaEditar(evento);
      setTitulo(evento.titulo);
      setDescricao(evento.descricao);
      setTipo(evento.tipo);
      setLaboratorio(evento.laboratorio);
      setDataInicio(dayjs(evento.dataInicio));
      setDataFim(dayjs(evento.dataFim));
    } else {
      resetForm();
    }
    setOpenDialog(true);
  };

  const handleCloseDialog = () => {
    setOpenDialog(false);
    resetForm();
  };

  const handleSubmit = async () => {
    if (!titulo || !dataInicio || !dataFim) {
      setFeedback({ open: true, message: 'Preencha todos os campos obrigatórios.', severity: 'warning' });
      return;
    }

    try {
      const eventoData = {
        titulo,
        descricao,
        tipo,
        laboratorio,
        dataInicio: dataInicio.toDate(),
        dataFim: dataFim.toDate(),
      };

      if (eventoParaEditar) {
        const docRef = doc(db, 'eventosManutencao', eventoParaEditar.id);
        await updateDoc(docRef, eventoData);
        setFeedback({ open: true, message: 'Evento atualizado com sucesso!', severity: 'success' });
      } else {
        await addDoc(collection(db, 'eventosManutencao'), eventoData);
        setFeedback({ open: true, message: 'Evento adicionado com sucesso!', severity: 'success' });
      }
      handleCloseDialog();
    } catch (err) {
      setFeedback({ open: true, message: `Erro ao salvar o evento: ${err.message}`, severity: 'error' });
    }
  };

  const handleDelete = async (id) => {
    try {
      await deleteDoc(doc(db, 'eventosManutencao', id));
      setFeedback({ open: true, message: 'Evento excluído com sucesso!', severity: 'success' });
    } catch (err) {
      setFeedback({ open: true, message: `Erro ao excluir o evento: ${err.message}`, severity: 'error' });
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
      default: return 'info';
    }
  };

  if (loading) return (<Container sx={{ textAlign: 'center', mt: 4 }}><CircularProgress /></Container>);
  if (error) return (<Container sx={{ mt: 4 }}><Alert severity="error">{error}</Alert></Container>);

  return (
    <Container maxWidth="lg">
      <Paper elevation={3} sx={{ p: 4, mt: 4 }}>
        <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
          <Typography variant="h4">Gerenciar Eventos e Manutenções</Typography>
          <Button variant="contained" startIcon={<AddIcon />} onClick={() => handleOpenDialog()}>
            Novo Evento
          </Button>
        </Box>

        {eventos.length === 0 ? (
          <EmptyState
            icon={CalendarOff}
            title="Nenhum evento de manutenção cadastrado"
            message="Adicione eventos como manutenções de laboratório ou feriados para bloquear o agendamento."
          />
        ) : (
          <List>
            {eventos.map((evento) => (
              <ListItem key={evento.id} divider>
                <ListItemText
                  primary={
                    <Box display="flex" alignItems="center">
                      <Chip label={evento.tipo} size="small" color={getChipColor(evento.tipo)} sx={{ mr: 1 }} />
                      <Typography variant="subtitle1" component="span">{evento.titulo}</Typography>
                    </Box>
                  }
                  secondary={
                    <>
                      <Typography component="span" variant="body2" color="text.primary">
                        {evento.laboratorio === 'Todos' ? 'Todos os Laboratórios' : `Laboratório: ${evento.laboratorio}`}
                      </Typography>
                      <br />
                      {`De: ${dayjs(evento.dataInicio).format('DD/MM/YYYY')} a ${dayjs(evento.dataFim).format('DD/MM/YYYY')}`}
                      {evento.descricao && <Tooltip title={evento.descricao}><Typography component="span" variant="body2" color="text.secondary" sx={{ ml: 1, cursor: 'pointer' }}> (Detalhes)</Typography></Tooltip>}
                    </>
                  }
                />
                <ListItemSecondaryAction>
                  <Tooltip title="Editar"><IconButton edge="end" onClick={() => handleOpenDialog(evento)} sx={{ mr: 1 }}><EditIcon color="info" /></IconButton></Tooltip>
                  <Tooltip title="Excluir"><IconButton onClick={() => handleDelete(evento.id)} color="error"><DeleteIcon /></IconButton></Tooltip>
                </ListItemSecondaryAction>
              </ListItem>
            ))}
          </List>
        )}
      </Paper>

      <Dialog open={openDialog} onClose={handleCloseDialog} fullWidth maxWidth="sm">
        <DialogTitle>{eventoParaEditar ? 'Editar Evento' : 'Novo Evento de Manutenção'}</DialogTitle>
        <DialogContent>
          <Grid container spacing={2} sx={{ mt: 1 }}>
            <Grid item xs={12}>
              <TextField autoFocus margin="dense" label="Título do Evento" type="text" fullWidth variant="outlined" value={titulo} onChange={(e) => setTitulo(e.target.value)} required />
            </Grid>
            <Grid item xs={12}>
              <TextField margin="dense" label="Descrição (Opcional)" type="text" fullWidth variant="outlined" multiline rows={2} value={descricao} onChange={(e) => setDescricao(e.target.value)} />
            </Grid>
            <Grid item xs={6}>
              <FormControl fullWidth>
                <InputLabel>Tipo</InputLabel>
                <Select value={tipo} label="Tipo" onChange={(e) => setTipo(e.target.value)}>
                  {EVENT_TYPES.map(t => <MenuItem key={t} value={t}>{t}</MenuItem>)}
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={6}>
              <FormControl fullWidth>
                <InputLabel>Laboratório</InputLabel>
                <Select value={laboratorio} label="Laboratório" onChange={(e) => setLaboratorio(e.target.value)}>
                  <MenuItem value="Todos">Todos os Laboratórios</MenuItem>
                  {/* MODIFICAÇÃO 2: Usando lab.id para key e lab.name para value e texto */}
                  {laboratorios.map(lab => <MenuItem key={lab.id} value={lab.name}>{lab.name}</MenuItem>)}
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={6}>
              <DatePicker label="Data de Início" value={dataInicio} onChange={(newValue) => setDataInicio(newValue)} format="DD/MM/YYYY" slotProps={{ textField: { fullWidth: true } }} />
            </Grid>
            <Grid item xs={6}>
              <DatePicker label="Data de Fim" value={dataFim} onChange={(newValue) => setDataFim(newValue)} format="DD/MM/YYYY" slotProps={{ textField: { fullWidth: true } }} />
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseDialog}>Cancelar</Button>
          <Button onClick={handleSubmit} variant="contained">{eventoParaEditar ? 'Salvar Alterações' : 'Adicionar Evento'}</Button>
        </DialogActions>
      </Dialog>

      <Snackbar open={feedback.open} autoHideDuration={6000} onClose={handleCloseSnackbar} anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}>
        <Alert onClose={handleCloseSnackbar} severity={feedback.severity} sx={{ width: '100%' }}>{feedback.message}</Alert>
      </Snackbar>
    </Container>
  );
}

export default EventosManutencao;