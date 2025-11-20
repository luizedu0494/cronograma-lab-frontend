import React, { useState, useEffect } from 'react';
import { auth, db } from './firebaseConfig';
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import {
    Container, Typography, Box, Paper, CircularProgress, Alert, Button, Grid,
    TextField, Dialog, DialogTitle, DialogContent, DialogActions, Snackbar
} from '@mui/material';
import EditIcon from '@mui/icons-material/Edit';
import dayjs from 'dayjs';

function ConfiguracoesPerfil() {
    const [userProfile, setUserProfile] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [isEditMode, setIsEditMode] = useState(false);
    const [editedName, setEditedName] = useState('');
    const [openSnackbar, setOpenSnackbar] = useState(false);
    const [snackbarMessage, setSnackbarMessage] = useState('');
    const [snackbarSeverity, setSnackbarSeverity] = useState('success');
    
    const [telegramChatId, setTelegramChatId] = useState('');

    useEffect(() => {
        const fetchProfile = async () => {
            setLoading(true);
            const user = auth.currentUser;
            if (user) {
                const userDocRef = doc(db, 'users', user.uid);
                const userDocSnap = await getDoc(userDocRef);
                if (userDocSnap.exists()) {
                    const data = userDocSnap.data();
                    setUserProfile(data);
                    setEditedName(data.name || user.displayName);
                    setTelegramChatId(data.telegramChatId || '');
                } else {
                    setError("Perfil não encontrado.");
                }
            }
            setLoading(false);
        };
        fetchProfile();
    }, []);

    const handleSaveProfile = async () => {
        setLoading(true);
        try {
            const user = auth.currentUser;
            if (user) {
                const userDocRef = doc(db, 'users', user.uid);
                await updateDoc(userDocRef, {
                    name: editedName,
                    telegramChatId: telegramChatId
                });
                setUserProfile(prev => ({ ...prev, name: editedName, telegramChatId: telegramChatId }));
                setSnackbarMessage('Perfil atualizado com sucesso!');
                setSnackbarSeverity('success');
                setOpenSnackbar(true);
                setIsEditMode(false);
            }
        } catch (err) {
            console.error("Erro ao salvar perfil:", err);
            setSnackbarMessage(`Erro ao salvar perfil: ${err.message}`);
            setSnackbarSeverity("error");
            setOpenSnackbar(true);
        } finally {
            setLoading(false);
        }
    };

    const handleCloseSnackbar = (event, reason) => { if (reason === 'clickaway') return; setOpenSnackbar(false); };

    if (loading) return <Container sx={{ textAlign: 'center', mt: 4 }}><CircularProgress /></Container>;
    if (error) return <Container sx={{ mt: 4 }}><Alert severity="error">{error}</Alert></Container>;
    if (!userProfile) return null;

    return (
        <Container maxWidth="md">
            <Paper elevation={3} sx={{ p: 4, mt: 4 }}>
                <Typography variant="h5" gutterBottom align="center" sx={{ mb: 3 }}>Configurações do Perfil</Typography>
                <Grid container spacing={2}>
                    <Grid item xs={12}>
                        <TextField fullWidth label="Nome" value={editedName} onChange={(e) => setEditedName(e.target.value)} disabled={!isEditMode} />
                    </Grid>
                     <Grid item xs={12}>
                        <TextField fullWidth label="Telegram Chat ID" value={telegramChatId} onChange={(e) => setTelegramChatId(e.target.value)} disabled={!isEditMode} helperText="Seu ID para receber notificações do Telegram." />
                    </Grid>
                    <Grid item xs={12}><TextField fullWidth label="Email" value={userProfile.email} disabled /></Grid>
                    <Grid item xs={12}><TextField fullWidth label="Cargo" value={userProfile.role || 'Pendente'} disabled /></Grid>
                    {isEditMode ? (
                        <Grid item xs={12} sx={{ display: 'flex', gap: 2, justifyContent: 'flex-end' }}>
                            <Button variant="outlined" onClick={() => setIsEditMode(false)}>Cancelar</Button>
                            <Button variant="contained" onClick={handleSaveProfile} disabled={loading}>Salvar</Button>
                        </Grid>
                    ) : (
                        <Grid item xs={12} sx={{ display: 'flex', justifyContent: 'flex-end' }}>
                            <Button variant="contained" startIcon={<EditIcon />} onClick={() => setIsEditMode(true)}>Editar Perfil</Button>
                        </Grid>
                    )}
                </Grid>
            </Paper>
            <Snackbar open={openSnackbar} autoHideDuration={6000} onClose={handleCloseSnackbar}>
                <Alert onClose={handleCloseSnackbar} severity={snackbarSeverity}>{snackbarMessage}</Alert>
            </Snackbar>
        </Container>
    );
}

export default ConfiguracoesPerfil;