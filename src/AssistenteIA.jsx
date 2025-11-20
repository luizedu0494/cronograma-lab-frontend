import React, { useState, useEffect, useRef } from 'react';
import {
    Container, Typography, Box, Paper, TextField, Button, CircularProgress,
    Alert, Snackbar, Dialog, DialogTitle, DialogContent, DialogActions,
    List, ListItem, ListItemText, Divider, Chip, IconButton, Card, CardContent
} from '@mui/material';
import { Send as SendIcon, SmartToy as AIIcon, ArrowBack, CheckCircle, Cancel } from '@mui/icons-material';
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

function AssistenteIA({ userInfo, currentUser }) {
    const [mensagens, setMensagens] = useState([]);
    const [inputUsuario, setInputUsuario] = useState('');
    const [carregando, setCarregando] = useState(false);
    const [openSnackbar, setOpenSnackbar] = useState(false);
    const [snackbarMessage, setSnackbarMessage] = useState('');
    const [snackbarSeverity, setSnackbarSeverity] = useState('success');
    const [openConfirmDialog, setOpenConfirmDialog] = useState(false);
    const [acaoPendente, setAcaoPendente] = useState(null);
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
                            content: `Você é um assistente especializado em gerenciar aulas de laboratório. Seu trabalho é interpretar comandos do usuário e extrair informações estruturadas.

IMPORTANTE: 
- O usuário DEVE fornecer uma data COMPLETA no formato DD/MM/AAAA. NÃO aceite datas relativas como "amanhã", "hoje", "próxima semana". Se o usuário usar datas relativas, retorne um erro pedindo a data completa.
- Sempre retorne um JSON válido com a estrutura especificada.
- Use APENAS os dados fornecidos no contexto (cursos, laboratórios, horários).
- Para múltiplos horários/cursos/laboratórios, use arrays.
- Valide se os dados fornecidos existem no contexto.

Contexto disponível:
${contexto}

Tipos de ação suportados:
1. "adicionar" - Adicionar uma ou múltiplas aulas
2. "editar" - Editar uma aula existente (requer ID da aula)
3. "excluir" - Excluir uma ou múltiplas aulas (requer ID ou critérios)

Formato de resposta esperado (JSON):
{
  "acao": "adicionar|editar|excluir",
  "dados": {
    "assunto": "string",
    "tipoAtividade": "string",
    "cursos": ["curso1", "curso2"],
    "laboratorios": [{"tipo": "tipo_lab", "ids": ["lab1", "lab2"]}],
    "horarios": ["07:00-09:10", "09:30-12:00"],
    "data": "DD/MM/YYYY",
    "observacoes": "string",
    "aulaId": "string (apenas para editar/excluir específico)"
  },
  "confirmacao": "Texto descritivo da ação para o usuário confirmar"
}

Se o comando não for claro ou faltar informações CRÍTICAS (especialmente data completa), retorne:
{
  "erro": "Descrição do que está faltando ou não está claro"
}`
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
            
            // Tentar extrair JSON da resposta
            const jsonMatch = resposta.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
                return JSON.parse(jsonMatch[0]);
            }
            
            return { erro: 'Não foi possível processar o comando. Por favor, seja mais específico.' };
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
            }

            if (criterios.laboratorio) {
                constraints.push(where("laboratorioSelecionado", "==", criterios.laboratorio));
            }

            if (constraints.length > 0) {
                q = query(q, ...constraints);
            }

            const querySnapshot = await getDocs(q);
            return querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        } catch (error) {
            console.error('Erro ao buscar aulas:', error);
            return [];
        }
    };

    const validarDados = (dados) => {
        const erros = [];

        // Validar data completa
        if (!dados.data || !dados.data.match(/^\d{2}\/\d{2}\/\d{4}$/)) {
            erros.push('Data inválida ou incompleta. Use o formato DD/MM/AAAA (exemplo: 20/11/2025)');
        }

        // Validar cursos
        if (dados.cursos && dados.cursos.length > 0) {
            const cursosValidos = LISTA_CURSOS.map(c => c.value);
            const cursosInvalidos = dados.cursos.filter(c => !cursosValidos.includes(c));
            if (cursosInvalidos.length > 0) {
                erros.push(`Cursos inválidos: ${cursosInvalidos.join(', ')}`);
            }
        }

        // Validar laboratórios
        if (dados.laboratorios && dados.laboratorios.length > 0) {
            const labsValidos = LISTA_LABORATORIOS.map(l => l.id);
            dados.laboratorios.forEach(labGroup => {
                const labsInvalidos = labGroup.ids.filter(id => !labsValidos.includes(id));
                if (labsInvalidos.length > 0) {
                    erros.push(`Laboratórios inválidos: ${labsInvalidos.join(', ')}`);
                }
            });
        }

        // Validar horários
        if (dados.horarios && dados.horarios.length > 0) {
            const horariosValidos = BLOCOS_HORARIO.map(h => h.value);
            const horariosInvalidos = dados.horarios.filter(h => !horariosValidos.includes(h));
            if (horariosInvalidos.length > 0) {
                erros.push(`Horários inválidos: ${horariosInvalidos.join(', ')}`);
            }
        }

        return erros;
    };

    const executarAcaoAdicionar = async (dados) => {
        const errosValidacao = validarDados(dados);
        if (errosValidacao.length > 0) {
            throw new Error(errosValidacao.join('\n'));
        }

        const dataBase = dayjs(dados.data, 'DD/MM/YYYY');
        const aulasParaCriar = [];

        // Gerar todas as combinações de horários x laboratórios
        for (const horario of dados.horarios) {
            const [inicioStr, fimStr] = horario.split('-');
            const dataHoraInicio = dataBase
                .hour(parseInt(inicioStr.split(':')[0]))
                .minute(parseInt(inicioStr.split(':')[1]));
            const dataHoraFim = dataBase
                .hour(parseInt(fimStr.split(':')[0]))
                .minute(parseInt(fimStr.split(':')[1]));

            for (const labGroup of dados.laboratorios) {
                for (const labId of labGroup.ids) {
                    const labInfo = LISTA_LABORATORIOS.find(l => l.id === labId);
                    
                    // Verificar conflitos
                    const q = query(
                        collection(db, "aulas"),
                        where("laboratorioSelecionado", "==", labId),
                        where("dataInicio", "==", Timestamp.fromDate(dataHoraInicio.toDate()))
                    );
                    const conflitos = await getDocs(q);
                    
                    if (conflitos.empty) {
                        aulasParaCriar.push({
                            tipoAtividade: dados.tipoAtividade || 'Aula Prática',
                            assunto: dados.assunto,
                            observacoes: dados.observacoes || '',
                            tipoLaboratorio: labInfo.tipo,
                            laboratorioSelecionado: labId,
                            cursos: dados.cursos,
                            liga: '',
                            disciplina: dados.assunto,
                            curso: dados.cursos.join(', '),
                            ano: dayjs().year().toString(),
                            dataInicio: Timestamp.fromDate(dataHoraInicio.toDate()),
                            dataFim: Timestamp.fromDate(dataHoraFim.toDate()),
                            horarioSlotString: horario,
                            status: 'aprovada',
                            propostoPorUid: currentUser.uid,
                            propostoPorNome: userInfo?.name || currentUser.displayName || currentUser.email,
                            tecnicos: [],
                            tecnicosInfo: []
                        });
                    }
                }
            }
        }

        if (aulasParaCriar.length === 0) {
            throw new Error('Nenhuma aula pôde ser criada. Todos os horários/laboratórios selecionados já estão ocupados.');
        }

        // Salvar no Firebase usando batch
        const batch = writeBatch(db);
        const aulasCollection = collection(db, "aulas");
        
        aulasParaCriar.forEach(aula => {
            const newDocRef = doc(aulasCollection);
            batch.set(newDocRef, { ...aula, createdAt: serverTimestamp() });
        });

        await batch.commit();

        return {
            sucesso: true,
            mensagem: `${aulasParaCriar.length} aula(s) adicionada(s) com sucesso!`,
            detalhes: aulasParaCriar
        };
    };

    const executarAcaoEditar = async (dados) => {
        if (!dados.aulaId) {
            throw new Error('ID da aula não fornecido para edição.');
        }

        const docRef = doc(db, "aulas", dados.aulaId);
        const docSnap = await getDoc(docRef);

        if (!docSnap.exists()) {
            throw new Error('Aula não encontrada.');
        }

        const atualizacoes = {};
        
        if (dados.assunto) atualizacoes.assunto = dados.assunto;
        if (dados.tipoAtividade) atualizacoes.tipoAtividade = dados.tipoAtividade;
        if (dados.cursos) atualizacoes.cursos = dados.cursos;
        if (dados.observacoes) atualizacoes.observacoes = dados.observacoes;
        
        if (dados.data && dados.horarios && dados.horarios.length > 0) {
            const dataBase = dayjs(dados.data, 'DD/MM/YYYY');
            const horario = dados.horarios[0];
            const [inicioStr, fimStr] = horario.split('-');
            const dataHoraInicio = dataBase
                .hour(parseInt(inicioStr.split(':')[0]))
                .minute(parseInt(inicioStr.split(':')[1]));
            const dataHoraFim = dataBase
                .hour(parseInt(fimStr.split(':')[0]))
                .minute(parseInt(fimStr.split(':')[1]));
            
            atualizacoes.dataInicio = Timestamp.fromDate(dataHoraInicio.toDate());
            atualizacoes.dataFim = Timestamp.fromDate(dataHoraFim.toDate());
            atualizacoes.horarioSlotString = horario;
        }

        atualizacoes.updatedAt = serverTimestamp();

        await updateDoc(docRef, atualizacoes);

        return {
            sucesso: true,
            mensagem: 'Aula editada com sucesso!',
            detalhes: atualizacoes
        };
    };

    const executarAcaoExcluir = async (dados) => {
        let aulasParaExcluir = [];

        if (dados.aulaId) {
            // Excluir aula específica por ID
            const docRef = doc(db, "aulas", dados.aulaId);
            const docSnap = await getDoc(docRef);
            if (docSnap.exists()) {
                aulasParaExcluir.push({ id: dados.aulaId, ...docSnap.data() });
            }
        } else {
            // Buscar aulas por critérios
            aulasParaExcluir = await buscarAulasFirebase(dados);
        }

        if (aulasParaExcluir.length === 0) {
            throw new Error('Nenhuma aula encontrada para excluir com os critérios fornecidos.');
        }

        // Excluir usando batch
        const batch = writeBatch(db);
        aulasParaExcluir.forEach(aula => {
            batch.delete(doc(db, "aulas", aula.id));
        });

        await batch.commit();

        return {
            sucesso: true,
            mensagem: `${aulasParaExcluir.length} aula(s) excluída(s) com sucesso!`,
            detalhes: aulasParaExcluir
        };
    };

    const processarComando = async () => {
        if (!inputUsuario.trim()) return;

        const comandoUsuario = inputUsuario;
        setInputUsuario('');
        adicionarMensagem(comandoUsuario, 'usuario');
        setCarregando(true);

        try {
            // Preparar contexto para a IA
            const contexto = `
Cursos disponíveis: ${LISTA_CURSOS.map(c => `${c.value} (${c.label})`).join(', ')}

Tipos de laboratório: ${TIPOS_LABORATORIO.map(t => `${t.id} (${t.name})`).join(', ')}

Laboratórios disponíveis:
${LISTA_LABORATORIOS.map(l => `- ${l.id}: ${l.name} (tipo: ${l.tipo})`).join('\n')}

Horários disponíveis: ${BLOCOS_HORARIO.map(h => h.value).join(', ')}

Data atual: ${dayjs().format('DD/MM/YYYY')}
`;

            const respostaIA = await chamarGroqAPI(comandoUsuario, contexto);

            if (respostaIA.erro) {
                adicionarMensagem(respostaIA.erro, 'ia');
                setCarregando(false);
                return;
            }

            // Preparar ação para confirmação
            setAcaoPendente({
                acao: respostaIA.acao,
                dados: respostaIA.dados,
                confirmacao: respostaIA.confirmacao
            });

            adicionarMensagem(respostaIA.confirmacao, 'ia');
            setOpenConfirmDialog(true);

        } catch (error) {
            console.error('Erro ao processar comando:', error);
            adicionarMensagem(`Erro ao processar comando: ${error.message}`, 'erro');
        } finally {
            setCarregando(false);
        }
    };

    const confirmarAcao = async () => {
        setOpenConfirmDialog(false);
        setCarregando(true);

        try {
            let resultado;

            switch (acaoPendente.acao.toLowerCase()) {
                case 'adicionar':
                    resultado = await executarAcaoAdicionar(acaoPendente.dados);
                    break;
                case 'editar':
                    resultado = await executarAcaoEditar(acaoPendente.dados);
                    break;
                case 'excluir':
                    resultado = await executarAcaoExcluir(acaoPendente.dados);
                    break;
                default:
                    throw new Error(`Ação não reconhecida: ${acaoPendente.acao}`);
            }

            adicionarMensagem(resultado.mensagem, 'sucesso');
            setSnackbarMessage(resultado.mensagem);
            setSnackbarSeverity('success');
            setOpenSnackbar(true);

        } catch (error) {
            console.error('Erro ao executar ação:', error);
            adicionarMensagem(`Erro: ${error.message}`, 'erro');
            setSnackbarMessage(`Erro: ${error.message}`);
            setSnackbarSeverity('error');
            setOpenSnackbar(true);
        } finally {
            setCarregando(false);
            setAcaoPendente(null);
        }
    };

    const cancelarAcao = () => {
        setOpenConfirmDialog(false);
        adicionarMensagem('Ação cancelada pelo usuário.', 'ia');
        setAcaoPendente(null);
    };

    if (!isCoordenador) {
        return null;
    }

    return (
        <Container maxWidth="lg" sx={{ mt: 4, mb: 4 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', mb: 3 }}>
                <IconButton onClick={() => navigate('/')} sx={{ mr: 2 }}>
                    <ArrowBack />
                </IconButton>
                <AIIcon sx={{ fontSize: 40, mr: 2, color: 'primary.main' }} />
                <Typography variant="h4" component="h1">
                    Assistente IA - Gerenciamento de Aulas
                </Typography>
            </Box>

            <Alert severity="info" sx={{ mb: 3 }}>
                <Typography variant="body2">
                    <strong>Como usar:</strong> Digite comandos em linguagem natural para adicionar, editar ou excluir aulas.
                    <br />
                    <strong>Importante:</strong> Sempre forneça a data completa (dia/mês/ano) para evitar erros.
                    <br />
                    <strong>Exemplos:</strong>
                    <br />• "Adicionar aula de Anatomia para Medicina no laboratório Anatomia 1 no dia 20/11/2025 das 07:00-09:10"
                    <br />• "Adicionar aula de Histologia para Biomedicina e Farmácia nos laboratórios Microscopia 1 e 2 no dia 25/11/2025 nos horários 13:00-15:10 e 15:30-18:00"
                    <br />• "Excluir aulas de Medicina no dia 20/11/2025"
                </Typography>
            </Alert>

            <Paper elevation={3} sx={{ height: '500px', display: 'flex', flexDirection: 'column' }}>
                <Box sx={{ flexGrow: 1, overflowY: 'auto', p: 2 }}>
                    {mensagens.length === 0 && (
                        <Box sx={{ textAlign: 'center', mt: 10 }}>
                            <AIIcon sx={{ fontSize: 80, color: 'grey.400' }} />
                            <Typography variant="h6" color="text.secondary" sx={{ mt: 2 }}>
                                Olá! Como posso ajudar você hoje?
                            </Typography>
                        </Box>
                    )}

                    {mensagens.map((msg, index) => (
                        <Box
                            key={index}
                            sx={{
                                display: 'flex',
                                justifyContent: msg.tipo === 'usuario' ? 'flex-end' : 'flex-start',
                                mb: 2
                            }}
                        >
                            <Card
                                sx={{
                                    maxWidth: '70%',
                                    bgcolor: msg.tipo === 'usuario' ? 'primary.main' :
                                             msg.tipo === 'erro' ? 'error.light' :
                                             msg.tipo === 'sucesso' ? 'success.light' :
                                             'grey.100',
                                    color: msg.tipo === 'usuario' ? 'white' : 'text.primary'
                                }}
                            >
                                <CardContent>
                                    <Typography variant="body1" sx={{ whiteSpace: 'pre-wrap' }}>
                                        {msg.texto}
                                    </Typography>
                                    <Typography variant="caption" sx={{ mt: 1, display: 'block', opacity: 0.7 }}>
                                        {dayjs(msg.timestamp).format('HH:mm')}
                                    </Typography>
                                </CardContent>
                            </Card>
                        </Box>
                    ))}

                    {carregando && (
                        <Box sx={{ display: 'flex', justifyContent: 'flex-start', mb: 2 }}>
                            <Card sx={{ bgcolor: 'grey.100' }}>
                                <CardContent>
                                    <CircularProgress size={24} />
                                </CardContent>
                            </Card>
                        </Box>
                    )}

                    <div ref={messagesEndRef} />
                </Box>

                <Divider />

                <Box sx={{ p: 2, display: 'flex', gap: 1 }}>
                    <TextField
                        fullWidth
                        multiline
                        maxRows={3}
                        placeholder="Digite seu comando aqui... (ex: Adicionar aula de Anatomia para Medicina no dia 20/11/2025 das 07:00-09:10)"
                        value={inputUsuario}
                        onChange={(e) => setInputUsuario(e.target.value)}
                        onKeyPress={(e) => {
                            if (e.key === 'Enter' && !e.shiftKey) {
                                e.preventDefault();
                                processarComando();
                            }
                        }}
                        disabled={carregando}
                    />
                    <Button
                        variant="contained"
                        endIcon={<SendIcon />}
                        onClick={processarComando}
                        disabled={carregando || !inputUsuario.trim()}
                        sx={{ minWidth: '120px' }}
                    >
                        Enviar
                    </Button>
                </Box>
            </Paper>

            {/* Dialog de Confirmação */}
            <Dialog open={openConfirmDialog} onClose={cancelarAcao} maxWidth="md" fullWidth>
                <DialogTitle>
                    Confirmar Ação
                </DialogTitle>
                <DialogContent>
                    <Alert severity="warning" sx={{ mb: 2 }}>
                        Por favor, revise cuidadosamente os dados antes de confirmar.
                    </Alert>
                    {acaoPendente && (
                        <Box>
                            <Typography variant="body1" sx={{ mb: 2 }}>
                                {acaoPendente.confirmacao}
                            </Typography>
                            <Divider sx={{ my: 2 }} />
                            <Typography variant="subtitle2" gutterBottom>
                                Detalhes da ação:
                            </Typography>
                            <Box sx={{ bgcolor: 'grey.100', p: 2, borderRadius: 1 }}>
                                <pre style={{ margin: 0, whiteSpace: 'pre-wrap', fontSize: '0.875rem' }}>
                                    {JSON.stringify(acaoPendente.dados, null, 2)}
                                </pre>
                            </Box>
                        </Box>
                    )}
                </DialogContent>
                <DialogActions>
                    <Button onClick={cancelarAcao} startIcon={<Cancel />} color="error">
                        Cancelar
                    </Button>
                    <Button onClick={confirmarAcao} startIcon={<CheckCircle />} variant="contained" color="primary">
                        Confirmar
                    </Button>
                </DialogActions>
            </Dialog>

            {/* Snackbar */}
            <Snackbar
                open={openSnackbar}
                autoHideDuration={6000}
                onClose={() => setOpenSnackbar(false)}
                anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
            >
                <Alert onClose={() => setOpenSnackbar(false)} severity={snackbarSeverity}>
                    {snackbarMessage}
                </Alert>
            </Snackbar>
        </Container>
    );
}

export default AssistenteIA;
