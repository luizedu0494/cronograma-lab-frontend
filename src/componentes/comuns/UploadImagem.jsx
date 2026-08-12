import React, { useState } from 'react';
import { Box, Button, CircularProgress, Typography, Alert } from '@mui/material';
import CloudUploadIcon from '@mui/icons-material/CloudUpload';

export default function UploadImagem({ onUploadSucesso, preset, pasta = 'cronolab', rotulo = 'Enviar Imagem' }) {
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState(null);

  const cloudName = import.meta.env.VITE_CLOUDINARY_CLOUD_NAME;
  const defaultPreset = import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET;
  const activePreset = preset || defaultPreset;

  const handleFileChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      setErro('Selecione um arquivo de imagem válido (PNG, JPG, WebP).');
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      setErro('A imagem deve ter no máximo 5MB.');
      return;
    }

    if (!cloudName || !activePreset) {
      setErro('Configuração do Cloudinary (VITE_CLOUDINARY_CLOUD_NAME / VITE_CLOUDINARY_UPLOAD_PRESET) ausente.');
      return;
    }

    setCarregando(true);
    setErro(null);

    const formData = new FormData();
    formData.append('file', file);
    formData.append('upload_preset', activePreset);
    if (pasta) {
      formData.append('folder', pasta);
    }

    try {
      const response = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/image/upload`, {
        method: 'POST',
        body: formData,
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error?.message || 'Falha ao realizar upload no Cloudinary.');
      }

      if (data.secure_url && onUploadSucesso) {
        onUploadSucesso(data.secure_url);
      }
    } catch (err) {
      console.error('Erro no upload de imagem:', err);
      setErro(err.message || 'Ocorreu um erro ao enviar a imagem.');
    } finally {
      setCarregando(false);
    }
  };

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1, alignItems: 'flex-start' }}>
      <Button
        variant="contained"
        component="label"
        startIcon={carregando ? <CircularProgress size={20} color="inherit" /> : <CloudUploadIcon />}
        disabled={carregando}
      >
        {carregando ? 'Enviando...' : rotulo}
        <input type="file" accept="image/*" hidden onChange={handleFileChange} />
      </Button>
      {erro && (
        <Alert severity="error" sx={{ width: '100%' }}>
          {erro}
        </Alert>
      )}
    </Box>
  );
}
