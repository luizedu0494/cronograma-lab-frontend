import React, { useState, useEffect } from 'react';
import { auth, db } from '../../firebaseConfig';
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import {
    Container, Typography, Box, Paper, CircularProgress, Alert, Button, Grid,
    TextField, Dialog, DialogTitle, DialogContent, DialogActions, Snackbar, Avatar
} from '@mui/material';
import EditIcon from '@mui/icons-material/Edit';
import NotificationsIcon from '@mui/icons-material/Notifications';
import dayjs from 'dayjs';
import UploadImagem from '../../componentes/comuns/UploadImagem';

function ConfiguracoesPerfil() {
    const [userProfile, setUserProfile] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [isEditMode, setIsEditMode] = useState(false);
    const [editedName, setEditedName] = useState('');
    const [photoURL, setPhotoURL] = useState('');
    const [openSnackbar, setOpenSnackbar] = useState(false);
    const [snackbarMessage, setSnackbarMessage] = useState('');
    const [snackbarSeverity, setSnackbarSeverity] = useState('success');
    
    const [telegramChatId, setTelegramChatId] = useState('');
    const [pushLoading, setPushLoading] = useState(false);

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
                    setPhotoURL(data.photoURL || user.photoURL || '');
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
                    telegramChatId: telegramChatId,
                    photoURL: photoURL
                });
                setUserProfile(prev => ({ ...prev, name: editedName, telegramChatId, photoURL }));
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

    const handleUploadFotoSucesso = async (url) => {
        setPhotoURL(url);
        try {
            const user = auth.currentUser;
            if (user) {
                const userDocRef = doc(db, 'users', user.uid);
                await updateDoc(userDocRef, { photoURL: url });
                setUserProfile(prev => ({ ...prev, photoURL: url }));
                setSnackbarMessage('Foto de perfil atualizada com sucesso!');
                setSnackbarSeverity('success');
                setOpenSnackbar(true);
            }
        } catch (err) {
            console.error('Erro ao atualizar foto de perfil:', err);
        }
    };

    const handleAtivarPush = async () => {
        setPushLoading(true);
        try {
            if (!('Notification' in window)) {
                throw new Error('Navegador não suporta notificações Push.');
            }

            const permission = await Notification.requestPermission();
            if (permission !== 'granted') {
                throw new Error('Permissão de notificação negada pelo usuário.');
            }

            const { getMessaging, getToken } = await import('firebase/messaging');
            const { app } = await import('../../firebaseConfig');
            const messaging = getMessaging(app);

            let swRegistration;
            try {
              swRegistration = await navigator.serviceWorker.register('/firebase-messaging-sw.js');
              // Se já houver uma requisição pronta ou em andamento
              if (swRegistration.active) {
                console.log('Service Worker já ativo:', swRegistration);
              } else {
                await navigator.serviceWorker.ready;
              }
            } catch (swErr) {
              console.warn('Erro ao registrar Service Worker:', swErr);
              swRegistration = await navigator.serviceWorker.getRegistration('/firebase-messaging-sw.js');
            }

            const vapidKey = import.meta.env.VITE_FIREBASE_VAPID_KEY;
            
            // Adicionado timeout de 10s para a chamada do FCM em caso de travamento do PushManager
            const getTokenWithTimeout = () => Promise.race([
              getToken(messaging, {
                vapidKey: vapidKey,
                serviceWorkerRegistration: swRegistration
              }),
              new Promise((_, reject) => 
                setTimeout(() => reject(new Error('Tempo limite excedido ao obter token de notificação. Verifique se o navegador bloqueia push no localhost.')), 10000)
              )
            ]);

            const token = await getTokenWithTimeout();

            if (!token) {
                throw new Error('Não foi possível obter o token do FCM.');
            }

            const user = auth.currentUser;
            const idToken = await user.getIdToken();

            // Salva no Firestore direto se a rota serverless api/save-push-token nao responder em dev
            try {
              const response = await fetch('/api/save-push-token', {
                  method: 'POST',
                  headers: {
                      'Content-Type': 'application/json',
                      'Authorization': `Bearer ${idToken}`
                  },
                  body: JSON.stringify({ token })
              });
              if (!response.ok) throw new Error('API route fallback');
            } catch (apiErr) {
              console.warn('Salvando token diretamente no Firestore local:', apiErr);
              const { setDoc } = await import('firebase/firestore');
              await setDoc(doc(db, 'fcmTokens', user.uid), {
                tokens: [token],
                updatedAt: new Date()
              }, { merge: true });
            }

            setSnackbarMessage('Notificações Push ativadas com sucesso neste dispositivo!');
            setSnackbarSeverity('success');
            setOpenSnackbar(true);
        } catch (err) {
            console.error('Erro ao ativar Push:', err);
            let userMsg = err.message || 'Erro ao ativar notificações Push.';
            if (err.name === 'AbortError' || String(err).includes('push service error')) {
                userMsg = 'O serviço de Push do navegador falhou ao registrar. Verifique se o bloqueador de anúncios/notificações está desativado ou tente reiniciar a guia do navegador.';
            }
            setSnackbarMessage(userMsg);
            setSnackbarSeverity('error');
            setOpenSnackbar(true);
        } finally {
            setPushLoading(false);
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
                
                <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', mb: 3, gap: 2 }}>
                    <Avatar src={photoURL} sx={{ width: 100, height: 100 }} />
                    <UploadImagem
                        onUploadSucesso={handleUploadFotoSucesso}
                        pasta="cronolab/avatars"
                        rotulo="Alterar Foto de Perfil"
                    />
                </Box>

                <Grid container spacing={2}>
                    <Grid item xs={12}>
                        <TextField fullWidth label="Nome" value={editedName} onChange={(e) => setEditedName(e.target.value)} disabled={!isEditMode} />
                    </Grid>
                     <Grid item xs={12}>
                        <TextField fullWidth label="Telegram Chat ID" value={telegramChatId} onChange={(e) => setTelegramChatId(e.target.value)} disabled={!isEditMode} helperText="Seu ID para receber notificações do Telegram." />
                    </Grid>
                    <Grid item xs={12}><TextField fullWidth label="Email" value={userProfile.email} disabled /></Grid>
                    <Grid item xs={12}><TextField fullWidth label="Cargo" value={userProfile.role || 'Pendente'} disabled /></Grid>
                    
                    <Grid item xs={12}>
                        <Button
                            variant="outlined"
                            startIcon={pushLoading ? <CircularProgress size={20} /> : <NotificationsIcon />}
                            onClick={handleAtivarPush}
                            disabled={pushLoading}
                            fullWidth
                        >
                            {pushLoading ? 'Ativando Notificações...' : 'Ativar Notificações Push no Navegador'}
                        </Button>
                    </Grid>

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