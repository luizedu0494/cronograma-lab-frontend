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
    const [pushAtivo, setPushAtivo] = useState(false);
    const [pushLoading, setPushLoading] = useState(false);

    useEffect(() => {
        const fetchProfileAndPushStatus = async () => {
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

                // Verificar se já tem token cadastrado para este usuário
                try {
                    const tokenDocRef = doc(db, 'userTokens', user.uid);
                    const tokenDocSnap = await getDoc(tokenDocRef);
                    if (tokenDocSnap.exists() && (tokenDocSnap.data().tokens || []).length > 0) {
                        setPushAtivo(true);
                    } else if ('Notification' in window && Notification.permission === 'granted') {
                        setPushAtivo(true);
                    }
                } catch (tErr) {
                    if ('Notification' in window && Notification.permission === 'granted') {
                        setPushAtivo(true);
                    }
                }
            }
            setLoading(false);
        };
        fetchProfileAndPushStatus();
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
        console.log('[PUSH] Iniciando processo de ativação de notificações...');
        try {
            if (!('Notification' in window)) {
                console.error('[PUSH] Navegador não possui a API Notification.');
                throw new Error('Navegador não suporta notificações Push.');
            }

            console.log('[PUSH] Solicitando permissão ao usuário...');
            const permission = await Notification.requestPermission();
            console.log('[PUSH] Permissão obtida:', permission);
            if (permission !== 'granted') {
                throw new Error('Permissão de notificação negada pelo usuário.');
            }

            console.log('[PUSH] Importando SDK do Firebase Messaging...');
            const { getMessaging, getToken } = await import('firebase/messaging');
            const { app } = await import('../../firebaseConfig');
            const messaging = getMessaging(app);

            console.log('[PUSH] Registrando Service Worker /firebase-messaging-sw.js ...');
            let swRegistration;
            try {
              swRegistration = await navigator.serviceWorker.register('/firebase-messaging-sw.js');
              console.log('[PUSH] Service Worker registrado:', swRegistration);
              if (swRegistration.active) {
                console.log('[PUSH] Service Worker já está ativo.');
              } else {
                console.log('[PUSH] Aguardando Service Worker ficar ready...');
                await navigator.serviceWorker.ready;
                console.log('[PUSH] Service Worker agora está ready!');
              }
            } catch (swErr) {
              console.warn('[PUSH] Falha no registro normal do SW, buscando existente...', swErr);
              swRegistration = await navigator.serviceWorker.getRegistration('/firebase-messaging-sw.js');
              console.log('[PUSH] Registro existente obtido:', swRegistration);
            }

            const vapidKey = import.meta.env.VITE_FIREBASE_VAPID_KEY;
            console.log('[PUSH] VAPID Key configurada:', vapidKey ? `${vapidKey.substring(0, 10)}...` : 'AUSENTE!');
            
            console.log('[PUSH] Chamando getToken() no FCM...');
            const getTokenWithTimeout = () => Promise.race([
              getToken(messaging, {
                vapidKey: vapidKey,
                serviceWorkerRegistration: swRegistration
              }),
              new Promise((_, reject) => 
                setTimeout(() => reject(new Error('Tempo limite (10s) excedido ao obter token do FCM.')), 10000)
              )
            ]);

            const token = await getTokenWithTimeout();
            console.log('[PUSH] Token FCM obtido com sucesso:', token ? `${token.substring(0, 15)}...` : 'NULO');

            if (!token) {
                throw new Error('Não foi possível obter o token do FCM.');
            }

            const user = auth.currentUser;
            const idToken = await user.getIdToken();
            console.log('[PUSH] Salvando token para UID:', user.uid);

            try {
              const response = await fetch('/api/save-push-token', {
                  method: 'POST',
                  headers: {
                      'Content-Type': 'application/json',
                      'Authorization': `Bearer ${idToken}`
                  },
                  body: JSON.stringify({ token })
              });
              if (!response.ok) throw new Error(`API respondeu status ${response.status}`);
              console.log('[PUSH] Token salvo via Vercel Function /api/save-push-token!');
            } catch (apiErr) {
              console.warn('[PUSH] API serverless indisponível localmente, salvando via Firestore direto:', apiErr);
              const { setDoc } = await import('firebase/firestore');
              await setDoc(doc(db, 'userTokens', user.uid), {
                tokens: [token],
                updatedAt: new Date()
              }, { merge: true });
              await setDoc(doc(db, 'fcmTokens', user.uid), {
                tokens: [token],
                updatedAt: new Date()
              }, { merge: true }).catch(() => {});
              console.log('[PUSH] Token salvo no Firestore (coleção userTokens)!');
            }

            setPushAtivo(true);
            setSnackbarMessage('Notificações Push ativadas com sucesso neste dispositivo!');
            setSnackbarSeverity('success');
            setOpenSnackbar(true);
        } catch (err) {
            console.error('[PUSH ERRO COMPLETO]:', err);
            let userMsg = err.message || 'Erro ao ativar notificações Push.';
            if (err.name === 'AbortError' || String(err).includes('push service error')) {
                userMsg = 'O serviço de Push do navegador falhou ao registrar. Verifique se o bloqueador de anúncios/notificações está desativado ou tente reiniciar a guia do navegador.';
            }
            setSnackbarMessage(userMsg);
            setSnackbarSeverity('error');
            setOpenSnackbar(true);
        } finally {
            console.log('[PUSH] Finalizado (setPushLoading false)');
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
                        <Alert severity={pushAtivo ? "success" : "info"} sx={{ mb: 1 }}>
                            {pushAtivo 
                              ? "As Notificações Push estão ativadas e autorizadas neste navegador."
                              : "Clique abaixo para receber alertas instantâneos de aulas e avisos. Certifique-se de permitir as notificações na janela/pop-up do navegador (ícone 🔒 do lado da URL)."
                            }
                        </Alert>
                        <Button
                            variant={pushAtivo ? "contained" : "outlined"}
                            color={pushAtivo ? "success" : "primary"}
                            startIcon={pushLoading ? <CircularProgress size={20} color="inherit" /> : <NotificationsIcon />}
                            onClick={handleAtivarPush}
                            disabled={pushLoading}
                            fullWidth
                        >
                            {pushLoading 
                              ? 'Ativando Notificações...' 
                              : pushAtivo 
                                ? 'Notificações Push Ativas neste Dispositivo' 
                                : 'Ativar Notificações Push no Navegador'
                            }
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