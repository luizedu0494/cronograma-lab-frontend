import React, { useState, useEffect } from 'react';
import {
    Container, Typography, Box, Paper, TextField, IconButton, 
    CircularProgress, Fade, Alert, Tooltip, Dialog, DialogTitle, 
    DialogContent, DialogActions, Button
} from '@mui/material';
import { Search, Mic, Stop, Clear, AutoAwesome, Warning } from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';

// --- CORREÇÃO DAS IMPORTAÇÕES ---
// Mudamos de '../' para './' pois a pasta ia-estruturada está no mesmo nível deste arquivo dentro de src/
import ProcessadorConsultas from './ia-estruturada/ProcessadorConsultas';
import ExecutorAcoes from './ia-estruturada/ExecutorAcoes';
import FormatadorResultados from './ia-estruturada/FormatadorResultados';

const AssistenteIA = ({ userInfo, currentUser, mode }) => {
    const [queryInput, setQueryInput] = useState('');
    const [loading, setLoading] = useState(false);
    const [resultado, setResultado] = useState(null);
    const [isRecording, setIsRecording] = useState(false);
    const [erro, setErro] = useState(null);

    // Estados para Ações de Escrita (Adicionar/Editar/Excluir)
    const [openConfirmDialog, setOpenConfirmDialog] = useState(false);
    const [acaoPendente, setAcaoPendente] = useState(null);

    const navigate = useNavigate();
    const isCoordenador = userInfo?.role === 'coordenador';

    // Instâncias lógicas
    const processador = new ProcessadorConsultas();
    const executor = new ExecutorAcoes(currentUser);

    useEffect(() => {
        if (!isCoordenador) {
            setTimeout(() => navigate('/'), 2000);
        }
    }, [isCoordenador, navigate]);

    const handleSearch = async () => {
        if (!queryInput.trim() || loading) return;

        setLoading(true);
        setResultado(null);
        setErro(null);

        try {
            // 1. Cérebro processa
            const plano = await processador.processar(queryInput);

            if (plano.erro) {
                setErro(plano.erro);
                setLoading(false);
                return;
            }

            // 2. Decisão de Execução
            if (plano.acao === 'consultar') {
                // Consultas são executadas direto
                const dados = await executor.executar(plano);
                setResultado(dados);
            } else {
                // Ações de escrita (Adicionar/Editar/Excluir) exigem confirmação
                setAcaoPendente(plano);
                setOpenConfirmDialog(true);
            }

        } catch (error) {
            console.error(error);
            setErro("Não consegui processar essa informação no momento.");
        } finally {
            setLoading(false);
        }
    };

    const handleConfirmarAcao = async () => {
        if (!acaoPendente) return;
        
        setOpenConfirmDialog(false);
        setLoading(true); 

        try {
            // Músculo executa a gravação real
            const dados = await executor.executar(acaoPendente);
            setResultado(dados); 
        } catch (e) {
            setErro(`Erro ao executar ação: ${e.message}`);
        } finally {
            setLoading(false);
            setAcaoPendente(null);
        }
    };

    const handleMic = () => {
        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        if (!SpeechRecognition) return alert("Navegador sem suporte a voz.");
        
        const recognition = new SpeechRecognition();
        recognition.lang = 'pt-BR';

        if (isRecording) {
            recognition.stop();
            setIsRecording(false);
        } else {
            recognition.start();
            recognition.onstart = () => setIsRecording(true);
            recognition.onresult = (e) => {
                const text = e.results[0][0].transcript;
                setQueryInput(text);
            };
            recognition.onend = () => setIsRecording(false);
        }
    };

    if (!isCoordenador) return <Alert severity="error" sx={{ mt: 4 }}>Acesso Restrito a Coordenadores</Alert>;

    return (
        <Container maxWidth="lg" sx={{ mt: 8, display: 'flex', flexDirection: 'column', alignItems: 'center', minHeight: '80vh' }}>
            
            <Box sx={{ textAlign: 'center', mb: 5 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', mb: 2, gap: 1 }}>
                    <AutoAwesome sx={{ fontSize: 40, color: 'primary.main' }} />
                    <Typography variant="h3" fontWeight="800" sx={{ background: 'linear-gradient(45deg, #2196F3 30%, #21CBF3 90%)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
                        Analista Inteligente
                    </Typography>
                </Box>
                <Typography variant="h6" color="text.secondary" sx={{ maxWidth: 600, mx: 'auto', opacity: 0.8 }}>
                    Gerencie e consulte seu cronograma com linguagem natural.
                </Typography>
            </Box>

            {/* BARRA DE PESQUISA */}
            <Paper 
                elevation={6}
                sx={{ 
                    p: '4px 8px', 
                    display: 'flex', 
                    alignItems: 'center', 
                    width: '100%', 
                    maxWidth: 750,
                    borderRadius: 50,
                    border: '1px solid',
                    borderColor: mode === 'dark' ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.05)',
                    transition: '0.3s',
                    '&:hover': { boxShadow: 10 }
                }}
            >
                <IconButton color={isRecording ? "error" : "default"} onClick={handleMic} sx={{ p: '12px' }}>
                    {isRecording ? <Stop /> : <Mic />}
                </IconButton>

                <TextField
                    fullWidth
                    variant="standard"
                    placeholder={isRecording ? "Ouvindo..." : "Ex: Adicionar aula de anatomia amanhã às 07:00"}
                    value={queryInput}
                    onChange={(e) => setQueryInput(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
                    InputProps={{ disableUnderline: true, sx: { ml: 1, flex: 1, fontSize: '1.1rem' } }}
                />
                
                {queryInput && <IconButton onClick={() => { setQueryInput(''); setResultado(null); setErro(null); }}><Clear /></IconButton>}

                <Box sx={{ m: 0.5, backgroundColor: 'primary.main', borderRadius: '50%', transition: '0.2s', '&:hover': { transform: 'scale(1.05)' } }}>
                    <IconButton onClick={handleSearch} sx={{ color: 'white', p: '12px' }} disabled={loading}>
                        {loading ? <CircularProgress size={24} color="inherit" /> : <Search />}
                    </IconButton>
                </Box>
            </Paper>

            {/* ÁREA DE RESULTADO */}
            <Box sx={{ width: '100%', maxWidth: 900, mt: 6 }}>
                {erro && <Fade in={true}><Alert severity="warning" sx={{ mb: 2, borderRadius: 2, fontSize: '1rem' }} variant="outlined">{erro}</Alert></Fade>}
                <Fade in={!!resultado} timeout={500}><Box>{resultado && <FormatadorResultados resultado={resultado} mode={mode} />}</Box></Fade>
            </Box>

            {/* MODAL DE CONFIRMAÇÃO DE AÇÃO */}
            <Dialog 
                open={openConfirmDialog} 
                onClose={() => setOpenConfirmDialog(false)}
                PaperProps={{ sx: { borderRadius: 3, p: 1, bgcolor: mode === 'dark' ? '#1e1e1e' : '#fff' } }}
            >
                <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1, color: 'warning.main' }}>
                    <Warning /> Confirmação Necessária
                </DialogTitle>
                <DialogContent>
                    <Typography variant="h6" paragraph>
                        {acaoPendente?.confirmacao || "Deseja realmente realizar esta alteração no cronograma?"}
                    </Typography>
                    
                    {/* Detalhes técnicos */}
                    {acaoPendente?.dados_novos && (
                        <Box sx={{ bgcolor: mode === 'dark' ? '#333' : '#f5f5f5', p: 2, borderRadius: 2, fontSize: '0.9rem', border: '1px solid divider' }}>
                            <Typography variant="caption" color="text.secondary" fontWeight="bold">DADOS A SEREM GRAVADOS:</Typography>
                            <ul style={{ margin: '8px 0', paddingLeft: '20px' }}>
                                {Object.entries(acaoPendente.dados_novos).map(([key, value]) => (
                                    value && <li key={key}><strong>{key}:</strong> {JSON.stringify(value).replace(/"/g, '')}</li>
                                ))}
                            </ul>
                        </Box>
                    )}
                </DialogContent>
                <DialogActions sx={{ px: 3, pb: 2 }}>
                    <Button onClick={() => setOpenConfirmDialog(false)} color="inherit" variant="outlined" sx={{ borderRadius: 2 }}>Cancelar</Button>
                    <Button onClick={handleConfirmarAcao} color="primary" variant="contained" sx={{ borderRadius: 2, px: 3 }} autoFocus>Confirmar</Button>
                </DialogActions>
            </Dialog>
        </Container>
    );
};

export default AssistenteIA;