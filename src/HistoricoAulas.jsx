
import React, { useState, useEffect } from 'react';
import { db } from './firebaseConfig';
import { collection, query, orderBy, limit, getDocs } from 'firebase/firestore';
import {
    Container, Paper, Typography, Box, CircularProgress, Alert,
    Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
    TablePagination, TextField, Grid, Chip, Button, Select, MenuItem, FormControl, InputLabel
} from '@mui/material';
import { useTheme } from '@mui/material/styles';
import { History, Search, RefreshCw, Filter, X } from 'lucide-react';
import dayjs from 'dayjs';
import 'dayjs/locale/pt-br';

dayjs.locale('pt-br');

const HistoricoAulas = () => {
    const theme = useTheme();
    const [logs, setLogs] = useState([]);
    const [logsFiltered, setLogsFiltered] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    // Paginação
    const [page, setPage] = useState(0);
    const [rowsPerPage, setRowsPerPage] = useState(10);

    // Filtros
    const [filtroNome, setFiltroNome] = useState('');
    const [filtroCurso, setFiltroCurso] = useState('');
    const [filtroAno, setFiltroAno] = useState('');
    const [filtroStatus, setFiltroStatus] = useState('');
    const [filtroDataInicio, setFiltroDataInicio] = useState('');
    const [filtroDataFim, setFiltroDataFim] = useState('');
    const MAX_RESULTS = 30; // Limite de resultados para o histórico

    // Listas únicas para os filtros
    const [cursos, setCursos] = useState([]);
    const [anos, setAnos] = useState([]);

    const fetchAulas = async () => {
        try {
            setLoading(true);
            
            // 1. Buscar Aulas Adicionadas (Coleção 'aulas')
            const aulasRef = collection(db, 'aulas');
            const qAulas = query(aulasRef, orderBy('createdAt', 'desc'), limit(MAX_RESULTS));
            const aulasSnapshot = await getDocs(qAulas);
            
            const aulasAdicionadas = aulasSnapshot.docs.map(doc => {
                const data = doc.data();
                return {
                    id: doc.id,
                    type: 'adicionada',
                    aula: data,
                    timestamp: data.createdAt ? data.createdAt.toDate() : new Date(), // Usar createdAt
                    user: { nome: data.propostoPorNome || data.propostoPor || 'Desconhecido' }
                };
            });

            // 2. Buscar Logs de Exclusão (Coleção 'logs')
            const logsRef = collection(db, 'logs');
            const qLogs = query(logsRef, orderBy('timestamp', 'desc'), limit(MAX_RESULTS * 2)); 
            const logsSnapshot = await getDocs(qLogs);
            
            const aulasExcluidas = logsSnapshot.docs
                .filter(doc => doc.data().type === 'exclusao')
                .map(doc => {
                    const data = doc.data();
                    return {
                        id: doc.id,
                        type: 'exclusao',
                        aula: data.aula,
                        timestamp: data.timestamp ? data.timestamp.toDate() : new Date(), // Usar timestamp
                        user: data.user || { nome: 'Desconhecido' }
                    };
                });

            // 3. Unificar e Ordenar
            let todosLogs = [...aulasAdicionadas, ...aulasExcluidas];
            
            todosLogs.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
            
            todosLogs = todosLogs.slice(0, MAX_RESULTS);

            setLogs(todosLogs);
            setLogsFiltered(todosLogs);
            
            // Extrair cursos e anos únicos para os filtros
            const todosCursos = todosLogs.flatMap(log => log.aula?.cursos || []).filter(Boolean);
            const todosAnos = todosLogs.map(log => {
                const data = log.aula?.dataInicio;
                if (!data) return null;
                const dateObj = data.toDate ? data.toDate() : new Date(data);
                return dayjs(dateObj).year().toString();
            }).filter(Boolean);

            setCursos([...new Set(todosCursos)].sort());
            setAnos([...new Set(todosAnos)].sort());

            setError(null);
        } catch (err) {
            console.error("Erro ao buscar histórico de aulas:", err);
            setError("Erro ao carregar o histórico de aulas. Verifique a conexão com o Firestore.");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchAulas();
    }, []);

    useEffect(() => {
        let resultado = [...logs];

        if (filtroNome) {
            resultado = resultado.filter(log =>
                log.aula?.assunto?.toLowerCase().includes(filtroNome.toLowerCase())
            );
        }

        if (filtroCurso) {
            resultado = resultado.filter(log => log.aula?.cursos?.includes(filtroCurso));
        }

        if (filtroAno) {
            resultado = resultado.filter(log => {
                const data = log.aula?.dataInicio;
                if (!data) return false;
                const dateObj = data.toDate ? data.toDate() : new Date(data);
                return dayjs(dateObj).year().toString() === filtroAno;
            });
        }

        if (filtroStatus) {
            resultado = resultado.filter(log => log.aula?.status === filtroStatus);
        }

        if (filtroDataInicio) {
            const dataInicio = dayjs(filtroDataInicio).startOf('day');
            resultado = resultado.filter(log => {
                if (!log.timestamp) return false;
                const dataCriacao = dayjs(log.timestamp);
                return dataCriacao.isAfter(dataInicio, 'day') || dataCriacao.isSame(dataInicio, 'day');
            });
        }

        if (filtroDataFim) {
            const dataFim = dayjs(filtroDataFim).endOf('day');
            resultado = resultado.filter(log => {
                if (!log.timestamp) return false;
                const dataCriacao = dayjs(log.timestamp);
                return dataCriacao.isBefore(dataFim, 'day') || dataCriacao.isSame(dataFim, 'day');
            });
        }

        setLogsFiltered(resultado);
        setPage(0); 
    }, [filtroNome, filtroCurso, filtroAno, filtroStatus, filtroDataInicio, filtroDataFim, logs]);

    const handleChangePage = (event, newPage) => {
        setPage(newPage);
    };

    const handleChangeRowsPerPage = (event) => {
        setRowsPerPage(parseInt(event.target.value, 10));
        setPage(0);
    };

    const limparFiltros = () => {
        setFiltroNome('');
        setFiltroCurso('');
        setFiltroAno('');
        setFiltroStatus('');
        setFiltroDataInicio('');
        setFiltroDataFim('');
    };

    const recarregarDados = async () => {
        await fetchAulas();
    };

    const getStatusColor = (status) => {
        switch (status) {
            case 'aprovada':
                return 'success';
            case 'pendente':
            case 'proposta':
                return 'warning';
            case 'rejeitada':
                return 'error';
            default:
                return 'default';
        }
    };

    const getStatusLabel = (status) => {
        switch (status) {
            case 'aprovada':
                return 'Aprovada';
            case 'pendente':
            case 'proposta':
                return 'Pendente';
            case 'rejeitada':
                return 'Rejeitada';
            default:
                return status;
        }
    };

    const getTipoColor = (type) => {
        switch (type) {
            case 'adicionada':
                return 'primary';
            case 'exclusao':
                return 'error';
            default:
                return 'default';
        }
    };

    const getTipoLabel = (type) => {
        switch (type) {
            case 'adicionada':
                return 'Adicionada';
            case 'exclusao':
                return 'Excluída';
            default:
                return type;
        }
    };

    if (loading) {
        return (
            <Container maxWidth="xl" sx={{ mt: 4, mb: 4 }}>
                <Box display="flex" justifyContent="center" alignItems="center" minHeight="60vh">
                    <CircularProgress />
                </Box>
            </Container>
        );
    }

    if (error) {
        return (
            <Container maxWidth="xl" sx={{ mt: 4, mb: 4 }}>
                <Alert severity="error">{error}</Alert>
            </Container>
        );
    }

    return (
        <Container maxWidth="xl" sx={{ mt: 4, mb: 4 }}>
            <Box display="flex" alignItems="center" mb={3}>
                <History size={32} style={{ marginRight: 12, color: theme.palette.primary.main }} />
                <Typography variant="h4" component="h1">
                    Histórico de Aulas
                </Typography>
            </Box>

            <Typography variant="subtitle1" color="text.secondary" gutterBottom>
                Visualize as últimas aulas adicionadas e excluídas do sistema.
            </Typography>

            {/* Filtros */}
            <Paper elevation={2} sx={{ p: 3, mb: 3, mt: 3 }}>
                <Box display="flex" alignItems="center" mb={2}>
                    <Filter size={20} style={{ marginRight: 8 }} />
                    <Typography variant="h6">Filtros</Typography>
                </Box>

                <Grid container spacing={2}>
                    <Grid item xs={12} sm={6} md={3}>
                        <TextField
                            fullWidth
                            label="Nome da Disciplina"
                            variant="outlined"
                            value={filtroNome}
                            onChange={(e) => setFiltroNome(e.target.value)}
                            InputProps={{
                                startAdornment: <Search size={18} style={{ marginRight: 8, color: theme.palette.text.secondary }} />
                            }}
                        />
                    </Grid>

                    <Grid item xs={12} sm={6} md={2}>
                        <FormControl fullWidth variant="outlined">
                            <InputLabel>Curso</InputLabel>
                            <Select
                                value={filtroCurso}
                                onChange={(e) => setFiltroCurso(e.target.value)}
                                label="Curso"
                            >
                                <MenuItem value="">Todos</MenuItem>
                                {cursos.map(curso => (
                                    <MenuItem key={curso} value={curso}>{curso}</MenuItem>
                                ))}
                            </Select>
                        </FormControl>
                    </Grid>

                    <Grid item xs={12} sm={6} md={2}>
                        <FormControl fullWidth variant="outlined">
                            <InputLabel>Ano</InputLabel>
                            <Select
                                value={filtroAno}
                                onChange={(e) => setFiltroAno(e.target.value)}
                                label="Ano"
                            >
                                <MenuItem value="">Todos</MenuItem>
                                {anos.map(ano => (
                                    <MenuItem key={ano} value={ano}>{ano}</MenuItem>
                                ))}
                            </Select>
                        </FormControl>
                    </Grid>

                    <Grid item xs={12} sm={6} md={2}>
                        <FormControl fullWidth variant="outlined">
                            <InputLabel>Status</InputLabel>
                            <Select
                                value={filtroStatus}
                                onChange={(e) => setFiltroStatus(e.target.value)}
                                label="Status"
                            >
                                <MenuItem value="">Todos</MenuItem>
                                <MenuItem value="aprovada">Aprovada</MenuItem>
                                <MenuItem value="pendente">Pendente</MenuItem>
                                <MenuItem value="rejeitada">Rejeitada</MenuItem>
                            </Select>
                        </FormControl>
                    </Grid>

                    <Grid item xs={12} sm={6} md={2}>
                        <TextField
                            fullWidth
                            label="Data Início"
                            type="date"
                            variant="outlined"
                            value={filtroDataInicio}
                            onChange={(e) => setFiltroDataInicio(e.target.value)}
                            InputLabelProps={{ shrink: true }}
                        />
                    </Grid>

                    <Grid item xs={12} sm={6} md={2}>
                        <TextField
                            fullWidth
                            label="Data Fim"
                            type="date"
                            variant="outlined"
                            value={filtroDataFim}
                            onChange={(e) => setFiltroDataFim(e.target.value)}
                            InputLabelProps={{ shrink: true }}
                        />
                    </Grid>

                    <Grid item xs={12} sm={6} md={3}>
                        <Box display="flex" gap={1}>
                            <Button
                                variant="outlined"
                                fullWidth
                                onClick={limparFiltros}
                                startIcon={<X size={20} />}
                                color="secondary"
                            >
                                Limpar Filtros
                            </Button>
                            <Button
                                variant="contained"
                                fullWidth
                                onClick={recarregarDados}
                                startIcon={<RefreshCw size={20} />}
                                color="primary"
                            >
                                Recarregar
                            </Button>
                        </Box>
                    </Grid>
                </Grid>
            </Paper>

            <Paper elevation={2} sx={{ width: '100%', overflow: 'hidden' }}>
                <TableContainer sx={{ maxHeight: 600 }}>
                    <Table stickyHeader aria-label="sticky table">
                        <TableHead>
                            <TableRow>
                                <TableCell>Tipo</TableCell>
                                <TableCell>Disciplina</TableCell>
                                <TableCell>Curso</TableCell>
                                <TableCell>Ano</TableCell>
                                <TableCell>Laboratório</TableCell>
                                <TableCell>Status</TableCell>
                                <TableCell>Data/Hora</TableCell>
                                <TableCell>Usuário</TableCell>
                            </TableRow>
                        </TableHead>
                        <TableBody>
                            {logsFiltered.length > 0 ? (
                                logsFiltered.slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage).map((log) => (
                                    <TableRow key={log.id} hover sx={{ backgroundColor: log.type === 'exclusao' ? theme.palette.error.light + '10' : 'inherit' }}>
                                        <TableCell>
                                            <Chip
                                                label={getTipoLabel(log.type)}
                                                color={getTipoColor(log.type)}
                                                size="small"
                                            />
                                        </TableCell>
                                        <TableCell component="th" scope="row">{log.aula?.assunto || 'Sem Nome'}</TableCell>
                                        <TableCell>{Array.isArray(log.aula?.cursos) ? log.aula.cursos.join(', ') : (log.aula?.curso || 'Não Especificado')}</TableCell>
                                        <TableCell>
                                            {log.aula?.dataInicio 
                                                ? dayjs(log.aula.dataInicio.toDate ? log.aula.dataInicio.toDate() : log.aula.dataInicio).year() 
                                                : 'N/A'}
                                        </TableCell>
                                        <TableCell>{log.aula?.laboratorioSelecionado || log.aula?.laboratorio || 'N/A'}</TableCell>
                                        <TableCell>
                                            <Chip
                                                label={getStatusLabel(log.aula?.status)}
                                                color={getStatusColor(log.aula?.status)}
                                                size="small"
                                            />
                                        </TableCell>
                                        <TableCell>
                                            {log.timestamp
                                                ? dayjs(log.timestamp).format('DD/MM/YYYY [às] HH:mm')
                                                : 'Data não disponível'
                                            }
                                        </TableCell>
                                        <TableCell>{log.user?.nome || 'Desconhecido'}</TableCell>
                                    </TableRow>
                                ))
                            ) : (
                                <TableRow>
                                    <TableCell colSpan={7} align="center">
                                        <Typography variant="body2" sx={{ p: 3 }}>
                                            Nenhuma atividade encontrada.
                                        </Typography>
                                    </TableCell>
                                </TableRow>
                            )}
                        </TableBody>
                    </Table>
                </TableContainer>
                <TablePagination
                    rowsPerPageOptions={[10, 25, 100]}
                    component="div"
                    count={logsFiltered.length}
                    rowsPerPage={rowsPerPage}
                    page={page}
                    onPageChange={handleChangePage}
                    onRowsPerPageChange={handleChangeRowsPerPage}
                    labelRowsPerPage="Linhas por página:"
                />
            </Paper>
        </Container>
    );
};

export default HistoricoAulas;

