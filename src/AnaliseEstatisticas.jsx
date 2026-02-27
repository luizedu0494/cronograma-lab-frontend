import React, { useState, useEffect } from 'react';
import { db } from './firebaseConfig';
import { collection, query, where, getDocs } from 'firebase/firestore';
import {
    Container, Typography, Box, Paper, CircularProgress, Alert,
    FormControl, InputLabel, Select, MenuItem, Grid, Card, CardContent,
    useTheme
} from '@mui/material';
import { Bar, Pie } from 'react-chartjs-2';
import { Chart as ChartJS, CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend, ArcElement } from 'chart.js';
import dayjs from 'dayjs';

ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend, ArcElement);

const CURRENT_YEAR = dayjs().year();
const YEARS = Array.from({ length: 5 }, (_, i) => CURRENT_YEAR - i);

function AnaliseEstatisticas() {
    const theme = useTheme();
    const [selectedYear, setSelectedYear] = useState(CURRENT_YEAR);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [stats, setStats] = useState(null);

    const fetchData = async (year) => {
        setLoading(true);
        setError(null);
        try {
            const startOfYear = dayjs(`${year}-01-01`).toDate();
            const endOfYear = dayjs(`${year}-12-31`).toDate();

            // 1. Aulas Aprovadas por Mês
            const aulasQuery = query(
                collection(db, 'aulas'),
                where('data', '>=', startOfYear),
                where('data', '<=', endOfYear),
                where('status', '==', 'aprovada')
            );
            const aulasSnapshot = await getDocs(aulasQuery);
            const aulasData = aulasSnapshot.docs.map(doc => doc.data());

            const aulasPorMes = Array(12).fill(0);
            const aulasPorLaboratorio = {};
            const aulasPorCurso = {};

            aulasData.forEach(aula => {
                const mes = dayjs(aula.data.toDate()).month(); // 0-11
                aulasPorMes[mes]++;

                // Estatísticas por Laboratório
                aulasPorLaboratorio[aula.laboratorio] = (aulasPorLaboratorio[aula.laboratorio] || 0) + 1;

                // Estatísticas por Curso
                aulasPorCurso[aula.curso] = (aulasPorCurso[aula.curso] || 0) + 1;
            });

            // 2. Contagem de Usuários (Apenas para o ano atual, pois a coleção 'users' não tem filtro de data)
            let totalUsers = 0;
            if (year === CURRENT_YEAR) {
                const usersQuery = query(collection(db, 'users'));
                const usersSnapshot = await getDocs(usersQuery);
                totalUsers = usersSnapshot.size;
            }

            setStats({
                aulasPorMes,
                aulasPorLaboratorio,
                aulasPorCurso,
                totalUsers,
                totalAulas: aulasData.length
            });

        } catch (err) {
            console.error("Erro ao buscar estatísticas:", err);
            setError("Não foi possível carregar as estatísticas. Verifique sua conexão com o Firebase.");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchData(selectedYear);
    }, [selectedYear]);

    const aulasPorMesChartData = {
        labels: ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'],
        datasets: [
            {
                label: 'Aulas Aprovadas',
                data: stats?.aulasPorMes || [],
                backgroundColor: theme.palette.primary.main,
            },
        ],
    };

    const aulasPorLaboratorioChartData = {
        labels: Object.keys(stats?.aulasPorLaboratorio || {}),
        datasets: [
            {
                label: 'Aulas por Laboratório',
                data: Object.values(stats?.aulasPorLaboratorio || {}),
                backgroundColor: Object.keys(stats?.aulasPorLaboratorio || {}).map((_, i) => theme.palette.chartColors[i % theme.palette.chartColors.length]),
            },
        ],
    };

    const aulasPorCursoChartData = {
        labels: Object.keys(stats?.aulasPorCurso || {}),
        datasets: [
            {
                label: 'Aulas por Curso',
                data: Object.values(stats?.aulasPorCurso || {}),
                backgroundColor: Object.keys(stats?.aulasPorCurso || {}).map((_, i) => theme.palette.chartColors[i % theme.palette.chartColors.length]),
            },
        ],
    };

    if (loading) return (<Container sx={{ textAlign: 'center', mt: 4 }}><CircularProgress /></Container>);
    if (error) return (<Container sx={{ mt: 4 }}><Alert severity="error">{error}</Alert></Container>);

    return (
        <Container maxWidth="xl">
            <Paper elevation={3} sx={{ p: 4, mt: 4 }}>
                <Typography variant="h4" gutterBottom>Análise de Estatísticas Anuais</Typography>

                <FormControl fullWidth size="small" sx={{ maxWidth: 200, mb: 3 }}>
                    <InputLabel id="select-year-label">Ano</InputLabel>
                    <Select
                        labelId="select-year-label"
                        value={selectedYear}
                        label="Ano"
                        onChange={(e) => setSelectedYear(e.target.value)}
                    >
                        {YEARS.map(year => (
                            <MenuItem key={year} value={year}>{year}</MenuItem>
                        ))}
                    </Select>
                </FormControl>

                <Grid container spacing={3}>
                    <Grid item xs={12} sm={6} md={3}>
                        <Card elevation={1}>
                            <CardContent>
                                <Typography variant="h6" color="text.secondary" gutterBottom>Total de Aulas Aprovadas ({selectedYear})</Typography>
                                <Typography variant="h3" color="primary">{stats?.totalAulas || 0}</Typography>
                            </CardContent>
                        </Card>
                    </Grid>
                    {selectedYear === CURRENT_YEAR && (
                        <Grid item xs={12} sm={6} md={3}>
                            <Card elevation={1}>
                                <CardContent>
                                    <Typography variant="h6" color="text.secondary" gutterBottom>Total de Usuários Cadastrados</Typography>
                                    <Typography variant="h3" color="secondary">{stats?.totalUsers || 0}</Typography>
                                </CardContent>
                            </Card>
                        </Grid>
                    )}
                    
                    <Grid item xs={12}>
                        <Paper elevation={1} sx={{ p: 2 }}>
                            <Typography variant="h6" gutterBottom>Aulas Aprovadas por Mês</Typography>
                            <Bar data={aulasPorMesChartData} options={{ responsive: true, plugins: { legend: { position: 'top' } } }} />
                        </Paper>
                    </Grid>

                    <Grid item xs={12} md={6}>
                        <Paper elevation={1} sx={{ p: 2 }}>
                            <Typography variant="h6" gutterBottom>Distribuição por Laboratório</Typography>
                            <Pie data={aulasPorLaboratorioChartData} options={{ responsive: true, plugins: { legend: { position: 'right' } } }} />
                        </Paper>
                    </Grid>

                    <Grid item xs={12} md={6}>
                        <Paper elevation={1} sx={{ p: 2 }}>
                            <Typography variant="h6" gutterBottom>Distribuição por Curso</Typography>
                            <Pie data={aulasPorCursoChartData} options={{ responsive: true, plugins: { legend: { position: 'right' } } }} />
                        </Paper>
                    </Grid>
                </Grid>
            </Paper>
        </Container>
    );
}

export default AnaliseEstatisticas;
