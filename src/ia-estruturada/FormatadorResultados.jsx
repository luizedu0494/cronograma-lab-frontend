import React, { useRef } from 'react';
import { Box, Card, Typography, Paper, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Chip, Alert, IconButton, Tooltip } from '@mui/material';
import { Download } from '@mui/icons-material';
import {
  Chart as ChartJS, CategoryScale, LinearScale, BarElement, Title, Tooltip as ChartTooltip, Legend, ArcElement, PointElement, LineElement
} from 'chart.js';
import { Bar, Pie, Line } from 'react-chartjs-2';

// Registra componentes do Chart.js
ChartJS.register(CategoryScale, LinearScale, BarElement, Title, ChartTooltip, Legend, ArcElement, PointElement, LineElement);

const FormatadorResultados = ({ resultado, mode }) => {
    if (!resultado) return null;
    if (resultado.erro) return <Alert severity="error">{resultado.erro}</Alert>;
    if (resultado.tipo === 'aviso_acao') return <Alert severity="success" sx={{mt: 2}}>{resultado.mensagem}</Alert>;

    const bgCard = mode === 'dark' ? '#1e1e1e' : '#fff';
    const textSecondary = mode === 'dark' ? '#aaa' : '#666';

    switch (resultado.tipo) {
        case 'kpi_numero':
            return (
                <Card elevation={6} sx={{ textAlign: 'center', p: 5, borderRadius: 4, bgcolor: bgCard, maxWidth: 450, mx: 'auto' }}>
                    <Typography variant="h6" color={textSecondary} gutterBottom textTransform="uppercase" letterSpacing={1}>
                        {resultado.descricao}
                    </Typography>
                    <Typography variant="h1" fontWeight="900" color="primary" sx={{ fontSize: '6rem', lineHeight: 1 }}>
                        {resultado.valor}
                    </Typography>
                    <Typography variant="h6" color="text.secondary" sx={{ mt: 2 }}>{resultado.titulo}</Typography>
                </Card>
            );

        case 'tabela_aulas':
            return <TabelaResultados data={resultado} mode={mode} />;

        case 'grafico_estatisticas':
        case 'grafico_linha':
            return <GraficoResultados data={resultado} mode={mode} />;

        default:
            return <Alert severity="warning">Formato desconhecido.</Alert>;
    }
};

const TabelaResultados = ({ data, mode }) => {
    const rows = data.dados_consulta || [];
    if (!rows.length) return <Alert severity="info">Nenhum dado encontrado.</Alert>;

    return (
        <Paper elevation={3} sx={{ borderRadius: 3, overflow: 'hidden', mt: 2 }}>
            <Box sx={{ p: 2, bgcolor: 'primary.main', color: '#fff' }}>
                <Typography variant="h6">{data.titulo}</Typography>
            </Box>
            <TableContainer sx={{ maxHeight: 500 }}>
                <Table stickyHeader>
                    <TableHead>
                        <TableRow>
                            <TableCell>Data</TableCell>
                            <TableCell>Horário</TableCell>
                            <TableCell>Assunto</TableCell>
                            <TableCell>Laboratório</TableCell>
                            <TableCell>Cursos</TableCell>
                        </TableRow>
                    </TableHead>
                    <TableBody>
                        {rows.map((row, i) => (
                            <TableRow key={i} hover>
                                <TableCell>{row.data}</TableCell>
                                <TableCell>{row.horario}</TableCell>
                                <TableCell sx={{fontWeight: 'bold'}}>{row.assunto}</TableCell>
                                <TableCell>{row.laboratorio}</TableCell>
                                <TableCell>{row.cursos?.join(', ')}</TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </TableContainer>
        </Paper>
    );
};

// --- COMPONENTE DE GRÁFICO COM DOWNLOAD ---
const GraficoResultados = ({ data, mode }) => {
    const chartRef = useRef(null); // Referência para o gráfico
    const { labels, valores, tipo_grafico } = data.dados_consulta;
    const colorText = mode === 'dark' ? '#fff' : '#000';

    // Função de Download
    const handleDownload = () => {
        if (chartRef.current) {
            const link = document.createElement('a');
            link.download = `${data.titulo || 'grafico'}.png`;
            link.href = chartRef.current.toBase64Image();
            link.click();
        }
    };

    const chartData = {
        labels,
        datasets: [{
            label: 'Dados',
            data: valores,
            backgroundColor: [
                'rgba(33, 150, 243, 0.7)', 'rgba(255, 87, 34, 0.7)', 'rgba(76, 175, 80, 0.7)',
                'rgba(255, 193, 7, 0.7)', 'rgba(156, 39, 176, 0.7)'
            ],
            borderColor: 'rgba(33, 150, 243, 1)',
            borderWidth: 2,
            tension: 0.3,
            fill: tipo_grafico === 'line'
        }],
    };

    const options = {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
            legend: { labels: { color: colorText } },
            title: { display: false } // Título já está no header do card
        },
        scales: {
            y: { ticks: { color: colorText }, grid: { color: mode === 'dark' ? '#444' : '#ddd' } },
            x: { ticks: { color: colorText } }
        }
    };

    return (
        <Paper elevation={4} sx={{ p: 3, mt: 2, bgcolor: mode === 'dark' ? '#1e1e1e' : '#fff', borderRadius: 3 }}>
            {/* Header com Título e Botão de Download */}
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                <Typography variant="h6" color="primary" fontWeight="bold">
                    {data.titulo}
                </Typography>
                <Tooltip title="Baixar Gráfico">
                    <IconButton onClick={handleDownload} color="primary">
                        <Download />
                    </IconButton>
                </Tooltip>
            </Box>

            <Box sx={{ height: 400, width: '100%', display: 'flex', justifyContent: 'center' }}>
                {tipo_grafico === 'pie' ? <Pie ref={chartRef} data={chartData} options={options} /> : 
                 tipo_grafico === 'line' ? <Line ref={chartRef} data={chartData} options={options} /> : 
                 <Bar ref={chartRef} data={chartData} options={options} />}
            </Box>
        </Paper>
    );
};

export default FormatadorResultados;