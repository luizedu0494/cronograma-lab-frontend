import React, { useState, useEffect } from 'react';
import { db } from '../firebaseConfig';
import { collection, query, orderBy, limit, getDocs } from 'firebase/firestore';
import {
    Card, CardContent, Typography, Box, CircularProgress, Alert, List, ListItem,
    ListItemText, Divider, Button, Chip
} from '@mui/material';
import { useTheme } from '@mui/material/styles';
import { useNavigate } from 'react-router-dom';
import { Clock, BookOpen } from 'lucide-react';
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
                    ...doc.data()
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
            case 'aprovada':
                return 'success';
            case 'pendente':
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
                return 'Pendente';
            case 'rejeitada':
                return 'Rejeitada';
            default:
                return status;
        }
    };

    if (loading) {
        return (
            <Card elevation={3} sx={{ p: 3 }}>
                <Box display="flex" justifyContent="center" alignItems="center" minHeight={200}>
                    <CircularProgress />
                </Box>
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
            <CardContent sx={{ flexGrow: 1 }}>
                <Box display="flex" alignItems="center" mb={2}>
                    <BookOpen size={28} style={{ marginRight: 12, color: theme.palette.primary.main }} />
                    <Typography variant="h6" component="h2">
                        Últimas Aulas Adicionadas
                    </Typography>
                </Box>
                
                {ultimasAulas.length === 0 ? (
                    <Alert severity="info">Nenhuma aula foi adicionada ainda.</Alert>
                ) : (
                    <List sx={{ pt: 0 }}>
                        {ultimasAulas.map((aula, index) => (
                            <React.Fragment key={aula.id}>
                                {index > 0 && <Divider />}
                                <ListItem
                                    sx={{
                                        px: 0,
                                        py: 1.5,
                                        flexDirection: 'column',
                                        alignItems: 'flex-start'
                                    }}
                                >
                                    <Box display="flex" justifyContent="space-between" width="100%" mb={0.5}>
                                        <Typography variant="subtitle2" fontWeight="bold">
                                            {aula.disciplina || aula.assunto || 'Sem nome'}
                                        </Typography>
                                        <Chip
                                            label={getStatusLabel(aula.status)}
                                            color={getStatusColor(aula.status)}
                                            size="small"
                                        />
                                    </Box>
                                    
                                    <Typography variant="body2" color="text.secondary" sx={{ mb: 0.5 }}>
                                        {aula.curso || 'Curso não especificado'} - {aula.ano || 'Ano não especificado'}
                                    </Typography>
                                    
                                    <Box display="flex" alignItems="center" gap={0.5}>
                                        <Clock size={14} style={{ color: theme.palette.text.secondary }} />
                                        <Typography variant="caption" color="text.secondary">
                                            {aula.createdAt 
                                                ? dayjs(aula.createdAt.toDate()).format('DD/MM/YYYY [às] HH:mm')
                                                : 'Data não disponível'
                                            }
                                        </Typography>
                                    </Box>
                                    
                                    {aula.propostoPor && (
                                        <Typography variant="caption" color="text.secondary">
                                            Por: {aula.propostoPor}
                                        </Typography>
                                    )}
                                </ListItem>
                            </React.Fragment>
                        ))}
                    </List>
                )}
                
                <Box mt={2} display="flex" justifyContent="center">
                    <Button
                        variant="outlined"
                        size="small"
                        onClick={() => navigate('/historico-aulas')}
                    >
                        Ver Histórico Completo
                    </Button>
                </Box>
            </CardContent>
        </Card>
    );
};

export default UltimasAulasCard;
