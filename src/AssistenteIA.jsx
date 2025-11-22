import React, { useState, useEffect } from 'react';
import {
    Container, Typography, Box, Paper, TextField, IconButton, 
    CircularProgress, Fade, Alert, Tooltip, Dialog, DialogTitle, 
    DialogContent, DialogActions, Button, Collapse
} from '@mui/material';
import { Search, Mic, Stop, Clear, AutoAwesome, Warning } from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';

import ProcessadorConsultas from './ia-estruturada/ProcessadorConsultas';
import ExecutorAcoes from './ia-estruturada/ExecutorAcoes';
import FormatadorResultados from './ia-estruturada/FormatadorResultados';

const AssistenteIA = ({ userInfo, currentUser, mode }) => {
    const [queryInput, setQueryInput] = useState('');
    const [loading, setLoading] = useState(false);
    const [resultado, setResultado] = useState(null);
    const [isRecording, setIsRecording] = useState(false);
    const [erro, setErro] = useState(null);
    const [openConfirmDialog, setOpenConfirmDialog] = useState(false);
    const [acaoPendente, setAcaoPendente] = useState(null);

    const navigate = useNavigate();
    const isAuthorized = userInfo?.role === 'coordenador' || userInfo?.role === 'tecnico';
    const processador = new ProcessadorConsultas();
    const executor = new ExecutorAcoes(currentUser);

    useEffect(() => {
        if (!isAuthorized) setTimeout(() => navigate('/'), 2000);
    }, [isAuthorized, navigate]);

    const handleSearch = async () => {
        if (!queryInput.trim() || loading) return;
        setLoading(true);
        setResultado(null);
        setErro(null);

        try {
            const plano = await processador.processar(queryInput);
            if (plano.erro) {
                setErro(plano.erro);
                setLoading(false);
                return;
            }
            if (plano.acao === 'consultar') {
                const dados = await executor.executar(plano);
                setResultado(dados);
            } else {
                setAcaoPendente(plano);
                setOpenConfirmDialog(true);
            }
        } catch (error) {
            setErro("Não consegui processar essa informação.");
        } finally {
            setLoading(false);
        }
    };

    const handleConfirmarAcao = async () => {
        if (!acaoPendente) return;
        setOpenConfirmDialog(false);
        setLoading(true); 
        try {
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
            recognition.onresult = (e) => { setQueryInput(e.results[0][0].transcript); };
            recognition.onend = () => setIsRecording(false);
        }
    };

    if (!isAuthorized) return null;

    return (
        <Container maxWidth="lg" sx={{ mt: 0, mb: 2, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            <Box sx={{ textAlign: 'center', mb: 3 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 1 }}>
                    <AutoAwesome sx={{ fontSize: 28, color: 'primary.main' }} />
                    <Typography variant="h5" fontWeight="bold" sx={{ background: 'linear-gradient(45deg, #2196F3 30%, #21CBF3 90%)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>Analista Inteligente</Typography>
                </Box>
                <Typography variant="caption" color="text.secondary">Consulte horários, vagas e estatísticas.</Typography>
            </Box>
            <Paper elevation={4} sx={{ p: '2px 4px', display: 'flex', alignItems: 'center', width: '100%', maxWidth: 700, borderRadius: 50, border: '1px solid', borderColor: mode === 'dark' ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.05)', transition: '0.3s', '&:hover': { boxShadow: 8, borderColor: 'primary.main' } }}>
                <IconButton color={isRecording ? "error" : "default"} onClick={handleMic} sx={{ p: '10px' }}><div style={{ display: 'flex' }}>{isRecording ? <Stop /> : <Mic />}</div></IconButton>
                <TextField fullWidth variant="standard" placeholder={isRecording ? "Ouvindo..." : "Ex: Quantas aulas de anatomia em novembro?"} value={queryInput} onChange={(e) => setQueryInput(e.target.value)} onKeyPress={(e) => e.key === 'Enter' && handleSearch()} InputProps={{ disableUnderline: true, sx: { ml: 1, flex: 1 } }} />
                {queryInput && <IconButton size="small" onClick={() => { setQueryInput(''); setResultado(null); setErro(null); }}><Clear fontSize="small" /></IconButton>}
                <Box sx={{ m: 0.5 }}><IconButton onClick={handleSearch} sx={{ color: 'white', bgcolor: 'primary.main', width: 36, height: 36, '&:hover': { bgcolor: 'primary.dark' } }} disabled={loading}>{loading ? <CircularProgress size={20} color="inherit" /> : <Search fontSize="small" />}</IconButton></Box>
            </Paper>
            <Collapse in={!!resultado || !!erro} sx={{ width: '100%', maxWidth: 900, mt: 2 }}>
                <Box sx={{ mb: 2 }}>
                    {erro && <Fade in={true}><Alert severity="warning" onClose={() => setErro(null)} sx={{ borderRadius: 2 }}>{erro}</Alert></Fade>}
                    {resultado && <Fade in={true}><Box><FormatadorResultados resultado={resultado} mode={mode} /></Box></Fade>}
                </Box>
            </Collapse>
            <Dialog open={openConfirmDialog} onClose={() => setOpenConfirmDialog(false)} PaperProps={{ sx: { borderRadius: 3, p: 1, bgcolor: mode === 'dark' ? '#1e1e1e' : '#fff' } }}>
                <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1, color: 'warning.main' }}><Warning /> Confirmação Necessária</DialogTitle>
                <DialogContent>
                    <Typography variant="h6" paragraph>{acaoPendente?.confirmacao || "Deseja realmente realizar esta alteração?"}</Typography>
                    {acaoPendente?.dados_novos && (<Box sx={{ bgcolor: mode === 'dark' ? '#333' : '#f5f5f5', p: 2, borderRadius: 2, fontSize: '0.9rem', border: '1px solid divider' }}><Typography variant="caption" color="text.secondary" fontWeight="bold">DADOS:</Typography><ul style={{ margin: '8px 0', paddingLeft: '20px' }}>{Object.entries(acaoPendente.dados_novos).map(([key, value]) => (value && <li key={key}><strong>{key}:</strong> {JSON.stringify(value).replace(/"/g, '')}</li>))}</ul></Box>)}
                </DialogContent>
                <DialogActions sx={{ px: 3, pb: 2 }}><Button onClick={() => setOpenConfirmDialog(false)} color="inherit" variant="outlined" sx={{ borderRadius: 2 }}>Cancelar</Button><Button onClick={handleConfirmarAcao} color="primary" variant="contained" sx={{ borderRadius: 2, px: 3 }} autoFocus>Confirmar</Button></DialogActions>
            </Dialog>
        </Container>
    );
};

export default AssistenteIA;