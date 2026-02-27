import React, { useState, useEffect, useCallback, useRef } from 'react';
import { db } from './firebaseConfig';
import { collection, query, where, getDocs } from 'firebase/firestore';
import UsageMonitor from './components/UsageMonitor';
import {
    Container,
    Typography,
    Box,
    Paper,
    Grid,
    CircularProgress,
    Alert,
    FormControl,
    InputLabel,
    Select,
    MenuItem,
    Chip,
    OutlinedInput,
    Button
} from '@mui/material';
import { Bar, Pie } from 'react-chartjs-2';
import {
    Chart as ChartJS,
    CategoryScale,
    LinearScale,
    BarElement,
    Title,
    Tooltip,
    Legend,
    ArcElement
} from 'chart.js';
import { LISTA_CURSOS } from './constants/cursos';
import { LISTA_LABORATORIOS } from './constants/laboratorios';
import dayjs from 'dayjs';
import 'dayjs/locale/pt-br';

dayjs.locale('pt-br');
ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend, ArcElement);

const CURSO_COLORS = {
    'biomedicina': 'rgba(76, 175, 80, 0.7)', 'farmacia': 'rgba(244, 67, 54, 0.7)', 'enfermagem': 'rgba(33, 150, 243, 0.7)',
    'odontologia': 'rgba(255, 152, 0, 0.7)', 'medicina': 'rgba(156, 39, 176, 0.7)', 'fisioterapia': 'rgba(255, 193, 7, 0.7)',
    'nutricao': 'rgba(0, 188, 212, 0.7)', 'ed_fisica': 'rgba(121, 85, 72, 0.7)', 'psicologia': 'rgba(233, 30, 99, 0.7)',
    'med_veterinaria': 'rgba(139, 195, 74, 0.7)', 'quimica_tecnologica': 'rgba(96, 125, 139, 0.7)', 'engenharia': 'rgba(158, 158, 158, 0.7)',
    'tec_cosmetico': 'rgba(63, 81, 181, 0.7)', 'default': 'rgba(97, 97, 97, 0.7)'
};

const PIE_CHART_COLORS = ['#42a5f5', '#ab47bc', '#ffa726', '#66bb6a', '#ef5350', '#26c6da', '#78909c'];

function AnaliseAulas() {
    const [propostas, setPropostas] = useState([]);
    const [aulas, setAulas] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    // Estados dos gráficos
    const [chartDataAulasPorEntidade, setChartDataAulasPorEntidade] = useState(null);
    const [chartDataTipoAtividade, setChartDataTipoAtividade] = useState(null);
    const [chartDataPorLaboratorio, setChartDataPorLaboratorio] = useState(null);
    const [chartDataPorDiaSemana, setChartDataPorDiaSemana] = useState(null);
    const [chartDataPorTurno, setChartDataPorTurno] = useState(null);
    const [chartDataPorMes, setChartDataPorMes] = useState(null);
    const [chartDataPropostaAprovacao, setChartDataPropostaAprovacao] = useState(null);

    const [cursosFiltro, setCursosFiltro] = useState([]);
    const [laboratoriosFiltro, setLaboratoriosFiltro] = useState([]);
    const [anoFiltro, setAnoFiltro] = useState(dayjs().year());
    const [tipoConteudo, setTipoConteudo] = useState('todos'); // 'todos' | 'aula' | 'revisao'
    const [anosDisponiveis, setAnosDisponiveis] = useState([]);

    const chartRefs = {
        aulasPorEntidade: useRef(null),
        tipoAtividade: useRef(null),
        porLaboratorio: useRef(null),
        porDiaSemana: useRef(null),
        porTurno: useRef(null),
        porMes: useRef(null),
        propostaAprovacao: useRef(null),
    };

    const fetchAulas = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            // Buscar TODAS as aulas (não só aprovadas)
            let q = collection(db, 'aulas');

            // 1. Filtro por Laboratório (se houver)
            if (laboratoriosFiltro.length > 0) {
                q = query(q, where('laboratorioSelecionado', 'in', laboratoriosFiltro));
            }

            // 2. Filtro por Ano (usando dataInicio)
            if (anoFiltro) {
                const startOfYear = dayjs().year(anoFiltro).startOf('year').toDate();
                const endOfYear = dayjs().year(anoFiltro).endOf('year').toDate();

                // O Firestore exige que a propriedade seja a mesma para todos os filtros de intervalo
                q = query(q, where('dataInicio', '>=', startOfYear), where('dataInicio', '<=', endOfYear));
            }

            const querySnapshot = await getDocs(q);
            let listaCompleta = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

            // 3. Filtro por Curso (feito no frontend devido a limitações de consulta do Firestore)
            if (cursosFiltro.length > 0) {
                listaCompleta = listaCompleta.filter(aula =>
                    aula.cursos && aula.cursos.some(curso => cursosFiltro.includes(curso))
                );
            }

            setPropostas(listaCompleta); // Todas as propostas
            // Filtro de tipo: aula normal, revisão, ou todos
            let aulasAprovadas = listaCompleta.filter(a => a.status === 'aprovada');
            if (tipoConteudo === 'aula') aulasAprovadas = aulasAprovadas.filter(a => !a.isRevisao);
            if (tipoConteudo === 'revisao') aulasAprovadas = aulasAprovadas.filter(a => a.isRevisao === true);
            setAulas(aulasAprovadas);

        } catch (err) {
            console.error("Erro ao buscar aulas para análise:", err);
            setError("Não foi possível carregar os dados para análise.");
        } finally {
            setLoading(false);
        }
    }, [laboratoriosFiltro, cursosFiltro, anoFiltro, tipoConteudo]);

    // Efeito para popular os anos disponíveis (exemplo: 2023, 2024, 2025)
    useEffect(() => {
        const currentYear = dayjs().year();
        const years = [];
        for (let i = currentYear; i >= currentYear - 2; i--) {
            years.push(i);
        }
        setAnosDisponiveis(years);
    }, []);

    useEffect(() => {
        fetchAulas();
    }, [fetchAulas]);

    useEffect(() => {
        if (propostas.length > 0) {
            const countsStatus = {
                'Aprovada': 0,
                'Pendente': 0,
                'Rejeitada': 0
            };

            propostas.forEach(p => {
                const st = p.status ? p.status.charAt(0).toUpperCase() + p.status.slice(1) : 'Indefinido';
                if (countsStatus.hasOwnProperty(st)) {
                    countsStatus[st]++;
                } else {
                    countsStatus['Outros'] = (countsStatus['Outros'] || 0) + 1;
                }
            });

            setChartDataPropostaAprovacao({
                labels: Object.keys(countsStatus).filter(k => countsStatus[k] > 0),
                datasets: [{
                    data: Object.values(countsStatus).filter(v => v > 0),
                    backgroundColor: ['#66bb6a', '#ffa726', '#ef5350', '#bdbdbd']
                }]
            });
        } else {
            setChartDataPropostaAprovacao(null);
        }
    }, [propostas]);

    useEffect(() => {
        if (aulas.length > 0) {
            const counts = {
                aulasPorEntidade: {}, // NOVO: Contador unificado
                tipoAtividade: {},
                porLaboratorio: {},
                porDiaSemana: { 'Domingo': 0, 'Segunda': 0, 'Terça': 0, 'Quarta': 0, 'Quinta': 0, 'Sexta': 0, 'Sábado': 0 },
                porTurno: { 'Matutino': 0, 'Vespertino': 0, 'Noturno': 0, 'Outro': 0 },
                porMes: {}
            };

            aulas.forEach(aula => {
                const cursosDaAula = aula.cursos || [];
                const dataInicio = aula.dataInicio?.toDate ? dayjs(aula.dataInicio.toDate()) : null;

                // --- LÓGICA UNIFICADA PARA O GRÁFICO PRINCIPAL ---
                if (cursosDaAula.length === 1) {
                    const cursoInfo = LISTA_CURSOS.find(c => c.value === cursosDaAula[0]);
                    const cursoLabel = cursoInfo ? cursoInfo.label : cursosDaAula[0];
                    counts.aulasPorEntidade[cursoLabel] = (counts.aulasPorEntidade[cursoLabel] || 0) + 1;
                } else if (cursosDaAula.length > 1) {
                    const combinacaoLabel = cursosDaAula.sort().map(id => LISTA_CURSOS.find(c => c.value === id)?.label || id).join(' & ');
                    counts.aulasPorEntidade[combinacaoLabel] = (counts.aulasPorEntidade[combinacaoLabel] || 0) + 1;
                }
                // --- FIM DA LÓGICA UNIFICADA ---

                const tipo = aula.tipoAtividade || 'Não especificado';
                counts.tipoAtividade[tipo] = (counts.tipoAtividade[tipo] || 0) + 1;

                const lab = aula.laboratorioSelecionado || 'Não especificado';
                counts.porLaboratorio[lab] = (counts.porLaboratorio[lab] || 0) + 1;

                if (dataInicio) {
                    const diaSemana = dataInicio.format('dddd').replace('-feira', '');
                    const diaCapitalizado = diaSemana.charAt(0).toUpperCase() + diaSemana.slice(1);
                    if (counts.porDiaSemana.hasOwnProperty(diaCapitalizado)) {
                        counts.porDiaSemana[diaCapitalizado]++;
                    }

                    const hora = dataInicio.hour();
                    if (hora >= 7 && hora < 12) counts.porTurno['Matutino']++;
                    else if (hora >= 12 && hora < 18) counts.porTurno['Vespertino']++;
                    else if (hora >= 18 && hora < 23) counts.porTurno['Noturno']++;
                    else counts.porTurno['Outro']++;

                    const mes = dataInicio.format('MMMM'); // Nome do mês
                    counts.porMes[mes] = (counts.porMes[mes] || 0) + 1;
                }
            });

            // Gráfico 1: Aulas por Entidade (Cursos e Combinações)
            const sortedAulasPorEntidade = Object.entries(counts.aulasPorEntidade).sort(([, a], [, b]) => a - b);
            const entidadeLabels = sortedAulasPorEntidade.map(([label]) => label);
            const entidadeCores = entidadeLabels.map(label => {
                const primeiroCurso = label.split(' & ')[0];
                const cursoInfo = LISTA_CURSOS.find(c => c.label === primeiroCurso);
                return cursoInfo ? CURSO_COLORS[cursoInfo.value] || CURSO_COLORS.default : CURSO_COLORS.default;
            });
            setChartDataAulasPorEntidade({
                labels: entidadeLabels,
                datasets: [{
                    label: 'Número de Aulas',
                    data: sortedAulasPorEntidade.map(([, count]) => count),
                    backgroundColor: entidadeCores,
                    borderColor: entidadeCores.map(c => c.replace('0.7', '1')),
                    borderWidth: 1,
                }],
            });

            // Outros gráficos permanecem iguais...
            setChartDataTipoAtividade({
                labels: Object.keys(counts.tipoAtividade),
                datasets: [{ data: Object.values(counts.tipoAtividade), backgroundColor: PIE_CHART_COLORS }],
            });

            const sortedLabs = Object.entries(counts.porLaboratorio).sort(([, a], [, b]) => b - a);
            setChartDataPorLaboratorio({
                labels: sortedLabs.map(([label]) => label),
                datasets: [{ data: sortedLabs.map(([, count]) => count), backgroundColor: PIE_CHART_COLORS }],
            });

            setChartDataPorDiaSemana({
                labels: Object.keys(counts.porDiaSemana),
                datasets: [{
                    label: 'Volume por Dia da Semana',
                    data: Object.values(counts.porDiaSemana),
                    backgroundColor: 'rgba(33, 150, 243, 0.7)',
                }],
            });

            setChartDataPorTurno({
                labels: Object.keys(counts.porTurno).filter((_, i) => Object.values(counts.porTurno)[i] > 0),
                datasets: [{ data: Object.values(counts.porTurno).filter(c => c > 0), backgroundColor: PIE_CHART_COLORS }],
            });

            // Gráfico 6: Volume por Mês
            const mesesOrdem = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
            const dadosMes = mesesOrdem.map(mes => counts.porMes[mes] || 0);
            const labelsMes = mesesOrdem.map(mes => mes.charAt(0).toUpperCase() + mes.slice(1));

            setChartDataPorMes({
                labels: labelsMes,
                datasets: [{
                    label: 'Número de Aulas',
                    data: dadosMes,
                    backgroundColor: 'rgba(255, 99, 132, 0.7)',
                    borderColor: 'rgba(255, 99, 132, 1)',
                    borderWidth: 1,
                }],
            });

        } else {
            setChartDataAulasPorEntidade(null);
            setChartDataTipoAtividade(null);
            setChartDataPorLaboratorio(null);
            setChartDataPorDiaSemana(null);
            setChartDataPorTurno(null);
            setChartDataPorMes(null);
        }
    }, [aulas]);

    const createOptions = (title, isHorizontal = false) => ({
        indexAxis: isHorizontal ? 'y' : 'x',
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: false }, title: { display: false } },
        scales: { x: { beginAtZero: true, grace: '5%' }, y: { beginAtZero: true } }
    });

    const createPieOptions = (title) => ({
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
            legend: { position: 'right', labels: { boxWidth: 12, font: { size: 12 } } },
            title: { display: false },
        },
    });

    const handleDownloadChart = (chartRefKey, title) => {
        const chartRef = chartRefs[chartRefKey].current;
        if (chartRef) {
            const link = document.createElement('a');
            link.href = chartRef.toBase64Image('image/png', 1);
            link.download = `${title.replace(/ /g, '_')}_${dayjs().format('YYYY-MM-DD')}.png`;
            link.click();
        }
    };

    const renderChart = (chartData, refKey, title, type) => {
        if (!chartData || chartData.labels.length === 0) return null;

        const ChartComponent = type === 'pie' ? Pie : Bar;
        const options = type === 'pie' ? createPieOptions(title) : createOptions(title, refKey === 'aulasPorEntidade');

        return (
            <Paper elevation={3} sx={{ p: 2, height: '500px', display: 'flex', flexDirection: 'column' }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
                    <Typography variant="h6" component="h3" sx={{ ml: 1, fontSize: '1.1rem' }}>{title}</Typography>
                    <Button size="small" variant="outlined" onClick={() => handleDownloadChart(refKey, title)}>Baixar</Button>
                </Box>
                <Box sx={{ flexGrow: 1, position: 'relative' }}>
                    <ChartComponent ref={chartRefs[refKey]} options={options} data={chartData} />
                </Box>
            </Paper>
        );
    };

    if (loading) { return <Box sx={{ display: 'flex', justifyContent: 'center', mt: 4 }}><CircularProgress /></Box>; }
    if (error) { return <Alert severity="error" sx={{ mt: 4 }}>{error}</Alert>; }

    return (
        <Container maxWidth="xl" sx={{ mt: 4, mb: 4 }}>
            <Typography variant="h4" component="h1" gutterBottom align="center" sx={{ fontWeight: 'bold' }}>
                Dashboard de Análise de Aulas
            </Typography>
            <UsageMonitor />

            <Paper elevation={2} sx={{ p: 2, mb: 4 }}>
                <Typography variant="h6" gutterBottom>Filtros</Typography>
                <Grid container spacing={2}>
                    <Grid item xs={12} sm={4}>
                        <FormControl sx={{ minWidth: 160 }} size="small">
                            <InputLabel shrink>Laboratório(s)</InputLabel>
                            <Select multiple value={laboratoriosFiltro} onChange={(e) => setLaboratoriosFiltro(e.target.value)} input={<OutlinedInput notched label="Laboratório(s)" />} renderValue={(selected) => (<Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>{selected.map((value) => (<Chip key={value} label={value} size="small" />))}</Box>)}>
                                {LISTA_LABORATORIOS.map(l => <MenuItem key={l.id} value={l.name}>{l.name}</MenuItem>)}
                            </Select>
                        </FormControl>
                    </Grid>
                    <Grid item xs={12} sm={4}>
                        <FormControl sx={{ minWidth: 140 }} size="small">
                            <InputLabel shrink>Curso(s)</InputLabel>
                            <Select multiple value={cursosFiltro} onChange={(e) => setCursosFiltro(e.target.value)} input={<OutlinedInput notched label="Curso(s)" />} renderValue={(selected) => (<Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>{selected.map((value) => (<Chip key={value} label={LISTA_CURSOS.find(c => c.value === value)?.label || value} size="small" />))}</Box>)}>
                                {LISTA_CURSOS.map(c => <MenuItem key={c.value} value={c.value}>{c.label}</MenuItem>)}
                            </Select>
                        </FormControl>
                    </Grid>
                    <Grid item xs={12} sm={4}>
                        <FormControl sx={{ minWidth: 140 }} size="small">
                            <InputLabel shrink>Ano</InputLabel>
                            <Select value={anoFiltro} onChange={(e) => setAnoFiltro(e.target.value)} input={<OutlinedInput notched label="Ano" />}>
                                {anosDisponiveis.map(ano => <MenuItem key={ano} value={ano}>{ano}</MenuItem>)}
                            </Select>
                        </FormControl>
                    </Grid>
                    <Grid item xs={12} sm={4}>
                        <FormControl sx={{ minWidth: 160 }} size="small">
                            <InputLabel shrink>Tipo de Conteúdo</InputLabel>
                            <Select value={tipoConteudo} onChange={(e) => setTipoConteudo(e.target.value)} input={<OutlinedInput notched label="Tipo de Conteúdo" />}>
                                <MenuItem value="todos">📅 Todos</MenuItem>
                                <MenuItem value="aula">🎓 Somente Aulas</MenuItem>
                                <MenuItem value="revisao">📖 Somente Revisões</MenuItem>
                            </Select>
                        </FormControl>
                    </Grid>
                </Grid>
            </Paper>

            {propostas.length === 0 ? (
                <Paper elevation={3} sx={{ p: 4, textAlign: 'center' }}>
                    <Typography variant="h6" color="text.secondary">Nenhuma proposta de aula encontrada</Typography>
                    <Typography color="text.secondary">Ajuste os filtros para visualizar os dados.</Typography>
                </Paper>
            ) : (
                <Grid container spacing={3}>
                    {/* NOVO GRÁFICO: Proposta vs. Aprovação */}
                    <Grid item xs={12}>{renderChart(chartDataPropostaAprovacao, 'propostaAprovacao', 'Métrica de Proposta vs. Aprovação', 'pie')}</Grid>

                    {aulas.length > 0 && (
                        <>
                            {/* GRÁFICO PRINCIPAL UNIFICADO */}
                            <Grid item xs={12}>{renderChart(chartDataAulasPorEntidade, 'aulasPorEntidade', 'Volume de Aulas por Curso / Combinação', 'bar')}</Grid>

                            {/* GRÁFICOS SECUNDÁRIOS */}
                            <Grid item xs={12} md={6} lg={4}>{renderChart(chartDataPorLaboratorio, 'porLaboratorio', 'Uso por Laboratório', 'pie')}</Grid>
                            <Grid item xs={12} md={6} lg={4}>{renderChart(chartDataTipoAtividade, 'tipoAtividade', 'Tipos de Atividade', 'pie')}</Grid>
                            <Grid item xs={12} md={6} lg={4}>{renderChart(chartDataPorTurno, 'porTurno', 'Distribuição por Turno', 'pie')}</Grid>
                            <Grid item xs={12}>{renderChart(chartDataPorDiaSemana, 'porDiaSemana', 'Volume por Dia da Semana', 'bar')}</Grid>
                            <Grid item xs={12}>{renderChart(chartDataPorMes, 'porMes', 'Volume de Aulas por Mês', 'bar')}</Grid>
                        </>
                    )}
                    {aulas.length === 0 && (
                        <Grid item xs={12}>
                            <Alert severity="warning">Nenhuma aula aprovada encontrada para gerar os gráficos de uso. O gráfico de Proposta vs. Aprovação está visível.</Alert>
                        </Grid>
                    )}
                </Grid>
            )}
        </Container>
    );
}

export default AnaliseAulas;
