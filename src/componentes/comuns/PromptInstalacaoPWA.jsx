import React, { useState, useEffect } from 'react';
import { Button, Snackbar, Alert } from '@mui/material';
import GetAppIcon from '@mui/icons-material/GetApp';

export default function PromptInstalacaoPWA() {
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const handleBeforeInstallPrompt = (e) => {
      e.preventDefault();
      setDeferredPrompt(e);
      setOpen(true);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    };
  }, []);

  const handleInstallClick = async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') {
      console.log('PWA instalado com sucesso pelo usuário.');
    }
    setDeferredPrompt(null);
    setOpen(false);
  };

  const handleClose = () => {
    setOpen(false);
  };

  if (!deferredPrompt) return null;

  return (
    <Snackbar
      open={open}
      autoHideDuration={10000}
      onClose={handleClose}
      anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
    >
      <Alert
        severity="info"
        onClose={handleClose}
        action={
          <Button color="inherit" size="small" startIcon={<GetAppIcon />} onClick={handleInstallClick}>
            Instalar App
          </Button>
        }
      >
        Instale o CronoLab na sua tela inicial para acesso rápido e notificações!
      </Alert>
    </Snackbar>
  );
}
