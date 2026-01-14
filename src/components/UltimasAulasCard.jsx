import React, { useState, useEffect } from 'react';
import { db } from '../firebaseConfig';
import { collection, query, orderBy, limit, getDocs } from 'firebase/firestore';
import {
    Card, CardContent, Typography, Box, CircularProgress, Alert, List, ListItem,
    ListItemText, Divider, Button, Chip
} from '@mui/material';
import { useTheme } from '@mui/material/styles';
import { useNavigate } from 'react-router-dom';
import { Clock, BookOpen, Users, FlaskConical } from 'lucide-react';
import dayjs from 'dayjs';
import 'dayjs/locale/pt-br';

dayjs.locale('pt-br');

const UltimasAulasCard = () => {
    const theme = useTheme();
    const navigate = useNavigate();
    const [ultimasAulas, setUltimasAulas] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    useEffect(() => {
        const fetchUltimasAulas = async () => {
            try {
                setLoading(true);
                const aulasRef = collection(db, 'aulas');
                const q = query(
                    aulasRef,
                    orderBy('createdAt', 'desc'),
                    limit(5)
                );
                
                const querySnapshot = await getDocs(q);
                const aulas = querySnapshot.docs.map(doc => ({
                    id: doc.id,
                    ...doc.data(),
                    // Garante que as datas sejam objetos Date
                    createdAt: doc.data().createdAt ? doc.data().createdAt.toDate() : new Date(),
                    dataInicio: doc.data().dataInicio ? doc.data().dataInicio.toDate() : null
                }));
                
                setUltimasAulas(aulas);
                setError(null);
            } catch (err) {
                console.error("Erro ao buscar últimas aulas:", err);
                setError("Erro ao carregar as últimas aulas.");
            } finally {
                setLoading(false);
            }
        };

        fetchUltimasAulas();
    }, []);

    const getStatusColor = (status) => {
        switch (status) {
            case 'aprovada': return 'success';
            case 'pendente': return 'warning';
            case 'rejeitada': return 'error';
            default: return 'default';
        }
    };

    const getStatusLabel = (status) => {
        switch (status) {
            case 'aprovada': return 'Aprovada';
            case 'pendente': return 'Pendente';
            case 'rejeitada': return 'Rejeitada';
            default: return status || 'Indefinido';
        }
    };

    // Helper para formatar cursos
    const formatarCursos = (cursos) => {
        if (Array.isArray(cursos) && cursos.length > 0) return cursos.join(', ');
        if (typeof cursos === 'string' && cursos.trim() !== '') return cursos;
        return 'Curso não especificado';
    };

    // Helper para formatar ano da aula
    const formatarAno = (dataInicio) => {
        if (!dataInicio) return '';
        const ano = dayjs(dataInicio).year();
        return isNaN(ano) ? '' : ` - ${ano}`;
    };

    if (loading) {
        return (
            <Card elevation={3} sx={{ height: '100%', display: 'flex', justifyContent: 'center', alignItems: 'center', p: 3 }}>
                <CircularProgress />
            </Card>
        );
    }

    if (error) {
        return (
            <Card elevation={3} sx={{ p: 3 }}>
                <Alert severity="error">{error}</Alert>
            </Card>
        );
    }

    return (
        <Card elevation={3} sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
            <CardContent sx={{ flexGrow: 1, p: 2 }}>
                <Box display="flex" alignItems="center" mb={2}>
                    <BookOpen size={24} style={{ marginRight: 8, color: theme.palette.primary.main }} />
                    <Typography variant="h6" component="h2" fontWeight="bold">
                        Últimas Aulas Adicionadas
                    </Typography>
                </Box>
                
                {ultimasAulas.length === 0 ? (
                    <Typography variant="body2" color="text.secondary" textAlign="center" py={4}>
                        Nenhuma aula foi adicionada ainda.
                    </Typography>
                ) : (
                    <List sx={{ pt: 0 }}>
                        {ultimasAulas.map((aula, index) => (
                            <React.Fragment key={aula.id}>
                                {index > 0 && <Divider component="li" />}
                                <ListItem
                                    alignItems="flex-start"
                                    sx={{ px: 0, py: 1.5, flexDirection: 'column' }}
                                >
                                    {/* Linha 1: Título e Status */}
                                    <Box display="flex" justifyContent="space-between" width="100%" mb={0.5}>
                                        <Typography variant="subtitle2" fontWeight="bold" sx={{ color: theme.palette.primary.dark }}>
                                            {aula.disciplina || aula.assunto || 'Sem nome'}
                                        </Typography>
                                        <Chip
                                            label={getStatusLabel(aula.status)}
                                            color={getStatusColor(aula.status)}
                                            size="small"
                                            variant="outlined"
                                            sx={{ height: 20, fontSize: '0.65rem' }}
                                        />
                                    </Box>
                                    
                                    {/* Linha 2: Curso e Ano */}
                                    <Box display="flex" alignItems="center" mb={0.5}>
                                        <Users size={14} style={{ marginRight: 4, color: theme.palette.text.secondary }} />
                                        <Typography variant="caption" color="text.primary">
                                            {formatarCursos(aula.cursos || aula.curso)}{formatarAno(aula.dataInicio)}
                                        </Typography>
                                    </Box>

                                    {/* Linha 3: Laboratório */}
                                    <Box display="flex" alignItems="center" mb={0.5}>
                                        <FlaskConical size={14} style={{ marginRight: 4, color: theme.palette.text.secondary }} />
                                        <Typography variant="caption" color="text.secondary">
                                            {aula.laboratorioSelecionado || aula.laboratorio || 'Lab não definido'}
                                        </Typography>
                                    </Box>
                                    
                                    {/* Linha 4: Data de Criação e Autor */}
                                    <Box display="flex" alignItems="center" gap={0.5} width="100%" flexWrap="wrap">
                                        <Clock size={14} style={{ color: theme.palette.text.secondary }} />
                                        <Typography variant="caption" color="text.secondary">
                                            Adicionada em: {dayjs(aula.createdAt).format('DD/MM/YYYY [às] HH:mm')}
                                        </Typography>
                                        
                                        {aula.propostoPorNome && (
                                            <Typography variant="caption" color="text.secondary" sx={{ ml: 'auto', fontStyle: 'italic' }}>
                                                Por: {aula.propostoPorNome}
                                            </Typography>
                                        )}
                                    </Box>
                                </ListItem>
                            </React.Fragment>
                        ))}
                    </List>
                )}
            </CardContent>
            
            <Box sx={{ p: 2, pt: 0 }}>
                <Button
                    fullWidth
                    variant="outlined"
                    size="small"
                    onClick={() => navigate('/historico-aulas')}
                    startIcon={<BookOpen size={18} />}
                >
                    Ver Histórico Completo
                </Button>
            </Box>
        </Card>
    );
};

export default UltimasAulasCard;