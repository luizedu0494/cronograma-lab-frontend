// src/ImportarAgendamento.jsx
// Importação Inteligente com IA (Claude) para interpretação dos arquivos
// Parsers client-side extraem o texto → Claude interpreta e retorna JSON estruturado
// Zero custo extra no Firebase Free Plan: 1 query por lote para verificar conflitos

import React, { useState, useCallback, useRef } from 'react';
import {
    Container, Typography, Box, Paper, Button, Stepper, Step, StepLabel,
    CircularProgress, Alert, Chip, Grid, Card, CardContent,
    TextField, FormControl, InputLabel, Select, MenuItem, Checkbox,
    IconButton, LinearProgress, Snackbar, Divider, Collapse,
    Tooltip, Badge,
} from '@mui/material';
import {
    CloudUpload, CheckCircle, Cancel, FilePresent,
    ArrowForward, ArrowBack, PlaylistAdd, Done, Warning,
    Delete as DeleteIcon, Science, Schedule, CalendarToday,
    AutoAwesome, CheckCircleOutline, SmartToy, Psychology,
    ExpandMore, ExpandLess, Edit,
} from '@mui/icons-material';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import { AdapterDayjs } from '@mui/x-date-pickers/AdapterDayjs';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { useTheme, alpha } from '@mui/material/styles';
import dayjs from 'dayjs';
import 'dayjs/locale/pt-br';
import isBetween from 'dayjs/plugin/isBetween';
import * as XLSX from 'xlsx';
import { db } from './firebaseConfig';
import {
    collection, addDoc, serverTimestamp, query,
    where, getDocs, Timestamp
} from 'firebase/firestore';
import { LISTA_LABORATORIOS, TIPOS_LABORATORIO } from './constants/laboratorios';
import { LISTA_CURSOS } from './constants/cursos';
import PropTypes from 'prop-types';

dayjs.extend(isBetween);
dayjs.locale('pt-br');

// ─── Blocos de horário padrão ──────────────────────────────────────────────────
const BLOCOS_HORARIO = [
    { value: '07:00-09:10', label: '07:00–09:10', turno: 'Matutino',   startMin: 7*60      },
    { value: '09:30-12:00', label: '09:30–12:00', turno: 'Matutino',   startMin: 9*60+30   },
    { value: '13:00-15:10', label: '13:00–15:10', turno: 'Vespertino', startMin: 13*60     },
    { value: '15:30-18:00', label: '15:30–18:00', turno: 'Vespertino', startMin: 15*60+30  },
    { value: '18:30-20:10', label: '18:30–20:10', turno: 'Noturno',    startMin: 18*60+30  },
    { value: '20:30-22:00', label: '20:30–22:00', turno: 'Noturno',    startMin: 20*60+30  },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function horarioParaBloco(str) {
    if (!str) return [];
    const blocos = new Set();
    const push = (h, m) => {
        const total = parseInt(h) * 60 + parseInt(m || 0);
        let best = null, bestDiff = 9999;
        BLOCOS_HORARIO.forEach(b => {
            const d = Math.abs(total - b.startMin);
            if (d < bestDiff) { bestDiff = d; best = b.value; }
        });
        if (best && bestDiff <= 90) blocos.add(best);
    };
    const r1 = /[Ii]n[íi]cio[:\s]+(\d{1,2})[h:](\d{0,2})/g;
    let m;
    while ((m = r1.exec(str)) !== null) push(m[1], m[2]);
    if (!blocos.size) {
        const r2 = /\b(\d{1,2}):(\d{2})\b/g;
        while ((m = r2.exec(str)) !== null) push(m[1], m[2]);
    }
    return [...blocos];
}

function parseData(str, anoDefault) {
    if (!str) return null;
    const s = String(str).replace(/\(.*?\)/g, '').trim().split(/\s/)[0];
    const m = s.match(/(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?/);
    if (!m) return null;
    const d = m[1].padStart(2, '0'), mo = m[2].padStart(2, '0');
    const y = m[3] ? (m[3].length === 2 ? '20' + m[3] : m[3]) : (anoDefault || dayjs().year());
    const dt = dayjs(`${y}-${mo}-${d}`);
    return dt.isValid() ? dt : null;
}

function labIdParaNome(id) {
    return LISTA_LABORATORIOS.find(l => l.id === id)?.name || id || '';
}

function labNomeParaId(nome) {
    if (!nome) return '';
    const n = nome.toLowerCase().trim();
    const exact = LISTA_LABORATORIOS.find(l => l.name.toLowerCase() === n);
    if (exact) return exact.id;
    const partial = LISTA_LABORATORIOS.find(l =>
        l.name.toLowerCase().includes(n) || n.includes(l.name.toLowerCase().split(' ')[0])
    );
    return partial?.id || '';
}

function makeAula({ assunto, data, horarios, laboratorioId, observacoes, iaConfianca, iaRazao, fonteTexto }) {
    return {
        id: `aula_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        assunto: (assunto || '').substring(0, 200),
        selecionada: true,
        dataAgendamento: data || null,
        horarios: horarios || [],
        laboratorio: laboratorioId || '',
        tipoLab: laboratorioId ? (LISTA_LABORATORIOS.find(l => l.id === laboratorioId)?.tipo || '') : '',
        observacoes: observacoes || '',
        iaConfianca: iaConfianca || 'media',   // 'alta' | 'media' | 'baixa'
        iaRazao: iaRazao || '',                // explicação da IA
        fonteTexto: fonteTexto || '',          // trecho original
        conflito: null,
    };
}

// ─── Extratores de texto bruto (client-side, sem custo) ───────────────────────

async function extrairTextoDOCX(file) {
    if (!window.JSZip) {
        await new Promise((res, rej) => {
            const s = document.createElement('script');
            s.src = 'https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js';
            s.onload = res; s.onerror = rej;
            document.head.appendChild(s);
        });
    }
    const zip = await window.JSZip.loadAsync(await file.arrayBuffer());
    const xml = await zip.file('word/document.xml').async('string');
    const cellText = x =>
        (x.match(/<w:t[^>]*>([^<]*)<\/w:t>/g) || [])
            .map(t => t.replace(/<[^>]+>/g, '')).join(' ').trim();

    // Extrai tabelas como texto CSV simples para a IA entender
    const tables = xml.split(/<w:tbl[ >]/);
    tables.shift();
    const blocos = [];

    tables.forEach((tblXml, ti) => {
        const rows = tblXml.split(/<w:tr[ >]/).slice(1);
        const linhas = rows.map(row => {
            const cells = row.split(/<w:tc[ >]/).slice(1).map(cellText);
            return cells.filter(Boolean).join(' | ');
        }).filter(Boolean);
        if (linhas.length > 1) blocos.push(`[Tabela ${ti + 1}]\n${linhas.join('\n')}`);
    });

    // Também extrai parágrafos fora de tabelas
    const paragrafos = (xml.match(/<w:p[ >][\s\S]*?<\/w:p>/g) || [])
        .map(p => (p.match(/<w:t[^>]*>([^<]*)<\/w:t>/g) || [])
            .map(t => t.replace(/<[^>]+>/g, '')).join(' ').trim())
        .filter(t => t.length > 3);

    if (paragrafos.length > 0) blocos.push(`[Parágrafos]\n${paragrafos.join('\n')}`);
    return blocos.join('\n\n');
}

async function extrairTextoExcel(file) {
    const wb = XLSX.read(await file.arrayBuffer(), { type: 'array', raw: false });
    const blocos = [];
    wb.SheetNames.forEach(sheetName => {
        const rows = XLSX.utils.sheet_to_json(wb.Sheets[sheetName], { header: 1, defval: '', raw: false });
        const linhas = rows.map(row =>
            row.map(c => String(c === null || c === undefined ? '' : c).trim()).filter(Boolean).join(' | ')
        ).filter(Boolean);
        if (linhas.length > 0) blocos.push(`[Planilha: ${sheetName}]\n${linhas.join('\n')}`);
    });
    return blocos.join('\n\n');
}

async function extrairTextoPDF(file) {
    if (!window.pdfjsLib) {
        await new Promise((res, rej) => {
            const s = document.createElement('script');
            s.src = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js';
            s.onload = res; s.onerror = rej; document.head.appendChild(s);
        });
        window.pdfjsLib.GlobalWorkerOptions.workerSrc =
            'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
    }
    const pdf = await window.pdfjsLib.getDocument({ data: await file.arrayBuffer() }).promise;
    const paginas = [];
    for (let i = 1; i <= pdf.numPages; i++) {
        const page = await pdf.getPage(i);
        const tc = await page.getTextContent();
        // Agrupa por linhas via posição Y
        const linhasMap = {};
        tc.items.forEach(item => {
            const y = Math.round(item.transform[5]);
            if (!linhasMap[y]) linhasMap[y] = [];
            linhasMap[y].push(item.str);
        });
        const linhas = Object.keys(linhasMap).sort((a, b) => b - a)
            .map(y => linhasMap[y].join('').trim()).filter(l => l.length > 2);
        paginas.push(`[PDF pág. ${i}]\n${linhas.join('\n')}`);
    }
    return paginas.join('\n\n');
}

async function extrairTexto(file) {
    const nome = file.name.toLowerCase();
    if (nome.endsWith('.docx') || nome.endsWith('.doc')) return await extrairTextoDOCX(file);
    if (nome.endsWith('.xlsx') || nome.endsWith('.xls') || nome.endsWith('.csv')) return await extrairTextoExcel(file);
    if (nome.endsWith('.pdf')) return await extrairTextoPDF(file);
    throw new Error(`Formato não suportado: ${file.name}`);
}

// ─── Interpretação via Claude API ─────────────────────────────────────────────

// Reutiliza exatamente a mesma chave e modelo já configurados no projeto (ProcessadorConsultas.js)
const GROQ_API_KEY = import.meta.env.VITE_GROQ_API_KEY;
const GROQ_MODEL   = 'llama-3.3-70b-versatile';
const LABS_PARA_IA = LISTA_LABORATORIOS.map(l => `${l.id} (${l.name})`).join(', ');

async function interpretarComIA(textoExtraido, nomeArquivo, onProgress) {
    if (!GROQ_API_KEY) throw new Error('Chave VITE_GROQ_API_KEY não encontrada no .env');

    onProgress('Enviando para interpretação com IA...');

    // Groq llama-3.3-70b suporta ~128k tokens, mas limitamos a ~12k chars de texto
    // para manter latência baixa e evitar timeouts
    const textoTruncado = textoExtraido.length > 12000
        ? textoExtraido.slice(0, 12000) + '\n...[truncado]'
        : textoExtraido;

    const systemPrompt = `Você é um assistente especializado em análise de cronogramas acadêmicos de cursos da área da saúde.
Sua tarefa é identificar aulas PRÁTICAS de laboratório em textos extraídos de arquivos de cronograma.

RETORNE APENAS um array JSON válido, sem markdown, sem texto antes ou depois.
Cada item do array deve ter exatamente estes campos:
- assunto: string — nome/tema da aula prática
- data: string|null — formato "DD/MM/YYYY" ou null
- horaBloco: string|null — UM dos blocos exatos: "07:00-09:10", "09:30-12:00", "13:00-15:10", "15:30-18:00", "18:30-20:10", "20:30-22:00", ou null
- laboratorioId: string|null — ID do laboratório mais adequado. IDs disponíveis: ${LABS_PARA_IA}
- confianca: "alta" | "media" | "baixa"
- razao: string — frase curta explicando a escolha do laboratório
- fonteTexto: string — trecho de até 80 chars do texto original

REGRAS:
1. Ignore aulas teóricas — só extraia práticas/laboratório
2. Mapeamento de conteúdo para laboratório: anatomia/dissecção→anatomia_1, microscopia/histologia/células/lâminas→microscopia_1, habilidades/semiologia/procedimentos/aferição→habilidade_1_ney_braga, química/vidraria/soluções/reagentes→multidisciplinar_1, farmácia/manipulação/formulação→farmaceutico, nutrição/alimentos/dietética→tec_dietetica
3. Se o arquivo mencionar o laboratório explicitamente, use esse
4. Não duplique a mesma aula — agrupe por data
5. Se não houver NENHUMA aula prática, retorne []`;

    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${GROQ_API_KEY}`,
        },
        body: JSON.stringify({
            model: GROQ_MODEL,
            temperature: 0.1,                          // baixa = mais obediente ao JSON
            response_format: { type: 'json_object' },  // Groq garante JSON válido
            messages: [
                { role: 'system', content: systemPrompt },
                { role: 'user',   content: `Arquivo: "${nomeArquivo}"\n\n${textoTruncado}` },
            ],
        }),
    });

    if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        throw new Error(`Erro Groq: ${err.error?.message || response.statusText}`);
    }

    const data = await response.json();
    onProgress('Processando resposta da IA...');

    const conteudo = data.choices[0].message.content;

    // response_format json_object garante JSON, mas pode vir como { aulas: [...] } ou diretamente [...]
    let parsed;
    try {
        parsed = JSON.parse(conteudo);
    } catch {
        throw new Error('Groq retornou resposta inválida. Tente novamente.');
    }

    // Normaliza: aceita tanto array direto quanto { aulas: [...] } ou { result: [...] }
    const aulasIA = Array.isArray(parsed)
        ? parsed
        : (parsed.aulas || parsed.result || parsed.data || Object.values(parsed).find(Array.isArray) || []);

    if (!Array.isArray(aulasIA)) throw new Error('Formato de resposta inesperado da IA.');

    return aulasIA.map(item => makeAula({
        assunto:      item.assunto      || 'Aula sem título',
        data:         item.data         ? parseData(item.data) : null,
        horarios:     item.horaBloco    ? [item.horaBloco] : [],
        laboratorioId: item.laboratorioId
            ? (LISTA_LABORATORIOS.find(l => l.id === item.laboratorioId)
                ? item.laboratorioId
                : labNomeParaId(item.laboratorioId))
            : '',
        observacoes:  '',
        iaConfianca:  item.confianca   || 'media',
        iaRazao:      item.razao       || '',
        fonteTexto:   item.fonteTexto  || '',
    }));
}

// ─── Verificação de conflitos — 1 query no Firestore ──────────────────────────

async function verificarConflitos(aulas) {
    const aulasComData = aulas.filter(a => a.dataAgendamento && dayjs(a.dataAgendamento).isValid());
    if (aulasComData.length === 0) return aulas;

    const datas = aulasComData.map(a => dayjs(a.dataAgendamento));
    const dataMin = datas.reduce((a, b) => (a.isBefore(b) ? a : b));
    const dataMax = datas.reduce((a, b) => (a.isAfter(b) ? a : b));

    // Uma única query para todo o período
    const snap = await getDocs(query(
        collection(db, 'aulas'),
        where('dataInicio', '>=', Timestamp.fromDate(dataMin.startOf('day').toDate())),
        where('dataInicio', '<=', Timestamp.fromDate(dataMax.endOf('day').toDate())),
        where('status', 'in', ['aprovada', 'pendente'])
    ));
    const existentes = snap.docs.map(d => ({ id: d.id, ...d.data() }));

    return aulas.map(aula => {
        if (!aula.dataAgendamento || !aula.laboratorio || aula.horarios.length === 0) {
            return { ...aula, conflito: null };
        }
        const conflitante = existentes.find(e => {
            if (e.laboratorioSelecionado !== aula.laboratorio) return false;
            const eData = dayjs(e.dataInicio?.toDate?.() || e.dataInicio);
            const aulaData = dayjs(aula.dataAgendamento);
            if (!eData.isSame(aulaData, 'day')) return false;
            const eHorarios = Array.isArray(e.horarioSlotString) ? e.horarioSlotString : [e.horarioSlotString];
            return eHorarios.some(h => aula.horarios.includes(h));
        });
        return {
            ...aula,
            conflito: conflitante ? {
                id: conflitante.id,
                assunto: conflitante.assunto,
                lab: labIdParaNome(conflitante.laboratorioSelecionado),
            } : null,
        };
    });
}

// ─── DropZone ─────────────────────────────────────────────────────────────────
function DropZone({ onFileSelected, loading, statusMsg }) {
    const inputRef = useRef(null);
    const [dragging, setDragging] = useState(false);
    const theme = useTheme();

    const handleDrop = useCallback(e => {
        e.preventDefault(); setDragging(false);
        const f = e.dataTransfer.files[0]; if (f) onFileSelected(f);
    }, [onFileSelected]);

    return (
        <Box
            onDragOver={e => { e.preventDefault(); setDragging(true); }}
            onDragLeave={() => setDragging(false)}
            onDrop={handleDrop}
            onClick={() => !loading && inputRef.current?.click()}
            sx={{
                border: `2px dashed ${dragging ? theme.palette.primary.main : theme.palette.divider}`,
                borderRadius: 3, p: { xs: 4, md: 6 }, textAlign: 'center',
                cursor: loading ? 'default' : 'pointer',
                background: dragging
                    ? alpha(theme.palette.primary.main, 0.04)
                    : alpha(theme.palette.action.selected, 0.02),
                transition: 'all 0.2s',
                '&:hover': {
                    background: !loading ? alpha(theme.palette.primary.main, 0.04) : undefined,
                    borderColor: !loading ? theme.palette.primary.main : undefined,
                },
            }}
        >
            <input ref={inputRef} type="file" hidden
                accept=".pdf,.doc,.docx,.xls,.xlsx,.csv"
                onChange={e => e.target.files[0] && onFileSelected(e.target.files[0])} />

            {loading ? (
                <Box sx={{ py: 2 }}>
                    <Box sx={{
                        width: 64, height: 64, mx: 'auto', mb: 2,
                        borderRadius: '50%',
                        background: `linear-gradient(135deg, ${theme.palette.primary.main}, ${theme.palette.secondary.main})`,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        animation: 'pulse 1.5s ease-in-out infinite',
                    }}>
                        <SmartToy sx={{ color: 'white', fontSize: 32 }} />
                    </Box>
                    <Typography variant="h6" fontWeight={600} gutterBottom>Analisando com IA</Typography>
                    <Typography variant="body2" color="text.secondary">{statusMsg}</Typography>
                    <LinearProgress sx={{ mt: 2, borderRadius: 2, mx: 'auto', maxWidth: 300 }} />
                </Box>
            ) : (
                <Box>
                    <CloudUpload sx={{ fontSize: 52, color: 'text.secondary', mb: 1.5 }} />
                    <Typography variant="h6" fontWeight={600} gutterBottom>Arraste ou clique para selecionar</Typography>
                    <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                        O arquivo será interpretado por IA para identificar automaticamente as aulas práticas
                    </Typography>
                    <Box sx={{ display: 'flex', gap: 1, justifyContent: 'center', flexWrap: 'wrap' }}>
                        {['.DOCX', '.XLSX', '.PDF', '.CSV'].map(e => (
                            <Chip key={e} label={e} size="small" variant="outlined" />
                        ))}
                    </Box>
                </Box>
            )}
        </Box>
    );
}

// ─── AulaCard ─────────────────────────────────────────────────────────────────
function AulaCard({ aula, index, onChange, onToggle, onRemove }) {
    const theme = useTheme();
    const [mostrarDetalhes, setMostrarDetalhes] = useState(false);

    const labAtualInfo = aula.laboratorio
        ? LISTA_LABORATORIOS.find(l => l.id === aula.laboratorio)
        : null;

    const corConfianca = {
        alta: theme.palette.success.main,
        media: theme.palette.warning.main,
        baixa: theme.palette.error.main,
    }[aula.iaConfianca] || theme.palette.grey[500];

    const isCompleto = aula.assunto && aula.dataAgendamento && aula.horarios.length > 0 && aula.laboratorio;

    return (
        <Card variant="outlined" sx={{
            mb: 2,
            opacity: aula.selecionada ? 1 : 0.4,
            borderColor: !aula.selecionada
                ? 'divider'
                : aula.conflito
                    ? 'error.main'
                    : isCompleto
                        ? 'success.main'
                        : 'warning.main',
            borderWidth: aula.conflito ? 2 : 1,
            transition: 'all 0.2s',
        }}>
            <CardContent sx={{ pb: '12px !important' }}>

                {/* Linha 1: checkbox + badge IA + status + lixeira */}
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1.5 }}>
                    <Checkbox
                        checked={aula.selecionada}
                        onChange={e => onToggle(index, e.target.checked)}
                        color="primary" sx={{ p: 0 }}
                    />

                    {/* Badge de confiança da IA */}
                    <Tooltip title={`IA: ${aula.iaRazao || 'sem detalhes'}`}>
                        <Chip
                            size="small"
                            icon={<SmartToy sx={{ fontSize: '14px !important' }} />}
                            label={aula.iaConfianca}
                            sx={{
                                backgroundColor: alpha(corConfianca, 0.12),
                                color: corConfianca,
                                fontWeight: 700,
                                fontSize: '0.65rem',
                                cursor: 'help',
                            }}
                        />
                    </Tooltip>

                    <Box sx={{ flexGrow: 1 }} />

                    {aula.conflito ? (
                        <Chip size="small" icon={<Warning sx={{ fontSize: 14 }} />}
                            label="CONFLITO" color="error" variant="filled" sx={{ fontWeight: 700 }} />
                    ) : labAtualInfo ? (
                        <Chip size="small" icon={<CheckCircleOutline sx={{ fontSize: 14 }} />}
                            label={labAtualInfo.name} color="success" variant="filled"
                            sx={{ fontWeight: 600, maxWidth: 180 }} />
                    ) : (
                        <Chip size="small" icon={<AutoAwesome sx={{ fontSize: 14 }} />}
                            label="Selecionar laboratório" color="warning" variant="outlined" />
                    )}

                    <IconButton size="small" onClick={() => onRemove(index)} color="error">
                        <DeleteIcon fontSize="small" />
                    </IconButton>
                </Box>

                {/* Alerta de conflito */}
                {aula.conflito && (
                    <Alert severity="error" sx={{ mb: 1.5, py: 0.5 }}>
                        <Typography variant="caption">
                            Conflito com <strong>"{aula.conflito.assunto}"</strong> neste lab/horário.
                            Troque o laboratório ou horário para resolver.
                        </Typography>
                    </Alert>
                )}

                {/* Assunto */}
                <TextField
                    label="Matéria / Assunto *"
                    fullWidth size="small" sx={{ mb: 2 }}
                    value={aula.assunto}
                    onChange={e => onChange(index, 'assunto', e.target.value)}
                    disabled={!aula.selecionada}
                    InputProps={{
                        startAdornment: <Science sx={{ fontSize: 18, mr: 0.5, color: 'text.secondary' }} />,
                    }}
                />

                <Grid container spacing={1.5}>
                    {/* Data */}
                    <Grid item xs={12} sm={5}>
                        <LocalizationProvider dateAdapter={AdapterDayjs} adapterLocale="pt-br">
                            <DatePicker
                                label="Data *"
                                value={aula.dataAgendamento}
                                onChange={val => onChange(index, 'dataAgendamento', val)}
                                disabled={!aula.selecionada}
                                slotProps={{
                                    textField: {
                                        size: 'small', fullWidth: true,
                                        InputProps: {
                                            startAdornment: <CalendarToday sx={{ fontSize: 16, mr: 0.5, color: 'text.secondary' }} />,
                                        },
                                    }
                                }}
                            />
                        </LocalizationProvider>
                    </Grid>

                    {/* Horários */}
                    <Grid item xs={12} sm={7}>
                        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 0.5 }}>
                            <Schedule sx={{ fontSize: 13, mr: 0.3, verticalAlign: 'middle' }} />
                            Horário(s) *
                        </Typography>
                        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                            {BLOCOS_HORARIO.map(b => {
                                const sel = aula.horarios.includes(b.value);
                                return (
                                    <Chip key={b.value}
                                        label={b.label} size="small" clickable
                                        disabled={!aula.selecionada}
                                        color={sel ? 'primary' : 'default'}
                                        variant={sel ? 'filled' : 'outlined'}
                                        onClick={() => {
                                            const novos = sel
                                                ? aula.horarios.filter(h => h !== b.value)
                                                : [...aula.horarios, b.value];
                                            onChange(index, 'horarios', novos);
                                        }}
                                        sx={{ fontWeight: sel ? 600 : 400, fontSize: '0.7rem' }}
                                    />
                                );
                            })}
                        </Box>
                    </Grid>
                </Grid>

                {/* Laboratório */}
                <FormControl sx={{ minWidth: 160 }} size="small" sx={{ mt: 2 }} disabled={!aula.selecionada}>
                    <InputLabel shrink>Laboratório *</InputLabel>
                    <Select
                        value={aula.laboratorio || ''}
                        label="Laboratório *"
                        onChange={e => {
                            onChange(index, 'laboratorio', e.target.value);
                            const lab = LISTA_LABORATORIOS.find(l => l.id === e.target.value);
                            if (lab) onChange(index, 'tipoLab', lab.tipo || '');
                        }}
                    >
                        <MenuItem value=""><em>Selecione…</em></MenuItem>
                        {TIPOS_LABORATORIO.map(tipo => [
                            <MenuItem key={`h_${tipo.id}`} disabled sx={{
                                opacity: 0.6, fontSize: '0.75rem', pt: 1.5, pb: 0.25, fontWeight: 600
                            }}>
                                ── {tipo.name} ──
                            </MenuItem>,
                            ...LISTA_LABORATORIOS
                                .filter(l => l.tipo === tipo.id)
                                .map(l => (
                                    <MenuItem key={l.id} value={l.id} sx={{ pl: 3 }}>
                                        {l.name}
                                    </MenuItem>
                                ))
                        ])}
                    </Select>
                </FormControl>

                {/* Detalhes da IA (colapsável) */}
                {(aula.iaRazao || aula.fonteTexto) && (
                    <Box sx={{ mt: 1.5 }}>
                        <Button
                            size="small"
                            startIcon={mostrarDetalhes ? <ExpandLess sx={{ fontSize: 14 }} /> : <ExpandMore sx={{ fontSize: 14 }} />}
                            onClick={() => setMostrarDetalhes(v => !v)}
                            sx={{ p: 0, fontSize: '0.7rem', color: 'text.secondary', minWidth: 0 }}
                        >
                            {mostrarDetalhes ? 'Ocultar' : 'Ver'} análise da IA
                        </Button>
                        <Collapse in={mostrarDetalhes}>
                            <Box sx={{
                                mt: 1, p: 1.5, borderRadius: 2,
                                background: alpha(theme.palette.primary.main, 0.04),
                                borderLeft: `3px solid ${alpha(theme.palette.primary.main, 0.3)}`,
                            }}>
                                {aula.iaRazao && (
                                    <Box sx={{ display: 'flex', gap: 0.75, alignItems: 'flex-start', mb: 0.5 }}>
                                        <Psychology sx={{ fontSize: 15, color: 'primary.main', mt: 0.1 }} />
                                        <Typography variant="caption" color="text.secondary">
                                            <strong>Raciocínio:</strong> {aula.iaRazao}
                                        </Typography>
                                    </Box>
                                )}
                                {aula.fonteTexto && (
                                    <Typography variant="caption" sx={{
                                        display: 'block', fontFamily: 'monospace',
                                        color: 'text.disabled', fontSize: '0.65rem',
                                        borderTop: `1px solid ${theme.palette.divider}`, pt: 0.5, mt: 0.5,
                                    }}>
                                        Fonte: "{aula.fonteTexto}"
                                    </Typography>
                                )}
                            </Box>
                        </Collapse>
                    </Box>
                )}
            </CardContent>
        </Card>
    );
}

// ─── Componente principal ──────────────────────────────────────────────────────
function ImportarAgendamento({ userInfo, currentUser }) {
    const theme = useTheme();
    const [step, setStep] = useState(0);
    const [file, setFile] = useState(null);
    const [loadingParse, setLoadingParse] = useState(false);
    const [statusMsg, setStatusMsg] = useState('');
    const [parseError, setParseError] = useState('');
    const [aulas, setAulas] = useState([]);
    const [loadingSubmit, setLoadingSubmit] = useState(false);
    const [submitProgress, setSubmitProgress] = useState(0);
    const [submitResults, setSubmitResults] = useState([]);
    const [snackbar, setSnackbar] = useState({ open: false, msg: '', severity: 'success' });

    const isCoordenador = userInfo?.role === 'coordenador';
    const steps = ['Selecionar Arquivo', 'Revisar Aulas', 'Resultado'];

    const handleFileSelected = useCallback(async f => {
        setFile(f);
        setParseError('');
        setLoadingParse(true);
        setStatusMsg('Lendo arquivo...');

        try {
            // 1. Extrai texto bruto (client-side)
            setStatusMsg('Extraindo conteúdo do arquivo...');
            const textoExtraido = await extrairTexto(f);

            if (!textoExtraido || textoExtraido.trim().length < 20) {
                throw new Error('Arquivo sem conteúdo textual legível.');
            }

            // 2. Envia para Claude interpretar
            setStatusMsg('Enviando para IA...');
            const aulasIA = await interpretarComIA(textoExtraido, f.name, setStatusMsg);

            if (aulasIA.length === 0) {
                setParseError(
                    'A IA não identificou aulas práticas no arquivo. ' +
                    'Verifique se o documento contém cronograma com aulas de laboratório, ' +
                    'ou adicione manualmente abaixo.'
                );
                setAulas([]);
            } else {
                // 3. Verifica conflitos — 1 query Firestore para todo o lote
                setStatusMsg('Verificando conflitos no sistema...');
                const aulasComConflito = await verificarConflitos(aulasIA);
                setAulas(aulasComConflito);

                const comConflito = aulasComConflito.filter(a => a.conflito).length;
                const semLab = aulasComConflito.filter(a => !a.laboratorio).length;
                if (comConflito > 0 || semLab > 0) {
                    setSnackbar({
                        open: true,
                        msg: `${aulasComConflito.length} aulas identificadas. ${comConflito > 0 ? `⚠️ ${comConflito} com conflito. ` : ''}${semLab > 0 ? `📝 ${semLab} sem laboratório definido.` : ''}`,
                        severity: 'warning',
                    });
                }
            }
            setStep(1);
        } catch (err) {
            console.error('Erro ao processar:', err);
            setParseError('Erro: ' + (err.message || String(err)));
            setAulas([]);
            setStep(1);
        } finally {
            setLoadingParse(false);
            setStatusMsg('');
        }
    }, []);

    const handleChange = (idx, field, value) =>
        setAulas(prev => { const n = [...prev]; n[idx] = { ...n[idx], [field]: value }; return n; });
    const handleToggle = (idx, v) => handleChange(idx, 'selecionada', v);
    const handleRemove = idx => setAulas(prev => prev.filter((_, i) => i !== idx));
    const handleAddManual = () => setAulas(prev => [...prev, makeAula({
        assunto: '', data: null, horarios: [], iaConfianca: 'media', iaRazao: 'Adicionada manualmente',
    })]);

    const aulasSelecionadas = aulas.filter(a => a.selecionada);
    const totalSel = aulasSelecionadas.length;
    const semLab = aulasSelecionadas.filter(a => !a.laboratorio).length;
    const semHor = aulasSelecionadas.filter(a => a.horarios.length === 0).length;
    const semData = aulasSelecionadas.filter(a => !a.dataAgendamento || !dayjs(a.dataAgendamento).isValid()).length;
    const comConflito = aulasSelecionadas.filter(a => a.conflito).length;
    const prontas = totalSel - semLab - semHor - semData - comConflito;

    function validateAulas() {
        for (let i = 0; i < aulasSelecionadas.length; i++) {
            const a = aulasSelecionadas[i];
            if (!a.assunto.trim()) return `Aula ${i + 1}: preencha o assunto.`;
            if (!a.dataAgendamento || !dayjs(a.dataAgendamento).isValid()) return `Aula ${i + 1}: data inválida.`;
            if (a.horarios.length === 0) return `Aula ${i + 1}: selecione ao menos um horário.`;
            if (!a.laboratorio) return `Aula ${i + 1}: selecione o laboratório.`;
            if (a.conflito) return `Aula ${i + 1} ("${a.assunto}"): há um conflito de horário. Resolva ou desmarque esta aula.`;
        }
        return null;
    }

    const handleSubmit = async () => {
        const err = validateAulas();
        if (err) { setSnackbar({ open: true, msg: err, severity: 'error' }); return; }

        setLoadingSubmit(true);
        setSubmitProgress(0);
        const results = [];

        for (let i = 0; i < aulasSelecionadas.length; i++) {
            const a = aulasSelecionadas[i];
            try {
                const dataTS = Timestamp.fromDate(dayjs(a.dataAgendamento).startOf('day').toDate());
                await addDoc(collection(db, 'aulas'), {
                    assunto: a.assunto.trim(),
                    observacoes: a.observacoes?.trim() || '',
                    tipoAtividade: 'aula',
                    dataInicio: dataTS,
                    dataFim: dataTS,
                    horarioSlotString: a.horarios,
                    laboratorioSelecionado: a.laboratorio,
                    tipoLaboratorio: a.tipoLab || LISTA_LABORATORIOS.find(l => l.id === a.laboratorio)?.tipo || '',
                    status: isCoordenador ? 'aprovada' : 'pendente',
                    propostaPorUid: currentUser?.uid || null,
                    propostaPorNome: userInfo?.name || currentUser?.email || 'Importação',
                    propostaPorEmail: currentUser?.email || '',
                    importadoDeArquivo: file?.name || 'importacao',
                    importadaVia: 'ImportarAgendamento-IA',
                    createdAt: serverTimestamp(),
                    assignedTechnicians: [],
                    assignedTechnicianUids: [],
                });
                results.push({ aula: a, status: 'sucesso', msg: isCoordenador ? 'Agendado' : 'Proposto (pendente)' });
            } catch (e) {
                results.push({ aula: a, status: 'erro', msg: e.message });
            }
            setSubmitProgress(Math.round(((i + 1) / aulasSelecionadas.length) * 100));
        }

        setSubmitResults(results);
        setLoadingSubmit(false);
        setStep(2);
    };

    // ── Render Step 0 ──
    const renderStep0 = () => (
        <Box>
            <Alert
                severity="info"
                icon={<SmartToy />}
                sx={{ mb: 3, borderRadius: 2 }}
            >
                <Typography variant="body2">
                    O arquivo é lido <strong>localmente no seu navegador</strong> e o conteúdo textual é enviado
                    para a IA interpretar — <strong>datas, horários, disciplinas e laboratórios</strong> são
                    identificados automaticamente. Você revisa tudo antes de confirmar.
                </Typography>
            </Alert>
            <DropZone onFileSelected={handleFileSelected} loading={loadingParse} statusMsg={statusMsg} />
            {parseError && (
                <Alert severity="warning" sx={{ mt: 2, borderRadius: 2 }}>
                    {parseError}
                    <Button size="small" onClick={() => { setAulas([]); setStep(1); }}
                        sx={{ mt: 1, display: 'block' }}>
                        Continuar e adicionar manualmente →
                    </Button>
                </Alert>
            )}
        </Box>
    );

    // ── Render Step 1 ──
    const renderStep1 = () => (
        <Box>
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1.5, flexWrap: 'wrap', gap: 1 }}>
                <Box>
                    <Typography variant="h6" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        Revisar Aulas Identificadas
                        <Badge badgeContent={totalSel} color="primary" />
                    </Typography>
                    {file && (
                        <Typography variant="caption" color="text.secondary"
                            sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                            <FilePresent fontSize="inherit" /> {file.name}
                        </Typography>
                    )}
                </Box>
                <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                    <Button size="small" onClick={() => setAulas(p => p.map(a => ({ ...a, selecionada: true })))}>Todas</Button>
                    <Button size="small" onClick={() => setAulas(p => p.map(a => ({ ...a, selecionada: false })))}>Nenhuma</Button>
                    <Button size="small" variant="outlined" startIcon={<PlaylistAdd />} onClick={handleAddManual}>
                        Adicionar
                    </Button>
                </Box>
            </Box>

            {/* Barra de progresso de completude */}
            {totalSel > 0 && (
                <Paper variant="outlined" sx={{ p: 1.5, mb: 2, borderRadius: 2 }}>
                    <Box sx={{ display: 'flex', gap: 1.5, flexWrap: 'wrap' }}>
                        <Chip size="small" color="success"
                            variant={prontas === totalSel ? 'filled' : 'outlined'}
                            icon={<CheckCircle sx={{ fontSize: 14 }} />}
                            label={`${prontas} pronta${prontas !== 1 ? 's' : ''}`} />
                        {semLab > 0 && <Chip size="small" color="warning"
                            icon={<Science sx={{ fontSize: 14 }} />} label={`${semLab} sem lab`} />}
                        {semHor > 0 && <Chip size="small" color="warning"
                            icon={<Schedule sx={{ fontSize: 14 }} />} label={`${semHor} sem horário`} />}
                        {semData > 0 && <Chip size="small" color="warning"
                            icon={<CalendarToday sx={{ fontSize: 14 }} />} label={`${semData} sem data`} />}
                        {comConflito > 0 && <Chip size="small" color="error"
                            icon={<Warning sx={{ fontSize: 14 }} />} label={`${comConflito} conflito${comConflito !== 1 ? 's' : ''}`} />}
                    </Box>
                    <LinearProgress
                        variant="determinate"
                        value={totalSel > 0 ? (prontas / totalSel) * 100 : 0}
                        color={prontas === totalSel ? 'success' : 'warning'}
                        sx={{ mt: 1, borderRadius: 1, height: 6 }}
                    />
                </Paper>
            )}

            {aulas.length === 0 && (
                <Alert severity="info" sx={{ mb: 2 }}>
                    Nenhuma aula encontrada. Use "Adicionar" para inserir manualmente.
                </Alert>
            )}

            {aulas.map((aula, idx) => (
                <AulaCard key={aula.id} aula={aula} index={idx}
                    onChange={handleChange} onToggle={handleToggle} onRemove={handleRemove} />
            ))}
        </Box>
    );

    // ── Render Step 2 ──
    const renderStep2 = () => {
        const counts = {
            sucesso: submitResults.filter(r => r.status === 'sucesso').length,
            erro: submitResults.filter(r => r.status === 'erro').length,
        };
        return (
            <Box>
                <Typography variant="h6" gutterBottom>Resultado da Importação</Typography>
                {loadingSubmit ? (
                    <Box sx={{ textAlign: 'center', py: 5 }}>
                        <CircularProgress variant="determinate" value={submitProgress} size={64} />
                        <Typography variant="body2" sx={{ mt: 1.5 }}>Salvando… {submitProgress}%</Typography>
                    </Box>
                ) : (
                    <>
                        <Grid container spacing={2} sx={{ mb: 3 }}>
                            {[
                                { label: 'Agendados', count: counts.sucesso, color: 'success' },
                                { label: 'Erros', count: counts.erro, color: 'error' },
                            ].map(({ label, count, color }) => (
                                <Grid item xs={6} key={label}>
                                    <Paper variant="outlined" sx={{ p: 2.5, textAlign: 'center', borderColor: `${color}.main`, borderRadius: 2 }}>
                                        <Typography variant="h3" color={`${color}.main`} fontWeight={800}>{count}</Typography>
                                        <Typography variant="body2" color="text.secondary">{label}</Typography>
                                    </Paper>
                                </Grid>
                            ))}
                        </Grid>
                        {submitResults.map((r, i) => {
                            const sc = r.status === 'sucesso' ? 'success' : 'error';
                            const Ic = r.status === 'sucesso' ? CheckCircle : Cancel;
                            return (
                                <Box key={i} sx={{
                                    display: 'flex', alignItems: 'center', gap: 2, p: 1.5, mb: 1,
                                    borderRadius: 2, border: '1px solid',
                                    borderColor: `${sc}.200`,
                                    bgcolor: theme.palette.mode === 'dark' ? alpha(theme.palette[sc].main, 0.08) : `${sc}.50`,
                                }}>
                                    <Ic color={sc} />
                                    <Box sx={{ flexGrow: 1 }}>
                                        <Typography variant="body2" fontWeight="medium">{r.aula.assunto}</Typography>
                                        <Typography variant="caption" color="text.secondary">
                                            {r.aula.dataAgendamento ? dayjs(r.aula.dataAgendamento).format('DD/MM/YYYY') : '—'}
                                            {' · '}
                                            {labIdParaNome(r.aula.laboratorio)}
                                        </Typography>
                                    </Box>
                                    <Chip label={r.msg} size="small" color={sc} variant="outlined" />
                                </Box>
                            );
                        })}
                    </>
                )}
            </Box>
        );
    };

    if (!isCoordenador) {
        return (
            <Container maxWidth="sm" sx={{ mt: 8, textAlign: 'center' }}>
                <Paper elevation={3} sx={{ p: 4 }}>
                    <Cancel sx={{ fontSize: 48, color: 'error.main' }} />
                    <Typography variant="h6" mt={2}>Acesso Negado</Typography>
                    <Typography variant="body2" color="text.secondary">
                        Apenas coordenadores podem importar agendamentos.
                    </Typography>
                </Paper>
            </Container>
        );
    }

    return (
        <Container maxWidth="lg">
            {/* Header */}
            <Box sx={{ mb: 3 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 0.5 }}>
                    <Box sx={{
                        width: 42, height: 42, borderRadius: 2,
                        background: `linear-gradient(135deg, ${theme.palette.primary.main}, ${theme.palette.secondary.main})`,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}>
                        <SmartToy sx={{ color: 'white', fontSize: 24 }} />
                    </Box>
                    <Box>
                        <Typography variant="h4" fontWeight="bold" lineHeight={1.2}>Importar Agendamentos</Typography>
                        <Typography variant="body2" color="text.secondary">
                            Powered by IA · Extração automática de aulas práticas
                        </Typography>
                    </Box>
                </Box>
            </Box>

            <Stepper activeStep={step} sx={{ mb: 4 }} alternativeLabel>
                {steps.map(label => <Step key={label}><StepLabel>{label}</StepLabel></Step>)}
            </Stepper>

            <Paper elevation={2} sx={{ p: { xs: 2, md: 3 }, borderRadius: 3, mb: 3 }}>
                {step === 0 && renderStep0()}
                {step === 1 && renderStep1()}
                {step === 2 && renderStep2()}
            </Paper>

            <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                <Button startIcon={<ArrowBack />}
                    onClick={() => setStep(s => s - 1)}
                    disabled={step === 0 || loadingSubmit || step === 2}>
                    Voltar
                </Button>
                {step === 1 && (
                    <Button variant="contained"
                        endIcon={loadingSubmit
                            ? <CircularProgress size={18} color="inherit" />
                            : <ArrowForward />}
                        onClick={handleSubmit}
                        disabled={totalSel === 0 || loadingSubmit}>
                        {loadingSubmit ? 'Salvando…' : `Agendar ${totalSel} aula(s)`}
                    </Button>
                )}
                {step === 2 && !loadingSubmit && (
                    <Button variant="contained" startIcon={<Done />}
                        onClick={() => { setStep(0); setFile(null); setAulas([]); setSubmitResults([]); }}>
                        Nova importação
                    </Button>
                )}
            </Box>

            <Snackbar open={snackbar.open} autoHideDuration={6000}
                onClose={() => setSnackbar(s => ({ ...s, open: false }))}>
                <Alert severity={snackbar.severity}
                    onClose={() => setSnackbar(s => ({ ...s, open: false }))}>
                    {snackbar.msg}
                </Alert>
            </Snackbar>

            <style>{`
                @keyframes pulse {
                    0%, 100% { transform: scale(1); opacity: 1; }
                    50% { transform: scale(1.05); opacity: 0.85; }
                }
            `}</style>
        </Container>
    );
}

ImportarAgendamento.propTypes = {
    userInfo: PropTypes.object,
    currentUser: PropTypes.object,
};

export default ImportarAgendamento;
