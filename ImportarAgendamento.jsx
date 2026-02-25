import React, { useState, useCallback, useRef } from 'react';
import {
    Container, Typography, Box, Paper, Button, Stepper, Step, StepLabel,
    CircularProgress, Alert, Chip, Grid, Card, CardContent,
    TextField, MenuItem, FormControl, InputLabel, Select, Checkbox,
    IconButton, Badge, LinearProgress, OutlinedInput, Snackbar,
} from '@mui/material';
import {
    CloudUpload, CheckCircle, Cancel, FilePresent,
    ArrowForward, ArrowBack, PlaylistAdd, Done, Warning,
    Delete as DeleteIcon, Science,
} from '@mui/icons-material';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import { AdapterDayjs } from '@mui/x-date-pickers/AdapterDayjs';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import dayjs from 'dayjs';
import 'dayjs/locale/pt-br';
import * as XLSX from 'xlsx';
import { db } from './firebaseConfig';
import { collection, addDoc, serverTimestamp, query, where, getDocs, Timestamp } from 'firebase/firestore';
import { LISTA_LABORATORIOS, TIPOS_LABORATORIO } from './constants/laboratorios';
import { LISTA_CURSOS } from './constants/cursos';
import PropTypes from 'prop-types';

dayjs.locale('pt-br');

const BLOCOS_HORARIO = [
    { value: '07:00-09:10', label: '07:00 - 09:10', turno: 'Matutino',   startMin: 7*60      },
    { value: '09:30-12:00', label: '09:30 - 12:00', turno: 'Matutino',   startMin: 9*60+30   },
    { value: '13:00-15:10', label: '13:00 - 15:10', turno: 'Vespertino', startMin: 13*60     },
    { value: '15:30-18:00', label: '15:30 - 18:00', turno: 'Vespertino', startMin: 15*60+30  },
    { value: '18:30-20:10', label: '18:30 - 20:10', turno: 'Noturno',    startMin: 18*60+30  },
    { value: '20:30-22:00', label: '20:30 - 22:00', turno: 'Noturno',    startMin: 20*60+30  },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function horarioParaBloco(str) {
    if (!str) return [];
    const blocos = new Set();
    // Formato "HH:MM - HH:MM" ou "HH:MM" (Excel)
    const re1 = /(\d{1,2}):(\d{2})/g;
    // Formato "Início: 07h30" (DOCX)
    const re2 = /[Ii]n[íi]cio[:\s]+(\d{1,2})[h:](\d{0,2})/g;

    const pushBloco = (h, m) => {
        const total = parseInt(h)*60 + parseInt(m||0);
        let best = null, bestDiff = 9999;
        BLOCOS_HORARIO.forEach(b => {
            const diff = Math.abs(total - b.startMin);
            if (diff < bestDiff) { bestDiff = diff; best = b.value; }
        });
        if (best && bestDiff <= 90) blocos.add(best);
    };

    let m;
    while ((m = re2.exec(str)) !== null) pushBloco(m[1], m[2]);
    if (blocos.size === 0) {
        while ((m = re1.exec(str)) !== null) pushBloco(m[1], m[2]);
    }
    return [...blocos];
}

function parseData(str, anoDefault) {
    if (!str) return null;
    const clean = String(str).split(/\s/)[0].trim();
    const m = clean.match(/(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?/);
    if (!m) return null;
    const d = m[1].padStart(2,'0'), mo = m[2].padStart(2,'0');
    const y = m[3] ? (m[3].length===2 ? '20'+m[3] : m[3]) : (anoDefault || dayjs().year());
    const dt = dayjs(`${y}-${mo}-${d}`);
    return dt.isValid() ? dt : null;
}

function labNomeParaId(nome) {
    if (!nome) return '';
    const n = nome.toLowerCase().trim();
    const exact = LISTA_LABORATORIOS.find(l => l.name.toLowerCase() === n);
    if (exact) return exact.id;
    const partial = LISTA_LABORATORIOS.find(l =>
        l.name.toLowerCase().includes(n) || n.includes(l.name.toLowerCase())
    );
    return partial?.id || '';
}

function cursoNomeParaValue(nome) {
    if (!nome) return null;
    const n = nome.toLowerCase().trim();
    const found = LISTA_CURSOS.find(c =>
        c.label.toLowerCase() === n ||
        c.label.toLowerCase().includes(n) ||
        n.includes(c.label.toLowerCase())
    );
    return found?.value || null;
}

function makeAula({ assuntoOriginal, assunto, data, horarios, laboratorioId, cursos, observacoes }) {
    return {
        id: `aula_${Date.now()}_${Math.random().toString(36).slice(2,6)}`,
        assuntoOriginal: assuntoOriginal || assunto || '',
        assunto: (assunto || '').substring(0, 200),
        selecionada: true,
        dataAgendamento: data || null,
        horarios: horarios || [],
        laboratorio: laboratorioId || '',
        tipoLab: laboratorioId ? (LISTA_LABORATORIOS.find(l=>l.id===laboratorioId)?.tipo||'') : '',
        cursos: cursos || [],
        observacoes: observacoes || '',
    };
}

// ─── DOCX Parser ──────────────────────────────────────────────────────────────
// Formato: tabela com colunas DATA|HORÁRIO|TEMA|PRESENCIAL PRÁTICA
// Extrai apenas linhas onde coluna "PRESENCIAL PRÁTICA" tem conteúdo real
async function parseDOCX(file) {
    if (!window.JSZip) {
        await new Promise((res, rej) => {
            const s = document.createElement('script');
            s.src = 'https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js';
            s.onload = res; s.onerror = rej;
            document.head.appendChild(s);
        });
    }
    const zip = await window.JSZip.loadAsync(await file.arrayBuffer());
    const xmlStr = await zip.file('word/document.xml').async('string');
    const xml = new DOMParser().parseFromString(xmlStr, 'application/xml');

    function cellText(tc) {
        const paras = tc.getElementsByTagName('w:p');
        const lines = [];
        for (const p of paras) {
            const ts = p.getElementsByTagName('w:t');
            let line = '';
            for (const t of ts) line += t.textContent;
            if (line.trim()) lines.push(line.trim());
        }
        return lines.join(' ');
    }

    const tables = xml.getElementsByTagName('w:tbl');
    const aulas = [];

    // Extrai metadados da tabela de cabeçalho (Tabela 0)
    let cursoDoc = '', semestreDoc = '';
    if (tables.length > 0) {
        const rows0 = tables[0].getElementsByTagName('w:tr');
        for (const row of rows0) {
            const cells = row.getElementsByTagName('w:tc');
            if (cells.length < 2) continue;
            const label = cellText(cells[0]).toLowerCase();
            const valor = cellText(cells[1]);
            if (label.includes('curso')) cursoDoc = valor;
            if (label.includes('semestre')) semestreDoc = valor;
        }
    }
    const anoMatch = semestreDoc.match(/(\d{4})/);
    const anoDoc = anoMatch ? parseInt(anoMatch[1]) : dayjs().year();
    const cursoValue = cursoNomeParaValue(cursoDoc);

    // Processa tabelas procurando a de cronograma
    for (const tbl of tables) {
        const rows = tbl.getElementsByTagName('w:tr');
        if (rows.length < 3) continue;

        // Detecta colunas varrendo as 3 primeiras linhas
        let colData=-1, colHor=-1, colTema=-1, colPratica=-1;
        for (let ri = 0; ri < Math.min(3, rows.length); ri++) {
            const cells = rows[ri].getElementsByTagName('w:tc');
            for (let ci = 0; ci < cells.length; ci++) {
                const txt = cellText(cells[ci]).toLowerCase();
                if (txt.includes('data') && colData===-1)          colData    = ci;
                if ((txt.includes('horár')||txt.includes('horar')) && colHor===-1) colHor = ci;
                if (txt.includes('tema') && colTema===-1)          colTema    = ci;
                if ((txt.includes('prática')||txt.includes('pratica')) && colPratica===-1) colPratica = ci;
            }
        }
        if (colTema === -1) continue;

        // Processa linhas de dados
        for (let ri = 2; ri < rows.length; ri++) {
            const cells = rows[ri].getElementsByTagName('w:tc');
            if (cells.length < 3) continue;

            const tema = colTema < cells.length ? cellText(cells[colTema]) : '';
            if (!tema.trim()) continue;

            // Pula separadores de etapa e legenda
            const tl = tema.toLowerCase();
            if ((tl.includes('etapa') && tl.includes('hora')) || tl.includes('legenda') || tl === 'tema') continue;

            // Verifica coluna PRESENCIAL PRÁTICA
            const praticaVal = colPratica >= 0 && colPratica < cells.length
                ? cellText(cells[colPratica]).trim() : '';

            // É prática se a célula tem conteúdo que não é o próprio cabeçalho
            const isPratica = praticaVal !== '' &&
                !['presencial', 'prática', 'pratica', 'prát', 'presencial prática'].includes(praticaVal.toLowerCase());

            // Aceita também por keyword no tema
            const isPorKeyword = tl.includes('laboratório') || tl.includes('laboratorio');

            if (!isPratica && !isPorKeyword) continue;

            const dataStr = colData >= 0 && colData < cells.length ? cellText(cells[colData]) : '';
            const horStr  = colHor  >= 0 && colHor  < cells.length ? cellText(cells[colHor])  : '';

            aulas.push(makeAula({
                assuntoOriginal: tema,
                assunto: tema.replace(/\n/g,' ').trim(),
                data: parseData(dataStr, anoDoc),
                horarios: horarioParaBloco(horStr),
                laboratorioId: '',
                cursos: cursoValue ? [cursoValue] : [],
                observacoes: [cursoDoc, semestreDoc].filter(Boolean).join(' | '),
            }));
        }
        if (aulas.length > 0) break;
    }
    return aulas;
}

// ─── Excel Parser ─────────────────────────────────────────────────────────────
// Formato: seções por laboratório (linha com só col A = nome do lab)
// Colunas: Data | Dia | Horário | Curso(s) | Assunto/Atividade | Professor | Técnico(s)
async function parseExcelCronograma(file) {
    const wb = XLSX.read(await file.arrayBuffer(), { type: 'array', raw: false });
    const aulas = [];

    wb.SheetNames.forEach(sheetName => {
        const rows = XLSX.utils.sheet_to_json(wb.Sheets[sheetName], { header:1, defval:'', raw:false });

        // Detecta índices das colunas no cabeçalho
        let colData=0, colHor=2, colCurso=3, colAssunto=4;
        for (let ri = 0; ri < Math.min(5, rows.length); ri++) {
            const row = rows[ri].map(c => String(c).toLowerCase().trim());
            if (row.some(c => c.includes('data') || c.includes('horár'))) {
                row.forEach((c, ci) => {
                    if (c.includes('data')   && colData===0)    colData   = ci;
                    if ((c.includes('horár')||c.includes('horar')) && colHor===2) colHor = ci;
                    if (c.includes('curso')  && colCurso===3)   colCurso  = ci;
                    if ((c.includes('assunto')||c.includes('atividade')) && colAssunto===4) colAssunto = ci;
                });
                break;
            }
        }

        let labAtual = '', labAtualId = '';

        rows.forEach(row => {
            const v = row.map(x => String(x===null||x===undefined?'':x).trim());

            // Linha de seção: só col 0 tem valor, demais vazias, e não é cabeçalho
            if (v[0] && !v[1] && !v[2] && !v[3] && v[0] !== 'Data') {
                labAtual   = v[0];
                labAtualId = labNomeParaId(labAtual);
                return;
            }

            if (!labAtual) return;
            if (!v[colData] || v[colData] === 'Data') return;

            const data    = parseData(v[colData], dayjs().year());
            if (!data) return;

            const horarios  = horarioParaBloco(v[colHor]);
            const assunto   = v[colAssunto] || '';
            const cursoStr  = v[colCurso]   || '';
            if (!assunto) return;

            const cursoValue = cursoNomeParaValue(cursoStr);

            aulas.push(makeAula({
                assuntoOriginal: assunto,
                assunto,
                data,
                horarios,
                laboratorioId: labAtualId,
                cursos: cursoValue ? [cursoValue] : [],
                observacoes: [labAtual, cursoStr].filter(Boolean).join(' | '),
            }));
        });
    });
    return aulas;
}

// ─── PDF Parser (fallback) ────────────────────────────────────────────────────
async function parsePDF(file) {
    if (!window.pdfjsLib) {
        await new Promise((res, rej) => {
            const s = document.createElement('script');
            s.src = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js';
            s.onload = res; s.onerror = rej;
            document.head.appendChild(s);
        });
        window.pdfjsLib.GlobalWorkerOptions.workerSrc =
            'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
    }
    const pdf = await window.pdfjsLib.getDocument({ data: await file.arrayBuffer() }).promise;
    let txt = '';
    for (let i = 1; i <= pdf.numPages; i++) {
        const page = await pdf.getPage(i);
        const content = await page.getTextContent();
        txt += content.items.map(x => x.str).join(' ') + '\n';
    }
    const kw = ['laboratório','laboratorio','prática','pratica'];
    return txt.split('\n')
        .filter(line => kw.some(k => line.toLowerCase().includes(k)) && line.length > 5)
        .map(line => makeAula({
            assuntoOriginal: line.trim(),
            assunto: line.trim().substring(0,200),
            data: parseData(line),
            horarios: horarioParaBloco(line),
        }));
}

// ─── Dispatcher ───────────────────────────────────────────────────────────────
async function processarArquivo(file) {
    const nome = file.name.toLowerCase();
    if (nome.endsWith('.docx') || nome.endsWith('.doc'))           return await parseDOCX(file);
    if (nome.endsWith('.xlsx')||nome.endsWith('.xls')||nome.endsWith('.csv')) return await parseExcelCronograma(file);
    if (nome.endsWith('.pdf'))                                      return await parsePDF(file);
    throw new Error(`Formato não suportado: ${file.name}`);
}

// ─── DropZone ─────────────────────────────────────────────────────────────────
function DropZone({ onFileSelected, loading }) {
    const inputRef = useRef(null);
    const [dragging, setDragging] = useState(false);
    const handleDrop = useCallback(e => {
        e.preventDefault(); setDragging(false);
        const f = e.dataTransfer.files[0];
        if (f) onFileSelected(f);
    }, [onFileSelected]);

    return (
        <Box
            onDragOver={e => { e.preventDefault(); setDragging(true); }}
            onDragLeave={() => setDragging(false)}
            onDrop={handleDrop}
            onClick={() => !loading && inputRef.current?.click()}
            sx={{
                border: t => `2px dashed ${dragging ? t.palette.primary.main : t.palette.divider}`,
                borderRadius: 3, p: { xs:4, md:6 }, textAlign: 'center',
                cursor: loading ? 'not-allowed' : 'pointer',
                bgcolor: t => dragging ? t.palette.action.hover : 'transparent',
                transition: 'all 0.2s',
                '&:hover': { bgcolor: t => !loading && t.palette.action.hover },
            }}
        >
            <input ref={inputRef} type="file" hidden
                accept=".pdf,.doc,.docx,.xls,.xlsx,.csv"
                onChange={e => e.target.files[0] && onFileSelected(e.target.files[0])} />
            {loading ? (
                <Box>
                    <CircularProgress size={48} />
                    <Typography variant="body1" sx={{ mt: 2 }}>
                        Analisando arquivo e extraindo aulas práticas…
                    </Typography>
                </Box>
            ) : (
                <Box>
                    <CloudUpload sx={{ fontSize: 56, color: 'text.secondary', mb: 2 }} />
                    <Typography variant="h6" gutterBottom>Arraste ou clique para selecionar</Typography>
                    <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                        Suporta cronograma <strong>DOCX</strong> (coluna "Presencial Prática") e
                        planilha <strong>Excel</strong> com seções por laboratório
                    </Typography>
                    <Box sx={{ display: 'flex', gap: 1, justifyContent: 'center', flexWrap: 'wrap' }}>
                        {['.DOCX','.XLSX','.XLS','.PDF','.CSV'].map(ext => (
                            <Chip key={ext} label={ext} size="small" variant="outlined" />
                        ))}
                    </Box>
                </Box>
            )}
        </Box>
    );
}

// ─── AulaCard ─────────────────────────────────────────────────────────────────
function AulaCard({ aula, index, onChange, onToggle, onRemove }) {
    const labsFiltrados = aula.tipoLab
        ? LISTA_LABORATORIOS.filter(l => l.tipo === aula.tipoLab)
        : LISTA_LABORATORIOS;

    return (
        <Card variant="outlined" sx={{
            mb: 2,
            opacity: aula.selecionada ? 1 : 0.45,
            borderColor: t => aula.selecionada ? t.palette.primary.main : t.palette.divider,
            transition: 'all 0.2s',
        }}>
            <CardContent>
                <Box sx={{ display:'flex', alignItems:'flex-start', gap:1, mb:2 }}>
                    <Checkbox checked={aula.selecionada}
                        onChange={e => onToggle(index, e.target.checked)}
                        color="primary" sx={{ pt:0 }} />
                    <Box sx={{ flexGrow:1 }}>
                        <Box sx={{ display:'flex', alignItems:'center', gap:1, mb:0.5, flexWrap:'wrap' }}>
                            <Science fontSize="small" color="primary" />
                            <Typography variant="caption" color="primary.main" fontWeight="bold">
                                AULA PRÁTICA DETECTADA
                            </Typography>
                            {aula.laboratorio && (
                                <Chip size="small" color="success" variant="outlined"
                                    label={LISTA_LABORATORIOS.find(l=>l.id===aula.laboratorio)?.name || aula.laboratorio} />
                            )}
                        </Box>
                        <Typography variant="body2" sx={{ fontStyle:'italic', color:'text.secondary' }}>
                            "{aula.assuntoOriginal.substring(0,120)}{aula.assuntoOriginal.length>120?'…':''}"
                        </Typography>
                    </Box>
                    <IconButton size="small" onClick={() => onRemove(index)} color="error">
                        <DeleteIcon fontSize="small" />
                    </IconButton>
                </Box>

                <Grid container spacing={2}>
                    <Grid item xs={12}>
                        <TextField label="Assunto *" fullWidth size="small"
                            value={aula.assunto}
                            onChange={e => onChange(index,'assunto',e.target.value)}
                            disabled={!aula.selecionada} />
                    </Grid>
                    <Grid item xs={12} sm={6}>
                        <LocalizationProvider dateAdapter={AdapterDayjs} adapterLocale="pt-br">
                            <DatePicker label="Data *" value={aula.dataAgendamento}
                                onChange={val => onChange(index,'dataAgendamento',val)}
                                disabled={!aula.selecionada}
                                slotProps={{ textField:{ size:'small', fullWidth:true } }} />
                        </LocalizationProvider>
                    </Grid>
                    <Grid item xs={12} sm={6}>
                        <FormControl fullWidth size="small" disabled={!aula.selecionada}>
                            <InputLabel>Horário *</InputLabel>
                            <Select multiple value={aula.horarios}
                                onChange={e => onChange(index,'horarios',e.target.value)}
                                input={<OutlinedInput label="Horário *" />}
                                renderValue={sel => (
                                    <Box sx={{ display:'flex', flexWrap:'wrap', gap:0.5 }}>
                                        {sel.map(v => <Chip key={v} label={v} size="small" />)}
                                    </Box>
                                )}>
                                {BLOCOS_HORARIO.map(b => (
                                    <MenuItem key={b.value} value={b.value}>{b.label} ({b.turno})</MenuItem>
                                ))}
                            </Select>
                        </FormControl>
                    </Grid>
                    <Grid item xs={12} sm={6}>
                        <FormControl fullWidth size="small" disabled={!aula.selecionada}>
                            <InputLabel>Tipo de Laboratório</InputLabel>
                            <Select value={aula.tipoLab} label="Tipo de Laboratório"
                                onChange={e => { onChange(index,'tipoLab',e.target.value); onChange(index,'laboratorio',''); }}>
                                <MenuItem value="">Todos os tipos</MenuItem>
                                {TIPOS_LABORATORIO.map(t => <MenuItem key={t.id} value={t.id}>{t.name}</MenuItem>)}
                            </Select>
                        </FormControl>
                    </Grid>
                    <Grid item xs={12} sm={6}>
                        <FormControl fullWidth size="small" disabled={!aula.selecionada}>
                            <InputLabel>Laboratório *</InputLabel>
                            <Select value={aula.laboratorio} label="Laboratório *"
                                onChange={e => onChange(index,'laboratorio',e.target.value)}>
                                <MenuItem value=""><em>Selecione</em></MenuItem>
                                {labsFiltrados.map(l => <MenuItem key={l.id} value={l.id}>{l.name}</MenuItem>)}
                            </Select>
                        </FormControl>
                    </Grid>
                    <Grid item xs={12}>
                        <FormControl fullWidth size="small" disabled={!aula.selecionada}>
                            <InputLabel>Cursos</InputLabel>
                            <Select multiple value={aula.cursos}
                                onChange={e => onChange(index,'cursos',e.target.value)}
                                input={<OutlinedInput label="Cursos" />}
                                renderValue={sel => (
                                    <Box sx={{ display:'flex', flexWrap:'wrap', gap:0.5 }}>
                                        {sel.map(v => {
                                            const c = LISTA_CURSOS.find(x => x.value===v);
                                            return <Chip key={v} label={c?.label||v} size="small" />;
                                        })}
                                    </Box>
                                )}>
                                {LISTA_CURSOS.map(c => <MenuItem key={c.value} value={c.value}>{c.label}</MenuItem>)}
                            </Select>
                        </FormControl>
                    </Grid>
                    <Grid item xs={12}>
                        <TextField label="Observações" fullWidth size="small" multiline rows={2}
                            value={aula.observacoes}
                            onChange={e => onChange(index,'observacoes',e.target.value)}
                            disabled={!aula.selecionada} />
                    </Grid>
                </Grid>
            </CardContent>
        </Card>
    );
}

// ─── Main Component ────────────────────────────────────────────────────────────
function ImportarAgendamento({ userInfo, currentUser }) {
    const [step, setStep] = useState(0);
    const [file, setFile] = useState(null);
    const [loadingParse, setLoadingParse] = useState(false);
    const [parseError, setParseError] = useState('');
    const [aulas, setAulas] = useState([]);
    const [loadingSubmit, setLoadingSubmit] = useState(false);
    const [submitProgress, setSubmitProgress] = useState(0);
    const [submitResults, setSubmitResults] = useState([]);
    const [snackbar, setSnackbar] = useState({ open:false, msg:'', severity:'success' });

    const isCoordenador = userInfo?.role === 'coordenador';
    const steps = ['Selecionar Arquivo', 'Revisar Aulas Extraídas', 'Resultado'];

    const handleFileSelected = useCallback(async f => {
        setFile(f); setParseError(''); setLoadingParse(true);
        try {
            const extracted = await processarArquivo(f);
            if (extracted.length === 0) {
                setParseError(
                    'Nenhuma aula prática identificada automaticamente. ' +
                    'Verifique se o arquivo segue o formato esperado, ou adicione manualmente abaixo.'
                );
            }
            setAulas(extracted);
            setStep(1);
        } catch (err) {
            setParseError('Erro ao processar o arquivo: ' + (err.message || String(err)));
            setAulas([]);
            setStep(1);
        } finally {
            setLoadingParse(false);
        }
    }, []);

    const handleChange = (idx, field, value) =>
        setAulas(prev => { const n=[...prev]; n[idx]={...n[idx],[field]:value}; return n; });
    const handleToggle = (idx, checked) => handleChange(idx,'selecionada',checked);
    const handleRemove = idx => setAulas(prev => prev.filter((_,i)=>i!==idx));
    const handleAddManual = () => setAulas(prev => [...prev, makeAula({
        assuntoOriginal:'(adicionada manualmente)', assunto:'', data:null, horarios:[],
    })]);

    const aulasSelecionadas = aulas.filter(a => a.selecionada);

    function validateAulas() {
        for (let i = 0; i < aulasSelecionadas.length; i++) {
            const a = aulasSelecionadas[i];
            if (!a.assunto.trim())                              return `Aula ${i+1}: preencha o assunto.`;
            if (!a.dataAgendamento||!dayjs(a.dataAgendamento).isValid()) return `Aula ${i+1}: data inválida.`;
            if (a.horarios.length===0)                          return `Aula ${i+1}: selecione ao menos um horário.`;
            if (!a.laboratorio)                                 return `Aula ${i+1}: selecione o laboratório.`;
        }
        return null;
    }

    const handleSubmit = async () => {
        const err = validateAulas();
        if (err) { setSnackbar({ open:true, msg:err, severity:'error' }); return; }
        setLoadingSubmit(true); setSubmitProgress(0);
        const results = [];
        const labMap = Object.fromEntries(LISTA_LABORATORIOS.map(l=>[l.id,l.name]));

        for (let i = 0; i < aulasSelecionadas.length; i++) {
            const a = aulasSelecionadas[i];
            try {
                const dataTS = Timestamp.fromDate(dayjs(a.dataAgendamento).startOf('day').toDate());
                const q = query(collection(db,'aulas'),
                    where('dataInicio','==',dataTS),
                    where('laboratorioSelecionado','==',a.laboratorio),
                    where('status','in',['aprovada','pendente'])
                );
                const snap = await getDocs(q);
                const conflito = snap.docs.some(d =>
                    (d.data().horarioSlotString||[]).some(h => a.horarios.includes(h))
                );
                if (conflito) {
                    results.push({ aula:a, status:'conflito', msg:'Conflito de horário' });
                } else {
                    await addDoc(collection(db,'aulas'), {
                        assunto:           a.assunto.trim(),
                        observacoes:       a.observacoes.trim(),
                        tipoAtividade:     'Aula Prática',
                        cursos:            a.cursos,
                        liga:              '',
                        dataInicio:        dataTS,
                        horarioSlotString: a.horarios,
                        laboratorioSelecionado: a.laboratorio,
                        laboratorioNome:   labMap[a.laboratorio] || a.laboratorio,
                        status:            isCoordenador ? 'aprovada' : 'pendente',
                        propostoBy:        currentUser?.uid || null,
                        propostoByName:    userInfo?.name || currentUser?.email || 'Importação',
                        importadoDeArquivo: file?.name || 'importacao',
                        criadoEm:          serverTimestamp(),
                    });
                    results.push({ aula:a, status:'sucesso',
                        msg: isCoordenador ? 'Agendado' : 'Proposto (pendente aprovação)' });
                }
            } catch (e) {
                results.push({ aula:a, status:'erro', msg:e.message });
            }
            setSubmitProgress(Math.round(((i+1)/aulasSelecionadas.length)*100));
        }
        setSubmitResults(results);
        setLoadingSubmit(false);
        setStep(2);
    };

    // ── Renders ──────────────────────────────────────────────────────────────

    const renderStep0 = () => (
        <Box>
            <Alert severity="info" sx={{ mb:3 }}>
                <strong>Como funciona:</strong> O sistema reconhece dois formatos automaticamente:<br />
                • <strong>DOCX de cronograma</strong> — extrai linhas onde a coluna <em>"Presencial Prática"</em> indica laboratório (ex: "Laboratório")<br />
                • <strong>Planilha Excel</strong> — extrai todas as aulas organizadas por seções de laboratório<br />
                Você revisa tudo antes de salvar. Nenhum arquivo é enviado ao servidor.
            </Alert>
            <DropZone onFileSelected={handleFileSelected} loading={loadingParse} />
            {parseError && (
                <Alert severity="warning" sx={{ mt:2 }}>
                    {parseError}
                    <Button size="small" onClick={() => { setAulas([]); setStep(1); }} sx={{ mt:1, display:'block' }}>
                        Continuar e adicionar manualmente →
                    </Button>
                </Alert>
            )}
        </Box>
    );

    const renderStep1 = () => (
        <Box>
            <Box sx={{ display:'flex', alignItems:'center', justifyContent:'space-between', mb:2, flexWrap:'wrap', gap:1 }}>
                <Box>
                    <Typography variant="h6" sx={{ display:'flex', alignItems:'center', gap:1 }}>
                        Aulas Extraídas
                        <Badge badgeContent={aulasSelecionadas.length} color="primary" />
                    </Typography>
                    {file && (
                        <Typography variant="caption" color="text.secondary" sx={{ display:'flex', alignItems:'center', gap:0.5 }}>
                            <FilePresent fontSize="inherit" /> {file.name} — {aulas.length} item(s)
                        </Typography>
                    )}
                </Box>
                <Box sx={{ display:'flex', gap:1, flexWrap:'wrap' }}>
                    <Button size="small" onClick={() => setAulas(p=>p.map(a=>({...a,selecionada:true})))}>Todas</Button>
                    <Button size="small" onClick={() => setAulas(p=>p.map(a=>({...a,selecionada:false})))}>Nenhuma</Button>
                    <Button size="small" variant="outlined" startIcon={<PlaylistAdd />} onClick={handleAddManual}>
                        Adicionar
                    </Button>
                </Box>
            </Box>

            {aulas.length === 0 && (
                <Alert severity="info" sx={{ mb:2 }}>
                    Nenhuma aula encontrada. Use "Adicionar" para inserir manualmente.
                </Alert>
            )}

            {aulas.map((aula, idx) => (
                <AulaCard key={aula.id} aula={aula} index={idx}
                    onChange={handleChange} onToggle={handleToggle} onRemove={handleRemove} />
            ))}

            {aulas.length > 0 && (
                <Alert severity="warning" sx={{ mt:1 }}>
                    Campos com * são obrigatórios. Desmarque as aulas que não deseja agendar.
                    {!isCoordenador && ' Como técnico, suas propostas ficam pendentes de aprovação.'}
                </Alert>
            )}
        </Box>
    );

    const renderStep2 = () => {
        const counts = {
            sucesso: submitResults.filter(r=>r.status==='sucesso').length,
            conflito: submitResults.filter(r=>r.status==='conflito').length,
            erro: submitResults.filter(r=>r.status==='erro').length,
        };
        return (
            <Box>
                <Typography variant="h6" gutterBottom>Resultado dos Agendamentos</Typography>
                {loadingSubmit ? (
                    <Box sx={{ textAlign:'center', py:6 }}>
                        <CircularProgress variant="determinate" value={submitProgress} size={72} />
                        <Typography variant="body2" sx={{ mt:2 }}>Salvando… {submitProgress}%</Typography>
                        <LinearProgress variant="determinate" value={submitProgress} sx={{ mt:2 }} />
                    </Box>
                ) : (
                    <>
                        <Grid container spacing={2} sx={{ mb:3 }}>
                            {[
                                { label:'Agendados', count:counts.sucesso,  color:'success' },
                                { label:'Conflitos', count:counts.conflito, color:'warning' },
                                { label:'Erros',     count:counts.erro,     color:'error'   },
                            ].map(({ label, count, color }) => (
                                <Grid item xs={4} key={label}>
                                    <Paper variant="outlined" sx={{ p:2, textAlign:'center', borderColor:`${color}.main` }}>
                                        <Typography variant="h4" color={`${color}.main`}>{count}</Typography>
                                        <Typography variant="body2">{label}</Typography>
                                    </Paper>
                                </Grid>
                            ))}
                        </Grid>
                        {submitResults.map((r, i) => {
                            const sc = r.status==='sucesso'?'success':r.status==='conflito'?'warning':'error';
                            const Ic = r.status==='sucesso'?CheckCircle:r.status==='conflito'?Warning:Cancel;
                            return (
                                <Box key={i} sx={{
                                    display:'flex', alignItems:'center', gap:2, p:1.5, mb:1,
                                    borderRadius:2, border:'1px solid', borderColor:`${sc}.200`, bgcolor:`${sc}.50`,
                                }}>
                                    <Ic color={sc} />
                                    <Box sx={{ flexGrow:1 }}>
                                        <Typography variant="body2" fontWeight="medium">{r.aula.assunto}</Typography>
                                        <Typography variant="caption" color="text.secondary">
                                            {r.aula.dataAgendamento ? dayjs(r.aula.dataAgendamento).format('DD/MM/YYYY') : '—'}
                                            {' · '}
                                            {LISTA_LABORATORIOS.find(l=>l.id===r.aula.laboratorio)?.name || r.aula.laboratorio || 'sem laboratório'}
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

    return (
        <Container maxWidth="lg">
            <Box sx={{ mb:3 }}>
                <Typography variant="h4" fontWeight="bold" gutterBottom>Importar Agendamentos</Typography>
                <Typography variant="body1" color="text.secondary">
                    Faça upload do cronograma (DOCX ou Excel) — as aulas práticas são detectadas automaticamente.
                </Typography>
            </Box>

            <Stepper activeStep={step} sx={{ mb:4 }}>
                {steps.map(label => <Step key={label}><StepLabel>{label}</StepLabel></Step>)}
            </Stepper>

            <Paper elevation={2} sx={{ p:{ xs:2, md:3 }, borderRadius:3, mb:3 }}>
                {step===0 && renderStep0()}
                {step===1 && renderStep1()}
                {step===2 && renderStep2()}
            </Paper>

            <Box sx={{ display:'flex', justifyContent:'space-between' }}>
                <Button startIcon={<ArrowBack />}
                    onClick={() => setStep(s=>s-1)}
                    disabled={step===0 || loadingSubmit || step===2}>
                    Voltar
                </Button>

                {step===1 && (
                    <Button variant="contained"
                        endIcon={loadingSubmit ? <CircularProgress size={18} color="inherit" /> : <ArrowForward />}
                        onClick={handleSubmit}
                        disabled={aulasSelecionadas.length===0 || loadingSubmit}>
                        {loadingSubmit ? 'Salvando…' : `Agendar ${aulasSelecionadas.length} aula(s)`}
                    </Button>
                )}

                {step===2 && !loadingSubmit && (
                    <Button variant="contained" startIcon={<Done />}
                        onClick={() => { setStep(0); setFile(null); setAulas([]); setSubmitResults([]); }}>
                        Nova importação
                    </Button>
                )}
            </Box>

            <Snackbar open={snackbar.open} autoHideDuration={5000}
                onClose={() => setSnackbar(s=>({...s,open:false}))}>
                <Alert severity={snackbar.severity} onClose={() => setSnackbar(s=>({...s,open:false}))}>
                    {snackbar.msg}
                </Alert>
            </Snackbar>
        </Container>
    );
}

ImportarAgendamento.propTypes = {
    userInfo: PropTypes.object,
    currentUser: PropTypes.object,
};

export default ImportarAgendamento;
