import React, { useState, useEffect, useCallback } from 'react';
import { db } from './firebaseConfig';
import { collection, query, where, onSnapshot, orderBy, Timestamp } from 'firebase/firestore';
import { useAuth } from './AuthContext';
import {
    Container, Typography, Paper, List, ListItem, ListItemText,
    CircularProgress, Alert, Box, Chip, Button
} from '@mui/material';
import { useTheme } from '@mui/material/styles';
import GroupIcon from '@mui/icons-material/Group';
import SwapVertIcon from '@mui/icons-material/SwapVert';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDayjs } from '@mui/x-date-pickers/AdapterDayjs';
import dayjs from 'dayjs';
import 'dayjs/locale/pt-br';

dayjs.locale('pt-br');

function MinhasDesignacoes() {
    const [aulas, setAulas] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const { currentUser } = useAuth();
    const theme = useTheme();

    // --- NOVOS ESTADOS PARA FILTRO E ORDENAÇÃO ---
    const [selectedDate, setSelectedDate] = useState(dayjs());
    const [sortOrder, setSortOrder] = useState('asc'); // 'asc' ou 'desc'

    const handleSortToggle = () => {
        setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc');
    };

    useEffect(() => {
        if (!currentUser) {
            setLoading(false);
            return;
        }

        setLoading(true);
        setError(null);
        
        const startOfMonth = selectedDate.startOf('month').toDate();
        const endOfMonth = selectedDate.endOf('month').toDate();

        // --- CONSULTA ATUALIZADA ---
        const q = query(
            collection(db, 'aulas'),
            where('tecnicos', 'array-contains', currentUser.uid), // NOME DO CAMPO CORRIGIDO
            where('dataInicio', '>=', Timestamp.fromDate(startOfMonth)),
            where('dataInicio', '<=', Timestamp.fromDate(endOfMonth)),
            orderBy('dataInicio', sortOrder) // Ordenação dinâmica
        );

        const unsubscribe = onSnapshot(q, (snapshot) => {
            const aulasDesignadas = snapshot.docs.map(doc => {
                const data = doc.data();
                return {
                    id: doc.id,
                    ...data,
                    dataInicio: data.dataInicio?.toDate ? dayjs(data.dataInicio.toDate()) : null,
                    dataFim: data.dataFim?.toDate ? dayjs(data.dataFim.toDate()) : null,
                };
            });
            setAulas(aulasDesignadas);
            setLoading(false);
        }, (err) => {
            console.error("Erro ao buscar aulas designadas:", err);
            setError("Falha ao carregar suas aulas. Verifique o console para mais detalhes (pode ser necessário criar um índice no Firestore).");
            setLoading(false);
        });

        return () => unsubscribe();
    }, [currentUser, selectedDate, sortOrder]); // Re-executa quando os filtros mudam

    if (loading) {
        return (<Container maxWidth="md" sx={{ textAlign: 'center', mt: 4 }}><CircularProgress /><Typography variant="h6" sx={{ mt: 2 }}>Carregando...</Typography></Container>);
    }
    if (error) {
        return (<Container maxWidth="md" sx={{ mt: 4 }}><Alert severity="error">{error}</Alert></Container>);
    }
    if (!currentUser) {
        return (<Container maxWidth="md" sx={{ mt: 4 }}><Alert severity="warning">Por favor, faça login.</Alert></Container>);
    }

    return (
        <LocalizationProvider dateAdapter={AdapterDayjs} adapterLocale="pt-br">
            <Container maxWidth="lg" sx={{ mt: 4, mb: 4 }}>
                <Paper elevation={3} sx={{ p: { xs: 2, md: 4 } }}>
                    <Typography variant="h4" component="h1" gutterBottom align="center" sx={{ mb: 1 }}>
                        Minhas Designações
                    </Typography>

                    {/* --- NOVOS CONTROLES DE FILTRO --- */}
                    <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', flexWrap: 'wrap', gap: 2, mb: 3 }}>
                        <DatePicker
                            views={['month', 'year']}
                            label="Filtrar por Mês/Ano"
                            value={selectedDate}
                            onChange={(newDate) => setSelectedDate(newDate || dayjs())}
                            slotProps={{ textField: { size: 'small' } }}
                        />
                        <Button
                            variant="outlined"
                            size="medium"
                            onClick={handleSortToggle}
                            startIcon={<SwapVertIcon />}
                        >
                            Ordenar por Data ({sortOrder === 'asc' ? 'Crescente' : 'Decrescente'})
                        </Button>
                    </Box>

                    {aulas.length === 0 ? (
                        <Typography variant="body1" align="center" color="text.secondary" sx={{ mt: 3 }}>
                            Você não possui nenhuma designação para o mês selecionado.
                        </Typography>
                    ) : (
                        <List>
                            {aulas.map((aula) => (
                                <Paper key={aula.id} elevation={2} sx={{ mb: 2, p: 2, borderLeft: `5px solid ${theme.palette.primary.main}` }}>
                                    <ListItem alignItems="flex-start" disableGutters>
                                        <ListItemText
                                            primary={
                                                <Typography variant="h6" component="div" gutterBottom>
                                                    {aula.assunto}
                                                    <Chip label={aula.tipoAtividade === 'aula' ? 'Aula' : 'Revisão'} size="small" color={aula.tipoAtividade === 'aula' ? 'primary' : 'secondary'} sx={{ ml: 1 }} />
                                                </Typography>
                                            }
                                            secondary={
                                                <React.Fragment>
                                                    <Typography component="div" variant="body2" color="text.secondary"><Box component="span" sx={{ fontWeight: 'bold' }}>Laboratório:</Box> {aula.laboratorioSelecionado}</Typography>
                                                    <Typography component="div" variant="body2" color="text.secondary"><Box component="span" sx={{ fontWeight: 'bold' }}>Data:</Box> {aula.dataInicio ? aula.dataInicio.format('dddd, DD [de] MMMM [de] YYYY') : 'N/A'}</Typography>
                                                    <Typography component="div" variant="body2" color="text.secondary"><Box component="span" sx={{ fontWeight: 'bold' }}>Horário:</Box> {aula.dataInicio ? aula.dataInicio.format('HH:mm') : ''} - {aula.dataFim ? aula.dataFim.format('HH:mm') : ''}</Typography>
                                                    {aula.tecnicosInfo && aula.tecnicosInfo.filter(t => t.uid !== currentUser.uid).length > 0 && (
                                                        <Typography component="div" variant="caption" color="text.disabled" sx={{mt: 1, display: 'flex', alignItems: 'center'}}><GroupIcon fontSize="inherit" sx={{ mr: 0.5 }} />Com: {aula.tecnicosInfo.filter(t => t.uid !== currentUser.uid).map(t => t.name || t.email).join(', ')}</Typography>
                                                    )}
                                                </React.Fragment>
                                            }
                                            secondaryTypographyProps={{ component: 'div' }}
                                        />
                                    </ListItem>
                                </Paper>
                            ))}
                        </List>
                    )}
                </Paper>
            </Container>
        </LocalizationProvider>
    );
}

export default MinhasDesignacoes;