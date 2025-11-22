import React from 'react';
import { Box, Card, Typography, Paper, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Chip, Alert, Grid } from '@mui/material';
import {
  Chart as ChartJS, CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend, ArcElement
} from 'chart.js';
import { Bar, Pie } from 'react-chartjs-2';

// Registra componentes do Chart.js
ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend, ArcElement);

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
                    <Typography variant="h6" color={textSecondary} sx={{ mt: 2 }}>Registros</Typography>
                </Card>
            );

        case 'tabela_aulas':
            return <TabelaResultados data={resultado} mode={mode} />;

        case 'grafico_estatisticas':
            return <GraficoResultados data={resultado} mode={mode} />;

        default:
            return <Alert severity="warning">Formato desconhecido.</Alert>;
    }
};

// COMPONENTE DE TABELA
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

// COMPONENTE DE GRÁFICO
const GraficoResultados = ({ data, mode }) => {
    const { labels, valores, tipo_grafico } = data.dados_consulta;
    const colorText = mode === 'dark' ? '#fff' : '#000';

    const chartData = {
        labels,
        datasets: [{
            label: 'Quantidade de Aulas',
            data: valores,
            backgroundColor: [
                'rgba(54, 162, 235, 0.7)',
                'rgba(255, 99, 132, 0.7)',
                'rgba(255, 206, 86, 0.7)',
                'rgba(75, 192, 192, 0.7)',
                'rgba(153, 102, 255, 0.7)',
            ],
            borderColor: 'rgba(54, 162, 235, 1)',
            borderWidth: 1,
        }],
    };

    const options = {
        responsive: true,
        plugins: {
            legend: { labels: { color: colorText } },
            title: { display: true, text: data.titulo, color: colorText }
        },
        scales: {
            y: { ticks: { color: colorText }, grid: { color: mode === 'dark' ? '#444' : '#ddd' } },
            x: { ticks: { color: colorText } }
        }
    };

    return (
        <Paper elevation={4} sx={{ p: 3, mt: 2, bgcolor: mode === 'dark' ? '#1e1e1e' : '#fff', borderRadius: 3 }}>
            <Typography variant="h6" gutterBottom align="center" color="primary">{data.titulo}</Typography>
            <Box sx={{ height: 400, display: 'flex', justifyContent: 'center' }}>
                {tipo_grafico === 'pie' ? <Pie data={chartData} options={options} /> : <Bar data={chartData} options={options} />}
            </Box>
        </Paper>
    );
};

export default FormatadorResultados;