import React, { useState, useEffect, useRef } from 'react';
import {
    Container, Typography, Box, Paper, TextField, Button, CircularProgress,
    Alert, Snackbar, Dialog, DialogTitle, DialogContent, DialogActions,
    List, ListItem, ListItemText, Divider, Chip, IconButton, Card, CardContent
} from '@mui/material';
import { Send as SendIcon, SmartToy as AIIcon, ArrowBack, CheckCircle, Cancel, Mic as MicIcon, Stop as StopIcon } from '@mui/icons-material';
import { db } from './firebaseConfig';
import {
    collection, addDoc, serverTimestamp, doc, getDoc, updateDoc, deleteDoc,
    query, where, getDocs, Timestamp, writeBatch
} from 'firebase/firestore';
import dayjs from 'dayjs';
import 'dayjs/locale/pt-br';
import { LISTA_LABORATORIOS, TIPOS_LABORATORIO } from './constants/laboratorios';
import { LISTA_CURSOS } from './constants/cursos';
import { useNavigate } from 'react-router-dom';

dayjs.locale('pt-br');

const BLOCOS_HORARIO = [
    { "value": "07:00-09:10", "label": "07:00 - 09:10", "turno": "Matutino" },
    { "value": "09:30-12:00", "label": "09:30 - 12:00", "turno": "Matutino" },
    { "value": "13:00-15:10", "label": "13:00 - 15:10", "turno": "Vespertino" },
    { "value": "15:30-18:00", "label": "15:30 - 18:00", "turno": "Vespertino" },
    { "value": "18:30-20:10", "label": "18:30 - 20:10", "turno": "Noturno" },
    { "value": "20:30-22:00", "label": "20:30 - 22:00", "turno": "Noturno" },
];

const GROQ_API_KEY = import.meta.env.VITE_GROQ_API_KEY;
const GROQ_MODEL = 'llama-3.1-8b-instant';

function AssistenteIA({ userInfo, currentUser, mode }) {
    const [mensagens, setMensagens] = useState([]);
    const [inputUsuario, setInputUsuario] = useState('');
    const [carregando, setCarregando] = useState(false);
    const [openSnackbar, setOpenSnackbar] = useState(false);
    const [snackbarMessage, setSnackbarMessage] = useState('');
    const [snackbarSeverity, setSnackbarSeverity] = useState('success');
    const [openConfirmDialog, setOpenConfirmDialog] = useState(false);
    const [acaoPendente, setAcaoPendente] = useState(null);
    const [isRecording, setIsRecording] = useState(false);
    const messagesEndRef = useRef(null);
    const navigate = useNavigate();

    const isCoordenador = userInfo?.role === 'coordenador';

    useEffect(() => {
        if (!isCoordenador) {
            setSnackbarMessage('Acesso negado. Apenas coordenadores podem usar o Assistente IA.');
            setSnackbarSeverity('error');
            setOpenSnackbar(true);
            setTimeout(() => navigate('/'), 2000);
        }
    }, [isCoordenador, navigate]);

    useEffect(() => {
        scrollToBottom();
    }, [mensagens]);

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    };

    const adicionarMensagem = (texto, tipo = 'usuario') => {
        setMensagens(prev => [...prev, { texto, tipo, timestamp: new Date() }]);
    };

    const chamarGroqAPI = async (prompt, contexto) => {
        try {
            const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${GROQ_API_KEY}`
                },
                body: JSON.stringify({
                    model: GROQ_MODEL,
                    messages: [
                        {
                            role: 'system',
                            content: `Você é um Assistente de Gerenciamento e Consulta de Cronograma de Aulas, um especialista em interpretar comandos do usuário e extrair informações estruturadas para execução ou consulta.

Seu trabalho é duplo:
1. **Executar Ações:** Para comandos de "adicionar", "editar" ou "excluir", você deve extrair os dados estruturados e gerar um texto de confirmação.
2. **Responder a Consultas:** Para comandos de "consultar", você deve simular a busca no cronograma e fornecer uma resposta detalhada e estruturada.

**1. Contexto e Estrutura de Dados (Conhecimento Base):**

Você tem acesso a um banco de dados de aulas com a seguinte estrutura (JSON de exemplo):
{
  "tipoAtividade": "Aula Prática",
  "assunto": "Anatomia Humana",
  "laboratorioSelecionado": "anatomia_1",
  "cursos": ["medicina", "enfermagem"],
  "horarioSlotString": "07:00-09:10",
  "dataInicio": "Timestamp",
  "status": "aprovada",
  "observacoes": "Aula com foco em peças ósseas e musculatura.",
  // ... outros campos
}

**2. Constantes do Sistema (Valores Válidos):**

*   **Cursos Válidos:** Biomedicina, Farmácia, Enfermagem, Odontologia, Medicina, Fisioterapia, Nutrição, Ed. Física, Psicologia, Medicina Veterinária, Química Tecnológica, Engenharia, Tec. e Cosmético.
*   **Horários Válidos (Slots):** 07:00-09:10, 09:30-12:00, 13:00-15:10, 15:30-18:00, 18:30-20:10, 20:30-22:00.
*   **Tipos de Laboratório:** Anatomia (1 a 6), Microscopia Normal (1 a 5), Microscopia Galeria (6 e 7), Multidisciplinar (1 a 4), Habilidades Ney Braga (1 a 4), Habilidades Santander (1 a 3), Habilidades Galeria (1 a 3), Farmacêutico, Tec. Dietética, UDA.

**3. Diretrizes de Ação e Consulta:**

*   **Ações (adicionar/editar/excluir):** O usuário DEVE fornecer uma data COMPLETA no formato DD/MM/AAAA. NÃO aceite datas relativas como "amanhã", "hoje", "próxima semana". Se o usuário usar datas relativas para estas ações, retorne um erro pedindo a data completa.
*   **Consultas (consultar):** O usuário pode usar termos como "mês que vem", "ano passado", ou um mês/ano específico.
*   **Busca por Termos Específicos:** Para consultas que envolvam termos incomuns (ex: "bcmol", "projeto X"), simule uma busca por palavra-chave nos campos **"assunto"** e **"observacoes"**.
*   **Detalhe e Estrutura da Resposta (Consultas):** Se a ação for "consultar" e você encontrar aulas, a resposta no campo \`resposta\` DEVE ser detalhada e estruturada (lista ou tabela) contendo: **Assunto**, **Data**, **Horário**, **Laboratório** e **Cursos Envolvidos**.

**4. Formato de Resposta Esperado (JSON):**

*   Use APENAS o formato JSON abaixo.
*   Sempre retorne um JSON válido.
*   Use APENAS os dados fornecidos no contexto (cursos, laboratórios, horários).

\`\`\`json
{
  "acao": "adicionar|editar|excluir|consultar",
  "dados": {
    "assunto": "string",
    "tipoAtividade": "string",
    "cursos": ["curso1", "curso2"],
    "laboratorios": [{"tipo": "tipo_lab", "ids": ["lab1", "lab2"]}],
    "horarios": ["07:00-09:10", "09:30-12:00"],
    "data": "DD/MM/YYYY",
    "observacoes": "string",
    "aulaId": "string (apenas para editar/excluir específico)",
    "termoBusca": "string (para consultas, ex: 'bcmol')",
    "mes": "MM/YYYY (para consultas)",
    "ano": "YYYY (para consultas)"
  },
  "confirmacao": "Texto descritivo da ação para o usuário confirmar (para adicionar/editar/excluir)",
  "resposta": "Texto de resposta para consultas (apenas se acao for 'consultar')"
}
\`\`\`

Se o comando não for claro ou faltar informações CRÍTICAS, retorne:
\`\`\`json
{
  "erro": "Descrição do que está faltando ou não está claro"
}
\`\`\`

Se o comando for uma consulta, retorne a resposta diretamente no campo "resposta" do JSON, e a "acao" deve ser "consultar".`
                        },
                        {
                            role: 'user',
                            content: prompt
                        }
                    ],
                    temperature: 0.3,
                    max_tokens: 1500
                })
            });

            if (!response.ok) {
                throw new Error(`Erro na API Groq: ${response.status}`);
            }

            const data = await response.json();
            const resposta = data.choices[0].message.content;
            
            const jsonMatch = resposta.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
                return JSON.parse(jsonMatch[0]);
            }
            
            return { acao: 'consultar', resposta: resposta };
        } catch (error) {
            console.error('Erro ao chamar Groq API:', error);
            throw error;
        }
    };

    const buscarAulasFirebase = async (criterios) => {
        try {
            let q = collection(db, "aulas");
            const constraints = [];

            if (criterios.data) {
                const dataInicio = dayjs(criterios.data, 'DD/MM/YYYY').startOf('day');
                const dataFim = dataInicio.endOf('day');
                constraints.push(where("dataInicio", ">=", Timestamp.fromDate(dataInicio.toDate())));
                constraints.push(where("dataInicio", "<=", Timestamp.fromDate(dataFim.toDate())));
            } else if (criterios.mes) {
                const [mes, ano] = criterios.mes.split('/');
                const dataInicio = dayjs().month(parseInt(mes) - 1).year(parseInt(ano)).startOf('month');
                const dataFim = dataInicio.endOf('month');
                constraints.push(where("dataInicio", ">=", Timestamp.fromDate(dataInicio.toDate())));
                constraints.push(where("dataInicio", "<=", Timestamp.fromDate(dataFim.toDate())));
            } else if (criterios.ano) {
                const dataInicio = dayjs().year(parseInt(criterios.ano)).startOf('year');
                const dataFim = dataInicio.endOf('year');
                constraints.push(where("dataInicio", ">=", Timestamp.fromDate(dataInicio.toDate())));
                constraints.push(where("dataInicio", "<=", Timestamp.fromDate(dataFim.toDate())));
            }

            if (criterios.laboratorio) {
                constraints.push(where("laboratorioSelecionado", "==", criterios.laboratorio));
            }

            if (constraints.length > 0) {
                q = query(q, ...constraints);
            }

            const querySnapshot = await getDocs(q);
            let aulas = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

            if (criterios.termoBusca) {
                const termo = criterios.termoBusca.toLowerCase();
                aulas = aulas.filter(aula => 
                    aula.assunto.toLowerCase().includes(termo) ||
                    (aula.tipoAtividade && aula.tipoAtividade.toLowerCase().includes(termo))
                );
            }

            return aulas;
        } catch (error) {
            console.error('Erro ao buscar aulas:', error);
            return [];
        }
    };

    const validarDados = (dados) => {
        const erros = [];
        if (!dados.data || !dados.data.match(/^\d{2}\/\d{2}\/\d{4}$/)) {
            erros.push('Data inválida ou incompleta. Use o formato DD/MM/AAAA.');
        }
        return erros;
    };

    const executarAcaoAdicionar = async (dados) => { /* ... (manter a lógica original) ... */ };
    const executarAcaoEditar = async (dados) => { /* ... (manter a lógica original) ... */ };
    const executarAcaoExcluir = async (dados) => { /* ... (manter a lógica original) ... */ };

    const handleSend = async (textInput = inputUsuario) => {
        if (!textInput.trim() || carregando) return;

        const mensagemUsuario = textInput.trim();
        adicionarMensagem(mensagemUsuario, 'usuario');
        setInputUsuario('');
        setCarregando(true);

        try {
            const contexto = `Cursos: ${LISTA_CURSOS.map(c => c.value).join(', ')}\nLaboratórios: ${LISTA_LABORATORIOS.map(l => l.id).join(', ')}\nHorários: ${BLOCOS_HORARIO.map(h => h.value).join(', ')}`;
            const resultadoIA = await chamarGroqAPI(mensagemUsuario, contexto);

            if (resultadoIA.erro) {
                adicionarMensagem(`Erro: ${resultadoIA.erro}`, 'ia');
                return;
            }

            if (resultadoIA.acao === 'consultar') {
                const aulas = await buscarAulasFirebase(resultadoIA.dados || {});
                let resposta = resultadoIA.resposta;

                // CORREÇÃO: Garante que a resposta da IA é uma string antes de ser exibida
                if (typeof resposta !== 'string') {
                    try {
                        // Tenta converter o objeto para uma string JSON formatada
                        resposta = JSON.stringify(resposta, null, 2);
                    } catch (e) {
                        // Se falhar, usa uma mensagem de erro padrão
                        resposta = "Erro ao formatar a resposta da IA. Por favor, tente reformular a consulta.";
                    }
                }

                if (!resposta || resposta.trim() === 'null' || resposta.trim() === '') {
                    if (aulas.length > 0) {
                        // Formata a lista de aulas se a IA não tiver fornecido uma resposta textual
                        const listaAulas = aulas.map(aula => 
                            `${aula.assunto} em ${aula.laboratorioSelecionado} no dia ${dayjs(aula.dataInicio.toDate()).format('DD/MM/YYYY HH:mm')}`
                        ).join('; ');
                        resposta = `Encontrei ${aulas.length} aula(s): ${listaAulas}.`;
                    } else {
                        resposta = `Não encontrei nenhuma aula que corresponda à sua busca.`;
                    }
                }
                adicionarMensagem(resposta, 'ia');
            } else if (resultadoIA.confirmacao) {
                setAcaoPendente({
                    acao: resultadoIA.acao,
                    dados: resultadoIA.dados,
                    confirmacao: resultadoIA.confirmacao
                });
                setOpenConfirmDialog(true);
            } else {
                adicionarMensagem('Não foi possível entender a ação. Por favor, tente novamente.', 'ia');
            }

        } catch (error) {
            console.error('Erro no processamento:', error);
            adicionarMensagem('Ocorreu um erro ao processar sua solicitação.', 'ia');
        } finally {
            setCarregando(false);
        }
    };

    const handleMicClick = () => {
        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        if (!SpeechRecognition) {
            setSnackbarMessage('Seu navegador não suporta a API de Reconhecimento de Fala.');
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
                setSnackbarMessage('Gravando... Fale agora.');
                setSnackbarSeverity('info');
                setOpenSnackbar(true);
            };

            recognition.onresult = (event) => {
                const transcript = event.results[0][0].transcript;
                setInputUsuario(transcript);
                handleSend(transcript);
            };

            recognition.onerror = (event) => {
                setSnackbarMessage(`Erro de reconhecimento de fala: ${event.error}`);
                setSnackbarSeverity('error');
                setOpenSnackbar(true);
            };

            recognition.onend = () => {
                setIsRecording(false);
            };
        }
    };

    const handleConfirmarAcao = async () => { /* ... (manter a lógica original) ... */ };
    const handleCancelarAcao = () => { /* ... (manter a lógica original) ... */ };

    const renderMensagem = (mensagem, index) => {
        const isUsuario = mensagem.tipo === 'usuario';
        const isIA = mensagem.tipo === 'ia';

        const backgroundColor = isUsuario
            ? (mode === 'dark' ? '#3f51b5' : '#3f51b5')
            : (mode === 'dark' ? '#424242' : '#f0f0f0');

        const color = isUsuario
            ? '#ffffff'
            : (mode === 'dark' ? '#ffffff' : '#000000');

        return (
            <Box
                key={index}
                sx={{ display: 'flex', justifyContent: isUsuario ? 'flex-end' : 'flex-start', mb: 2 }}
            >
                <Paper
                    elevation={3}
                    sx={{
                        p: 1.5,
                        maxWidth: '80%',
                        borderRadius: isUsuario ? '20px 20px 5px 20px' : '20px 20px 20px 5px',
                        backgroundColor: backgroundColor,
                        color: color,
                        wordBreak: 'break-word',
                        whiteSpace: 'pre-wrap',
                    }}
                >
                    <Typography variant="body1">{mensagem.texto}</Typography>
                    <Typography variant="caption" sx={{ display: 'block', textAlign: 'right', mt: 0.5, opacity: 0.7 }}>
                        {dayjs(mensagem.timestamp).format('HH:mm')}
                    </Typography>
                </Paper>
            </Box>
        );
    };

    if (!isCoordenador) {
        return (
            <Container maxWidth="md" sx={{ mt: 4 }}>
                <Alert severity="error">Acesso negado.</Alert>
            </Container>
        );
    }

    return (
        <Container maxWidth="lg" sx={{ mt: 4, display: 'flex', flexDirection: 'column', height: 'calc(100vh - 100px)' }}>
            <Paper elevation={5} sx={{ p: 2, mb: 2 }}>
                <Box display="flex" alignItems="center">
                    <AIIcon color="primary" sx={{ mr: 1.5, fontSize: 32 }} />
                    <Typography variant="h5" component="h1" fontWeight="bold">
                        Assistente IA Experimental
                    </Typography>
                </Box>
                <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                    Use texto ou voz para gerenciar e consultar aulas. Ex: "Consultar aulas de bcmol em novembro" ou "Agendar aula de anatomia para 25/12/2025 às 15:30 no lab 1".
                </Typography>
            </Paper>

            <Paper elevation={5} sx={{ flexGrow: 1, display: 'flex', flexDirection: 'column', p: 2, overflow: 'hidden' }}>
                <Box sx={{ flexGrow: 1, overflowY: 'auto', p: 1, mb: 2 }}>
                    {mensagens.map(renderMensagem)}
                    <div ref={messagesEndRef} />
                </Box>

                <Divider />

                <Box display="flex" alignItems="center" sx={{ p: 1, mt: 1 }}>
                    <TextField
                        fullWidth
                        variant="outlined"
                        placeholder={isRecording ? "Ouvindo..." : "Digite sua mensagem..."}
                        value={inputUsuario}
                        onChange={(e) => setInputUsuario(e.target.value)}
                        onKeyPress={(e) => e.key === 'Enter' && handleSend()}
                        disabled={carregando || isRecording}
                        sx={{ mr: 1 }}
                    />
                    <IconButton
                        color={isRecording ? "error" : "primary"}
                        onClick={handleMicClick}
                        disabled={carregando}
                        size="large"
                    >
                        {isRecording ? <StopIcon /> : <MicIcon />}
                    </IconButton>
                    <Button
                        variant="contained"
                        onClick={() => handleSend()}
                        disabled={!inputUsuario.trim() || carregando || isRecording}
                        sx={{ ml: 1 }}
                    >
                        {carregando ? <CircularProgress size={24} /> : <SendIcon />}
                    </Button>
                </Box>
            </Paper>

            <Dialog open={openConfirmDialog} onClose={handleCancelarAcao}>
                <DialogTitle>Confirmação de Ação</DialogTitle>
                <DialogContent>
                    <Typography>{acaoPendente?.confirmacao}</Typography>
                    <Alert severity="warning" sx={{ mt: 2 }}>Esta ação irá modificar o cronograma.</Alert>
                </DialogContent>
                <DialogActions>
                    <Button onClick={handleCancelarAcao}>Cancelar</Button>
                    <Button onClick={handleConfirmarAcao} autoFocus>Confirmar</Button>
                </DialogActions>
            </Dialog>

            <Snackbar open={openSnackbar} autoHideDuration={6000} onClose={() => setOpenSnackbar(false)}>
                <Alert onClose={() => setOpenSnackbar(false)} severity={snackbarSeverity} sx={{ width: '100%' }}>
                    {snackbarMessage}
                </Alert>
            </Snackbar>
        </Container>
    );
}

export default AssistenteIA;
