// src/ImportarCronograma.jsx
// Importação Inteligente de Cronograma via PDF, DOCX ou Excel
// Processamento 100% client-side - sem custo adicional no Firebase Free Plan

import React, { useState, useCallback, useRef } from 'react';
import {
  Container, Typography, Box, Button, Paper, CircularProgress,
  Snackbar, Alert, Stepper, Step, StepLabel, StepContent,
  Card, CardContent, CardActions, Grid, TextField, MenuItem,
  Select, FormControl, InputLabel, Chip, Dialog, DialogTitle,
  DialogContent, DialogActions, IconButton, Tooltip, Divider,
  LinearProgress, Badge, Collapse, FormHelperText
} from '@mui/material';
import { useTheme, alpha } from '@mui/material/styles';
import {
  Upload, FileText, CheckCircle, AlertTriangle, X, Edit2,
  Trash2, ChevronDown, ChevronUp, Eye, Save, RefreshCw,
  Info, Calendar, Clock, FlaskConical, BookOpen, Loader2,
  FileSpreadsheet, File
} from 'lucide-react';
import * as XLSX from 'xlsx';
import dayjs from 'dayjs';
import 'dayjs/locale/pt-br';
import customParseFormat from 'dayjs/plugin/customParseFormat';
import isSameOrBefore from 'dayjs/plugin/isSameOrBefore';
import isBetween from 'dayjs/plugin/isBetween';
import { db } from './firebaseConfig';
import { collection, query, where, getDocs, addDoc, serverTimestamp, Timestamp } from 'firebase/firestore';
import { useAuth } from './AuthContext';
import { LISTA_LABORATORIOS } from './constants/laboratorios';

dayjs.extend(customParseFormat);
dayjs.extend(isSameOrBefore);
dayjs.extend(isBetween);
dayjs.locale('pt-br');

// ─── CONSTANTES ────────────────────────────────────────────────────────────────

const FORMATOS_DATA = [
  'DD/MM/YYYY HH:mm', 'D/M/YYYY H:mm', 'DD/MM/YYYY H:mm',
  'D/M/YYYY HH:mm', 'YYYY-MM-DD HH:mm', 'DD/MM/YY HH:mm',
  'DD-MM-YYYY HH:mm', 'DD/MM/YYYY', 'D/M/YYYY', 'YYYY-MM-DD',
];

const TIPOS_ATIVIDADE = ['aula', 'revisao', 'evento', 'pratica'];

const HORARIOS_PADRAO = [
  '07:00-08:40', '07:30-09:10', '08:00-09:40', '08:50-10:30',
  '09:00-10:40', '10:00-11:40', '10:40-12:20', '13:00-14:40',
  '13:30-15:10', '14:00-15:40', '14:50-16:30', '15:00-16:40',
  '16:40-18:20', '17:00-18:40', '18:30-20:10', '19:00-20:40',
  '20:20-22:00', '20:30-22:10',
];

// ─── PARSERS DE ARQUIVO ────────────────────────────────────────────────────────

/**
 * Extrai texto de um arquivo Excel/CSV e retorna linhas candidatas a aulas
 */
async function parsearExcel(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target.result);
        const wb = XLSX.read(data, { type: 'array', cellDates: false });
        const todasLinhas = [];

        wb.SheetNames.forEach((sheetName) => {
          const ws = wb.Sheets[sheetName];
          const json = XLSX.utils.sheet_to_json(ws, { raw: false, defval: '' });
          json.forEach((row) => {
            const textoLinha = Object.values(row).join(' | ');
            todasLinhas.push({ texto: textoLinha, dadosBrutos: row, fonte: `Planilha: ${sheetName}` });
          });
        });

        resolve(todasLinhas);
      } catch (err) {
        reject(new Error(`Erro ao ler Excel: ${err.message}`));
      }
    };
    reader.readAsArrayBuffer(file);
  });
}

/**
 * Extrai texto de PDF usando pdf.js via CDN (carregado dinamicamente)
 */
async function parsearPDF(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        // Carrega pdf.js dinamicamente se não estiver disponível
        if (!window.pdfjsLib) {
          await new Promise((res, rej) => {
            const script = document.createElement('script');
            script.src = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js';
            script.onload = res;
            script.onerror = () => rej(new Error('Falha ao carregar pdf.js'));
            document.head.appendChild(script);
          });
          window.pdfjsLib.GlobalWorkerOptions.workerSrc =
            'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
        }

        const typedArray = new Uint8Array(e.target.result);
        const pdf = await window.pdfjsLib.getDocument({ data: typedArray }).promise;
        const linhasExtraidas = [];

        for (let i = 1; i <= pdf.numPages; i++) {
          const page = await pdf.getPage(i);
          const textContent = await page.getTextContent();
          // Agrupa items por linha (y position aproximada)
          const itensPorY = {};
          textContent.items.forEach((item) => {
            const y = Math.round(item.transform[5]);
            if (!itensPorY[y]) itensPorY[y] = [];
            itensPorY[y].push(item.str);
          });

          Object.keys(itensPorY)
            .sort((a, b) => b - a) // top to bottom
            .forEach((y) => {
              const texto = itensPorY[y].join(' ').trim();
              if (texto.length > 5) {
                linhasExtraidas.push({ texto, dadosBrutos: null, fonte: `PDF pág. ${i}` });
              }
            });
        }

        resolve(linhasExtraidas);
      } catch (err) {
        reject(new Error(`Erro ao ler PDF: ${err.message}`));
      }
    };
    reader.readAsArrayBuffer(file);
  });
}

/**
 * Extrai texto de DOCX usando mammoth via CDN
 */
async function parsearDOCX(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        if (!window.mammoth) {
          await new Promise((res, rej) => {
            const script = document.createElement('script');
            script.src = 'https://cdnjs.cloudflare.com/ajax/libs/mammoth/1.6.0/mammoth.browser.min.js';
            script.onload = res;
            script.onerror = () => rej(new Error('Falha ao carregar mammoth.js'));
            document.head.appendChild(script);
          });
        }

        const arrayBuffer = e.target.result;
        const result = await window.mammoth.extractRawText({ arrayBuffer });
        const linhas = result.value
          .split('\n')
          .map((l) => l.trim())
          .filter((l) => l.length > 5)
          .map((texto) => ({ texto, dadosBrutos: null, fonte: 'DOCX' }));

        resolve(linhas);
      } catch (err) {
        reject(new Error(`Erro ao ler DOCX: ${err.message}`));
      }
    };
    reader.readAsArrayBuffer(file);
  });
}

// ─── HEURÍSTICAS DE EXTRAÇÃO ──────────────────────────────────────────────────

const REGEX_DATA = /\b(\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{2,4})\b/g;
const REGEX_HORA = /\b(\d{1,2}[h:]\d{0,2})\s*[-–a]\s*(\d{1,2}[h:]\d{0,2})\b/gi;
const REGEX_HORA_SIMPLES = /\b(\d{1,2}[h:]\d{2})\b/g;
const REGEX_HORA_PADRAO = /\b(\d{2}:\d{2})\s*[-–]\s*(\d{2}:\d{2})\b/g;

function normalizarHora(horaStr) {
  if (!horaStr) return null;
  // converte "8h30", "8:30", "08h30" → "08:30"
  const m = horaStr.replace(',', ':').match(/(\d{1,2})[h:](\d{0,2})/i);
  if (!m) return null;
  const h = m[1].padStart(2, '0');
  const min = (m[2] || '00').padStart(2, '0');
  return `${h}:${min}`;
}

function normalizarData(dataStr) {
  if (!dataStr) return null;
  const limpa = dataStr.replace(/\./g, '/').replace(/-/g, '/');
  const partes = limpa.split('/');
  if (partes.length < 3) return null;
  let d = partes[0].padStart(2, '0');
  let m = partes[1].padStart(2, '0');
  let a = partes[2];
  if (a.length === 2) a = '20' + a;
  return `${d}/${m}/${a}`;
}

function sugerirLaboratorio(textoLinha) {
  const textoLower = textoLinha.toLowerCase();
  // Tenta match direto por nome
  for (const lab of LISTA_LABORATORIOS) {
    if (textoLower.includes(lab.name.toLowerCase())) return lab.name;
  }
  // Match por tipo
  if (textoLower.includes('anatom')) return 'Anatomia 1';
  if (textoLower.includes('microsc')) return 'Microscopia 1';
  if (textoLower.includes('multidis') || textoLower.includes('multi dis')) return 'Multidisciplinar 1';
  if (textoLower.includes('habilid') || textoLower.includes('skill')) return 'Habilidades 1 (Santander)';
  if (textoLower.includes('farmac')) return 'Farmacêutico';
  if (textoLower.includes('dieté') || textoLower.includes('dietet')) return 'Tec. Dietética';
  if (textoLower.includes('uda')) return 'UDA';
  return null;
}

function sugerirTipoAtividade(textoLinha) {
  const t = textoLinha.toLowerCase();
  if (t.includes('revis') || t.includes('revisão')) return 'revisao';
  if (t.includes('prática') || t.includes('pratica') || t.includes('lab')) return 'aula';
  if (t.includes('aula') || t.includes('turma') || t.includes('disciplina')) return 'aula';
  return 'aula';
}

function extrairAssunto(textoLinha) {
  // Remove datas, horas e palavras de laboratório para extrair o assunto
  return textoLinha
    .replace(REGEX_DATA, '')
    .replace(/\d{1,2}[h:]\d{0,2}\s*[-–a]\s*\d{1,2}[h:]\d{0,2}/gi, '')
    .replace(/\d{2}:\d{2}/g, '')
    .replace(/laboratório|lab\.?|anatomia|microscopia|multidisciplinar|habilidades?/gi, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 100) || 'Aula sem título';
}

/**
 * Analisa linhas extraídas e retorna candidatos a aulas
 */
function identificarCandidatosDeAula(linhas) {
  const candidatos = [];

  // Primeiro tenta extrair de dados estruturados (Excel)
  const linhasComDados = linhas.filter((l) => l.dadosBrutos && Object.keys(l.dadosBrutos).length > 1);

  if (linhasComDados.length > 0) {
    // Tenta mapear colunas automaticamente
    const primeiroItem = linhasComDados[0]?.dadosBrutos || {};
    const chaves = Object.keys(primeiroItem);

    const mapaChaves = {};
    chaves.forEach((k) => {
      const kl = k.toLowerCase();
      if (kl.includes('data') || kl.includes('date') || kl.includes('dia')) mapaChaves.data = k;
      if (kl.includes('início') || kl.includes('inicio') || kl.includes('start') || kl.includes('hora i')) mapaChaves.horaInicio = k;
      if (kl.includes('fim') || kl.includes('end') || kl.includes('término') || kl.includes('hora f')) mapaChaves.horaFim = k;
      if (kl.includes('assunto') || kl.includes('atividade') || kl.includes('disciplina') || kl.includes('materia') || kl.includes('descrição') || kl.includes('subject')) mapaChaves.assunto = k;
      if (kl.includes('laborat') || kl.includes('lab') || kl.includes('sala')) mapaChaves.laboratorio = k;
      if (kl.includes('tipo') || kl.includes('type')) mapaChaves.tipo = k;
      if (kl.includes('observ') || kl.includes('obs') || kl.includes('nota')) mapaChaves.obs = k;
    });

    linhasComDados.forEach((linha, idx) => {
      const row = linha.dadosBrutos;
      const dataRaw = mapaChaves.data ? row[mapaChaves.data] : null;
      const horaInicioRaw = mapaChaves.horaInicio ? row[mapaChaves.horaInicio] : null;
      const horaFimRaw = mapaChaves.horaFim ? row[mapaChaves.horaFim] : null;

      const dataNorm = normalizarData(dataRaw);
      const horaInicioNorm = normalizarHora(horaInicioRaw);
      const horaFimNorm = normalizarHora(horaFimRaw);

      if (!dataNorm && !horaInicioNorm) return; // linha sem dados úteis

      const assunto = mapaChaves.assunto
        ? String(row[mapaChaves.assunto] || '').trim() || 'Aula sem título'
        : extrairAssunto(linha.texto);

      const labSugerido =
        (mapaChaves.laboratorio ? LISTA_LABORATORIOS.find((l) => l.name.toLowerCase().includes(String(row[mapaChaves.laboratorio] || '').toLowerCase()))?.name : null) ||
        sugerirLaboratorio(linha.texto);

      candidatos.push({
        id: `candidato_${Date.now()}_${idx}`,
        selecionado: true,
        confianca: dataNorm && horaInicioNorm && horaFimNorm ? 'alta' : dataNorm || horaInicioNorm ? 'media' : 'baixa',
        fonte: linha.fonte,
        textoOriginal: linha.texto.slice(0, 120),
        data: dataNorm || '',
        horaInicio: horaInicioNorm || '',
        horaFim: horaFimNorm || '',
        assunto,
        laboratorio: labSugerido || '',
        tipoAtividade: mapaChaves.tipo ? sugerirTipoAtividade(String(row[mapaChaves.tipo] || '')) : sugerirTipoAtividade(linha.texto),
        observacoes: mapaChaves.obs ? String(row[mapaChaves.obs] || '') : '',
        conflito: null,
      });
    });
  } else {
    // Parsing por texto livre (PDF/DOCX)
    let candidatoAtual = null;

    linhas.forEach((linha, idx) => {
      const texto = linha.texto;
      const datasEncontradas = [...texto.matchAll(REGEX_DATA)].map((m) => normalizarData(m[1])).filter(Boolean);
      const horasEncontradas = [...texto.matchAll(REGEX_HORA_PADRAO)].map((m) => ({
        inicio: normalizarHora(m[1]),
        fim: normalizarHora(m[2]),
      })).filter((h) => h.inicio && h.fim);

      const temData = datasEncontradas.length > 0;
      const temHora = horasEncontradas.length > 0;
      const labSugerido = sugerirLaboratorio(texto);

      // Se a linha tem data, começa um novo candidato
      if (temData || (temHora && texto.length > 15)) {
        if (candidatoAtual && (candidatoAtual.data || candidatoAtual.horaInicio)) {
          candidatos.push(candidatoAtual);
        }

        const hora = horasEncontradas[0];
        candidatoAtual = {
          id: `candidato_${Date.now()}_${idx}`,
          selecionado: true,
          confianca: temData && temHora ? 'alta' : 'media',
          fonte: linha.fonte,
          textoOriginal: texto.slice(0, 120),
          data: datasEncontradas[0] || '',
          horaInicio: hora?.inicio || '',
          horaFim: hora?.fim || '',
          assunto: extrairAssunto(texto),
          laboratorio: labSugerido || '',
          tipoAtividade: sugerirTipoAtividade(texto),
          observacoes: '',
          conflito: null,
        };
      } else if (candidatoAtual && !candidatoAtual.horaInicio && temHora) {
        const hora = horasEncontradas[0];
        candidatoAtual.horaInicio = hora.inicio;
        candidatoAtual.horaFim = hora.fim;
        if (!candidatoAtual.laboratorio && labSugerido) candidatoAtual.laboratorio = labSugerido;
      }
    });

    if (candidatoAtual && (candidatoAtual.data || candidatoAtual.horaInicio)) {
      candidatos.push(candidatoAtual);
    }
  }

  return candidatos.filter((c) => c.confianca !== 'baixa' || c.assunto !== 'Aula sem título');
}

// ─── VERIFICAÇÃO DE CONFLITOS (1 QUERY no Firestore) ─────────────────────────

async function verificarConflitos(candidatos) {
  if (candidatos.length === 0) return candidatos;

  // Encontra range de datas para fazer UMA única query
  const datas = candidatos
    .map((c) => {
      const dt = dayjs(c.data, 'DD/MM/YYYY', true);
      return dt.isValid() ? dt : null;
    })
    .filter(Boolean);

  if (datas.length === 0) return candidatos;

  const dataMin = datas.reduce((a, b) => (a.isBefore(b) ? a : b));
  const dataMax = datas.reduce((a, b) => (a.isAfter(b) ? a : b));

  // 1 única query - busca todas as aulas no período
  const q = query(
    collection(db, 'aulas'),
    where('dataInicio', '>=', Timestamp.fromDate(dataMin.startOf('day').toDate())),
    where('dataInicio', '<=', Timestamp.fromDate(dataMax.endOf('day').toDate()))
  );

  const snapshot = await getDocs(q);
  const aulasExistentes = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));

  // Verifica conflito para cada candidato
  return candidatos.map((candidato) => {
    if (!candidato.data || !candidato.horaInicio || !candidato.horaFim || !candidato.laboratorio) {
      return { ...candidato, conflito: null };
    }

    const dtInicio = dayjs(`${candidato.data} ${candidato.horaInicio}`, 'DD/MM/YYYY HH:mm', true);
    const dtFim = dayjs(`${candidato.data} ${candidato.horaFim}`, 'DD/MM/YYYY HH:mm', true);

    if (!dtInicio.isValid() || !dtFim.isValid()) return { ...candidato, conflito: null };

    const aulaConflito = aulasExistentes.find((aula) => {
      if (aula.laboratorioSelecionado !== candidato.laboratorio) return false;
      const aulaInicio = dayjs(aula.dataInicio.toDate());
      const aulaFim = dayjs(aula.dataFim.toDate());
      return dtInicio.isBefore(aulaFim) && dtFim.isAfter(aulaInicio);
    });

    return {
      ...candidato,
      conflito: aulaConflito
        ? {
            id: aulaConflito.id,
            assunto: aulaConflito.assunto,
            horario: `${dayjs(aulaConflito.dataInicio.toDate()).format('HH:mm')} - ${dayjs(aulaConflito.dataFim.toDate()).format('HH:mm')}`,
          }
        : null,
    };
  });
}

// ─── COMPONENTE CARD DE CANDIDATO ─────────────────────────────────────────────

function CardCandidato({ candidato, onChange, onRemover, index }) {
  const theme = useTheme();
  const [expandido, setExpandido] = useState(false);
  const [editando, setEditando] = useState(!candidato.data || !candidato.horaInicio || !candidato.laboratorio);

  const corConfianca = {
    alta: theme.palette.success.main,
    media: theme.palette.warning.main,
    baixa: theme.palette.error.main,
  }[candidato.confianca];

  const labEncontrado = LISTA_LABORATORIOS.find((l) => l.name === candidato.laboratorio);

  const handleField = (field) => (e) => onChange({ ...candidato, [field]: e.target.value });

  const isValido =
    candidato.data &&
    candidato.horaInicio &&
    candidato.horaFim &&
    candidato.assunto &&
    candidato.laboratorio &&
    labEncontrado;

  return (
    <Card
      elevation={2}
      sx={{
        mb: 2,
        opacity: candidato.selecionado ? 1 : 0.5,
        border: candidato.conflito
          ? `2px solid ${theme.palette.error.main}`
          : isValido
          ? `1px solid ${alpha(theme.palette.success.main, 0.3)}`
          : `1px solid ${alpha(theme.palette.warning.main, 0.4)}`,
        transition: 'all 0.2s',
      }}
    >
      <CardContent sx={{ pb: 1 }}>
        {/* Header */}
        <Box display="flex" alignItems="center" gap={1} mb={1}>
          <Chip
            size="small"
            label={candidato.confianca.toUpperCase()}
            sx={{ backgroundColor: alpha(corConfianca, 0.15), color: corConfianca, fontWeight: 700, fontSize: '0.65rem' }}
          />
          <Chip
            size="small"
            label={candidato.fonte}
            variant="outlined"
            sx={{ fontSize: '0.65rem', maxWidth: 150 }}
          />
          {candidato.conflito && (
            <Chip
              size="small"
              icon={<AlertTriangle size={12} />}
              label="CONFLITO"
              color="error"
              sx={{ fontWeight: 700 }}
            />
          )}
          {isValido && !candidato.conflito && (
            <Chip size="small" icon={<CheckCircle size={12} />} label="OK" color="success" sx={{ fontWeight: 700 }} />
          )}
          <Box flex={1} />
          <Tooltip title={candidato.selecionado ? 'Desmarcar' : 'Marcar para importar'}>
            <IconButton
              size="small"
              onClick={() => onChange({ ...candidato, selecionado: !candidato.selecionado })}
              color={candidato.selecionado ? 'primary' : 'default'}
            >
              <CheckCircle size={18} />
            </IconButton>
          </Tooltip>
          <Tooltip title="Editar campos">
            <IconButton size="small" onClick={() => setEditando(!editando)} color={editando ? 'secondary' : 'default'}>
              <Edit2 size={16} />
            </IconButton>
          </Tooltip>
          <Tooltip title="Remover">
            <IconButton size="small" onClick={onRemover} color="error">
              <Trash2 size={16} />
            </IconButton>
          </Tooltip>
        </Box>

        {/* Resumo sempre visível */}
        <Box display="flex" flexWrap="wrap" gap={1} alignItems="center">
          <Box display="flex" alignItems="center" gap={0.5}>
            <Calendar size={14} color={theme.palette.text.secondary} />
            <Typography variant="body2" fontWeight={600}>
              {candidato.data || <span style={{ color: theme.palette.warning.main }}>sem data</span>}
            </Typography>
          </Box>
          <Box display="flex" alignItems="center" gap={0.5}>
            <Clock size={14} color={theme.palette.text.secondary} />
            <Typography variant="body2">
              {candidato.horaInicio && candidato.horaFim
                ? `${candidato.horaInicio} – ${candidato.horaFim}`
                : <span style={{ color: theme.palette.warning.main }}>sem horário</span>}
            </Typography>
          </Box>
          <Box display="flex" alignItems="center" gap={0.5}>
            <FlaskConical size={14} color={theme.palette.text.secondary} />
            <Typography variant="body2">
              {candidato.laboratorio || <span style={{ color: theme.palette.warning.main }}>sem lab</span>}
            </Typography>
          </Box>
          <Box display="flex" alignItems="center" gap={0.5}>
            <BookOpen size={14} color={theme.palette.text.secondary} />
            <Typography variant="body2" noWrap sx={{ maxWidth: 200 }}>
              {candidato.assunto}
            </Typography>
          </Box>
        </Box>

        {candidato.conflito && (
          <Alert severity="error" sx={{ mt: 1, py: 0.5 }} icon={<AlertTriangle size={16} />}>
            <Typography variant="caption">
              Conflito com <strong>{candidato.conflito.assunto}</strong> ({candidato.conflito.horario}) neste lab.
              Troque o laboratório ou horário.
            </Typography>
          </Alert>
        )}

        {/* Texto original colapsável */}
        <Box mt={1}>
          <Button
            size="small"
            startIcon={expandido ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
            onClick={() => setExpandido(!expandido)}
            sx={{ p: 0, minWidth: 0, fontSize: '0.7rem', color: 'text.secondary' }}
          >
            Texto original
          </Button>
          <Collapse in={expandido}>
            <Typography
              variant="caption"
              sx={{ display: 'block', mt: 0.5, p: 1, backgroundColor: alpha(theme.palette.action.selected, 0.5), borderRadius: 1, fontFamily: 'monospace' }}
            >
              {candidato.textoOriginal}
            </Typography>
          </Collapse>
        </Box>
      </CardContent>

      {/* Campos de edição */}
      <Collapse in={editando}>
        <Divider />
        <CardContent>
          <Grid container spacing={2}>
            <Grid item xs={12} sm={4}>
              <TextField
                label="Data (DD/MM/AAAA)"
                value={candidato.data}
                onChange={handleField('data')}
                size="small"
                fullWidth
                placeholder="ex: 15/07/2025"
                error={candidato.data && !dayjs(candidato.data, 'DD/MM/YYYY', true).isValid()}
                helperText={candidato.data && !dayjs(candidato.data, 'DD/MM/YYYY', true).isValid() ? 'Formato inválido' : ''}
              />
            </Grid>
            <Grid item xs={6} sm={2}>
              <TextField
                label="Início"
                value={candidato.horaInicio}
                onChange={handleField('horaInicio')}
                size="small"
                fullWidth
                placeholder="08:00"
              />
            </Grid>
            <Grid item xs={6} sm={2}>
              <TextField
                label="Fim"
                value={candidato.horaFim}
                onChange={handleField('horaFim')}
                size="small"
                fullWidth
                placeholder="09:40"
              />
            </Grid>
            <Grid item xs={12} sm={4}>
              <FormControl fullWidth size="small" error={!labEncontrado && !!candidato.laboratorio}>
                <InputLabel>Laboratório</InputLabel>
                <Select
                  value={candidato.laboratorio}
                  onChange={handleField('laboratorio')}
                  label="Laboratório"
                >
                  <MenuItem value=""><em>Selecionar...</em></MenuItem>
                  {LISTA_LABORATORIOS.map((lab) => (
                    <MenuItem key={lab.id} value={lab.name}>{lab.name}</MenuItem>
                  ))}
                </Select>
                {!labEncontrado && candidato.laboratorio && (
                  <FormHelperText>Lab. não reconhecido</FormHelperText>
                )}
              </FormControl>
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                label="Assunto / Atividade"
                value={candidato.assunto}
                onChange={handleField('assunto')}
                size="small"
                fullWidth
              />
            </Grid>
            <Grid item xs={12} sm={3}>
              <FormControl fullWidth size="small">
                <InputLabel>Tipo</InputLabel>
                <Select value={candidato.tipoAtividade} onChange={handleField('tipoAtividade')} label="Tipo">
                  {TIPOS_ATIVIDADE.map((t) => (
                    <MenuItem key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} sm={3}>
              <TextField
                label="Observações"
                value={candidato.observacoes}
                onChange={handleField('observacoes')}
                size="small"
                fullWidth
              />
            </Grid>
          </Grid>
        </CardContent>
      </Collapse>
    </Card>
  );
}

// ─── COMPONENTE PRINCIPAL ─────────────────────────────────────────────────────

const STEPS = ['Upload do Arquivo', 'Revisão dos Pontos Extraídos', 'Confirmação e Importação'];

function ImportarCronograma() {
  const theme = useTheme();
  const { currentUser, userProfile, loading: loadingAuth } = useAuth();
  const isCoordenador = userProfile?.role === 'coordenador';

  const [activeStep, setActiveStep] = useState(0);
  const [progresso, setProgresso] = useState(0);
  const [statusMsg, setStatusMsg] = useState('');
  const [loading, setLoading] = useState(false);
  const [candidatos, setCandidatos] = useState([]);
  const [arquivoNome, setArquivoNome] = useState('');
  const [feedback, setFeedback] = useState({ open: false, message: '', severity: 'info' });
  const [dialogConfirmar, setDialogConfirmar] = useState(false);
  const [resultadoImportacao, setResultadoImportacao] = useState(null);
  const inputRef = useRef(null);

  const showFeedback = (message, severity = 'info') => setFeedback({ open: true, message, severity });
  const closeFeedback = (_, reason) => { if (reason !== 'clickaway') setFeedback((p) => ({ ...p, open: false })); };

  // Drag & Drop
  const [dragging, setDragging] = useState(false);
  const handleDragOver = (e) => { e.preventDefault(); setDragging(true); };
  const handleDragLeave = () => setDragging(false);
  const handleDrop = (e) => { e.preventDefault(); setDragging(false); const f = e.dataTransfer.files[0]; if (f) processarArquivo(f); };

  const processarArquivo = useCallback(async (file) => {
    const ext = file.name.split('.').pop().toLowerCase();
    const aceitaveis = ['xlsx', 'xls', 'csv', 'pdf', 'docx', 'doc'];
    if (!aceitaveis.includes(ext)) {
      showFeedback('Formato não suportado. Use: xlsx, xls, csv, pdf ou docx.', 'error');
      return;
    }

    setArquivoNome(file.name);
    setLoading(true);
    setProgresso(10);
    setStatusMsg('Lendo arquivo...');

    try {
      let linhas = [];

      if (['xlsx', 'xls', 'csv'].includes(ext)) {
        setStatusMsg('Analisando planilha...');
        setProgresso(30);
        linhas = await parsearExcel(file);
      } else if (ext === 'pdf') {
        setStatusMsg('Carregando leitor de PDF...');
        setProgresso(20);
        linhas = await parsearPDF(file);
        setProgresso(50);
      } else if (['docx', 'doc'].includes(ext)) {
        setStatusMsg('Carregando leitor de DOCX...');
        setProgresso(20);
        linhas = await parsearDOCX(file);
        setProgresso(50);
      }

      setProgresso(60);
      setStatusMsg(`Identificando pontos de aula (${linhas.length} linhas analisadas)...`);

      const candidatosExtraidos = identificarCandidatosDeAula(linhas);

      if (candidatosExtraidos.length === 0) {
        showFeedback('Nenhum ponto de aula identificado no arquivo. Verifique se o documento contém datas e horários.', 'warning');
        setLoading(false);
        setProgresso(0);
        return;
      }

      setProgresso(80);
      setStatusMsg(`Verificando conflitos com ${candidatosExtraidos.length} aulas encontradas...`);

      const candidatosComConflito = await verificarConflitos(candidatosExtraidos);

      setProgresso(100);
      const comConflito = candidatosComConflito.filter((c) => c.conflito).length;
      const semData = candidatosComConflito.filter((c) => !c.data || !c.horaInicio).length;

      setCandidatos(candidatosComConflito);
      setActiveStep(1);
      showFeedback(
        `${candidatosComConflito.length} ponto(s) encontrado(s). ${comConflito > 0 ? `⚠️ ${comConflito} com conflito. ` : ''}${semData > 0 ? `📝 ${semData} precisam de ajuste.` : ''}`,
        comConflito > 0 ? 'warning' : 'success'
      );
    } catch (err) {
      console.error('Erro ao processar arquivo:', err);
      showFeedback(`Erro: ${err.message}`, 'error');
    } finally {
      setLoading(false);
      setProgresso(0);
      setStatusMsg('');
    }
  }, []);

  const handleFileInput = (e) => {
    const f = e.target.files[0];
    if (f) processarArquivo(f);
    e.target.value = null;
  };

  const candidatosSelecionados = candidatos.filter((c) => c.selecionado);
  const candidatosValidos = candidatosSelecionados.filter((c) => {
    const labOk = LISTA_LABORATORIOS.some((l) => l.name === c.laboratorio);
    const dtOk = dayjs(c.data, 'DD/MM/YYYY', true).isValid();
    const horaOk = c.horaInicio && c.horaFim;
    return labOk && dtOk && horaOk && c.assunto;
  });
  const candidatosComConflito = candidatosValidos.filter((c) => c.conflito);

  const handleImportar = async () => {
    setDialogConfirmar(false);
    const aulasParaImportar = candidatosValidos.filter((c) => !c.conflito);

    if (aulasParaImportar.length === 0) {
      showFeedback('Nenhuma aula válida sem conflito para importar.', 'warning');
      return;
    }

    setLoading(true);
    setActiveStep(2);
    setProgresso(5);
    setStatusMsg('Salvando aulas...');

    let salvos = 0;
    const erros = [];

    for (let i = 0; i < aulasParaImportar.length; i++) {
      const c = aulasParaImportar[i];
      try {
        const lab = LISTA_LABORATORIOS.find((l) => l.name === c.laboratorio);
        const dtInicio = dayjs(`${c.data} ${c.horaInicio}`, 'DD/MM/YYYY HH:mm');
        const dtFim = dayjs(`${c.data} ${c.horaFim}`, 'DD/MM/YYYY HH:mm');

        await addDoc(collection(db, 'aulas'), {
          tipoAtividade: c.tipoAtividade || 'aula',
          dataInicio: Timestamp.fromDate(dtInicio.toDate()),
          dataFim: Timestamp.fromDate(dtFim.toDate()),
          assunto: c.assunto.trim(),
          observacoes: c.observacoes?.trim() || '',
          tipoLaboratorio: lab?.tipo || 'desconhecido',
          laboratorioSelecionado: c.laboratorio,
          status: 'aprovada',
          propostaPorEmail: currentUser.email,
          propostaPorUid: currentUser.uid,
          propostaPorNome: userProfile?.name || currentUser.displayName || currentUser.email,
          createdAt: serverTimestamp(),
          assignedTechnicians: [],
          assignedTechnicianUids: [],
          horarioSlotString: `${c.horaInicio}-${c.horaFim}`,
          importadaVia: 'ImportarCronograma',
          arquivoOrigem: arquivoNome,
        });
        salvos++;
      } catch (err) {
        erros.push(`"${c.assunto}": ${err.message}`);
      }
      setProgresso(Math.round(((i + 1) / aulasParaImportar.length) * 100));
    }

    setLoading(false);
    setProgresso(0);
    setResultadoImportacao({ salvos, erros, total: aulasParaImportar.length });
    showFeedback(
      erros.length === 0
        ? `✅ ${salvos} aulas importadas com sucesso!`
        : `${salvos} importadas, ${erros.length} com erro.`,
      erros.length === 0 ? 'success' : 'warning'
    );
  };

  const reiniciar = () => {
    setActiveStep(0);
    setCandidatos([]);
    setArquivoNome('');
    setResultadoImportacao(null);
    setProgresso(0);
  };

  // ── Guards ──
  if (loadingAuth) return <Box display="flex" justifyContent="center" mt={8}><CircularProgress /></Box>;
  if (!isCoordenador) return (
    <Container maxWidth="sm" sx={{ mt: 8, textAlign: 'center' }}>
      <Paper elevation={3} sx={{ p: 4 }}>
        <AlertTriangle size={48} color={theme.palette.error.main} />
        <Typography variant="h6" mt={2}>Acesso Negado</Typography>
        <Typography variant="body2" color="text.secondary">Apenas coordenadores podem usar esta funcionalidade.</Typography>
      </Paper>
    </Container>
  );

  return (
    <Container maxWidth="lg" sx={{ mt: 4, mb: 6 }}>
      {/* Header */}
      <Paper elevation={0} sx={{ p: 3, mb: 3, background: `linear-gradient(135deg, ${theme.palette.primary.main} 0%, ${theme.palette.primary.dark} 100%)`, color: 'white', borderRadius: 3 }}>
        <Box display="flex" alignItems="center" gap={2}>
          <FileSpreadsheet size={36} />
          <Box>
            <Typography variant="h5" fontWeight={700}>Importar Cronograma</Typography>
            <Typography variant="body2" sx={{ opacity: 0.85 }}>
              Faça upload de um arquivo PDF, Word ou Excel — o sistema identifica automaticamente os pontos de aula e verifica conflitos
            </Typography>
          </Box>
        </Box>
      </Paper>

      {/* Stepper */}
      <Stepper activeStep={activeStep} sx={{ mb: 4 }} alternativeLabel>
        {STEPS.map((label) => (
          <Step key={label}><StepLabel>{label}</StepLabel></Step>
        ))}
      </Stepper>

      {/* ── STEP 0: Upload ── */}
      {activeStep === 0 && (
        <Paper elevation={2} sx={{ p: { xs: 2, md: 4 } }}>
          <Typography variant="h6" gutterBottom fontWeight={600}>Selecione o arquivo de cronograma</Typography>
          <Typography variant="body2" color="text.secondary" mb={3}>
            Formatos aceitos: <strong>.xlsx, .xls, .csv</strong> (planilha), <strong>.pdf</strong>, <strong>.docx</strong> (Word).
            O sistema tentará identificar datas, horários, laboratórios e assuntos automaticamente.
          </Typography>

          {/* Drop zone */}
          <Box
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            onClick={() => !loading && inputRef.current?.click()}
            sx={{
              border: `2px dashed ${dragging ? theme.palette.primary.main : theme.palette.divider}`,
              borderRadius: 3,
              p: 6,
              textAlign: 'center',
              cursor: loading ? 'not-allowed' : 'pointer',
              backgroundColor: dragging ? alpha(theme.palette.primary.main, 0.05) : alpha(theme.palette.action.selected, 0.02),
              transition: 'all 0.2s',
              '&:hover': { backgroundColor: alpha(theme.palette.primary.main, 0.04), borderColor: theme.palette.primary.main },
            }}
          >
            {loading ? (
              <Box>
                <Loader2 size={48} color={theme.palette.primary.main} style={{ animation: 'spin 1s linear infinite' }} />
                <Typography variant="body1" mt={2} fontWeight={500}>{statusMsg}</Typography>
                <LinearProgress variant="determinate" value={progresso} sx={{ mt: 2, borderRadius: 2 }} />
              </Box>
            ) : (
              <Box>
                <Upload size={48} color={theme.palette.primary.main} />
                <Typography variant="h6" mt={2} fontWeight={600}>Arraste o arquivo aqui</Typography>
                <Typography variant="body2" color="text.secondary" mt={0.5}>ou clique para selecionar</Typography>
                <Box display="flex" justifyContent="center" gap={1} mt={2} flexWrap="wrap">
                  {['xlsx/csv', 'pdf', 'docx'].map((fmt) => (
                    <Chip key={fmt} label={fmt} size="small" icon={<File size={12} />} variant="outlined" />
                  ))}
                </Box>
              </Box>
            )}
          </Box>

          <input ref={inputRef} type="file" accept=".xlsx,.xls,.csv,.pdf,.docx,.doc" style={{ display: 'none' }} onChange={handleFileInput} />

          {/* Dica sobre o formato esperado */}
          <Alert severity="info" icon={<Info size={18} />} sx={{ mt: 3 }}>
            <Typography variant="body2">
              <strong>Dica:</strong> Para melhores resultados com planilhas, use colunas com nomes como:
              <em> Data, Hora Início, Hora Fim, Assunto/Disciplina, Laboratório</em>.
              Para PDF/DOCX, o sistema procura padrões como <em>"DD/MM/AAAA HH:MM - HH:MM"</em> nas linhas.
            </Typography>
          </Alert>
        </Paper>
      )}

      {/* ── STEP 1: Revisão ── */}
      {activeStep === 1 && (
        <Box>
          {/* Resumo */}
          <Paper elevation={1} sx={{ p: 2, mb: 3, display: 'flex', flexWrap: 'wrap', gap: 2, alignItems: 'center' }}>
            <Box>
              <Typography variant="body2" color="text.secondary">Arquivo</Typography>
              <Typography variant="body1" fontWeight={600}>{arquivoNome}</Typography>
            </Box>
            <Divider orientation="vertical" flexItem />
            <Box>
              <Typography variant="body2" color="text.secondary">Pontos encontrados</Typography>
              <Typography variant="h6" fontWeight={700} color="primary">{candidatos.length}</Typography>
            </Box>
            <Box>
              <Typography variant="body2" color="text.secondary">Selecionados</Typography>
              <Typography variant="h6" fontWeight={700}>{candidatosSelecionados.length}</Typography>
            </Box>
            <Box>
              <Typography variant="body2" color="text.secondary">Válidos</Typography>
              <Typography variant="h6" fontWeight={700} color="success.main">{candidatosValidos.filter((c) => !c.conflito).length}</Typography>
            </Box>
            {candidatosComConflito.length > 0 && (
              <Box>
                <Typography variant="body2" color="text.secondary">Com conflito</Typography>
                <Typography variant="h6" fontWeight={700} color="error.main">{candidatosComConflito.length}</Typography>
              </Box>
            )}
            <Box flex={1} display="flex" justifyContent="flex-end" gap={1}>
              <Button startIcon={<RefreshCw size={16} />} onClick={reiniciar} variant="outlined" size="small">
                Novo arquivo
              </Button>
              <Button
                variant="contained"
                startIcon={<Save size={16} />}
                onClick={() => setDialogConfirmar(true)}
                disabled={candidatosValidos.filter((c) => !c.conflito).length === 0}
                size="small"
              >
                Importar {candidatosValidos.filter((c) => !c.conflito).length} aulas
              </Button>
            </Box>
          </Paper>

          {/* Cards */}
          {candidatos.length === 0 ? (
            <Alert severity="warning">Nenhum candidato encontrado. Tente outro arquivo.</Alert>
          ) : (
            candidatos.map((c, i) => (
              <CardCandidato
                key={c.id}
                index={i}
                candidato={c}
                onChange={(updated) => setCandidatos((prev) => prev.map((x) => (x.id === updated.id ? updated : x)))}
                onRemover={() => setCandidatos((prev) => prev.filter((x) => x.id !== c.id))}
              />
            ))
          )}

          {/* Bottom action */}
          <Box display="flex" justifyContent="flex-end" mt={2} gap={2}>
            <Button startIcon={<RefreshCw size={16} />} onClick={reiniciar} variant="outlined">
              Novo arquivo
            </Button>
            <Button
              variant="contained"
              startIcon={<Save size={16} />}
              onClick={() => setDialogConfirmar(true)}
              disabled={candidatosValidos.filter((c) => !c.conflito).length === 0 || loading}
              size="large"
            >
              Importar {candidatosValidos.filter((c) => !c.conflito).length} aulas aprovadas
            </Button>
          </Box>
        </Box>
      )}

      {/* ── STEP 2: Resultado ── */}
      {activeStep === 2 && (
        <Paper elevation={2} sx={{ p: 4, textAlign: 'center' }}>
          {loading ? (
            <Box>
              <CircularProgress size={64} />
              <Typography variant="h6" mt={3}>{statusMsg}</Typography>
              <LinearProgress variant="determinate" value={progresso} sx={{ mt: 2, borderRadius: 2 }} />
            </Box>
          ) : resultadoImportacao ? (
            <Box>
              <CheckCircle size={64} color={theme.palette.success.main} />
              <Typography variant="h5" fontWeight={700} mt={2}>
                {resultadoImportacao.erros.length === 0 ? 'Importação concluída!' : 'Importação com avisos'}
              </Typography>
              <Typography variant="h3" fontWeight={800} color="success.main" mt={1}>
                {resultadoImportacao.salvos}
              </Typography>
              <Typography variant="body1" color="text.secondary">aulas importadas com sucesso</Typography>

              {resultadoImportacao.erros.length > 0 && (
                <Alert severity="warning" sx={{ mt: 2, textAlign: 'left' }}>
                  <Typography variant="body2" fontWeight={600}>Erros ({resultadoImportacao.erros.length}):</Typography>
                  {resultadoImportacao.erros.map((e, i) => (
                    <Typography key={i} variant="caption" display="block">• {e}</Typography>
                  ))}
                </Alert>
              )}

              <Button variant="contained" startIcon={<RefreshCw size={16} />} onClick={reiniciar} sx={{ mt: 3 }} size="large">
                Importar outro arquivo
              </Button>
            </Box>
          ) : null}
        </Paper>
      )}

      {/* ── Dialog de confirmação ── */}
      <Dialog open={dialogConfirmar} onClose={() => setDialogConfirmar(false)} maxWidth="sm" fullWidth>
        <DialogTitle>
          <Box display="flex" alignItems="center" gap={1}>
            <Save size={20} />
            Confirmar Importação
          </Box>
        </DialogTitle>
        <DialogContent>
          <Typography variant="body1" gutterBottom>
            Você está prestes a importar <strong>{candidatosValidos.filter((c) => !c.conflito).length} aulas</strong> como <strong>aprovadas</strong>.
          </Typography>
          {candidatosComConflito.length > 0 && (
            <Alert severity="warning" sx={{ mt: 1 }}>
              <strong>{candidatosComConflito.length} aulas</strong> com conflito serão ignoradas. Ajuste o laboratório ou horário para incluí-las.
            </Alert>
          )}
          {candidatosSelecionados.length - candidatosValidos.length > 0 && (
            <Alert severity="info" sx={{ mt: 1 }}>
              <strong>{candidatosSelecionados.length - candidatosValidos.length} aulas</strong> estão incompletas (sem data, horário ou laboratório) e serão ignoradas.
            </Alert>
          )}
          <Typography variant="body2" color="text.secondary" mt={2}>
            Esta ação criará os registros diretamente no Firebase. Não é possível desfazer em lote.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDialogConfirmar(false)} variant="outlined">Cancelar</Button>
          <Button onClick={handleImportar} variant="contained" color="success" startIcon={<CheckCircle size={16} />}>
            Confirmar e Importar
          </Button>
        </DialogActions>
      </Dialog>

      {/* Snackbar */}
      <Snackbar open={feedback.open} autoHideDuration={7000} onClose={closeFeedback} anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}>
        <Alert onClose={closeFeedback} severity={feedback.severity} sx={{ width: '100%' }}>
          {feedback.message}
        </Alert>
      </Snackbar>

      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
    </Container>
  );
}

export default ImportarCronograma;
