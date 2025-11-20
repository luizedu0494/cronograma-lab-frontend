// src/GerenciarAvisos.js
import React, { useState, useEffect } from 'react';
import { db } from './firebaseConfig';
import {
  collection, query, orderBy, onSnapshot, addDoc,
  deleteDoc, doc, serverTimestamp, Timestamp, updateDoc,
  getDocs // Adicionado getDocs para buscar leituras
} from 'firebase/firestore';
import { useAuth } from './AuthContext';
import {
  Container, Typography, Paper, Box, CircularProgress, Alert,
  List, ListItem, ListItemText, ListItemSecondaryAction, IconButton,
  TextField, Button, Dialog, DialogActions, DialogContent,
  DialogContentText, DialogTitle, Tooltip, Divider, Chip, Snackbar // Adicionado Divider e Chip
} from '@mui/material';
import AddCircleOutlineIcon from '@mui/icons-material/AddCircleOutline';
import DeleteIcon from '@mui/icons-material/Delete';
import EditIcon from '@mui/icons-material/Edit';
import VisibilityIcon from '@mui/icons-material/Visibility'; // Ícone para "Ver Leituras"
import CloseIcon from '@mui/icons-material/Close'; // Ícone para fechar modal

import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';
import 'dayjs/locale/pt-br';

dayjs.locale('pt-br');
dayjs.extend(relativeTime);

function GerenciarAvisos() {
  const [avisos, setAvisos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [openSnackbar, setOpenSnackbar] = useState(false);
  const [snackbarMessage, setSnackbarMessage] = useState('');
  const [snackbarSeverity, setSnackbarSeverity] = useState('success');

  const [openFormDialog, setOpenFormDialog] = useState(false);
  const [tituloForm, setTituloForm] = useState('');
  const [mensagemForm, setMensagemForm] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [avisoEmEdicao, setAvisoEmEdicao] = useState(null);

  const [openConfirmDeleteDialog, setOpenConfirmDeleteDialog] = useState(false);
  const [avisoParaExcluir, setAvisoParaExcluir] = useState(null);

  // --- NOVOS ESTADOS PARA O MODAL DE LEITURAS ---
  const [openLeiturasDialog, setOpenLeiturasDialog] = useState(false);
  const [avisoSelecionadoParaLeituras, setAvisoSelecionadoParaLeituras] = useState(null);
  const [listaDeLeituras, setListaDeLeituras] = useState([]);
  const [loadingLeituras, setLoadingLeituras] = useState(false);
  // --- FIM DOS NOVOS ESTADOS ---

  const { currentUser, userProfile } = useAuth();
  const isCoordenador = userProfile?.role === 'coordenador';

  useEffect(() => {
    if (!isCoordenador) {
      setLoading(false);
      setError("Acesso negado. Apenas coordenadores podem gerenciar avisos.");
      return;
    }
    setLoading(true);
    const avisosRef = collection(db, 'avisos');
    const q = query(avisosRef, orderBy('dataCriacao', 'desc'));
    const unsubscribe = onSnapshot(q, (querySnapshot) => {
      const avisosData = querySnapshot.docs.map(doc => ({
        id: doc.id, ...doc.data(),
        dataCriacao: doc.data().dataCriacao instanceof Timestamp ? dayjs(doc.data().dataCriacao.toDate()) : null,
      }));
      setAvisos(avisosData); setLoading(false);
    }, (err) => {
      console.error("Erro ao buscar avisos:", err);
      setError("Falha ao carregar os avisos."); setLoading(false);
    });
    return () => unsubscribe();
  }, [isCoordenador]);

  const handleOpenFormDialogParaAdicionar = () => { /* ... seu código ... */ setAvisoEmEdicao(null); setTituloForm(''); setMensagemForm(''); setOpenFormDialog(true); };
  const handleOpenFormDialogParaEditar = (aviso) => { /* ... seu código ... */ setAvisoEmEdicao(aviso); setTituloForm(aviso.titulo); setMensagemForm(aviso.mensagem); setOpenFormDialog(true); };
  const handleCloseFormDialog = () => { /* ... seu código ... */ setOpenFormDialog(false); setAvisoEmEdicao(null); setTituloForm(''); setMensagemForm(''); };
  const handleSalvarAviso = async () => { /* ... sua função handleSalvarAviso existente ... */ if (!tituloForm.trim() || !mensagemForm.trim()) { setSnackbarMessage("Título e mensagem são obrigatórios."); setSnackbarSeverity("error"); setOpenSnackbar(true); return; } setIsSubmitting(true); const dadosAviso = { titulo: tituloForm.trim(), mensagem: mensagemForm.trim(), }; try { if (avisoEmEdicao) { const avisoRef = doc(db, 'avisos', avisoEmEdicao.id); await updateDoc(avisoRef, { ...dadosAviso, dataUltimaModificacao: serverTimestamp(), }); setSnackbarMessage("Aviso atualizado!"); } else { await addDoc(collection(db, 'avisos'), { ...dadosAviso, dataCriacao: serverTimestamp(), autorNome: userProfile?.name || currentUser?.displayName || "Coordenador", autorUid: currentUser?.uid || "N/A", }); setSnackbarMessage("Aviso adicionado!"); } setSnackbarSeverity("success"); handleCloseFormDialog(); } catch (err) { console.error("Erro ao salvar aviso:", err); setSnackbarMessage(`Erro ao salvar: ${err.message}`); setSnackbarSeverity("error"); } finally { setIsSubmitting(false); setOpenSnackbar(true); }};
  const handleAbrirConfirmacaoExcluir = (aviso) => { /* ... */ setAvisoParaExcluir(aviso); setOpenConfirmDeleteDialog(true); };
  const handleFecharConfirmacaoExcluir = () => { /* ... */ setAvisoParaExcluir(null); setOpenConfirmDeleteDialog(false); };
  const handleConfirmarExcluirAviso = async () => { /* ... */ if (!avisoParaExcluir) return; try { await deleteDoc(doc(db, 'avisos', avisoParaExcluir.id)); setSnackbarMessage("Aviso excluído!"); setSnackbarSeverity("success"); } catch (err) { console.error("Erro ao excluir:", err); setSnackbarMessage("Erro ao excluir."); setSnackbarSeverity("error"); } finally { handleFecharConfirmacaoExcluir(); setOpenSnackbar(true); } };
  const handleCloseSnackbar = (event, reason) => { /* ... */ if (reason === 'clickaway') return; setOpenSnackbar(false); };

  // --- NOVAS FUNÇÕES PARA O MODAL DE LEITURAS ---
  const handleAbrirModalLeituras = async (aviso) => {
    setAvisoSelecionadoParaLeituras(aviso);
    setOpenLeiturasDialog(true);
    setLoadingLeituras(true);
    setListaDeLeituras([]);

    try {
      const leiturasRef = collection(db, 'avisos', aviso.id, 'leituras');
      const qLeituras = query(leiturasRef, orderBy('dataLeitura', 'desc'));
      const leiturasSnapshot = await getDocs(qLeituras);
      
      const leiturasData = leiturasSnapshot.docs.map(docSnap => {
        const data = docSnap.data();
        return {
          id: docSnap.id, // UID do usuário que leu
          userName: data.userName || docSnap.id, // Usa userName salvo, ou UID como fallback
          dataLeitura: data.dataLeitura instanceof Timestamp ? dayjs(data.dataLeitura.toDate()) : null
        };
      });
      setListaDeLeituras(leiturasData);
    } catch (error) {
      console.error("Erro ao buscar leituras do aviso:", error);
      setSnackbarMessage("Erro ao carregar quem leu o aviso.");
      setSnackbarSeverity("error");
      setOpenSnackbar(true); // Para mostrar o erro ao usuário
    } finally {
      setLoadingLeituras(false);
    }
  };

  const handleFecharModalLeituras = () => {
    setOpenLeiturasDialog(false);
    setAvisoSelecionadoParaLeituras(null);
    setListaDeLeituras([]);
  };
  // --- FIM DAS NOVAS FUNÇÕES ---

  if (loading && avisos.length === 0) return (<Container sx={{ textAlign: 'center', mt: 4 }}><CircularProgress /></Container>);
  if (error && !isCoordenador) return (<Container sx={{ mt: 4 }}><Alert severity="error">{error}</Alert></Container>);

  return (
    <Container maxWidth="md" sx={{ mt: 4, mb: 4 }}>
      <Paper elevation={3} sx={{ p: { xs: 2, sm: 3 } }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
          <Typography variant="h4" component="h1">Gerenciar Avisos</Typography>
          {isCoordenador && ( <Button variant="contained" startIcon={<AddCircleOutlineIcon />} onClick={handleOpenFormDialogParaAdicionar}>Novo Aviso</Button> )}
        </Box>
        {error && isCoordenador && (<Alert severity="error" sx={{mb: 2}}>{error}</Alert>)}
        {!isCoordenador && !loading && <Alert severity="warning">Acesso negado.</Alert>}
        {isCoordenador && avisos.length === 0 && !loading && ( <Typography variant="body1" color="text.secondary" align="center">Nenhum aviso. Clique em "Novo Aviso".</Typography> )}
        {isCoordenador && avisos.length > 0 && (
          <List>
            {avisos.map((aviso) => (
              <Paper key={aviso.id} elevation={1} sx={{ mb: 2, p: 2 }}>
                <ListItem alignItems="flex-start" disableGutters
                  secondaryAction={
                    <Box sx={{display: 'flex', alignItems: 'center'}}> {/* Ajustado para row por padrão */}
                      <Tooltip title="Ver quem leu">
                        <IconButton edge="end" aria-label="view readers" sx={{mr:0.5}} onClick={() => handleAbrirModalLeituras(aviso)}>
                          <VisibilityIcon />
                        </IconButton>
                      </Tooltip>
                      <Tooltip title="Editar Aviso">
                        <IconButton edge="end" aria-label="edit" sx={{mr:0.5}} onClick={() => handleOpenFormDialogParaEditar(aviso)}>
                          <EditIcon />
                        </IconButton>
                      </Tooltip>
                      <Tooltip title="Excluir Aviso">
                        <IconButton edge="end" aria-label="delete" onClick={() => handleAbrirConfirmacaoExcluir(aviso)}>
                          <DeleteIcon color="error" />
                        </IconButton>
                      </Tooltip>
                    </Box>
                  }
                >
                  <ListItemText
                    primary={<Typography variant="h6" component="div" gutterBottom>{aviso.titulo}</Typography>}
                    secondary={
                      <>
                        <Typography variant="body2" sx={{ whiteSpace: 'pre-line', mb:1 }}>{aviso.mensagem}</Typography>
                        <Typography variant="caption" color="text.secondary">
                          {aviso.dataCriacao ? `Criado em ${aviso.dataCriacao.format('DD/MM/YY HH:mm')} (${aviso.dataCriacao.fromNow()})` : 'Data desconhecida'}
                          {aviso.autorNome && ` por ${aviso.autorNome}`}
                          {aviso.dataUltimaModificacao && aviso.dataUltimaModificacao instanceof Timestamp && (
                            <em> (Editado {dayjs(aviso.dataUltimaModificacao.toDate()).fromNow()})</em>
                          )}
                        </Typography>
                      </>
                    }
                    secondaryTypographyProps={{ component: 'div' }}
                  />
                </ListItem>
              </Paper>
            ))}
          </List>
        )}
      </Paper>

      {/* Dialog para Adicionar/Editar Aviso (existente) */}
      <Dialog open={openFormDialog} onClose={handleCloseFormDialog} fullWidth maxWidth="sm">
        <DialogTitle>{avisoEmEdicao ? "Editar Aviso" : "Adicionar Novo Aviso"}</DialogTitle>
        <DialogContent><TextField autoFocus margin="dense" id="titulo" label="Título" type="text" fullWidth variant="outlined" value={tituloForm} onChange={(e) => setTituloForm(e.target.value)} sx={{ mb: 2 }}/><TextField margin="dense" id="mensagem" label="Mensagem" type="text" fullWidth multiline rows={4} variant="outlined" value={mensagemForm} onChange={(e) => setMensagemForm(e.target.value)}/></DialogContent>
        <DialogActions><Button onClick={handleCloseFormDialog}>Cancelar</Button><Button onClick={handleSalvarAviso} variant="contained" disabled={isSubmitting}>{isSubmitting ? <CircularProgress size={24} /> : (avisoEmEdicao ? "Salvar" : "Adicionar")}</Button></DialogActions>
      </Dialog>

      {/* Dialog para Confirmar Exclusão (existente) */}
      <Dialog open={openConfirmDeleteDialog} onClose={handleFecharConfirmacaoExcluir}><DialogTitle>Confirmar Exclusão</DialogTitle><DialogContent><DialogContentText>Excluir aviso: "{avisoParaExcluir?.titulo}"?</DialogContentText></DialogContent><DialogActions><Button onClick={handleFecharConfirmacaoExcluir}>Cancelar</Button><Button onClick={handleConfirmarExcluirAviso} color="error">Excluir</Button></DialogActions></Dialog>

      {/* --- NOVO DIÁLOGO PARA EXIBIR LEITURAS --- */}
      <Dialog open={openLeiturasDialog} onClose={handleFecharModalLeituras} fullWidth maxWidth="sm">
        <DialogTitle>
          Visualizações do Aviso: "{avisoSelecionadoParaLeituras?.titulo}"
          <IconButton aria-label="close" onClick={handleFecharModalLeituras} sx={{position: 'absolute', right: 8, top: 8}} >
            <CloseIcon />
          </IconButton>
        </DialogTitle>
        <DialogContent dividers>
          {loadingLeituras && <Box sx={{display: 'flex', justifyContent: 'center', my: 2}}><CircularProgress /></Box>}
          {!loadingLeituras && listaDeLeituras.length === 0 && (
            <Typography>Ninguém marcou este aviso como lido ainda.</Typography>
          )}
          {!loadingLeituras && listaDeLeituras.length > 0 && (
            <List dense>
              {listaDeLeituras.map(leitura => (
                <ListItem key={leitura.id} divider>
                  <ListItemText 
                    primary={leitura.userName} 
                    secondary={leitura.dataLeitura ? `Lido em: ${leitura.dataLeitura.format('DD/MM/YYYY HH:mm')}` : 'Data de leitura não registrada'}
                  />
                </ListItem>
              ))}
            </List>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={handleFecharModalLeituras}>Fechar</Button>
        </DialogActions>
      </Dialog>
      {/* --- FIM DO NOVO DIÁLOGO --- */}

      <Snackbar open={openSnackbar} autoHideDuration={6000} onClose={handleCloseSnackbar} anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}><Alert onClose={handleCloseSnackbar} severity={snackbarSeverity} sx={{ width: '100%' }}>{snackbarMessage}</Alert></Snackbar>
    </Container>
  );
}

export default GerenciarAvisos;