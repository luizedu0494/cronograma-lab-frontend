// src/MinhasPropostas.js

import React, { useState, useEffect } from 'react';
import { db, auth } from './firebaseConfig';
import { collection, query, where, getDocs } from 'firebase/firestore';
import {
    Container, Typography, Box, CircularProgress, Alert, Paper,
    List, ListItem, ListItemText, ListItemSecondaryAction, Chip, Divider
} from '@mui/material';

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
                // Modificado: Consulta todas as propostas do usuário logado
                const q = query(
                    collection(db, 'aulas'),
                    where('propostoPorUid', '==', currentUser.uid)
                );
                const querySnapshot = await getDocs(q);
                const propostasList = querySnapshot.docs.map(doc => ({
                    id: doc.id,
                    ...doc.data()
                }));
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
                return { label: 'Pendente', color: 'warning' };
        }
    };

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
                    Aqui estão todas as aulas que você propôs, com seus respectivos status.
                </Typography>
                <Divider sx={{ my: 2 }} />
                
                {propostas.length === 0 ? (
                    <Typography variant="body1" color="text.secondary" sx={{ textAlign: 'center', mt: 4 }}>
                        Você não possui nenhuma proposta no momento.
                    </Typography>
                ) : (
                    <List>
                        {propostas.map((proposta, index) => (
                            <React.Fragment key={proposta.id}>
                                <ListItem>
                                    <ListItemText
                                        // CORRIGIDO: Agora exibe o assunto da aula
                                        primary={proposta.assunto}
                                        secondary={`Proposto em: ${new Date(proposta.createdAt?.toDate()).toLocaleDateString('pt-BR')}`}
                                    />
                                    <ListItemSecondaryAction>
                                        <Chip {...getChipProps(proposta.status)} />
                                    </ListItemSecondaryAction>
                                </ListItem>
                                {index < propostas.length - 1 && <Divider />}
                            </React.Fragment>
                        ))}
                    </List>
                )}
            </Paper>
        </Container>
    );
};

export default MinhasPropostas;