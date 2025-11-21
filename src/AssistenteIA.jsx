import React, { useState, useEffect, useRef } from 'react';
import {
    Container, Typography, Box, Paper, TextField, Button, CircularProgress,
    Alert, Snackbar, Dialog, DialogTitle, DialogContent, DialogActions,
    List, ListItem, ListItemText, Divider, Chip, IconButton, Card, CardContent
} from '@mui/material';
import { Send as SendIcon, SmartToy as AIIcon, ArrowBack, CheckCircle, Cancel, Mic as MicIcon, Stop as StopIcon } from '@mui/icons-material';
import ResultadoVisual from './components/ResultadoVisual';
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

    const adicionarMensagem = (texto, tipo = 'usuario', visualData = null) => {
        setMensagens(prev => [...prev, { texto, tipo, timestamp: new Date(), visualData }]);
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

Seu trabalho é interpretar comandos do usuário e extrair informações em um JSON estruturado. Sua principal responsabilidade é separar claramente os **critérios de busca** dos **dados para a ação**.

1. **Para ações de 'editar' ou 'excluir':** Sua prioridade é preencher o objeto 'criterios_busca'. Use os detalhes fornecidos pelo usuário (assunto, data, curso) para identificar qual(is) aula(s) devem ser modificadas. O objeto 'dados_novos' deve conter apenas as informações que serão alteradas.

2. **Para ações de 'adicionar':** Preencha o objeto 'dados_novos' com todas as informações da nova aula. O objeto 'criterios_busca' pode ficar vazio.

3. **Para ações de 'consultar':** Preencha o objeto 'criterios_busca' com os filtros que o usuário especificar. IMPORTANTE: Se o usuário perguntar sobre um assunto específico (ex: 'tem aula de bcmol?', 'aulas de anatomia'), use o campo 'termoBusca' com o termo mencionado. Além disso, você DEVE preencher os campos 'tipo_visual' e 'dados_consulta' com a informação simulada da busca.

*   **Se a consulta for sobre um resumo (ex: "quantas aulas", "próxima aula"):** Use tipo_visual: "card_resumo".
*   **Se a consulta for sobre uma lista detalhada (ex: "aulas de medicina em dezembro"):** Use tipo_visual: "tabela_aulas".

**Formato de 'dados_consulta' para 'card_resumo' (simulação):**
{ "total_aulas": 5, "proxima_aula": "Anatomia Humana - 20/11/2025 às 07:00", "laboratorio_mais_usado": "Anatomia 1" }

**Formato de 'dados_consulta' para 'tabela_aulas' (simulação):**
[{ "assunto": "Anatomia Humana", "data": "20/11/2025", "horario": "07:00-09:10", "laboratorio": "Anatomia 1", "cursos": ["Medicina", "Enfermagem"] }]

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
*   **Detalhe e Estrutura da Resposta (Consultas):** Se a ação for "consultar" e você encontrar aulas, a resposta no campo 'resposta' DEVE ser detalhada e estruturada (lista ou tabela) contendo: **Assunto**, **Data**, **Horário**, **Laboratório** e **Cursos Envolvidos**.

**4. Formato de Resposta Esperado (JSON):**

*   Use APENAS o formato JSON abaixo.
*   Sempre retorne um JSON válido.
*   Use APENAS os dados fornecidos no contexto (cursos, laboratórios, horários).

Formato: { "acao": "adicionar|editar|excluir|consultar", "criterios_busca": { "aulaId": "string", "assunto": "string", "termoBusca": "string (termo para buscar em assunto/observacoes)", "cursos": ["curso1"], "laboratorios": ["lab1"], "data": "DD/MM/YYYY", "mes": "MM/YYYY", "ano": "YYYY", "horarios": ["07:00-09:10"] }, "dados_novos": { "assunto": "string", "cursos": ["curso1"], "laboratorios": [{"tipo": "tipo_lab", "ids": ["lab1"]}], "horarios": ["07:00-09:10"], "data": "DD/MM/YYYY", "observacoes": "string" }, "confirmacao": "Texto descritivo", "resposta": "Texto de resposta", "tipo_visual": "card_resumo|tabela_aulas|null", "dados_consulta": "object|array" }

Se o comando não for claro ou faltar informações CRÍTICAS, retorne: { "erro": "Descrição do que está faltando ou não está claro" }

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

            // Se há constraints, aplica a query com filtros
            if (constraints.length > 0) {
                q = query(q, ...constraints);
            } else if (!criterios.termoBusca) {
                // Se não há nenhum critério (nem constraints nem termoBusca), retorna vazio
                // Isso evita buscar todas as 4909 aulas sem necessidade
                console.warn('Busca sem critérios específicos - retornando vazio');
                return [];
            }

            const querySnapshot = await getDocs(q);
            let aulas = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

            // Filtro por termo de busca (aplicação local)
            if (criterios.termoBusca) {
                const termo = criterios.termoBusca.toLowerCase();
                aulas = aulas.filter(aula => 
                    (aula.assunto && aula.assunto.toLowerCase().includes(termo)) ||
                    (aula.tipoAtividade && aula.tipoAtividade.toLowerCase().includes(termo)) ||
                    (aula.observacoes && aula.observacoes.toLowerCase().includes(termo))
                );
            }

            // Filtro por cursos (aplicação local)
            if (criterios.cursos && criterios.cursos.length > 0) {
                aulas = aulas.filter(aula => 
                    aula.cursos && aula.cursos.some(curso => 
                        criterios.cursos.includes(curso.toLowerCase())
                    )
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

    const isConflict = async (data, horario, laboratorio, aulaIdToExclude = null) => {
        // Converte a data e horário para um objeto Day.js para facilitar a comparação
        const dataAula = dayjs(data, 'DD/MM/YYYY');
        const [horaInicio, horaFim] = horario.split('-');
        
        // 1. Busca no Firebase por aulas no mesmo dia, mesmo laboratório e mesmo horário
        const q = query(
            collection(db, "aulas"),
            where("laboratorioSelecionado", "==", laboratorio),
            where("horarioSlotString", "==", horario),
            where("dataInicio", ">=", Timestamp.fromDate(dataAula.startOf('day').toDate())),
            where("dataInicio", "<=", Timestamp.fromDate(dataAula.endOf('day').toDate()))
        );

        const querySnapshot = await getDocs(q);
        
        let conflitos = [];
        querySnapshot.forEach(doc => {
            if (doc.id !== aulaIdToExclude) {
                conflitos.push({ id: doc.id, ...doc.data() });
            }
        });

        return conflitos;
    };

    const executarAcaoAdicionar = async (dados) => {
        // Lógica de Adicionar: A IA já forneceu todos os dados em dados_novos.
        // A validação de conflito deve ser feita aqui.
        // Por enquanto, vamos simular a lógica de adição.
        // **IMPORTANTE:** A lógica de validação de conflito (isConflict) deve ser implementada.
        
        // 1. Validação de Dados Básica
        const erros = validarDados(dados);
        if (erros.length > 0) {
            throw new Error(erros.join('; '));
        }

        // 2. Verificação de Conflito (Ação Real)
        let conflitosEncontrados = [];
        for (const lab of dados.laboratorios) {
            for (const horario of dados.horarios) {
                const conflitos = await isConflict(dados.data, horario, lab);
                if (conflitos.length > 0) {
                    conflitosEncontrados.push({ lab, horario, conflitos });
                }
            }
        }

        if (conflitosEncontrados.length > 0) {
            const listaConflitos = conflitosEncontrados.map(c => 
                `Conflito em ${c.lab} no horário ${c.horario} com ${c.conflitos.length} aula(s) existente(s).`
            ).join('\n');
            throw new Error(`Conflito de horário detectado:\n${listaConflitos}`);
        }

        // 3. Adição no Firebase (Ação Real)
        // const batch = writeBatch(db);
        // ... (código de adição)
        
        // Retorna uma mensagem de sucesso
        // const batch = writeBatch(db);
        // for (const curso of dados.cursos) {
        //     for (const lab of dados.laboratorios) {
        //         for (const horario of dados.horarios) {
        //             const aulaRef = doc(collection(db, "aulas"));
        //             batch.set(aulaRef, {
        //                 assunto: dados.assunto,
        //                 curso: curso,
        //                 laboratorioSelecionado: lab,
        //                 horarioSlotString: horario,
        //                 dataInicio: Timestamp.fromDate(dayjs(dados.data, 'DD/MM/YYYY').toDate()),
        //                 // ... outros campos
        //                 createdAt: serverTimestamp(),
        //                 propostoPorUid: currentUser.uid,
        //                 propostoPorNome: currentUser.displayName || 'Coordenador IA'
        //             });
        //         }
        //     }
        // }
        // await batch.commit();
        
        // Retorna uma mensagem de sucesso
        return `Ação de Adicionar executada com sucesso. ${dados.cursos.length * dados.laboratorios.length * dados.horarios.length} aula(s) simulada(s) para ${dados.assunto}.`;
    };
    const executarAcaoEditar = async (criteriosBusca, dadosNovos) => {
        // 1. Busca: Encontrar a aula a ser editada
        let aulas = [];
        if (criteriosBusca.aulaId) {
            const docSnap = await getDoc(doc(db, "aulas", criteriosBusca.aulaId));
            if (docSnap.exists()) {
                aulas.push({ id: docSnap.id, ...docSnap.data() });
            }
        } else {
            // Se não tem ID, usa os critérios de busca
            aulas = await buscarAulasFirebase(criteriosBusca);
        }

        // 2. Desambiguação/Validação
        if (aulas.length === 0) {
            throw new Error('Nenhuma aula encontrada com os critérios fornecidos. Por favor, seja mais específico.');
        }
        if (aulas.length > 1) {
            // Se houver mais de uma aula, o sistema deve pausar e pedir desambiguação.
            // Aqui, vamos forçar um erro para que o usuário refine a busca.
            const listaAulas = aulas.map(aula => 
                `ID: ${aula.id.substring(0, 6)}... - ${aula.assunto} em ${aula.laboratorioSelecionado} (${dayjs(aula.dataInicio.toDate()).format('DD/MM/YYYY HH:mm')})`
            ).join('\n');
            throw new Error(`Múltiplas aulas encontradas (${aulas.length}). Por favor, forneça o ID exato ou critérios mais específicos:\n${listaAulas}`);
        }

        const aulaParaEditar = aulas[0];
        
        // 3. Validação de Conflito (Ação Real)
        if (dadosNovos.data || dadosNovos.horarios || dadosNovos.laboratorios) {
            const data = dadosNovos.data || dayjs(aulaParaEditar.dataInicio.toDate()).format('DD/MM/YYYY');
            const horarios = dadosNovos.horarios || [aulaParaEditar.horarioSlotString];
            const laboratorios = dadosNovos.laboratorios || [aulaParaEditar.laboratorioSelecionado];

            let conflitosEncontrados = [];
            for (const lab of laboratorios) {
                for (const horario of horarios) {
                    // Exclui a própria aula da verificação de conflito
                    const conflitos = await isConflict(data, horario, lab, aulaParaEditar.id);
                    if (conflitos.length > 0) {
                        conflitosEncontrados.push({ lab, horario, conflitos });
                    }
                }
            }

            if (conflitosEncontrados.length > 0) {
                const listaConflitos = conflitosEncontrados.map(c => 
                    `Conflito em ${c.lab} no horário ${c.horario} com ${c.conflitos.length} aula(s) existente(s).`
                ).join('\n');
                throw new Error(`Conflito de horário detectado ao tentar editar:\n${listaConflitos}`);
            }
        }

        // 4. Execução da Edição
        const dadosAtualizados = {
            ...dadosNovos,
            // Atualiza o timestamp de modificação
            updatedAt: serverTimestamp()
        };

        // Simulação de Edição no Firebase
        // await updateDoc(doc(db, "aulas", aulaParaEditar.id), dadosAtualizados);

        return `Aula ID ${aulaParaEditar.id.substring(0, 6)}... (${aulaParaEditar.assunto}) editada com sucesso.`;
    };
    const executarAcaoExcluir = async (criteriosBusca) => {
        // 1. Busca: Encontrar a(s) aula(s) a ser(em) excluída(s)
        let aulas = [];
        if (criteriosBusca.aulaId) {
            const docSnap = await getDoc(doc(db, "aulas", criteriosBusca.aulaId));
            if (docSnap.exists()) {
                aulas.push({ id: docSnap.id, ...docSnap.data() });
            }
        } else {
            // Se não tem ID, usa os critérios de busca
            aulas = await buscarAulasFirebase(criteriosBusca);
        }

        // 2. Validação
        if (aulas.length === 0) {
            throw new Error('Nenhuma aula encontrada para exclusão com os critérios fornecidos.');
        }

        // 3. Execução da Exclusão em Lote
        // const batch = writeBatch(db);
        // aulas.forEach(aula => {
        //     batch.delete(doc(db, "aulas", aula.id));
        // });
        // await batch.commit();

        return `${aulas.length} aula(s) simulada(s) para exclusão com sucesso.`;
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

            if (resultadoIA.acao === 'consultar') {
                // Lógica de Layout Adaptativo
                
                // 1. Busca no Firebase (para obter dados reais)
                const aulas = await buscarAulasFirebase(resultadoIA.criterios_busca || {});
                
                let visualData = null;
                let respostaTexto = resultadoIA.resposta || '';

                if (resultadoIA.tipo_visual) {
                    // Se a IA sugeriu um tipo visual, usamos os dados reais do Firebase para preencher o componente
                    
                    // Simulação de preenchimento de dados para o componente visual
                    if (resultadoIA.tipo_visual === 'card_resumo') {
                        visualData = {
                            tipo_visual: 'card_resumo',
                            titulo: 'Resumo da Consulta',
                            dados_consulta: {
                                total_aulas: aulas.length,
                                proxima_aula: aulas.length > 0 ? `${aulas[0].assunto} em ${dayjs(aulas[0].dataInicio.toDate()).format('DD/MM/YYYY HH:mm')}` : 'Nenhuma',
                                laboratorio_mais_usado: 'Anatomia 1 (Simulado)'
                            }
                        };
                    } else if (resultadoIA.tipo_visual === 'tabela_aulas') {
                        visualData = {
                            tipo_visual: 'tabela_aulas',
                            titulo: 'Lista Detalhada de Aulas',
                            dados_consulta: aulas.map(aula => ({
                                assunto: aula.assunto,
                                data: dayjs(aula.dataInicio.toDate()).format('DD/MM/YYYY'),
                                horario: aula.horarioSlotString,
                                laboratorio: aula.laboratorioSelecionado,
                                cursos: aula.cursos || []
                            }))
                        };
                    }
                    
                    // Se encontramos dados, a resposta de texto pode ser mais simples
                    if (aulas.length > 0) {
                        respostaTexto = `Encontrei ${aulas.length} aula(s) que correspondem à sua busca. Veja o resumo visual abaixo.`;
                    } else {
                        respostaTexto = `Não encontrei nenhuma aula que corresponda à sua busca.`;
                        visualData = null; // Não mostra componente visual se não houver dados
                    }

                } else {
                    // Fallback para o modo texto tradicional (se a IA não sugerir visual)
                    if (aulas.length > 0) {
                        const listaAulas = aulas.map(aula => 
                            `${aula.assunto} em ${aula.laboratorioSelecionado} no dia ${dayjs(aula.dataInicio.toDate()).format('DD/MM/YYYY HH:mm')}`
                        ).join('; ');
                        respostaTexto = `Encontrei ${aulas.length} aula(s): ${listaAulas}.`;
                    } else {
                        respostaTexto = `Não encontrei nenhuma aula que corresponda à sua busca.`;
                    }
                }
                
                adicionarMensagem(respostaTexto, 'ia', visualData);

            } else if (resultadoIA.confirmacao) {
                setAcaoPendente({
                    acao: resultadoIA.acao,
                    // Passa o JSON completo da IA, que agora contém criterios_busca e dados_novos
                    dados: resultadoIA, 
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

    const handleConfirmarAcao = async () => {
        setOpenConfirmDialog(false);
        setCarregando(true);
        
        try {
            let resultadoMensagem = '';
            const { acao, dados } = acaoPendente;
            
            // O JSON da IA agora tem "criterios_busca" e "dados_novos"
            const criteriosBusca = dados.criterios_busca || {};
            const dadosNovos = dados.dados_novos || {};

            if (acao === 'adicionar') {
                resultadoMensagem = await executarAcaoAdicionar(dadosNovos);
            } else if (acao === 'editar') {
                resultadoMensagem = await executarAcaoEditar(criteriosBusca, dadosNovos);
            } else if (acao === 'excluir') {
                resultadoMensagem = await executarAcaoExcluir(criteriosBusca);
            }

            adicionarMensagem(`✅ ${resultadoMensagem}`, 'ia');
            setAcaoPendente(null);
        } catch (error) {
            console.error('Erro na execução da ação:', error);
            adicionarMensagem(`❌ Erro ao executar a ação: ${error.message}`, 'ia');
        } finally {
            setCarregando(false);
        }
    };
    const handleCancelarAcao = () => {
        setOpenConfirmDialog(false);
        adicionarMensagem('Ação cancelada pelo usuário.', 'ia');
        setAcaoPendente(null);
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
                    {/* NOVO: Renderiza o componente visual se houver dados */}
                    {mensagem.visualData && (
                        <Box sx={{ mt: 1, p: 1, borderRadius: 1, backgroundColor: mode === 'dark' ? '#555' : '#eee' }}>
                            <ResultadoVisual resultado={mensagem.visualData} mode={mode} />
                        </Box>
                    )}
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
