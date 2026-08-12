import React, { useState, useEffect } from 'react';
import {
  Container,
  Paper,
  Box,
  Typography,
  Button,
  Stepper,
  Step,
  StepLabel,
  CircularProgress,
  LinearProgress,
  Chip,
  Alert,
  AlertTitle,
  Divider,
  Stack,
  FormControlLabel,
  Switch,
  Snackbar,
} from '@mui/material';
import CloudUploadIcon from '@mui/icons-material/CloudUpload';
import DownloadIcon from '@mui/icons-material/Download';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import WarningIcon from '@mui/icons-material/Warning';
import ErrorIcon from '@mui/icons-material/Error';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import EventAvailableIcon from '@mui/icons-material/EventAvailable';
import ExcelJS from 'exceljs';
import { saveAs } from 'file-saver';
import { collection, getDocs, writeBatch, doc, addDoc, serverTimestamp, query, where } from 'firebase/firestore';
import { db } from './firebaseConfig';
import { useAuth } from './AuthContext';
import { parseCronogramaExterno } from './utils/parseCronogramaExterno';
import { analisarItensImportados } from './utils/analisarItensImportados';
import ItemRevisaoCard from './components/ItemRevisaoCard';

const ETAPAS = ['Upload do Arquivo', 'Análise de Conflitos', 'Revisão e Confirmação'];

export default function UploadCronogramaExterno() {
  const { usuario, perfil } = useAuth();
  
  const [etapa, setEtapa] = useState(0);
  const [arquivo, setArquivo] = useState(null);
  const [erroUpload, setErroUpload] = useState('');
  
  const [carregandoAnalise, setCarregandoAnalise] = useState(false);
  const [progressoAnalise, setProgressoAnalise] = useState(0);
  const [itensAnalisados, setItensAnalisados] = useState([]);
  const [filtroStatus, setFiltroStatus] = useState('todos');

  const [processandoBatch, setProcessandoBatch] = useState(false);
  const [resultadoFinal, setResultadoFinal] = useState(null);
  const [snackMsg, setSnackMsg] = useState('');

  if (perfil && perfil !== 'coordenador' && perfil !== 'admin') {
    return (
      <Container maxWidth="md" sx={{ mt: 4 }}>
        <Alert severity="error">
          <AlertTitle>Acesso Restrito</AlertTitle>
          Apenas coordenadores possuem permissão para importar cronogramas externos.
        </Alert>
      </Container>
    );
  }

  const baixarModeloTemplate = async () => {
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet('Cronograma');

    ws.columns = [
      { header: 'Data', key: 'data', width: 14 },
      { header: 'Horário Início', key: 'horarioInicio', width: 16 },
      { header: 'Horário Fim', key: 'horarioFim', width: 16 },
      { header: 'Laboratório', key: 'laboratorio', width: 22 },
      { header: 'Disciplina', key: 'disciplina', width: 28 },
      { header: 'Professor', key: 'professor', width: 26 },
      { header: 'Curso', key: 'curso', width: 20 },
      { header: 'Turno', key: 'turno', width: 14 },
      { header: 'Observações', key: 'observacoes', width: 30 },
    ];

    ws.addRow({
      data: '20/08/2026',
      horarioInicio: '07:00',
      horarioFim: '09:10',
      laboratorio: 'Anatomia 1',
      disciplina: 'Anatomia Humana I',
      professor: 'Prof. Dr. Silva',
      curso: 'Medicina',
      turno: 'Matutino',
      observacoes: 'Apresentação de peças sintéticas',
    });

    ws.addRow({
      data: '20/08/2026',
      horarioInicio: '09:30',
      horarioFim: '12:00',
      laboratorio: 'Microscopia 1',
      disciplina: 'Histologia Geral',
      professor: 'Profa. Dra. Oliveira',
      curso: 'Biomedicina',
      turno: 'Matutino',
      observacoes: 'Lâminas de tecido epitelial',
    });

    const buffer = await wb.xlsx.writeBuffer();
    saveAs(new Blob([buffer]), 'modelo_importacao_cronolab.xlsx');
  };

  const handleFileChange = (e) => {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;

    if (selectedFile.name.endsWith('.doc') && !selectedFile.name.endsWith('.docx')) {
      setErroUpload('FORMATO_DOC_ANTIGO');
      setArquivo(null);
      return;
    }

    setErroUpload('');
    setArquivo(selectedFile);
  };

  const iniciarAnalise = async () => {
    if (!arquivo) return;

    setCarregandoAnalise(true);
    setEtapa(1);
    setProgressoAnalise(15);

    try {
      const itensBrutos = await parseCronogramaExterno(arquivo);
      setProgressoAnalise(40);

      if (itensBrutos.length === 0) {
        setErroUpload('Nenhum item válido ou reconhecido foi encontrado no arquivo.');
        setEtapa(0);
        setCarregandoAnalise(false);
        return;
      }

      const [aulasSnap, periodosSnap] = await Promise.all([
        getDocs(collection(db, 'aulas')),
        getDocs(collection(db, 'periodos_academicos')).catch(() => ({ docs: [] })),
      ]);

      const aulasExistentes = aulasSnap.docs.map(d => ({ id: d.id, ...d.data() }));
      const periodosAtivos = periodosSnap.docs ? periodosSnap.docs.map(d => d.data()) : [];
      
      setProgressoAnalise(70);

      const contexto = {
        aulasExistentes,
        periodosAtivos,
        feriados: [],
      };

      const resultado = await analisarItensImportados(itensBrutos, contexto);
      setProgressoAnalise(100);

      setItensAnalisados(resultado);
      setEtapa(2);
    } catch (err) {
      console.error('Erro na análise de arquivo:', err);
      if (err.message === 'FORMATO_DOC_ANTIGO') {
        setErroUpload('FORMATO_DOC_ANTIGO');
      } else {
        setErroUpload(`Erro ao processar arquivo: ${err.message}`);
      }
      setEtapa(0);
    } finally {
      setCarregandoAnalise(false);
    }
  };

  const toggleItemSelecionado = (idTemp) => {
    setItensAnalisados(prev =>
      prev.map(item => item.idTemp === idTemp ? { ...item, selecionado: !item.selecionado } : item)
    );
  };

  const selecionarTodosValidos = (marcar) => {
    setItensAnalisados(prev =>
      prev.map(item => item.status !== 'invalido' ? { ...item, selecionado: marcar } : item)
    );
  };

  const contagem = {
    total: itensAnalisados.length,
    validos: itensAnalisados.filter(i => i.status === 'valido').length,
    atencao: itensAnalisados.filter(i => i.status === 'atencao').length,
    conflitos: itensAnalisados.filter(i => i.status === 'conflito').length,
    invalidos: itensAnalisados.filter(i => i.status === 'invalido').length,
    selecionados: itensAnalisados.filter(i => i.selecionado).length,
  };

  const itensFiltrados = itensAnalisados.filter(item => {
    if (filtroStatus === 'todos') return true;
    return item.status === filtroStatus;
  });

  const agendarItensSelecionados = async () => {
    const paraAgendar = itensAnalisados.filter(i => i.selecionado && i.normalizado);
    if (paraAgendar.length === 0) return;

    setProcessandoBatch(true);

    try {
      const tamanhoBatch = 400;
      let agendadosSucesso = 0;
      let errosCount = 0;

      for (let i = 0; i < paraAgendar.length; i += tamanhoBatch) {
        const chunk = paraAgendar.slice(i, i + tamanhoBatch);
        const batch = writeBatch(db);

        chunk.forEach(item => {
          const docRef = doc(collection(db, 'aulas'));
          batch.set(docRef, {
            ...item.normalizado,
            criadoPor: usuario?.uid || 'coordenador',
            criadoEm: serverTimestamp(),
            origem: 'importacao_externa',
            nomeArquivoOrigem: arquivo?.name || 'desconhecido',
          });
        });

        await batch.commit();
        agendadosSucesso += chunk.length;
      }

      await addDoc(collection(db, 'logs_importacao'), {
        coordenadorUid: usuario?.uid || 'coordenador',
        coordenadorEmail: usuario?.email || 'desconhecido',
        nomeArquivo: arquivo?.name || '',
        totalNoArquivo: itensAnalisados.length,
        totalAgendados: agendadosSucesso,
        timestamp: serverTimestamp(),
      });

      setResultadoFinal({
        sucesso: true,
        agendados: agendadosSucesso,
      });

      setSnackMsg(`${agendadosSucesso} aula(s) agendada(s) com sucesso!`);
    } catch (err) {
      console.error('Erro ao agendar em lote:', err);
      setResultadoFinal({
        sucesso: false,
        erroMsg: err.message,
      });
    } finally {
      setProcessandoBatch(false);
    }
  };

  return (
    <Container maxWidth="lg" sx={{ mt: 4, mb: 8 }}>
      <Paper elevation={3} sx={{ p: 4, borderRadius: 2 }}>
        <Typography variant="h4" fontWeight={700} color="primary" gutterBottom>
          📥 Importar Cronograma Externo
        </Typography>
        <Typography variant="body1" color="text.secondary" sx={{ mb: 4 }}>
          Upload e análise inteligente de cronogramas em formato <strong>Excel (.xlsx)</strong>, <strong>Word (.docx)</strong>, <strong>CSV</strong> ou <strong>JSON</strong>.
        </Typography>

        <Stepper activeStep={etapa} sx={{ mb: 4 }}>
          {ETAPAS.map((label) => (
            <Step key={label}>
              <StepLabel>{label}</StepLabel>
            </Step>
          ))}
        </Stepper>

        {etapa === 0 && (
          <Box>
            {erroUpload === 'FORMATO_DOC_ANTIGO' && (
              <Alert severity="warning" sx={{ mb: 3 }}>
                <AlertTitle>Formato .doc (Word antigo) não suportado diretamente</AlertTitle>
                Por favor, abra o arquivo no Word e salve-o como <strong>.docx</strong> (Arquivo → Salvar como → Documento do Word (.docx)) antes de importar.
              </Alert>
            )}

            {erroUpload && erroUpload !== 'FORMATO_DOC_ANTIGO' && (
              <Alert severity="error" sx={{ mb: 3 }}>
                {erroUpload}
              </Alert>
            )}

            <Paper
              variant="outlined"
              sx={{
                p: 5,
                textAlign: 'center',
                borderStyle: 'dashed',
                borderWidth: 2,
                borderColor: arquivo ? 'primary.main' : 'grey.400',
                bgcolor: arquivo ? 'rgba(25, 118, 210, 0.02)' : 'background.paper',
                borderRadius: 2,
                cursor: 'pointer',
                transition: 'all 0.2s',
                '&:hover': { borderColor: 'primary.main', bgcolor: 'rgba(25, 118, 210, 0.04)' }
              }}
              component="label"
            >
              <input
                type="file"
                hidden
                accept=".xlsx,.xls,.docx,.csv,.json,.doc"
                onChange={handleFileChange}
              />
              <CloudUploadIcon sx={{ fontSize: 60, color: arquivo ? 'primary.main' : 'action.active', mb: 2 }} />
              <Typography variant="h6" fontWeight={600}>
                {arquivo ? arquivo.name : 'Clique ou arraste o arquivo do cronograma aqui'}
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                Suporta .xlsx, .docx, .csv e .json
              </Typography>
            </Paper>

            <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mt: 4 }}>
              <Button
                variant="outlined"
                startIcon={<DownloadIcon />}
                onClick={baixarModeloTemplate}
              >
                Baixar Modelo Excel (.xlsx)
              </Button>

              <Button
                variant="contained"
                size="large"
                disabled={!arquivo}
                onClick={iniciarAnalise}
              >
                Analisar Cronograma
              </Button>
            </Stack>
          </Box>
        )}

        {etapa === 1 && carregandoAnalise && (
          <Box sx={{ py: 8, textAlign: 'center' }}>
            <CircularProgress size={60} sx={{ mb: 3 }} />
            <Typography variant="h6" fontWeight={600}>
              Analisando itens e checando conflitos no sistema...
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 4 }}>
              Verificando laboratórios, feriados e disponibilidade de horários.
            </Typography>
            <Box sx={{ width: '80%', mx: 'auto' }}>
              <LinearProgress variant="determinate" value={progressoAnalise} height={10} sx={{ borderRadius: 5 }} />
            </Box>
          </Box>
        )}

        {etapa === 2 && (
          <Box>
            {resultadoFinal ? (
              <Box sx={{ textAlign: 'center', py: 4 }}>
                {resultadoFinal.sucesso ? (
                  <>
                    <CheckCircleIcon sx={{ fontSize: 70, color: 'success.main', mb: 2 }} />
                    <Typography variant="h5" fontWeight={700} color="success.main" gutterBottom>
                      Agendamento Concluído com Sucesso!
                    </Typography>
                    <Typography variant="body1" sx={{ mb: 4 }}>
                      <strong>{resultadoFinal.agendados}</strong> aula(s) foram cadastradas no sistema.
                    </Typography>
                    <Button variant="contained" onClick={() => { setEtapa(0); setArquivo(null); setResultadoFinal(null); }}>
                      Importar Outro Cronograma
                    </Button>
                  </>
                ) : (
                  <>
                    <ErrorIcon sx={{ fontSize: 70, color: 'error.main', mb: 2 }} />
                    <Typography variant="h5" fontWeight={700} color="error.main" gutterBottom>
                      Erro no Agendamento
                    </Typography>
                    <Typography variant="body1" color="error" sx={{ mb: 4 }}>
                      {resultadoFinal.erroMsg}
                    </Typography>
                    <Button variant="outlined" onClick={() => setResultadoFinal(null)}>
                      Tentar Novamente
                    </Button>
                  </>
                )}
              </Box>
            ) : (
              <>
                <Box sx={{ display: 'flex', gap: 1, mb: 3, flexWrap: 'wrap', alignItems: 'center' }}>
                  <Chip
                    icon={<CheckCircleIcon />}
                    label={`${contagem.validos} Válidos`}
                    color="success"
                    variant={filtroStatus === 'valido' ? 'filled' : 'outlined'}
                    onClick={() => setFiltroStatus(filtroStatus === 'valido' ? 'todos' : 'valido')}
                  />
                  <Chip
                    icon={<WarningIcon />}
                    label={`${contagem.atencao} Atenção`}
                    color="warning"
                    variant={filtroStatus === 'atencao' ? 'filled' : 'outlined'}
                    onClick={() => setFiltroStatus(filtroStatus === 'atencao' ? 'todos' : 'atencao')}
                  />
                  <Chip
                    icon={<ErrorIcon />}
                    label={`${contagem.conflitos} Conflitos`}
                    color="error"
                    variant={filtroStatus === 'conflito' ? 'filled' : 'outlined'}
                    onClick={() => setFiltroStatus(filtroStatus === 'conflito' ? 'todos' : 'conflito')}
                  />
                  <Chip
                    label={`${contagem.invalidos} Inválidos`}
                    variant={filtroStatus === 'invalido' ? 'filled' : 'outlined'}
                    onClick={() => setFiltroStatus(filtroStatus === 'invalido' ? 'todos' : 'invalido')}
                  />

                  <Box sx={{ flexGrow: 1 }} />

                  <FormControlLabel
                    control={
                      <Switch
                        checked={contagem.selecionados > 0}
                        onChange={(e) => selecionarTodosValidos(e.target.checked)}
                      />
                    }
                    label="Selecionar Todos Válidos"
                  />
                </Box>

                <Divider sx={{ mb: 3 }} />

                <Box sx={{ maxHeight: 520, overflowY: 'auto', pr: 1, mb: 4 }}>
                  {itensFiltrados.map((item) => (
                    <ItemRevisaoCard
                      key={item.idTemp}
                      item={item}
                      onToggle={() => toggleItemSelecionado(item.idTemp)}
                    />
                  ))}
                </Box>

                <Paper
                  elevation={4}
                  sx={{
                    p: 2.5,
                    bgcolor: 'background.paper',
                    borderRadius: 2,
                    display: 'flex',
                    alignItems: 'center',
                    justify: 'space-between',
                  }}
                >
                  <Button
                    startIcon={<ArrowBackIcon />}
                    onClick={() => setEtapa(0)}
                  >
                    Voltar / Trocar Arquivo
                  </Button>

                  <Typography variant="subtitle1" fontWeight={700}>
                    {contagem.selecionados} de {contagem.total} itens selecionados
                  </Typography>

                  <Button
                    variant="contained"
                    size="large"
                    color="primary"
                    startIcon={<EventAvailableIcon />}
                    disabled={contagem.selecionados === 0 || processandoBatch}
                    onClick={agendarItensSelecionados}
                  >
                    {processandoBatch ? <CircularProgress size={24} color="inherit" /> : `Agendar ${contagem.selecionados} Item(ns)`}
                  </Button>
                </Paper>
              </>
            )}
          </Box>
        )}
      </Paper>

      <Snackbar
        open={Boolean(snackMsg)}
        autoHideDuration={4000}
        onClose={() => setSnackMsg('')}
        message={snackMsg}
      />
    </Container>
  );
}
