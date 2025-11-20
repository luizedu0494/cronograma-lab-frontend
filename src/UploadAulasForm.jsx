// src/UploadAulasForm.js
import React, { useState, useEffect, useMemo } from 'react';
import { db } from './firebaseConfig';
import { collection, addDoc, serverTimestamp, Timestamp } from 'firebase/firestore';
import { useAuth } from './AuthContext';

import {
  Container, Typography, Box, Button, Paper, CircularProgress,
  Snackbar, // Certifique-se que Snackbar está importado
  Alert,    // Certifique-se que Alert está importado
  Input,
  TableContainer, Table, TableHead, TableBody, TableRow, TableCell,
  Tooltip,
} from '@mui/material';
import { useTheme, alpha } from '@mui/material/styles';
import ErrorIcon from '@mui/icons-material/Error';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import * as XLSX from 'xlsx';
import dayjs from 'dayjs';
import 'dayjs/locale/pt-br';
import customParseFormat from 'dayjs/plugin/customParseFormat';
import { LISTA_LABORATORIOS } from './constants/laboratorios';

dayjs.extend(customParseFormat);
dayjs.locale('pt-br');

const EXPECTED_HEADERS = [
  "Data Início", "Hora Início", "Hora Fim",
  "Assunto/Atividade", "Laboratório Selecionado", "Tipo Atividade",
  "Proposto por (Nome)", "Proposto por (E-mail)",
  "Observações"
];

const HEADER_TO_FIELD_MAP = {
  "Data Início": "data", "Hora Início": "horaInicioStr", "Hora Fim": "horaFimStr",
  "Assunto/Atividade": "assunto", "Laboratório Selecionado": "laboratorioSelecionado",
  "Tipo Atividade": "tipoAtividade", "Proposto por (Nome)": "propostaPorNome",
  "Proposto por (E-mail)": "propostaPorEmail", "Observações": "observacoes",
};

function UploadAulasForm() {
  const [file, setFile] = useState(null); // Este estado não estava sendo usado, mas não causa o erro
  const [loading, setLoading] = useState(false);
  
  // --- Definição do estado de feedback ---
  const [feedback, setFeedback] = useState({ 
    open: false, 
    message: '', 
    severity: 'info' 
  });
  // --- Fim da definição ---

  const [parsedData, setParsedData] = useState([]);
  const [showPreview, setShowPreview] = useState(false);

  const { currentUser, userProfile, loading: loadingAuth } = useAuth();
  const isCoordenador = userProfile?.role === 'coordenador';
  const theme = useTheme();

  const showFeedback = (message, severity = 'info') => {
    setFeedback({ open: true, message, severity }); // Usa setFeedback
  };

  const validateRow = (rowData, rowIndex) => {
    const errors = [];
    const processedRow = { ...rowData };
    if (!rowData.data || !rowData.horaInicioStr || !rowData.horaFimStr) {
      errors.push({ field: "Data Início/Hora", message: "Data, Hora Início e Hora Fim são obrigatórios." });
    } else {
      const inicioStr = `${rowData.data} ${rowData.horaInicioStr}`;
      const fimStr = `${rowData.data} ${rowData.horaFimStr}`;
      const formatos = ["DD/MM/YYYY HH:mm", "D/M/YYYY H:m", "YYYY-MM-DD HH:mm", "D/M/YY HH:mm"];
      const inicioDt = dayjs(inicioStr, formatos, 'pt-br', true);
      const fimDt = dayjs(fimStr, formatos, 'pt-br', true);

      if (!inicioDt.isValid()) errors.push({ field: "Data Início/Hora", message: `Formato inválido Início: ${inicioStr}. Use DD/MM/AAAA HH:MM` });
      else processedRow.dataInicioValid = inicioDt;
      if (!fimDt.isValid()) errors.push({ field: "Data Fim/Hora", message: `Formato inválido Fim: ${fimStr}. Use DD/MM/AAAA HH:MM` });
      else processedRow.dataFimValid = fimDt;

      if (inicioDt.isValid() && fimDt.isValid() && fimDt.isSameOrBefore(inicioDt)) {
        errors.push({ field: "Hora Fim", message: "Hora Fim deve ser após Hora Início." });
      }
    }
    if (!rowData.assunto || String(rowData.assunto).trim() === '') errors.push({ field: "Assunto/Atividade", message: "Assunto obrigatório." });
    
    const labSelTrim = String(rowData.laboratorioSelecionado || '').trim();
    const labFound = LISTA_LABORATORIOS.find(lab => lab.name.trim().toLowerCase() === labSelTrim.toLowerCase());
    if (!labSelTrim || !labFound) errors.push({ field: "Laboratório Selecionado", message: `Lab '${rowData.laboratorioSelecionado}' inválido.` });
    else { processedRow.tipoLaboratorio = labFound.tipo; processedRow.laboratorioSelecionado = labFound.name; }

    const tipoAtivLow = String(rowData.tipoAtividade || '').toLowerCase().trim();
    if (tipoAtivLow !== 'aula' && tipoAtivLow !== 'revisao' && tipoAtivLow !== 'revisão') errors.push({ field: "Tipo Atividade", message: "Inválido. Use 'aula' ou 'revisao'." });
    else processedRow.tipoAtividadeValid = tipoAtivLow.replace('revisão', 'revisao');
    
    return { isValid: errors.length === 0, errors, processedRow };
  };

  const handleFileProcess = async (e) => {
    const selectedFile = e.target.files[0];
    if (e.target) e.target.value = null;

    if (!selectedFile) {
      // setFile(null); // Estado 'file' não está sendo usado
      setShowPreview(false); setParsedData([]); return;
    }
    // setFile(selectedFile); // Estado 'file' não está sendo usado
    setShowPreview(false); setParsedData([]);
    setLoading(true);
    showFeedback('Lendo e validando planilha...', 'info');

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const data = new Uint8Array(event.target.result);
        const workbook = XLSX.read(data, { type: 'array', cellDates: false }); 
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        const jsonData = XLSX.utils.sheet_to_json(worksheet, { raw: false, defval: "" });

        if (jsonData.length === 0) {
          showFeedback('Planilha vazia ou sem dados (verifique cabeçalhos).', 'error');
          setLoading(false); return;
        }

        const processedResults = jsonData.map((rowRaw, index) => {
          const rowData = {};
          for (const expectedHeader of EXPECTED_HEADERS) {
            const firestoreField = HEADER_TO_FIELD_MAP[expectedHeader];
            if (firestoreField) rowData[firestoreField] = rowRaw[expectedHeader] !== undefined ? String(rowRaw[expectedHeader]).trim() : "";
          }
          for (const key of Object.values(HEADER_TO_FIELD_MAP)) {
              if (rowData[key] === undefined) rowData[key] = "";
          }
          const validation = validateRow(rowData, index);
          return { originalRowIndex: index + 2, rawDataFromSheet: rowRaw, ...rowData, ...validation.processedRow, _validation: validation };
        });
        
        setParsedData(processedResults);
        setShowPreview(true);
        const errorCount = processedResults.filter(r => !r._validation.isValid).length;
        const validCount = processedResults.length - errorCount;
        showFeedback(`Pré-visualização: ${validCount} aulas válidas, ${errorCount} com erros.`, errorCount > 0 ? 'warning' : (validCount > 0 ? 'success' : 'info') );
      } catch (err) {
        console.error("Erro ao processar arquivo Excel:", err);
        showFeedback(`Erro ao ler planilha: ${err.message}`, 'error');
      } finally {
        setLoading(false); 
      }
    };
    reader.readAsArrayBuffer(selectedFile);
  };

  const handleActualImport = async () => {
    if (!isCoordenador || !currentUser) { showFeedback('Ação não permitida.', 'error'); return;}
    const aulasValidasParaImportar = parsedData.filter(row => row._validation.isValid);
    if (aulasValidasParaImportar.length === 0) { showFeedback('Nenhuma aula válida.', 'warning'); return;}
    setLoading(true);
    showFeedback(`Importando ${aulasValidasParaImportar.length} aulas...`, 'info');
    let aulasAdicionadas = 0; let errosImportacao = [];
    for (const row of aulasValidasParaImportar) {
      try {
        const aulaDataToSave = {
          tipoAtividade: row.tipoAtividadeValid, dataInicio: row.dataInicioValid.toDate(), dataFim: row.dataFimValid.toDate(),
          assunto: String(row.assunto).trim(), observacoes: String(row.observacoes).trim(), tipoLaboratorio: row.tipoLaboratorio,
          laboratorioSelecionado: row.laboratorioSelecionado, status: 'aprovada', 
          propostaPorEmail: String(row.propostaPorEmail || currentUser.email).trim(),
          propostaPorUid: currentUser.uid, 
          propostaPorNome: String(row.propostaPorNome || userProfile?.name || currentUser.displayName).trim(),
          createdAt: serverTimestamp(), assignedTechnicians: [], assignedTechnicianUids: [],
          horarioSlotString: row.horarioSlotString || `${row.horaInicioStr}-${row.horaFimStr}`,
        };
        await addDoc(collection(db, "aulas"), aulaDataToSave);
        aulasAdicionadas++;
      } catch (err) { console.error(`Erro salvar linha ${row.originalRowIndex}:`, err); errosImportacao.push(`Linha ${row.originalRowIndex}: ${err.message}`); }
    }
    // As linhas 192 e 194 do seu erro original estariam aqui, usando 'showFeedback'
    let finalMessage = `${aulasAdicionadas} aulas importadas.`;
    let finalSeverityForSnackbar = 'success'; // Variável local para evitar conflito
    if (errosImportacao.length > 0) { 
      finalMessage += ` ${errosImportacao.length} falharam: ${errosImportacao.join('; ')}`; 
      finalSeverityForSnackbar = 'warning'; 
    }
    showFeedback(finalMessage, finalSeverityForSnackbar); // Usa a função auxiliar

    setLoading(false); setShowPreview(false); setParsedData([]); //setFile(null); 
    if (document.getElementById('file-input-upload-aulas')) { document.getElementById('file-input-upload-aulas').value = ""; }
  };

  const handleCloseSnackbar = (event, reason) => { if (reason === 'clickaway') return; setFeedback(prev => ({ ...prev, open: false }));};
  const columns = useMemo(() => EXPECTED_HEADERS.map(header => ({ id: HEADER_TO_FIELD_MAP[header] || header.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/gi, ''), label: header, minWidth: header.includes("Observações") || header.includes("Assunto") ? 200 : (header.includes("Técnico") ? 250 : 120) })), []);

  if (loadingAuth) { return (<Container maxWidth="sm" sx={{ textAlign: 'center', mt: 4 }}><CircularProgress /><Typography variant="h6">Carregando...</Typography></Container> ); }
  if (!isCoordenador) { return (<Container maxWidth="sm" sx={{ textAlign: 'center', mt: 4 }}><Typography variant="h6" color="error">Acesso Negado</Typography><Typography variant="body1">Apenas coordenadores.</Typography></Container> ); }

  return (
    <Container maxWidth="lg" sx={{ mt: 4, mb: 4 }}>
      <Paper elevation={3} sx={{ p: {xs: 2, md: 4} }}>
        <Typography variant="h5" component="h2" gutterBottom align="center">Upload de Aulas via Planilha</Typography>
        <Typography variant="body2" align="center" sx={{ mb: 2 }}>
          Selecione um arquivo .xlsx ou .csv. A primeira linha deve conter os cabeçalhos. <br/>
          Cabeçalhos esperados: {EXPECTED_HEADERS.join(', ')}.
        </Typography>
        <Box sx={{ mt: 3, mb: 3, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
          <Input id="file-input-upload-aulas" type="file" onChange={handleFileProcess} inputProps={{ accept: '.csv, application/vnd.openxmlformats-officedocument.spreadsheetml.sheet, application/vnd.ms-excel' }} sx={{ display: 'block', mb: 2 }} />
        </Box>
        {loading && <Box sx={{display: 'flex', justifyContent: 'center', my:2}}><CircularProgress /></Box>}
        {showPreview && parsedData.length > 0 && (
          <Box>
            <Typography variant="h6" gutterBottom>Pré-visualização e Validação</Typography>
            <TableContainer component={Paper} sx={{ maxHeight: 440, mb:2 }}>
              <Table stickyHeader aria-label="preview table">
                <TableHead>
                  <TableRow>
                    <TableCell sx={{fontWeight: 'bold', position: 'sticky', left: 0, zIndex: 100, backgroundColor: 'background.paper' }}>Status</TableCell>
                    {columns.map((column) => ( <TableCell key={column.id} sx={{minWidth: column.minWidth, fontWeight: 'bold'}}>{column.label}</TableCell> ))}
                  </TableRow>
                </TableHead>
                <TableBody>
                  {parsedData.map((row, rowIndex) => (
                    <TableRow 
                        key={rowIndex} 
                        sx={{ '&:hover': {backgroundColor: alpha(theme.palette.action.hover, 0.08)}, backgroundColor: row._validation.isValid ? 'inherit' : alpha(theme.palette.error.light, 0.1) }}
                    >
                      <TableCell sx={{position: 'sticky', left: 0, zIndex: 99, backgroundColor: row._validation.isValid ? alpha(theme.palette.background.paper,0.8) : alpha(theme.palette.error.light, 0.1) }}>
                        {row._validation.isValid ? (
                          <Tooltip title="Linha válida"><CheckCircleIcon color="success" /></Tooltip>
                        ) : (
                          <Tooltip title={row._validation.errors.map(e => `${e.field || 'Geral'}: ${e.message}`).join('; ')}>
                            <ErrorIcon color="error" />
                          </Tooltip>
                        )}
                      </TableCell>
                      {columns.map((column) => {
                        const fieldKey = HEADER_TO_FIELD_MAP[column.label];
                        const displayValue = row.rawDataFromSheet?.[column.label] !== undefined ? row.rawDataFromSheet[column.label] : (row[fieldKey] !== undefined ? row[fieldKey] : '');
                        return ( <TableCell key={column.id}>{String(displayValue)}</TableCell> );
                      })}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
            <Button variant="contained" color="primary" onClick={handleActualImport} disabled={loading || parsedData.filter(r => r._validation.isValid).length === 0} sx={{ mt: 2 }}>
              {loading ? <CircularProgress size={24} /> : `Importar ${parsedData.filter(r => r._validation.isValid).length} Aulas Válidas`}
            </Button>
          </Box>
        )}
      </Paper>
      {/* JSX do Snackbar usando o estado 'feedback' */}
      <Snackbar 
        open={feedback.open} 
        autoHideDuration={6000} 
        onClose={handleCloseSnackbar} 
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert onClose={handleCloseSnackbar} severity={feedback.severity} sx={{ width: '100%', whiteSpace: 'pre-line' }}>
          {feedback.message}
        </Alert>
      </Snackbar>
    </Container>
  );
}

export default UploadAulasForm;