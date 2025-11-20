import React, { useState, useEffect, useCallback } from 'react';
import { db } from './firebaseConfig';
import { collection, onSnapshot, getDocs, doc, addDoc, updateDoc, deleteDoc, query, where, orderBy } from 'firebase/firestore';
import {
    Container, Paper, Typography, Box, Button, List, ListItem, ListItemText,
    IconButton, Dialog, DialogTitle, DialogContent, DialogActions, TextField,
    FormGroup, FormControlLabel, Checkbox, CircularProgress, Alert
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';

function GerenciarGrupos() {
    const [grupos, setGrupos] = useState([]);
    const [loading, setLoading] = useState(true);
    const [openDialog, setOpenDialog] = useState(false);
    const [isEditing, setIsEditing] = useState(false);
    const [currentGrupo, setCurrentGrupo] = useState(null);
    const [nomeGrupo, setNomeGrupo] = useState('');
    const [selectedTecnicos, setSelectedTecnicos] = useState([]);
    const [allTecnicos, setAllTecnicos] = useState([]);
    const [loadingTecnicos, setLoadingTecnicos] = useState(false);
    const [error, setError] = useState('');

    useEffect(() => {
        const q = query(collection(db, 'grupos'), orderBy('nome', 'asc'));
        const unsubscribe = onSnapshot(q, (snapshot) => {
            const gruposData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            setGrupos(gruposData);
            setLoading(false);
        }, (err) => {
            console.error("Erro ao buscar grupos:", err);
            setError("Não foi possível carregar os grupos.");
            setLoading(false);
        });
        return () => unsubscribe();
    }, []);

    const fetchAllTecnicos = useCallback(async () => {
        setLoadingTecnicos(true);
        try {
            const q = query(collection(db, 'users'), where('role', '==', 'tecnico'));
            const querySnapshot = await getDocs(q);
            const tecnicosData = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            setAllTecnicos(tecnicosData);
        } catch (err) {
            console.error("Erro ao buscar técnicos:", err);
            setError("Falha ao carregar lista de técnicos.");
        } finally {
            setLoadingTecnicos(false);
        }
    }, []);

    const handleOpenDialog = (grupo = null) => {
        fetchAllTecnicos();
        if (grupo) {
            setIsEditing(true);
            setCurrentGrupo(grupo);
            setNomeGrupo(grupo.nome);
            setSelectedTecnicos(grupo.membros.map(m => m.uid));
        } else {
            setIsEditing(false);
            setCurrentGrupo(null);
            setNomeGrupo('');
            setSelectedTecnicos([]);
        }
        setOpenDialog(true);
    };

    const handleCloseDialog = () => {
        setOpenDialog(false);
        setError('');
    };

    const handleToggleTecnico = (tecnicoId) => {
        setSelectedTecnicos(prev =>
            prev.includes(tecnicoId) ? prev.filter(id => id !== tecnicoId) : [...prev, tecnicoId]
        );
    };

    const handleSaveGrupo = async () => {
        if (!nomeGrupo.trim()) {
            setError("O nome do grupo é obrigatório.");
            return;
        }

        const membrosData = selectedTecnicos.map(uid => {
            const tecnico = allTecnicos.find(t => t.id === uid);
            return { uid: tecnico.id, name: tecnico.name };
        });

        const grupoData = {
            nome: nomeGrupo.trim(),
            membros: membrosData,
        };

        try {
            if (isEditing) {
                const grupoRef = doc(db, 'grupos', currentGrupo.id);
                await updateDoc(grupoRef, grupoData);
            } else {
                await addDoc(collection(db, 'grupos'), grupoData);
            }
            handleCloseDialog();
        } catch (err) {
            console.error("Erro ao salvar grupo:", err);
            setError("Ocorreu um erro ao salvar o grupo.");
        }
    };

    const handleDeleteGrupo = async (grupoId) => {
        if (window.confirm("Tem certeza que deseja apagar este grupo?")) {
            try {
                await deleteDoc(doc(db, 'grupos', grupoId));
            } catch (err) {
                console.error("Erro ao apagar grupo:", err);
                setError("Ocorreu um erro ao apagar o grupo.");
            }
        }
    };

    return (
        <Container maxWidth="md">
            <Paper sx={{ p: 3, mt: 4 }}>
                <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
                    <Typography variant="h4">Gerir Grupos de Técnicos</Typography>
                    <Button variant="contained" startIcon={<AddIcon />} onClick={() => handleOpenDialog()}>
                        Criar Grupo
                    </Button>
                </Box>
                {loading ? <CircularProgress /> : (
                    <List>
                        {grupos.map(grupo => (
                            <ListItem key={grupo.id} secondaryAction={
                                <>
                                    <IconButton edge="end" aria-label="edit" onClick={() => handleOpenDialog(grupo)}>
                                        <EditIcon />
                                    </IconButton>
                                    <IconButton edge="end" aria-label="delete" onClick={() => handleDeleteGrupo(grupo.id)}>
                                        <DeleteIcon />
                                    </IconButton>
                                </>
                            }>
                                <ListItemText 
                                    primary={grupo.nome}
                                    secondary={`${grupo.membros.length} membro(s)`}
                                />
                            </ListItem>
                        ))}
                    </List>
                )}
            </Paper>

            <Dialog open={openDialog} onClose={handleCloseDialog} fullWidth maxWidth="sm">
                <DialogTitle>{isEditing ? 'Editar Grupo' : 'Criar Novo Grupo'}</DialogTitle>
                <DialogContent>
                    {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
                    <TextField
                        autoFocus
                        margin="dense"
                        label="Nome do Grupo"
                        type="text"
                        fullWidth
                        variant="outlined"
                        value={nomeGrupo}
                        onChange={(e) => setNomeGrupo(e.target.value)}
                    />
                    <Typography sx={{ mt: 2, mb: 1 }}>Membros:</Typography>
                    {loadingTecnicos ? <CircularProgress /> : (
                        <FormGroup>
                            {allTecnicos.map(tecnico => (
                                <FormControlLabel
                                    key={tecnico.id}
                                    control={
                                        <Checkbox
                                            checked={selectedTecnicos.includes(tecnico.id)}
                                            onChange={() => handleToggleTecnico(tecnico.id)}
                                        />
                                    }
                                    label={tecnico.name}
                                />
                            ))}
                        </FormGroup>
                    )}
                </DialogContent>
                <DialogActions>
                    <Button onClick={handleCloseDialog}>Cancelar</Button>
                    <Button onClick={handleSaveGrupo} variant="contained">Salvar</Button>
                </DialogActions>
            </Dialog>
        </Container>
    );
}

export default GerenciarGrupos;