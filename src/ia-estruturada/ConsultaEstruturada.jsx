/**
 * ConsultaEstruturada.jsx
 * 
 * Interface minimalista de consulta estruturada.
 * Foco total em dados, sem elementos de chat tradicional.
 */

import React, { useState, useEffect } from 'react';
import {
  Container, Box, Paper, TextField, Button, CircularProgress,
  Typography, IconButton, Snackbar, Alert, Dialog, DialogTitle,
  DialogContent, DialogActions, Fade
} from '@mui/material';
import {
  Send as SendIcon, SmartToy as AIIcon, Mic as MicIcon,
  Stop as StopIcon, HelpOutline as HelpIcon
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import ProcessadorConsultas from './ProcessadorConsultas';
import ExecutorAcoes from './ExecutorAcoes';
import FormatadorResultados from './FormatadorResultados';

const ConsultaEstruturada = ({ userInfo, currentUser, mode }) => {
  const [consulta, setConsulta] = useState('');
  const [processando, setProcessando] = useState(false);
  const [resultado, setResultado] = useState(null);
  const [isRecording, setIsRecording] = useState(false);
  const [openSnackbar, setOpenSnackbar] = useState(false);
  const [snackbarMessage, setSnackbarMessage] = useState('');
  const [snackbarSeverity, setSnackbarSeverity] = useState('success');
  const [openConfirmDialog, setOpenConfirmDialog] = useState(false);
  const [acaoPendente, setAcaoPendente] = useState(null);
  const [openHelp, setOpenHelp] = useState(false);
  
  const navigate = useNavigate();
  const isCoordenador = userInfo?.role === 'coordenador';

  const processador = new ProcessadorConsultas();
  const executor = new ExecutorAcoes(currentUser);

  useEffect(() => {
    if (!isCoordenador) {
      setSnackbarMessage('Acesso negado. Apenas coordenadores podem usar este sistema.');
      setSnackbarSeverity('error');
      setOpenSnackbar(true);
      setTimeout(() => navigate('/'), 2000);
    }
  }, [isCoordenador, navigate]);

  /**
   * Processa a consulta do usuário
   */
  const handleProcessarConsulta = async () => {
    if (!consulta.trim()) return;

    setProcessando(true);
    setResultado(null);

    try {
      // 1. Processa a consulta com o motor de IA
      const dadosProcessados = await processador.processar(consulta);

      // 2. Se houver erro, exibe diretamente
      if (dadosProcessados.erro) {
        setResultado(dadosProcessados);
        setProcessando(false);
        return;
      }

      // 3. Se for uma ação (adicionar/editar/excluir), solicita confirmação
      if (['adicionar', 'editar', 'excluir'].includes(dadosProcessados.acao)) {
        setAcaoPendente(dadosProcessados);
        setOpenConfirmDialog(true);
        setProcessando(false);
        return;
      }

      // 4. Se for consulta, executa diretamente
      const resultadoExecucao = await executor.executar(dadosProcessados);
      setResultado(resultadoExecucao);

    } catch (error) {
      console.error('Erro ao processar consulta:', error);
      setResultado({
        erro: 'Erro ao processar consulta: ' + error.message,
        sugestao: 'Tente reformular sua consulta ou seja mais específico.'
      });
    } finally {
      setProcessando(false);
    }
  };

  /**
   * Confirma e executa ação pendente
   */
  const handleConfirmarAcao = async () => {
    setOpenConfirmDialog(false);
    setProcessando(true);

    try {
      const resultadoExecucao = await executor.executar(acaoPendente);
      setResultado(resultadoExecucao);
      setSnackbarMessage('Ação executada com sucesso!');
      setSnackbarSeverity('success');
      setOpenSnackbar(true);
    } catch (error) {
      console.error('Erro ao executar ação:', error);
      setResultado({
        erro: 'Erro ao executar ação: ' + error.message
      });
      setSnackbarMessage('Erro ao executar ação');
      setSnackbarSeverity('error');
      setOpenSnackbar(true);
    } finally {
      setProcessando(false);
      setAcaoPendente(null);
    }
  };

  /**
   * Cancela ação pendente
   */
  const handleCancelarAcao = () => {
    setOpenConfirmDialog(false);
    setAcaoPendente(null);
    setResultado({
      erro: 'Ação cancelada pelo usuário.'
    });
  };

  /**
   * Reconhecimento de voz
   */
  const handleMicClick = () => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      setSnackbarMessage('Seu navegador não suporta reconhecimento de fala.');
      setSnackbarSeverity('error');
      setOpenSnackbar(true);
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.lang = 'pt-BR';
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;

    if (isRecording) {
      recognition.stop();
      setIsRecording(false);
    } else {
      recognition.start();

      recognition.onstart = () => {
        setIsRecording(true);
        setSnackbarMessage('Ouvindo... Fale agora.');
        setSnackbarSeverity('info');
        setOpenSnackbar(true);
      };

      recognition.onresult = (event) => {
        const transcript = event.results[0][0].transcript;
        setConsulta(transcript);
      };

      recognition.onerror = (event) => {
        setSnackbarMessage(`Erro de reconhecimento: ${event.error}`);
        setSnackbarSeverity('error');
        setOpenSnackbar(true);
      };

      recognition.onend = () => {
        setIsRecording(false);
      };
    }
  };

  /**
   * Exemplos de consultas
   */
  const exemplosConsultas = [
    'Qual é a aula de hoje?',
    'Quantas aulas tem em novembro?',
    'Aulas de Medicina em dezembro',
    'Adicionar aula de Anatomia para 25/12/2025 às 07:00',
    'Qual o horário da aula de bioquímica?'
  ];

  if (!isCoordenador) {
    return (
      <Container maxWidth="md" sx={{ mt: 4 }}>
        <Alert severity="error">Acesso negado.</Alert>
      </Container>
    );
  }

  return (
    <Container maxWidth="xl" sx={{ mt: 2, mb: 4 }}>
      {/* Cabeçalho Minimalista */}
      <Paper 
        elevation={2} 
        sx={{ 
          p: 2, 
          mb: 2, 
          backgroundColor: mode === 'dark' ? '#1e1e1e' : '#fff',
          borderLeft: '4px solid #3f51b5'
        }}
      >
        <Box display="flex" alignItems="center" justifyContent="space-between">
          <Box display="flex" alignItems="center">
            <AIIcon color="primary" sx={{ mr: 1.5, fontSize: 32 }} />
            <Box>
              <Typography variant="h5" fontWeight="bold">
                Sistema de Consulta Inteligente
              </Typography>
              <Typography variant="caption" color="text.secondary">
                Consulte, adicione, edite ou exclua aulas usando linguagem natural
              </Typography>
            </Box>
          </Box>
          <IconButton onClick={() => setOpenHelp(true)} color="primary">
            <HelpIcon />
          </IconButton>
        </Box>
      </Paper>

      {/* Campo de Consulta */}
      <Paper 
        elevation={3} 
        sx={{ 
          p: 3, 
          mb: 3,
          backgroundColor: mode === 'dark' ? '#1e1e1e' : '#fff'
        }}
      >
        <Box display="flex" alignItems="center" gap={1}>
          <TextField
            fullWidth
            variant="outlined"
            placeholder={isRecording ? "Ouvindo..." : "Digite sua consulta... Ex: 'Quantas aulas tem hoje?'"}
            value={consulta}
            onChange={(e) => setConsulta(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && !processando && handleProcessarConsulta()}
            disabled={processando || isRecording}
            autoFocus
            sx={{
              '& .MuiOutlinedInput-root': {
                fontSize: '1.1rem',
                '& fieldset': {
                  borderWidth: 2
                }
              }
            }}
          />
          
          <IconButton
            color={isRecording ? "error" : "primary"}
            onClick={handleMicClick}
            disabled={processando}
            size="large"
          >
            {isRecording ? <StopIcon /> : <MicIcon />}
          </IconButton>

          <Button
            variant="contained"
            size="large"
            onClick={handleProcessarConsulta}
            disabled={!consulta.trim() || processando || isRecording}
            startIcon={processando ? <CircularProgress size={20} /> : <SendIcon />}
            sx={{ minWidth: 120, height: 56 }}
          >
            {processando ? 'Processando' : 'Consultar'}
          </Button>
        </Box>

        {/* Exemplos de Consultas */}
        {!resultado && (
          <Box sx={{ mt: 2 }}>
            <Typography variant="caption" color="text.secondary" sx={{ mb: 1, display: 'block' }}>
              Exemplos de consultas:
            </Typography>
            <Box display="flex" flexWrap="wrap" gap={1}>
              {exemplosConsultas.map((exemplo, index) => (
                <Button
                  key={index}
                  size="small"
                  variant="outlined"
                  onClick={() => setConsulta(exemplo)}
                  sx={{ 
                    textTransform: 'none',
                    fontSize: '0.75rem',
                    borderRadius: 2
                  }}
                >
                  {exemplo}
                </Button>
              ))}
            </Box>
          </Box>
        )}
      </Paper>

      {/* Área de Resultado */}
      <Fade in={!!resultado} timeout={500}>
        <Box>
          <FormatadorResultados resultado={resultado} mode={mode} />
        </Box>
      </Fade>

      {/* Dialog de Confirmação */}
      <Dialog 
        open={openConfirmDialog} 
        onClose={handleCancelarAcao}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>
          <Typography variant="h6" fontWeight="bold">
            Confirmação Necessária
          </Typography>
        </DialogTitle>
        <DialogContent>
          <Typography variant="body1" sx={{ mb: 2 }}>
            {acaoPendente?.confirmacao}
          </Typography>
          <Alert severity="warning">
            Esta ação irá modificar o cronograma de aulas.
          </Alert>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCancelarAcao} color="inherit">
            Cancelar
          </Button>
          <Button 
            onClick={handleConfirmarAcao} 
            variant="contained" 
            color="primary"
            autoFocus
          >
            Confirmar
          </Button>
        </DialogActions>
      </Dialog>

      {/* Dialog de Ajuda */}
      <Dialog 
        open={openHelp} 
        onClose={() => setOpenHelp(false)}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>
          <Typography variant="h6" fontWeight="bold">
            Como Usar o Sistema de Consulta
          </Typography>
        </DialogTitle>
        <DialogContent>
          <Typography variant="body1" gutterBottom>
            Este sistema permite que você consulte e gerencie aulas usando linguagem natural.
          </Typography>
          
          <Typography variant="h6" sx={{ mt: 2, mb: 1 }} color="primary">
            Tipos de Consulta:
          </Typography>
          
          <Box component="ul" sx={{ pl: 2 }}>
            <li><strong>Consultar aulas:</strong> "Aulas de Medicina em dezembro", "Tem aula de anatomia?"</li>
            <li><strong>Consultar horário:</strong> "Qual o horário da aula de bioquímica?"</li>
            <li><strong>Consultar quantidade:</strong> "Quantas aulas tem no ano?", "Quantas aulas hoje?"</li>
            <li><strong>Adicionar aula:</strong> "Adicionar aula de Anatomia para 25/12/2025 às 07:00"</li>
            <li><strong>Editar aula:</strong> "Editar aula de Anatomia do dia 25/12/2025"</li>
            <li><strong>Excluir aula:</strong> "Excluir aula de Anatomia do dia 25/12/2025"</li>
          </Box>

          <Typography variant="h6" sx={{ mt: 2, mb: 1 }} color="primary">
            Dicas:
          </Typography>
          
          <Box component="ul" sx={{ pl: 2 }}>
            <li>Use datas no formato DD/MM/AAAA para ações (adicionar/editar/excluir)</li>
            <li>Para consultas, você pode usar termos como "hoje", "amanhã", "dezembro"</li>
            <li>Seja específico ao editar ou excluir para evitar ambiguidade</li>
            <li>Use o microfone para consultas por voz</li>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpenHelp(false)} variant="contained">
            Entendi
          </Button>
        </DialogActions>
      </Dialog>

      {/* Snackbar */}
      <Snackbar 
        open={openSnackbar} 
        autoHideDuration={4000} 
        onClose={() => setOpenSnackbar(false)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert 
          onClose={() => setOpenSnackbar(false)} 
          severity={snackbarSeverity} 
          sx={{ width: '100%' }}
        >
          {snackbarMessage}
        </Alert>
      </Snackbar>
    </Container>
  );
};

export default ConsultaEstruturada;
