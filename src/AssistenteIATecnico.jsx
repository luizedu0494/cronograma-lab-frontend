import React, { useState, useEffect, useRef } from 'react';
import {
    Container, Typography, Box, Paper, TextField, Button, CircularProgress,
    Alert, Snackbar, IconButton
} from '@mui/material';
import { Send as SendIcon, SmartToy as AIIcon, Mic as MicIcon, Stop as StopIcon } from '@mui/icons-material';
import { db } from './firebaseConfig';
import {
    collection, query, where, getDocs, Timestamp
} from 'firebase/firestore';
import dayjs from 'dayjs';
import 'dayjs/locale/pt-br';
import { LISTA_LABORATORIOS } from './constants/laboratorios';
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

// PROMPT SOMENTE CONSULTA PARA TÉCNICO
const PROMPT_TECNICO_CONSULTA = `Você é um Assistente de Consulta de Cronograma de Aulas, um especialista em interpretar e responder a perguntas complexas sobre o agendamento de aulas, laboratórios e cursos, com base nos dados estruturados fornecidos.

Seu objetivo é **apenas responder a consultas** do usuário. Você NÃO tem permissão para executar ações de agendamento (adicionar, editar, excluir).

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

**3. Diretrizes de Consulta:**

*   **Ação Única:** A única ação suportada é "consultar".
*   **Busca por Termos Específicos:** Para consultas que envolvam termos incomuns (ex: "bcmol", "projeto X"), simule uma busca por palavra-chave nos campos **"assunto"** e **"observacoes"**.
*   **Detalhe e Estrutura da Resposta:** Se você encontrar aulas, a resposta no campo \`resposta\` DEVE ser detalhada e estruturada (lista ou tabela) contendo: **Assunto**, **Data**, **Horário**, **Laboratório** e **Cursos Envolvidos**.
*   **Restrição de Ação:** Se o usuário tentar um comando de ação (ex: "Adicionar aula de...", "Excluir a aula..."), você deve responder: "Meu papel é apenas consultar o cronograma. Não tenho permissão para agendar, editar ou excluir aulas."

**4. Formato de Resposta Esperado (JSON):**

*   Use APENAS o formato JSON abaixo.
*   A \`acao\` DEVE ser sempre "consultar".

\`\`\`json
{
  "acao": "consultar",
  "dados": {
    "termoBusca": "string (para consultas, ex: 'bcmol')",
    "mes": "MM/YYYY (para consultas)",
    "ano": "YYYY (para consultas)",
    "data": "DD/MM/YYYY (para consultas)",
    "laboratorio": "string (para consultas)"
  },
  "resposta": "Texto de resposta detalhada para a consulta"
}
\`\`\`

Se o comando não for claro ou faltar informações CRÍTICAS, retorne:
\`\`\`json
{
  "erro": "Descrição do que está faltando ou não está claro"
}
\`\`\`

Se o comando for uma consulta, retorne a resposta diretamente no campo "resposta" do JSON, e a "acao" deve ser "consultar".`;


function AssistenteIATecnico({ userInfo, currentUser, mode }) {
    const [mensagens, setMensagens] = useState([]);
    const [inputUsuario, setInputUsuario] = useState('');
    const [carregando, setCarregando] = useState(false);
    const [openSnackbar, setOpenSnackbar] = useState(false);
    const [snackbarMessage, setSnackbarMessage] = useState('');
    const [snackbarSeverity, setSnackbarSeverity] = useState('success');
    const [isRecording, setIsRecording] = useState(false);
    const messagesEndRef = useRef(null);
    const navigate = useNavigate();

    // Acesso permitido para 'tecnico' e 'coordenador' (se desejar)
    const isTecnicoOuCoordenador = userInfo?.role === 'tecnico' || userInfo?.role === 'coordenador';

    useEffect(() => {
        if (!isTecnicoOuCoordenador) {
            setSnackbarMessage('Acesso negado. Apenas técnicos e coordenadores podem usar o Assistente IA de Consulta.');
            setSnackbarSeverity('error');
            setOpenSnackbar(true);
            setTimeout(() => navigate('/'), 2000);
        }
    }, [isTecnicoOuCoordenador, navigate]);

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
                            content: PROMPT_TECNICO_CONSULTA.replace('${contexto}', contexto) // Usa o prompt de consulta
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
            
            // Se não retornar JSON, assume que é uma resposta direta de consulta
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

            // Lógica de busca simplificada para consulta
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

            // Ação é sempre 'consultar' neste componente
            const aulas = await buscarAulasFirebase(resultadoIA.dados || {});
            let resposta = resultadoIA.resposta;

            // CORREÇÃO: Garante que a resposta da IA é uma string antes de ser exibida
            if (typeof resposta !== 'string') {
                try {
                    resposta = JSON.stringify(resposta, null, 2);
                } catch (e) {
                    resposta = "Erro ao formatar a resposta da IA. Por favor, tente reformular a consulta.";
                }
            }

            if (!resposta || resposta.trim() === 'null' || resposta.trim() === '') {
                if (aulas.length > 0) {
                    // Formata a lista de aulas se a IA não tiver fornecido uma resposta textual
                    const listaAulas = aulas.map(aula => 
                        `* **Assunto:** ${aula.assunto}\n  **Data:** ${dayjs(aula.dataInicio.toDate()).format('DD/MM/YYYY HH:mm')}\n  **Laboratório:** ${aula.laboratorioSelecionado}\n  **Cursos:** ${aula.cursos.join(', ')}`
                    ).join('\n\n');
                    resposta = `Encontrei ${aulas.length} aula(s) que correspondem à sua busca:\n\n${listaAulas}`;
                } else {
                    resposta = `Não encontrei nenhuma aula que corresponda à sua busca.`;
                }
            }
            adicionarMensagem(resposta, 'ia');

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

    if (!isTecnicoOuCoordenador) {
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
                        Assistente IA de Consulta (Técnico)
                    </Typography>
                </Box>
                <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                    Use texto ou voz para consultar o cronograma de aulas. Ex: "Quais aulas estão no Anatomia 1 amanhã?" ou "Existe alguma aula sobre bcmol este mês?".
                </Typography>
            </Paper>

            <Paper elevation={5} sx={{ flexGrow: 1, display: 'flex', flexDirection: 'column', p: 2, overflow: 'hidden' }}>
                <Box sx={{ flexGrow: 1, overflowY: 'auto', p: 1, mb: 2 }}>
                    {mensagens.map(renderMensagem)}
                    <div ref={messagesEndRef} />
                </Box>

                <Box display="flex" alignItems="center" sx={{ p: 1, mt: 1 }}>
                    <TextField
                        fullWidth
                        variant="outlined"
                        placeholder={isRecording ? "Ouvindo..." : "Digite sua consulta..."}
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

            <Snackbar open={openSnackbar} autoHideDuration={6000} onClose={() => setOpenSnackbar(false)}>
                <Alert onClose={() => setOpenSnackbar(false)} severity={snackbarSeverity} sx={{ width: '100%' }}>
                    {snackbarMessage}
                </Alert>
            </Snackbar>
        </Container>
    );
}

export default AssistenteIATecnico;
