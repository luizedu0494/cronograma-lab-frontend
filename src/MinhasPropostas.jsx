// src/MinhasPropostas.js

import React, { useState, useEffect } from 'react';
import { db, auth } from './firebaseConfig';
import { collection, query, where, getDocs, orderBy } from 'firebase/firestore';
import {
    Container, Typography, Box, CircularProgress, Alert, Paper,
    List, ListItem, ListItemText, ListItemSecondaryAction, Chip, Divider,
    Grid
} from '@mui/material';
import dayjs from 'dayjs';
import 'dayjs/locale/pt-br';

dayjs.locale('pt-br');

const MinhasPropostas = () => {
    const [propostas, setPropostas] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const currentUser = auth.currentUser;

    useEffect(() => {
        const fetchPropostas = async () => {
            if (!currentUser) {
                setLoading(false);
                return;
            }

            setLoading(true);
            setError(null);

            try {
                // Busca por propostoPorUid (campo novo/correto)
                const q1 = query(
                    collection(db, 'aulas'),
                    where('propostoPorUid', '==', currentUser.uid)
                );
                // Busca por professorUid (campo legado, registros antigos)
                const q2 = query(
                    collection(db, 'aulas'),
                    where('professorUid', '==', currentUser.uid)
                );

                const [snap1, snap2] = await Promise.all([getDocs(q1), getDocs(q2)]);

                const idsVistos = new Set();
                const propostasList = [];

                [...snap1.docs, ...snap2.docs].forEach(doc => {
                    if (!idsVistos.has(doc.id)) {
                        idsVistos.add(doc.id);
                        propostasList.push({ id: doc.id, ...doc.data() });
                    }
                });

                // Ordena por data de criação decrescente
                propostasList.sort((a, b) => {
                    const dateA = a.createdAt?.toDate?.() ?? new Date(0);
                    const dateB = b.createdAt?.toDate?.() ?? new Date(0);
                    return dateB - dateA;
                });

                setPropostas(propostasList);
            } catch (err) {
                console.error("Erro ao buscar propostas:", err);
                setError("Erro ao carregar suas propostas. Por favor, tente novamente.");
            } finally {
                setLoading(false);
            }
        };

        fetchPropostas();
    }, [currentUser]);

    const getChipProps = (status) => {
        switch (status) {
            case 'aprovada':
                return { label: 'Aprovada', color: 'success' };
            case 'rejeitada':
                return { label: 'Rejeitada', color: 'error' };
            default:
                return { label: 'Pendente Aprovação', color: 'warning' };
        }
    };

    const pendentes = propostas.filter(p => p.status === 'pendente');
    const aprovadas = propostas.filter(p => p.status === 'aprovada');
    const rejeitadas = propostas.filter(p => p.status === 'rejeitada');

    if (loading) {
        return (
            <Box sx={{ display: 'flex', justifyContent: 'center', mt: 4 }}>
                <CircularProgress />
            </Box>
        );
    }

    if (error) {
        return (
            <Box sx={{ mt: 4 }}>
                <Alert severity="error">{error}</Alert>
            </Box>
        );
    }

    return (
        <Container maxWidth="md">
            <Paper elevation={3} sx={{ p: 4, mt: 4 }}>
                <Typography variant="h5" component="h1" gutterBottom>
                    Minhas Propostas de Aula
                </Typography>
                <Typography variant="body1" color="text.secondary" gutterBottom>
                    Aulas propostas por você e seus respectivos status de aprovação.
                </Typography>

                {/* Resumo */}
                <Grid container spacing={2} sx={{ my: 2 }}>
                    <Grid item xs={4}>
                        <Paper elevation={1} sx={{ p: 1.5, textAlign: 'center', borderTop: '3px solid #ed6c02' }}>
                            <Typography variant="h4" fontWeight="bold" color="warning.main">{pendentes.length}</Typography>
                            <Typography variant="caption">Pendentes</Typography>
                        </Paper>
                    </Grid>
                    <Grid item xs={4}>
                        <Paper elevation={1} sx={{ p: 1.5, textAlign: 'center', borderTop: '3px solid #2e7d32' }}>
                            <Typography variant="h4" fontWeight="bold" color="success.main">{aprovadas.length}</Typography>
                            <Typography variant="caption">Aprovadas</Typography>
                        </Paper>
                    </Grid>
                    <Grid item xs={4}>
                        <Paper elevation={1} sx={{ p: 1.5, textAlign: 'center', borderTop: '3px solid #d32f2f' }}>
                            <Typography variant="h4" fontWeight="bold" color="error.main">{rejeitadas.length}</Typography>
                            <Typography variant="caption">Rejeitadas</Typography>
                        </Paper>
                    </Grid>
                </Grid>

                <Divider sx={{ my: 2 }} />

                {propostas.length === 0 ? (
                    <Typography variant="body1" color="text.secondary" sx={{ textAlign: 'center', mt: 4 }}>
                        Você não possui nenhuma proposta no momento.
                    </Typography>
                ) : (
                    <List disablePadding>
                        {propostas.map((proposta, index) => {
                            const dataAula = proposta.dataInicio?.toDate
                                ? dayjs(proposta.dataInicio.toDate()).format('DD/MM/YYYY [às] HH:mm')
                                : '—';
                            const dataProposta = proposta.createdAt?.toDate
                                ? dayjs(proposta.createdAt.toDate()).format('DD/MM/YYYY HH:mm')
                                : '—';

                            return (
                                <React.Fragment key={proposta.id}>
                                    <ListItem alignItems="flex-start" sx={{ px: 0 }}>
                                        <ListItemText
                                            primary={
                                                <Typography variant="subtitle1" fontWeight="bold">
                                                    {proposta.assunto || 'Sem título'}
                                                </Typography>
                                            }
                                            secondary={
                                                <Box component="span" sx={{ display: 'flex', flexDirection: 'column', gap: 0.3, mt: 0.5 }}>
                                                    <Typography variant="body2" component="span" color="text.secondary">
                                                        🏛️ {proposta.laboratorioSelecionado || '—'} &nbsp;|&nbsp; 📅 {dataAula}
                                                    </Typography>
                                                    <Typography variant="caption" component="span" color="text.disabled">
                                                        Proposto em: {dataProposta}
                                                    </Typography>
                                                </Box>
                                            }
                                        />
                                        <ListItemSecondaryAction>
                                            <Chip {...getChipProps(proposta.status)} size="small" />
                                        </ListItemSecondaryAction>
                                    </ListItem>
                                    {index < propostas.length - 1 && <Divider />}
                                </React.Fragment>
                            );
                        })}
                    </List>
                )}
            </Paper>
        </Container>
    );
};

export default MinhasPropostas;