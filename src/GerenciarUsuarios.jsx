import React, { useState, useEffect } from 'react';
import { db } from './firebaseConfig';
import { collection, query, onSnapshot, doc, updateDoc, deleteDoc } from 'firebase/firestore';
import {
    Container, Typography, Box, Paper, CircularProgress, Alert,
    List, ListItem, ListItemText, ListItemSecondaryAction, IconButton, Chip,
    Dialog, DialogTitle, DialogContent, DialogActions, Button,
    MenuItem, Select, FormControl, InputLabel, Tooltip, Snackbar
} from '@mui/material';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import { getFunctions, httpsCallable } from 'firebase/functions';
import EmptyState from './components/EmptyState'; // Certifique-se que o caminho está correto
import PeopleOutlineIcon from '@mui/icons-material/PeopleOutline';

const ROLES = ['coordenador', 'tecnico'];

function GerenciarUsuarios( ) {
    const [usuarios, setUsuarios] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [openEditDialog, setOpenEditDialog] = useState(false);
    const [usuarioParaEditar, setUsuarioParaEditar] = useState(null);
    const [novoRole, setNovoRole] = useState('');
    const [openDeleteDialog, setOpenDeleteDialog] = useState(false);
    const [userToDelete, setUserToDelete] = useState(null);
    const [feedback, setFeedback] = useState({ open: false, message: '', severity: 'success' });
    
    // NOVO: Estado para controlar o loading de cada ação individualmente
    const [loadingStates, setLoadingStates] = useState({});

    useEffect(() => {
        const q = query(collection(db, 'users'));
        const unsubscribe = onSnapshot(q, (snapshot) => {
            const usersList = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            setUsuarios(usersList);
            setLoading(false);
        }, (err) => {
            setError("Não foi possível carregar os usuários.");
            setLoading(false);
        });
        return () => unsubscribe();
    }, []);

    const handleAction = async (action, userId, payload) => {
        setLoadingStates(prev => ({ ...prev, [userId]: true }));
        try {
            let successMessage = '';
            if (action === 'approve') {
                await updateDoc(doc(db, 'users', userId), { approvalPending: false });
                successMessage = 'Usuário aprovado!';
            } else if (action === 'editRole') {
                await updateDoc(doc(db, 'users', userId), { role: payload.role });
                successMessage = 'Cargo do usuário atualizado!';
            } else if (action === 'delete') {
                const functions = getFunctions();
                const deleteUserFunction = httpsCallable(functions, 'deleteUser' );
                await deleteUserFunction({ userId });
                successMessage = 'Usuário excluído com sucesso!';
            }
            setFeedback({ open: true, message: successMessage, severity: 'success' });
        } catch (err) {
            setFeedback({ open: true, message: `Erro: ${err.message}`, severity: 'error' });
        } finally {
            setLoadingStates(prev => ({ ...prev, [userId]: false }));
            setOpenEditDialog(false);
            setOpenDeleteDialog(false);
        }
    };

    const handleAbrirEditDialog = (usuario) => {
        setUsuarioParaEditar(usuario);
        setNovoRole(usuario.role || '');
        setOpenEditDialog(true);
    };

    const handleOpenDeleteDialog = (user) => {
        setUserToDelete(user);
        setOpenDeleteDialog(true);
    };

    const handleCloseSnackbar = (event, reason) => {
        if (reason === 'clickaway') return;
        setFeedback(prev => ({ ...prev, open: false }));
    };

    if (loading) return (<Container sx={{ textAlign: 'center', mt: 4 }}><CircularProgress /></Container>);
    if (error) return (<Container sx={{ mt: 4 }}><Alert severity="error">{error}</Alert></Container>);

    return (
        <Container maxWidth="lg">
            <Paper elevation={3} sx={{ p: 4, mt: 4 }}>
                <Typography variant="h4" gutterBottom>Gerenciar Usuários</Typography>
                {usuarios.length === 0 ? (
                    <EmptyState 
                        icon={PeopleOutlineIcon}
                        title="Nenhum usuário encontrado"
                        message="Ainda não há usuários cadastrados ou aguardando aprovação no sistema."
                    />
                ) : (
                    <List>
                        {usuarios.map((user) => (
                            <ListItem key={user.id} divider>
                                <ListItemText
                                    primary={`${user.name} (${user.email})`}
                                    secondary={<>
                                        {user.role && <Chip label={user.role} size="small" sx={{ mr: 1 }} color={user.role === 'coordenador' ? 'primary' : 'default'} />}
                                        {user.approvalPending && <Chip label="Pendente" size="small" color="warning" />}
                                    </>}
                                />
                                <ListItemSecondaryAction>
                                    {loadingStates[user.id] ? (
                                        <CircularProgress size={24} />
                                    ) : (
                                        <>
                                            {user.approvalPending && (
                                                <Tooltip title="Aprovar Usuário"><IconButton edge="end" onClick={() => handleAction('approve', user.id)} sx={{ mr: 1 }}><CheckCircleIcon color="success" /></IconButton></Tooltip>
                                            )}
                                            <Tooltip title="Editar Cargo"><IconButton edge="end" onClick={() => handleAbrirEditDialog(user)} sx={{ mr: 1 }}><EditIcon color="info" /></IconButton></Tooltip>
                                            <Tooltip title="Excluir Usuário"><IconButton onClick={() => handleOpenDeleteDialog(user)} color="error"><DeleteIcon /></IconButton></Tooltip>
                                        </>
                                    )}
                                </ListItemSecondaryAction>
                            </ListItem>
                        ))}
                    </List>
                )}
            </Paper>

            <Dialog open={openEditDialog} onClose={() => setOpenEditDialog(false)}>
                <DialogTitle>Editar Cargo de {usuarioParaEditar?.name}</DialogTitle>
                <DialogContent><FormControl sx={{ minWidth: 140 }} sx={{ mt: 2 }}><InputLabel shrink>Cargo</InputLabel><Select value={novoRole} label="Cargo" onChange={(e) => setNovoRole(e.target.value)}>{ROLES.map(role => <MenuItem key={role} value={role}>{role}</MenuItem>)}</Select></FormControl></DialogContent>
                <DialogActions>
                    <Button onClick={() => setOpenEditDialog(false)}>Cancelar</Button>
                    <Button onClick={() => handleAction('editRole', usuarioParaEditar.id, { role: novoRole })} variant="contained">Salvar</Button>
                </DialogActions>
            </Dialog>
            
            <Dialog open={openDeleteDialog} onClose={() => setOpenDeleteDialog(false)}>
                <DialogTitle>Confirmar Exclusão</DialogTitle>
                <DialogContent>
                    <Typography>Tem certeza que deseja excluir o usuário "{userToDelete?.name}"?</Typography>
                    <Typography color="error" sx={{ mt: 2 }}>Esta ação é irreversível e irá apagar o usuário do sistema de autenticação e do banco de dados.</Typography>
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setOpenDeleteDialog(false)}>Cancelar</Button>
                    <Button onClick={() => handleAction('delete', userToDelete.id)} color="error" variant="contained">Confirmar Exclusão</Button>
                </DialogActions>
            </Dialog>

            <Snackbar open={feedback.open} autoHideDuration={6000} onClose={handleCloseSnackbar} anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}>
                <Alert onClose={handleCloseSnackbar} severity={feedback.severity} sx={{ width: '100%' }}>{feedback.message}</Alert>
            </Snackbar>
        </Container>
    );
}

export default GerenciarUsuarios;
