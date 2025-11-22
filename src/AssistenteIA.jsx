import React, { useState, useEffect } from 'react';
import {
    Container, Typography, Box, Paper, TextField, IconButton, 
    CircularProgress, Fade, Alert, Tooltip
} from '@mui/material';
import { Search, Mic, Stop, Clear, AutoAwesome } from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';

// --- CORREÇÃO DAS IMPORTAÇÕES ---
// Como este arquivo está em 'src/', usamos './' para acessar 'src/ia-estruturada/'
import ProcessadorConsultas from './ia-estruturada/ProcessadorConsultas';
import ExecutorAcoes from './ia-estruturada/ExecutorAcoes';
import FormatadorResultados from './ia-estruturada/FormatadorResultados';

const AssistenteIA = ({ userInfo, currentUser, mode }) => {
    const [queryInput, setQueryInput] = useState('');
    const [loading, setLoading] = useState(false);
    const [resultado, setResultado] = useState(null);
    const [isRecording, setIsRecording] = useState(false);
    const [erro, setErro] = useState(null);

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
            // 1. Interpretação (Cérebro)
            const plano = await processador.processar(queryInput);

            if (plano.erro) {
                setErro(plano.erro);
                setLoading(false);
                return;
            }

            // 2. Execução (Músculo)
            if (plano.acao === 'consultar') {
                const dados = await executor.executar(plano);
                setResultado(dados);
            } else {
                // Ações de escrita (Adicionar/Editar) retornam um feedback visual
                setResultado({
                    tipo: 'aviso_acao',
                    titulo: 'Ação Identificada',
                    mensagem: 'Para adicionar, editar ou excluir aulas, recomendamos usar a visualização de Calendário para garantir que não haja conflitos visuais.',
                    detalhe: `Ação pretendida: ${plano.acao.toUpperCase()}`
                });
            }

        } catch (error) {
            console.error(error);
            setErro("Não consegui processar essa informação no momento.");
        } finally {
            setLoading(false);
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
            
            {/* CABEÇALHO */}
            <Box sx={{ textAlign: 'center', mb: 5 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', mb: 2, gap: 1 }}>
                    <AutoAwesome sx={{ fontSize: 40, color: 'primary.main' }} />
                    <Typography variant="h3" fontWeight="800" sx={{ background: 'linear-gradient(45deg, #2196F3 30%, #21CBF3 90%)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
                        Analista Inteligente
                    </Typography>
                </Box>
                <Typography variant="h6" color="text.secondary" sx={{ maxWidth: 600, mx: 'auto', opacity: 0.8 }}>
                    Pergunte sobre quantidades, horários e cronogramas.
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
                <IconButton 
                    color={isRecording ? "error" : "default"} 
                    onClick={handleMic}
                    sx={{ p: '12px' }}
                >
                    {isRecording ? <Stop /> : <Mic />}
                </IconButton>

                <TextField
                    fullWidth
                    variant="standard"
                    placeholder={isRecording ? "Ouvindo..." : "Ex: Quantas aulas de enfermagem tem em novembro?"}
                    value={queryInput}
                    onChange={(e) => setQueryInput(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
                    InputProps={{
                        disableUnderline: true,
                        sx: { ml: 1, flex: 1, fontSize: '1.1rem' }
                    }}
                />
                
                {queryInput && (
                    <IconButton onClick={() => { setQueryInput(''); setResultado(null); setErro(null); }}>
                        <Clear />
                    </IconButton>
                )}

                <Box sx={{ m: 0.5, backgroundColor: 'primary.main', borderRadius: '50%', transition: '0.2s', '&:hover': { transform: 'scale(1.05)' } }}>
                    <IconButton onClick={handleSearch} sx={{ color: 'white', p: '12px' }} disabled={loading}>
                        {loading ? <CircularProgress size={24} color="inherit" /> : <Search />}
                    </IconButton>
                </Box>
            </Paper>

            {/* ÁREA DE RESULTADO */}
            <Box sx={{ width: '100%', maxWidth: 900, mt: 6 }}>
                
                {erro && (
                    <Fade in={true}>
                        <Alert severity="warning" sx={{ mb: 2, borderRadius: 2, fontSize: '1rem' }} variant="outlined">
                            {erro}
                        </Alert>
                    </Fade>
                )}

                <Fade in={!!resultado} timeout={500}>
                    <Box>
                        {resultado && (
                            <FormatadorResultados resultado={resultado} mode={mode} />
                        )}
                    </Box>
                </Fade>

                {/* Dicas (Estado Vazio) */}
                {!resultado && !loading && !erro && (
                    <Box sx={{ mt: 8, textAlign: 'center', opacity: 0.4 }}>
                        <Typography variant="body2" gutterBottom>SUGESTÕES DE BUSCA:</Typography>
                        <Box sx={{ display: 'flex', gap: 2, justifyContent: 'center', flexWrap: 'wrap', mt: 2 }}>
                            {["Aulas de hoje", "Quantas aulas de medicina?", "Aulas no Lab 1 amanhã"].map(txt => (
                                <Typography 
                                    key={txt} 
                                    variant="caption" 
                                    sx={{ 
                                        border: '1px solid', 
                                        borderColor: 'text.disabled', 
                                        px: 2, py: 1, 
                                        borderRadius: 10,
                                        cursor: 'pointer'
                                    }}
                                    onClick={() => { setQueryInput(txt); }}
                                >
                                    {txt}
                                </Typography>
                            ))}
                        </Box>
                    </Box>
                )}
            </Box>
        </Container>
    );
};

export default AssistenteIA;