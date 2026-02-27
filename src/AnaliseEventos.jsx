import React, { useState, useEffect, useCallback } from 'react';
import { db } from './firebaseConfig';
import { collection, query, where, getDocs, Timestamp } from 'firebase/firestore';
import {
    Container, Typography, Box, Paper, Grid, CircularProgress, Alert,
    FormControl, InputLabel, Select, MenuItem, Chip, OutlinedInput, Divider
} from '@mui/material';
import { Bar, Pie } from 'react-chartjs-2';
import {
    Chart as ChartJS, CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend, ArcElement
} from 'chart.js';
import { LISTA_LABORATORIOS } from './constants/laboratorios';
import dayjs from 'dayjs';
import 'dayjs/locale/pt-br';

dayjs.locale('pt-br');
ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend, ArcElement);

const EVENT_COLORS = {
    'Manutenção': 'rgba(244, 67, 54, 0.7)',
    'Feriado': 'rgba(255, 152, 0, 0.7)',
    'Evento': 'rgba(33, 150, 243, 0.7)',
    'Giro': 'rgba(156, 39, 176, 0.7)',
    'Outro': 'rgba(96, 125, 139, 0.7)',
    'default': 'rgba(117, 117, 117, 0.7)'
};

const PIE_CHART_COLORS = ['#ef5350', '#ffa726', '#42a5f5', '#ab47bc', '#78909c', '#26c6da', '#66bb6a'];

function AnaliseEventos() {
    const [eventos, setEventos] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    const [laboratoriosFiltro, setLaboratoriosFiltro] = useState([]);
    const [anoFiltro, setAnoFiltro] = useState(dayjs().year());
    const [anosDisponiveis, setAnosDisponiveis] = useState([]);

    const [chartDataPorTipo, setChartDataPorTipo] = useState(null);
    const [chartDataPorLaboratorio, setChartDataPorLaboratorio] = useState(null);
    const [chartDataPorMes, setChartDataPorMes] = useState(null);

    const fetchEventos = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            let q = collection(db, 'eventosManutencao');
            
            const startOfYear = dayjs().year(anoFiltro).startOf('year').toDate();
            const endOfYear = dayjs().year(anoFiltro).endOf('year').toDate();
            
            // Usando query com filtros de data
            const qFiltered = query(q, 
                where('dataInicio', '>=', Timestamp.fromDate(startOfYear)), 
                where('dataInicio', '<=', Timestamp.fromDate(endOfYear))
            );

            const querySnapshot = await getDocs(qFiltered);
            let listaCompleta = querySnapshot.docs.map(doc => {
                const data = doc.data();
                return {
                    id: doc.id,
                    ...data,
                    // Garantir que dataInicio seja um objeto Date para o dayjs
                    dataInicio: data.dataInicio instanceof Timestamp ? data.dataInicio.toDate() : new Date(data.dataInicio)
                };
            });

            if (laboratoriosFiltro.length > 0) {
                listaCompleta = listaCompleta.filter(e => 
                    e.laboratorio === 'Todos' || laboratoriosFiltro.includes(e.laboratorio)
                );
            }

            setEventos(listaCompleta);
        } catch (err) {
            console.error("Erro ao buscar eventos para análise:", err);
            setError("Não foi possível carregar os dados para análise. Verifique se existem eventos cadastrados para este ano.");
        } finally {
            setLoading(false);
        }
    }, [laboratoriosFiltro, anoFiltro]);

    useEffect(() => {
        const currentYear = dayjs().year();
        const years = [];
        for (let i = currentYear; i >= currentYear - 2; i--) {
            years.push(i);
        }
        setAnosDisponiveis(years);
    }, []);

    useEffect(() => {
        fetchEventos();
    }, [fetchEventos]);

    useEffect(() => {
        if (eventos.length > 0) {
            const counts = {
                porTipo: {},
                porLaboratorio: {},
                porMes: {}
            };

            eventos.forEach(evento => {
                const tipo = evento.tipo || 'Outro';
                counts.porTipo[tipo] = (counts.porTipo[tipo] || 0) + 1;

                const lab = evento.laboratorio || 'Todos';
                counts.porLaboratorio[lab] = (counts.porLaboratorio[lab] || 0) + 1;

                const dataInicio = dayjs(evento.dataInicio);
                const mes = dataInicio.format('MMMM');
                counts.porMes[mes] = (counts.porMes[mes] || 0) + 1;
            });

            setChartDataPorTipo({
                labels: Object.keys(counts.porTipo),
                datasets: [{
                    data: Object.values(counts.porTipo),
                    backgroundColor: Object.keys(counts.porTipo).map(t => EVENT_COLORS[t] || EVENT_COLORS.default)
                }]
            });

            const sortedLabs = Object.entries(counts.porLaboratorio).sort(([, a], [, b]) => b - a);
            setChartDataPorLaboratorio({
                labels: sortedLabs.map(([label]) => label),
                datasets: [{
                    label: 'Eventos por Laboratório',
                    data: sortedLabs.map(([, count]) => count),
                    backgroundColor: PIE_CHART_COLORS
                }]
            });

            const mesesOrdenados = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
            const labelsMes = Object.keys(counts.porMes).sort((a, b) => mesesOrdenados.indexOf(a.toLowerCase()) - mesesOrdenados.indexOf(b.toLowerCase()));
            
            setChartDataPorMes({
                labels: labelsMes,
                datasets: [{
                    label: 'Volume de Eventos por Mês',
                    data: labelsMes.map(m => counts.porMes[m]),
                    backgroundColor: 'rgba(75, 192, 192, 0.7)',
                    borderColor: 'rgba(75, 192, 192, 1)',
                    borderWidth: 1
                }]
            });
        } else {
            setChartDataPorTipo(null);
            setChartDataPorLaboratorio(null);
            setChartDataPorMes(null);
        }
    }, [eventos]);

    return (
        <Container maxWidth="lg" sx={{ mt: 4, mb: 4 }}>
            <Box sx={{ mb: 4 }}>
                <Typography variant="h4" fontWeight="bold" gutterBottom>Análise de Eventos</Typography>
                <Typography variant="body1" color="text.secondary">Visualize estatísticas de manutenções, feriados e eventos agendados.</Typography>
            </Box>
            
            <Paper sx={{ p: 3, mb: 4, borderRadius: 2 }}>
                <Grid container spacing={3} alignItems="center">
                    <Grid item xs={12} md={3}>
                        <FormControl sx={{ minWidth: 140 }} size="small">
                            <InputLabel shrink>Ano de Referência</InputLabel>
                            <Select value={anoFiltro} label="Ano de Referência" onChange={(e) => setAnoFiltro(e.target.value)}>
                                {anosDisponiveis.map(year => <MenuItem key={year} value={year}>{year}</MenuItem>)}
                            </Select>
                        </FormControl>
                    </Grid>
                    <Grid item xs={12} md={9}>
                        <FormControl sx={{ minWidth: 160 }} size="small">
                            <InputLabel shrink>Filtrar por Laboratórios</InputLabel>
                            <Select
                                multiple
                                value={laboratoriosFiltro}
                                onChange={(e) => setLaboratoriosFiltro(e.target.value)}
                                input={<OutlinedInput notched label="Filtrar por Laboratórios" />}
                                renderValue={(selected) => (
                                    <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                                        {selected.map((value) => <Chip key={value} label={value} size="small" />)}
                                    </Box>
                                )}
                            >
                                {LISTA_LABORATORIOS.map((lab) => (
                                    <MenuItem key={lab.id} value={lab.name}>{lab.name}</MenuItem>
                                ))}
                            </Select>
                        </FormControl>
                    </Grid>
                </Grid>
            </Paper>

            {loading ? (
                <Box sx={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', my: 10, gap: 2 }}>
                    <CircularProgress />
                    <Typography color="text.secondary">Carregando dados analíticos...</Typography>
                </Box>
            ) : error ? (
                <Alert severity="error" sx={{ borderRadius: 2 }}>{error}</Alert>
            ) : eventos.length === 0 ? (
                <Paper sx={{ p: 5, textAlign: 'center', borderRadius: 2 }}>
                    <Typography variant="h6" color="text.secondary">Nenhum evento encontrado para os filtros selecionados.</Typography>
                    <Typography variant="body2" color="text.secondary">Tente alterar o ano ou os laboratórios selecionados.</Typography>
                </Paper>
            ) : (
                <Grid container spacing={4}>
                    <Grid item xs={12} md={5}>
                        <Paper sx={{ p: 3, height: '100%', borderRadius: 2 }}>
                            <Typography variant="h6" gutterBottom fontWeight="bold">Distribuição por Tipo</Typography>
                            <Divider sx={{ mb: 3 }} />
                            <Box sx={{ maxWidth: '300px', mx: 'auto' }}>
                                {chartDataPorTipo && <Pie data={chartDataPorTipo} options={{ responsive: true, plugins: { legend: { position: 'bottom' } } }} />}
                            </Box>
                        </Paper>
                    </Grid>
                    <Grid item xs={12} md={7}>
                        <Paper sx={{ p: 3, height: '100%', borderRadius: 2 }}>
                            <Typography variant="h6" gutterBottom fontWeight="bold">Eventos por Laboratório</Typography>
                            <Divider sx={{ mb: 3 }} />
                            {chartDataPorLaboratorio && <Bar data={chartDataPorLaboratorio} options={{ indexAxis: 'y', responsive: true, plugins: { legend: { display: false } } }} />}
                        </Paper>
                    </Grid>
                    <Grid item xs={12}>
                        <Paper sx={{ p: 3, borderRadius: 2 }}>
                            <Typography variant="h6" gutterBottom fontWeight="bold">Volume Mensal de Eventos</Typography>
                            <Divider sx={{ mb: 3 }} />
                            {chartDataPorMes && <Bar data={chartDataPorMes} options={{ responsive: true, plugins: { legend: { display: false } }, scales: { y: { beginAtZero: true, ticks: { stepSize: 1 } } } }} />}
                        </Paper>
                    </Grid>
                </Grid>
            )}
        </Container>
    );
}

export default AnaliseEventos;
