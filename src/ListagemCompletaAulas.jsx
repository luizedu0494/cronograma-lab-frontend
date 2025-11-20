import React, { useState, useEffect, useCallback } from 'react';
import {
    Container, Paper, Typography, Box, CircularProgress, Alert, Button,
    TextField, Grid, Chip, Table, TableBody, TableCell, TableContainer,
    TableHead, TableRow, TablePagination, FormControl, InputLabel, Select,
    MenuItem, Card, CardContent, CardHeader, useTheme, useMediaQuery
} from '@mui/material';
import { format, startOfDay, endOfDay, startOfMonth, endOfMonth, startOfYear, endOfYear } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { collection, query, where, getDocs, Timestamp, orderBy } from 'firebase/firestore';
import { db } from './firebaseConfig';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDayjs } from '@mui/x-date-pickers/AdapterDayjs';
import dayjs from 'dayjs';
import { Search, Filter, X, CheckCircle, XCircle, Clock } from 'lucide-react';

const ListagemCompletaAulas = () => {
    const theme = useTheme();
    const isMobile = useMediaQuery(theme.breakpoints.down('sm'));

    // Estados de dados
    const [aulas, setAulas] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [usuarios, setUsuarios] = useState([]);

    // Estados de filtro
    const [filtroStatus, setFiltroStatus] = useState('');
    const [filtroAutor, setFiltroAutor] = useState('');
    const [filtroDataInicio, setFiltroDataInicio] = useState(null);
    const [filtroDataFim, setFiltroDataFim] = useState(null);
    const [filtroTipo, setFiltroTipo] = useState(''); // 'dia', 'mes', 'ano', 'intervalo', ''
    const [searchTerm, setSearchTerm] = useState('');

    // Estados de paginação
    const [page, setPage] = useState(0);
    const [rowsPerPage, setRowsPerPage] = useState(10);

    // Buscar usuários para o filtro de autor
    useEffect(() => {
        const fetchUsuarios = async () => {
            try {
                const usuariosRef = collection(db, 'usuarios');
                const querySnapshot = await getDocs(usuariosRef);
                const usuariosList = querySnapshot.docs.map(doc => ({
                    uid: doc.id,
                    nome: doc.data().name || 'Usuário desconhecido'
                }));
                setUsuarios(usuariosList);
            } catch (err) {
                console.error("Erro ao buscar usuários:", err);
            }
        };
        fetchUsuarios();
    }, []);

    // Função para construir o filtro de data
    const construirFiltroData = useCallback(() => {
        if (filtroTipo === 'dia' && filtroDataInicio) {
            const inicio = startOfDay(filtroDataInicio.toDate());
            const fim = endOfDay(filtroDataInicio.toDate());
            return { inicio: Timestamp.fromDate(inicio), fim: Timestamp.fromDate(fim) };
        } else if (filtroTipo === 'mes' && filtroDataInicio) {
            const inicio = startOfMonth(filtroDataInicio.toDate());
            const fim = endOfMonth(filtroDataInicio.toDate());
            return { inicio: Timestamp.fromDate(inicio), fim: Timestamp.fromDate(fim) };
        } else if (filtroTipo === 'ano' && filtroDataInicio) {
            const inicio = startOfYear(filtroDataInicio.toDate());
            const fim = endOfYear(filtroDataInicio.toDate());
            return { inicio: Timestamp.fromDate(inicio), fim: Timestamp.fromDate(fim) };
        } else if (filtroTipo === 'intervalo' && filtroDataInicio && filtroDataFim) {
            const inicio = startOfDay(filtroDataInicio.toDate());
            const fim = endOfDay(filtroDataFim.toDate());
            return { inicio: Timestamp.fromDate(inicio), fim: Timestamp.fromDate(fim) };
        }
        return null;
    }, [filtroTipo, filtroDataInicio, filtroDataFim]);

    // Função para buscar aulas com filtros
    const fetchAulas = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const aulasRef = collection(db, 'aulas');
            let q = query(aulasRef, orderBy('dataCriacao', 'desc'));

            // Construir array de condições where
            const conditions = [];

            // Filtro por status
            if (filtroStatus) {
                conditions.push(where('status', '==', filtroStatus));
            }

            // Filtro por autor
            if (filtroAutor) {
                conditions.push(where('autorUid', '==', filtroAutor));
            }

            // Filtro por data
            const filtroData = construirFiltroData();
            if (filtroData) {
                conditions.push(where('dataInicio', '>=', filtroData.inicio));
                conditions.push(where('dataInicio', '<=', filtroData.fim));
            }

            // Aplicar condições
            if (conditions.length > 0) {
                q = query(aulasRef, ...conditions, orderBy('dataCriacao', 'desc'));
            }

            const querySnapshot = await getDocs(q);

            let aulasList = querySnapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data(),
                dataInicio: doc.data().dataInicio?.toDate().toISOString() || null,
                dataFim: doc.data().dataFim?.toDate().toISOString() || null,
                dataCriacao: doc.data().dataCriacao?.toDate().toISOString() || null,
            }));

            // Filtro por termo de busca (título, laboratório)
            if (searchTerm) {
                aulasList = aulasList.filter(aula =>
                    (aula.titulo?.toLowerCase().includes(searchTerm.toLowerCase())) ||
                    (aula.laboratorio?.toLowerCase().includes(searchTerm.toLowerCase()))
                );
            }

            setAulas(aulasList);
        } catch (err) {
            console.error("Erro ao buscar aulas:", err);
            setError("Não foi possível carregar as aulas. Verifique os filtros e tente novamente.");
        } finally {
            setLoading(false);
        }
    }, [filtroStatus, filtroAutor, filtroTipo, filtroDataInicio, filtroDataFim, searchTerm, construirFiltroData]);

    // Executar busca quando filtros mudam
    useEffect(() => {
        fetchAulas();
    }, [fetchAulas]);

    // Funções de manipulação de paginação
    const handleChangePage = (event, newPage) => {
        setPage(newPage);
    };

    const handleChangeRowsPerPage = (event) => {
        setRowsPerPage(parseInt(event.target.value, 10));
        setPage(0);
    };

    // Função para limpar filtros
    const limparFiltros = () => {
        setFiltroStatus('');
        setFiltroAutor('');
        setFiltroDataInicio(null);
        setFiltroDataFim(null);
        setFiltroTipo('');
        setSearchTerm('');
        setPage(0);
    };

    // Função para obter a cor do status
    const getStatusColor = (status) => {
        switch (status) {
            case 'aprovada':
                return '#4caf50';
            case 'reprovada':
                return '#f44336';
            case 'pendente':
                return '#ff9800';
            default:
                return '#9e9e9e';
        }
    };

    // Função para obter o ícone do status
    const getStatusIcon = (status) => {
        switch (status) {
            case 'aprovada':
                return <CheckCircle size={16} />;
            case 'reprovada':
                return <XCircle size={16} />;
            case 'pendente':
                return <Clock size={16} />;
            default:
                return null;
        }
    };

    // Função para formatar a data
    const formatarData = (data) => {
        if (!data) return 'Data não disponível';
        try {
            const dataObj = typeof data === 'string' ? new Date(data) : data.toDate?.() || data;
            return format(dataObj, 'dd/MM/yyyy HH:mm', { locale: ptBR });
        } catch {
            return 'Data inválida';
        }
    };

    // Dados para exibição na tabela
    const displayedAulas = aulas.slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage);

    return (
        <Container maxWidth="lg" sx={{ py: 4 }}>
            {/* Cabeçalho */}
            <Box sx={{ mb: 4 }}>
                <Typography variant="h4" component="h1" gutterBottom sx={{ fontWeight: 600 }}>
                    Listagem Completa de Aulas
                </Typography>
                <Typography variant="subtitle1" color="text.secondary">
                    Visualize e filtre todas as aulas adicionadas ao sistema
                </Typography>
            </Box>

            {/* Card de Filtros */}
            <Card sx={{ mb: 4, boxShadow: 2 }}>
                <CardHeader
                    avatar={<Filter size={24} style={{ color: theme.palette.primary.main }} />}
                    title="Filtros de Busca"
                    titleTypographyProps={{ variant: 'h6', fontWeight: 600 }}
                />
                <CardContent>
                    <Grid container spacing={2}>
                        {/* Busca por Título/Laboratório */}
                        <Grid item xs={12} sm={6} md={4}>
                            <TextField
                                fullWidth
                                label="Buscar por Título ou Laboratório"
                                variant="outlined"
                                size="small"
                                value={searchTerm}
                                onChange={(e) => {
                                    setSearchTerm(e.target.value);
                                    setPage(0);
                                }}
                                InputProps={{
                                    startAdornment: <Search size={18} style={{ marginRight: 8 }} />
                                }}
                            />
                        </Grid>

                        {/* Filtro por Status */}
                        <Grid item xs={12} sm={6} md={4}>
                            <FormControl fullWidth size="small">
                                <InputLabel>Status</InputLabel>
                                <Select
                                    value={filtroStatus}
                                    onChange={(e) => {
                                        setFiltroStatus(e.target.value);
                                        setPage(0);
                                    }}
                                    label="Status"
                                >
                                    <MenuItem value="">Todos</MenuItem>
                                    <MenuItem value="aprovada">Aprovada</MenuItem>
                                    <MenuItem value="reprovada">Reprovada</MenuItem>
                                    <MenuItem value="pendente">Pendente</MenuItem>
                                </Select>
                            </FormControl>
                        </Grid>

                        {/* Filtro por Autor */}
                        <Grid item xs={12} sm={6} md={4}>
                            <FormControl fullWidth size="small">
                                <InputLabel>Autor</InputLabel>
                                <Select
                                    value={filtroAutor}
                                    onChange={(e) => {
                                        setFiltroAutor(e.target.value);
                                        setPage(0);
                                    }}
                                    label="Autor"
                                >
                                    <MenuItem value="">Todos</MenuItem>
                                    {usuarios.map(usuario => (
                                        <MenuItem key={usuario.uid} value={usuario.uid}>
                                            {usuario.nome}
                                        </MenuItem>
                                    ))}
                                </Select>
                            </FormControl>
                        </Grid>

                        {/* Tipo de Filtro de Data */}
                        <Grid item xs={12} sm={6} md={4}>
                            <FormControl fullWidth size="small">
                                <InputLabel>Filtro de Data</InputLabel>
                                <Select
                                    value={filtroTipo}
                                    onChange={(e) => {
                                        setFiltroTipo(e.target.value);
                                        setPage(0);
                                    }}
                                    label="Filtro de Data"
                                >
                                    <MenuItem value="">Nenhum</MenuItem>
                                    <MenuItem value="dia">Por Dia</MenuItem>
                                    <MenuItem value="mes">Por Mês</MenuItem>
                                    <MenuItem value="ano">Por Ano</MenuItem>
                                    <MenuItem value="intervalo">Por Intervalo</MenuItem>
                                </Select>
                            </FormControl>
                        </Grid>

                        {/* Data Início (conforme tipo de filtro) */}
                        {filtroTipo && (
                            <Grid item xs={12} sm={6} md={4}>
                                <LocalizationProvider dateAdapter={AdapterDayjs} adapterLocale="pt-br">
                                    <DatePicker
                                        label={filtroTipo === 'intervalo' ? 'Data Início' : 'Data'}
                                        value={filtroDataInicio}
                                        onChange={(newValue) => {
                                            setFiltroDataInicio(newValue);
                                            setPage(0);
                                        }}
                                        slotProps={{ textField: { fullWidth: true, size: 'small' } }}
                                    />
                                </LocalizationProvider>
                            </Grid>
                        )}

                        {/* Data Fim (apenas para intervalo) */}
                        {filtroTipo === 'intervalo' && (
                            <Grid item xs={12} sm={6} md={4}>
                                <LocalizationProvider dateAdapter={AdapterDayjs} adapterLocale="pt-br">
                                    <DatePicker
                                        label="Data Fim"
                                        value={filtroDataFim}
                                        onChange={(newValue) => {
                                            setFiltroDataFim(newValue);
                                            setPage(0);
                                        }}
                                        slotProps={{ textField: { fullWidth: true, size: 'small' } }}
                                    />
                                </LocalizationProvider>
                            </Grid>
                        )}

                        {/* Botão Limpar Filtros */}
                        <Grid item xs={12}>
                            <Button
                                variant="outlined"
                                startIcon={<X size={18} />}
                                onClick={limparFiltros}
                                sx={{ mt: 1 }}
                            >
                                Limpar Filtros
                            </Button>
                        </Grid>
                    </Grid>
                </CardContent>
            </Card>

            {/* Indicador de Resultados */}
            <Box sx={{ mb: 2 }}>
                <Typography variant="subtitle2" color="text.secondary">
                    Total de aulas encontradas: <strong>{aulas.length}</strong>
                </Typography>
            </Box>

            {/* Tabela de Aulas */}
            {loading ? (
                <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
                    <CircularProgress />
                </Box>
            ) : error ? (
                <Alert severity="error">{error}</Alert>
            ) : aulas.length === 0 ? (
                <Alert severity="info">Nenhuma aula encontrada com os filtros selecionados.</Alert>
            ) : (
                <TableContainer component={Paper} sx={{ boxShadow: 2 }}>
                    <Table>
                        <TableHead sx={{ backgroundColor: theme.palette.primary.light }}>
                            <TableRow>
                                <TableCell sx={{ fontWeight: 600, color: 'white' }}>Título</TableCell>
                                {!isMobile && <TableCell sx={{ fontWeight: 600, color: 'white' }}>Laboratório</TableCell>}
                                <TableCell sx={{ fontWeight: 600, color: 'white' }}>Data/Hora</TableCell>
                                {!isMobile && <TableCell sx={{ fontWeight: 600, color: 'white' }}>Autor</TableCell>}
                                <TableCell sx={{ fontWeight: 600, color: 'white' }}>Status</TableCell>
                            </TableRow>
                        </TableHead>
                        <TableBody>
                            {displayedAulas.map((aula) => (
                                <TableRow key={aula.id} hover>
                                    <TableCell>
                                        <Typography variant="body2" sx={{ fontWeight: 500 }}>
                                            {aula.titulo || 'Sem título'}
                                        </Typography>
                                    </TableCell>
                                    {!isMobile && (
                                        <TableCell>
                                            <Typography variant="body2">
                                                {aula.laboratorio || 'Não especificado'}
                                            </Typography>
                                        </TableCell>
                                    )}
                                    <TableCell>
                                        <Typography variant="body2">
                                            {formatarData(aula.dataInicio)}
                                        </Typography>
                                    </TableCell>
                                    {!isMobile && (
                                        <TableCell>
                                            <Typography variant="body2">
                                                {aula.autorNome || 'Desconhecido'}
                                            </Typography>
                                        </TableCell>
                                    )}
                                    <TableCell>
                                        <Chip
                                            icon={getStatusIcon(aula.status)}
                                            label={aula.status || 'Desconhecido'}
                                            size="small"
                                            sx={{
                                                backgroundColor: getStatusColor(aula.status),
                                                color: 'white',
                                                fontWeight: 500
                                            }}
                                        />
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                    <TablePagination
                        rowsPerPageOptions={[5, 10, 25, 50]}
                        component="div"
                        count={aulas.length}
                        rowsPerPage={rowsPerPage}
                        page={page}
                        onPageChange={handleChangePage}
                        onRowsPerPageChange={handleChangeRowsPerPage}
                        labelRowsPerPage="Aulas por página:"
                        labelDisplayedRows={({ from, to, count }) => `${from}–${to} de ${count}`}
                    />
                </TableContainer>
            )}
        </Container>
    );
};

export default ListagemCompletaAulas;
