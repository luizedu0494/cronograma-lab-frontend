import React, { useState, useEffect } from 'react';
import {
    Container, Typography, Box, Paper, TextField, IconButton, 
    CircularProgress, Fade, Alert, Tooltip, Chip
} from '@mui/material';
import { Search, Mic, Stop, Clear, AutoGraph, Analytics } from '@mui/icons-material'; // Ícones mais analíticos
import { useNavigate } from 'react-router-dom';

import ProcessadorConsultas from '../ia-estruturada/ProcessadorConsultas';
import ExecutorAcoes from '../ia-estruturada/ExecutorAcoes';
import FormatadorResultados from '../ia-estruturada/FormatadorResultados';

const AssistenteIA = ({ userInfo, currentUser, mode }) => {
    const [queryInput, setQueryInput] = useState('');
    const [loading, setLoading] = useState(false);
    const [resultado, setResultado] = useState(null);
    const [isRecording, setIsRecording] = useState(false);
    const [erro, setErro] = useState(null);

    const navigate = useNavigate();
    // Se quiser liberar para outros perfis no futuro, ajuste aqui
    const isCoordenador = userInfo?.role === 'coordenador';

    const processador = new ProcessadorConsultas();
    const executor = new ExecutorAcoes(currentUser);

    // Se for integrar no Dashboard, talvez não precise desse redirecionamento
    // Mas mantive por segurança se for acessado via rota direta
    useEffect(() => {
        if (!isCoordenador) {
            // setTimeout(() => navigate('/'), 2000); 
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

            // 2. Verificação de Segurança Visual
            // Se a IA entender que é uma ação de escrita, o Executor vai bloquear,
            // mas já avisamos visualmente aqui também.
            if (['adicionar', 'editar', 'excluir'].includes(plano.acao)) {
                setResultado({
                    tipo: 'aviso_acao',
                    titulo: 'Modo Leitura',
                    mensagem: 'Sou seu Analista de Dados. Para alterações no cronograma, utilize o Calendário Oficial.',
                });
            } else {
                // É consulta, manda bala
                const dados = await executor.executar(plano);
                setResultado(dados);
            }

        } catch (error) {
            console.error(error);
            setErro("Não foi possível analisar os dados no momento.");
        } finally {
            setLoading(false);
        }
    };

    const handleMic = () => {
        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        if (!SpeechRecognition) return alert("Seu navegador não suporta comandos de voz.");
        
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
                // handleSearch(); // Descomente se quiser busca automática ao falar
            };
            recognition.onend = () => setIsRecording(false);
        }
    };

    if (!isCoordenador) return null; // Ou uma mensagem discreta

    return (
        <Container maxWidth="lg" sx={{ mt: 4, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            
            {/* CABEÇALHO - Foco em Dados */}
            <Box sx={{ textAlign: 'center', mb: 4 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', mb: 1, gap: 1 }}>
                    <AutoGraph sx={{ fontSize: 36, color: 'secondary.main' }} />
                    <Typography variant="h4" fontWeight="800" sx={{ color: mode === 'dark' ? '#fff' : '#333' }}>
                        Insights & Analytics
                    </Typography>
                </Box>
                <Typography variant="body1" color="text.secondary" sx={{ maxWidth: 600, mx: 'auto', opacity: 0.8 }}>
                    Consulte métricas, verifique ocupação e gere relatórios instantâneos.
                </Typography>
            </Box>

            {/* BARRA DE PESQUISA - Estilo "Spotlight" */}
            <Paper 
                elevation={8}
                sx={{ 
                    p: '4px 8px', 
                    display: 'flex', 
                    alignItems: 'center', 
                    width: '100%', 
                    maxWidth: 800,
                    borderRadius: 50,
                    border: '1px solid',
                    borderColor: mode === 'dark' ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.05)',
                    background: mode === 'dark' ? 'linear-gradient(145deg, #2a2a2a, #1e1e1e)' : '#fff',
                    transition: '0.3s',
                    '&:hover': { transform: 'translateY(-2px)', boxShadow: 12 }
                }}
            >
                <IconButton color={isRecording ? "error" : "default"} onClick={handleMic} sx={{ p: '12px' }}>
                    {isRecording ? <Stop /> : <Mic />}
                </IconButton>

                <TextField
                    fullWidth
                    variant="standard"
                    // Placeholder focado em perguntas de dados
                    placeholder={isRecording ? "Ouvindo..." : "Ex: Qual a taxa de ocupação este mês? / Gráfico de cursos..."}
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

                <Box sx={{ m: 0.5, backgroundColor: 'secondary.main', borderRadius: '50%', transition: '0.2s', '&:hover': { transform: 'scale(1.1)' } }}>
                    <IconButton onClick={handleSearch} sx={{ color: 'white', p: '12px' }} disabled={loading}>
                        {loading ? <CircularProgress size={24} color="inherit" /> : <Search />}
                    </IconButton>
                </Box>
            </Paper>

            {/* ÁREA DE RESULTADO */}
            <Box sx={{ width: '100%', maxWidth: 950, mt: 5, minHeight: 300 }}>
                
                {erro && (
                    <Fade in={true}>
                        <Alert severity="warning" sx={{ mb: 2, borderRadius: 2, mx: 'auto', maxWidth: 600 }} variant="filled">
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

                {/* SUGESTÕES VISUAIS (Chips) - Só aparece se não tiver resultado */}
                {!resultado && !loading && !erro && (
                    <Box sx={{ textAlign: 'center', mt: 6 }}>
                        <Typography variant="caption" color="text.secondary" sx={{ mb: 2, display: 'block', letterSpacing: 1, fontWeight: 'bold' }}>
                            ANÁLISES RÁPIDAS
                        </Typography>
                        
                        <Box sx={{ display: 'flex', gap: 1.5, justifyContent: 'center', flexWrap: 'wrap' }}>
                            {[
                                { icon: <Analytics fontSize="small"/>, text: "Taxa de Ocupação Mensal" },
                                { icon: <AutoGraph fontSize="small"/>, text: "Gráfico de Labs mais usados" },
                                { icon: <Search fontSize="small"/>, text: "Horários vagos amanhã" },
                                { icon: <Search fontSize="small"/>, text: "Evolução de aulas em 2025" }
                            ].map((sugestao, index) => (
                                <Chip 
                                    key={index}
                                    icon={sugestao.icon}
                                    label={sugestao.text}
                                    onClick={() => { setQueryInput(sugestao.text); handleSearch(); }}
                                    sx={{ 
                                        cursor: 'pointer', 
                                        py: 2.5, px: 1,
                                        fontSize: '0.9rem',
                                        bgcolor: mode === 'dark' ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.03)',
                                        '&:hover': { bgcolor: 'secondary.main', color: '#fff', '& .MuiChip-icon': { color: '#fff' } }
                                    }}
                                />
                            ))}
                        </Box>
                    </Box>
                )}
            </Box>
        </Container>
    );
};

export default AssistenteIA;