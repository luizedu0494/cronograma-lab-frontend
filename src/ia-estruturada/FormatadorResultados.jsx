/**
 * FormatadorResultados.jsx
 * 
 * Componente responsável por renderizar os resultados de forma estruturada e visual.
 * Suporta diferentes tipos de visualização: cards, tabelas, gráficos e confirmações.
 */

import React from 'react';
import {
  Box, Card, CardContent, Typography, Table, TableBody, TableCell,
  TableContainer, TableHead, TableRow, Paper, Chip, Alert, Grid,
  Divider, List, ListItem, ListItemText, ListItemIcon
} from '@mui/material';
import {
  Event, AccessTime, Science, CheckCircle, Error as ErrorIcon,
  School, TrendingUp
} from '@mui/icons-material';
import { Bar } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend
} from 'chart.js';

ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend
);

const FormatadorResultados = ({ resultado, mode }) => {
  if (!resultado) {
    return null;
  }

  // Se houver erro, exibe mensagem de erro
  if (resultado.erro) {
    return (
      <Box sx={{ mt: 3 }}>
        <Alert severity="error" icon={<ErrorIcon />}>
          <Typography variant="h6" gutterBottom>Erro no Processamento</Typography>
          <Typography variant="body1">{resultado.erro}</Typography>
          {resultado.sugestao && (
            <Typography variant="body2" sx={{ mt: 1, fontStyle: 'italic' }}>
              💡 {resultado.sugestao}
            </Typography>
          )}
        </Alert>
      </Box>
    );
  }

  const { tipo } = resultado;

  switch (tipo) {
    case 'card_resumo':
      return <CardResumo resultado={resultado} mode={mode} />;
    
    case 'tabela_aulas':
      return <TabelaAulas resultado={resultado} mode={mode} />;
    
    case 'grafico_estatisticas':
      return <GraficoEstatisticas resultado={resultado} mode={mode} />;
    
    case 'confirmacao_acao':
      return <ConfirmacaoAcao resultado={resultado} mode={mode} />;
    
    default:
      return <ResultadoGenerico resultado={resultado} mode={mode} />;
  }
};

/**
 * Card de Resumo - Para consultas de quantidade/estatísticas
 */
const CardResumo = ({ resultado, mode }) => {
  const { titulo, dados_consulta } = resultado;

  return (
    <Box sx={{ mt: 3 }}>
      <Typography variant="h5" gutterBottom fontWeight="bold" color="primary">
        {titulo || 'Resumo da Consulta'}
      </Typography>
      
      <Grid container spacing={3} sx={{ mt: 1 }}>
        <Grid item xs={12} md={4}>
          <Card elevation={3} sx={{ height: '100%', backgroundColor: mode === 'dark' ? '#1e1e1e' : '#fff' }}>
            <CardContent sx={{ textAlign: 'center' }}>
              <Event color="primary" sx={{ fontSize: 48, mb: 2 }} />
              <Typography variant="h3" color="primary" fontWeight="bold">
                {dados_consulta?.total_aulas || 0}
              </Typography>
              <Typography variant="body1" color="text.secondary" sx={{ mt: 1 }}>
                Total de Aulas
              </Typography>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} md={4}>
          <Card elevation={3} sx={{ height: '100%', backgroundColor: mode === 'dark' ? '#1e1e1e' : '#fff' }}>
            <CardContent sx={{ textAlign: 'center' }}>
              <AccessTime color="secondary" sx={{ fontSize: 48, mb: 2 }} />
              <Typography variant="body1" fontWeight="bold" sx={{ minHeight: 60, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                {dados_consulta?.proxima_aula || 'Nenhuma aula agendada'}
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                Próxima Aula
              </Typography>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} md={4}>
          <Card elevation={3} sx={{ height: '100%', backgroundColor: mode === 'dark' ? '#1e1e1e' : '#fff' }}>
            <CardContent sx={{ textAlign: 'center' }}>
              <Science color="success" sx={{ fontSize: 48, mb: 2 }} />
              <Typography variant="h6" fontWeight="bold" sx={{ minHeight: 60, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                {dados_consulta?.laboratorio_mais_usado || 'N/A'}
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                Laboratório Mais Utilizado
              </Typography>
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </Box>
  );
};

/**
 * Tabela de Aulas - Para listagem detalhada
 */
const TabelaAulas = ({ resultado, mode }) => {
  const { titulo, dados_consulta } = resultado;

  if (!dados_consulta || dados_consulta.length === 0) {
    return (
      <Box sx={{ mt: 3 }}>
        <Alert severity="info">
          Nenhuma aula encontrada com os critérios especificados.
        </Alert>
      </Box>
    );
  }

  return (
    <Box sx={{ mt: 3 }}>
      <Typography variant="h5" gutterBottom fontWeight="bold" color="primary">
        {titulo || 'Lista de Aulas'}
      </Typography>
      
      <TableContainer component={Paper} elevation={3} sx={{ mt: 2, backgroundColor: mode === 'dark' ? '#1e1e1e' : '#fff' }}>
        <Table>
          <TableHead>
            <TableRow sx={{ backgroundColor: mode === 'dark' ? '#2d2d2d' : '#f5f5f5' }}>
              <TableCell><strong>Assunto</strong></TableCell>
              <TableCell><strong>Data</strong></TableCell>
              <TableCell><strong>Horário</strong></TableCell>
              <TableCell><strong>Laboratório</strong></TableCell>
              <TableCell><strong>Cursos</strong></TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {dados_consulta.map((aula, index) => (
              <TableRow 
                key={aula.id || index}
                sx={{ 
                  '&:hover': { backgroundColor: mode === 'dark' ? '#2a2a2a' : '#f9f9f9' },
                  '&:last-child td, &:last-child th': { border: 0 }
                }}
              >
                <TableCell>
                  <Typography variant="body1" fontWeight="medium">
                    {aula.assunto}
                  </Typography>
                </TableCell>
                <TableCell>
                  <Chip 
                    icon={<Event />} 
                    label={aula.data} 
                    size="small" 
                    color="primary" 
                    variant="outlined" 
                  />
                </TableCell>
                <TableCell>
                  <Chip 
                    icon={<AccessTime />} 
                    label={aula.horario} 
                    size="small" 
                    color="secondary" 
                    variant="outlined" 
                  />
                </TableCell>
                <TableCell>
                  <Chip 
                    icon={<Science />} 
                    label={aula.laboratorio} 
                    size="small" 
                  />
                </TableCell>
                <TableCell>
                  <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                    {aula.cursos && aula.cursos.length > 0 ? (
                      aula.cursos.map((curso, i) => (
                        <Chip 
                          key={i} 
                          label={curso} 
                          size="small" 
                          icon={<School />}
                          sx={{ fontSize: '0.75rem' }}
                        />
                      ))
                    ) : (
                      <Typography variant="caption" color="text.secondary">-</Typography>
                    )}
                  </Box>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>
    </Box>
  );
};

/**
 * Gráfico de Estatísticas - Para análises visuais
 */
const GraficoEstatisticas = ({ resultado, mode }) => {
  const { titulo, dados_consulta } = resultado;

  if (!dados_consulta || !dados_consulta.labels || !dados_consulta.valores) {
    return (
      <Box sx={{ mt: 3 }}>
        <Alert severity="warning">
          Dados insuficientes para gerar gráfico.
        </Alert>
      </Box>
    );
  }

  const chartData = {
    labels: dados_consulta.labels,
    datasets: [
      {
        label: 'Número de Aulas',
        data: dados_consulta.valores,
        backgroundColor: 'rgba(63, 81, 181, 0.6)',
        borderColor: 'rgba(63, 81, 181, 1)',
        borderWidth: 2
      }
    ]
  };

  const options = {
    responsive: true,
    plugins: {
      legend: {
        position: 'top',
        labels: {
          color: mode === 'dark' ? '#fff' : '#000'
        }
      },
      title: {
        display: false
      }
    },
    scales: {
      y: {
        beginAtZero: true,
        ticks: {
          color: mode === 'dark' ? '#fff' : '#000'
        },
        grid: {
          color: mode === 'dark' ? '#333' : '#e0e0e0'
        }
      },
      x: {
        ticks: {
          color: mode === 'dark' ? '#fff' : '#000'
        },
        grid: {
          color: mode === 'dark' ? '#333' : '#e0e0e0'
        }
      }
    }
  };

  return (
    <Box sx={{ mt: 3 }}>
      <Typography variant="h5" gutterBottom fontWeight="bold" color="primary">
        <TrendingUp sx={{ mr: 1, verticalAlign: 'middle' }} />
        {titulo || 'Estatísticas'}
      </Typography>
      
      <Paper elevation={3} sx={{ p: 3, mt: 2, backgroundColor: mode === 'dark' ? '#1e1e1e' : '#fff' }}>
        <Bar data={chartData} options={options} />
      </Paper>
    </Box>
  );
};

/**
 * Confirmação de Ação - Para adicionar/editar/excluir
 */
const ConfirmacaoAcao = ({ resultado, mode }) => {
  const { acao, status, mensagem, dados_afetados } = resultado;

  const isSuccess = status === 'sucesso';
  const severity = isSuccess ? 'success' : 'error';
  const icon = isSuccess ? <CheckCircle /> : <ErrorIcon />;

  return (
    <Box sx={{ mt: 3 }}>
      <Alert severity={severity} icon={icon}>
        <Typography variant="h6" gutterBottom>
          {acao === 'adicionar' && 'Aula Adicionada'}
          {acao === 'editar' && 'Aula Editada'}
          {acao === 'excluir' && 'Aula Excluída'}
        </Typography>
        <Typography variant="body1">{mensagem}</Typography>
      </Alert>

      {dados_afetados && (
        <Card elevation={3} sx={{ mt: 2, backgroundColor: mode === 'dark' ? '#1e1e1e' : '#fff' }}>
          <CardContent>
            <Typography variant="h6" gutterBottom color="primary">
              Detalhes da Operação
            </Typography>
            <Divider sx={{ mb: 2 }} />
            
            <List dense>
              {dados_afetados.assunto && (
                <ListItem>
                  <ListItemIcon>
                    <School color="primary" />
                  </ListItemIcon>
                  <ListItemText 
                    primary="Assunto" 
                    secondary={dados_afetados.assunto}
                  />
                </ListItem>
              )}
              
              {dados_afetados.data && (
                <ListItem>
                  <ListItemIcon>
                    <Event color="primary" />
                  </ListItemIcon>
                  <ListItemText 
                    primary="Data" 
                    secondary={dados_afetados.data}
                  />
                </ListItem>
              )}
              
              {dados_afetados.total_aulas_adicionadas && (
                <ListItem>
                  <ListItemIcon>
                    <CheckCircle color="success" />
                  </ListItemIcon>
                  <ListItemText 
                    primary="Total de Aulas Adicionadas" 
                    secondary={dados_afetados.total_aulas_adicionadas}
                  />
                </ListItem>
              )}

              {dados_afetados.alteracoes && (
                <ListItem>
                  <ListItemIcon>
                    <CheckCircle color="success" />
                  </ListItemIcon>
                  <ListItemText 
                    primary="Campos Alterados" 
                    secondary={dados_afetados.alteracoes.join(', ')}
                  />
                </ListItem>
              )}
            </List>
          </CardContent>
        </Card>
      )}
    </Box>
  );
};

/**
 * Resultado Genérico - Fallback para tipos não especificados
 */
const ResultadoGenerico = ({ resultado, mode }) => {
  return (
    <Box sx={{ mt: 3 }}>
      <Paper elevation={3} sx={{ p: 3, backgroundColor: mode === 'dark' ? '#1e1e1e' : '#fff' }}>
        <Typography variant="body1" sx={{ whiteSpace: 'pre-wrap' }}>
          {resultado.resposta || JSON.stringify(resultado, null, 2)}
        </Typography>
      </Paper>
    </Box>
  );
};

export default FormatadorResultados;
