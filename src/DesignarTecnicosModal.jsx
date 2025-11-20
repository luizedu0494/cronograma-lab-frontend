import React, { useState, useEffect, useCallback } from 'react';
import {
    Dialog, DialogTitle, DialogContent, DialogActions, Button,
    Checkbox, FormControlLabel, FormGroup, CircularProgress, Box, Typography,
    Alert, IconButton, FormControl, InputLabel, Select, MenuItem, Divider
} from '@mui/material';
import ClearIcon from '@mui/icons-material/Clear';
import { collection, getDocs, query, where, doc, updateDoc, orderBy } from 'firebase/firestore';
import { db } from './firebaseConfig';
import PropTypes from 'prop-types';

function DesignarTecnicosModal({ open, onClose, aula, setSnackBar }) {
    const [tecnicosDisponiveis, setTecnicosDisponiveis] = useState([]);
    const [selectedTecnicos, setSelectedTecnicos] = useState([]);
    const [grupos, setGrupos] = useState([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    const fetchData = useCallback(async () => {
        if (!open) return;
        setLoading(true);
        setError('');
        try {
            const usersRef = collection(db, 'users');
            const qTecnicos = query(usersRef, where('role', '==', 'tecnico'));
            const tecnicosSnapshot = await getDocs(qTecnicos);
            const tecnicosList = tecnicosSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            setTecnicosDisponiveis(tecnicosList);

            const gruposRef = collection(db, 'grupos');
            const qGrupos = query(gruposRef, orderBy('nome'));
            const gruposSnapshot = await getDocs(qGrupos);
            const gruposList = gruposSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            setGrupos(gruposList);

            if (aula && Array.isArray(aula.tecnicos)) {
                setSelectedTecnicos(aula.tecnicos);
            } else {
                setSelectedTecnicos([]);
            }
        } catch (err) {
            console.error("Erro ao buscar dados:", err);
            setError('Falha ao carregar dados.');
        } finally {
            setLoading(false);
        }
    }, [open, aula]);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    const handleToggleTecnico = (tecnicoId) => {
        setSelectedTecnicos(prev =>
            prev.includes(tecnicoId) ? prev.filter(id => id !== tecnicoId) : [...prev, tecnicoId]
        );
    };

    const handleApplyGrupo = (event) => {
        const grupoId = event.target.value;
        if (!grupoId) {
            setSelectedTecnicos(aula.tecnicos || []);
            return;
        }
        const grupoSelecionado = grupos.find(g => g.id === grupoId);
        if (grupoSelecionado) {
            const membrosUids = grupoSelecionado.membros.map(m => m.uid);
            setSelectedTecnicos(membrosUids);
        }
    };

    const handleConfirmarDesignacao = async () => {
        if (!aula || !aula.id) return;
        setLoading(true);
        const tecnicosOriginais = new Set(aula.tecnicos || []);
        const tecnicosNovosSelecionados = new Set(selectedTecnicos);
        const idsParaNotificar = [...tecnicosNovosSelecionados].filter(id => !tecnicosOriginais.has(id));

        const tecnicosInfoParaSalvar = selectedTecnicos.map(uid => {
            const tecnico = tecnicosDisponiveis.find(t => t.id === uid);
            if (!tecnico) return null;
            return { uid: tecnico.id, name: tecnico.name };
        }).filter(Boolean);

        try {
            const aulaRef = doc(db, 'aulas', aula.id);
            await updateDoc(aulaRef, {
                tecnicos: selectedTecnicos,
                tecnicosInfo: tecnicosInfoParaSalvar 
            });

            if (idsParaNotificar.length > 0) {
                await fetch('/api/send-push-notification', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ uids: idsParaNotificar, title: 'Nova Designação', body: `Você foi designado para a aula: ${aula.title}.`, link: '/minhas-designacoes' }),
                });
            }

            if(setSnackBar) setSnackBar({ open: true, message: 'Técnico(s) designado(s) com sucesso!', severity: 'success' });
            onClose(true);
        } catch (err) {
            console.error("Erro ao designar técnico:", err);
            setError('Ocorreu um erro ao salvar as alterações.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <Dialog open={open} onClose={() => onClose(false)} fullWidth maxWidth="sm">
            <DialogTitle>
                Designar/Alterar Técnico(s)
                <IconButton aria-label="close" onClick={() => onClose(false)} sx={{position:'absolute',right:8,top:8}}>
                    <ClearIcon/>
                </IconButton>
            </DialogTitle>
            <DialogContent dividers>
                <Typography variant="body2" color="text.secondary" gutterBottom>Aula: {aula?.title}</Typography>
                <FormControl fullWidth variant="outlined" sx={{ my: 2 }}>
                    <InputLabel id="grupo-select-label">Aplicar Grupo</InputLabel>
                    <Select labelId="grupo-select-label" label="Aplicar Grupo" onChange={handleApplyGrupo} defaultValue="">
                        <MenuItem value=""><em>Nenhum / Limpar</em></MenuItem>
                        {grupos.map(grupo => (<MenuItem key={grupo.id} value={grupo.id}>{grupo.nome}</MenuItem>))}
                    </Select>
                </FormControl>
                <Divider sx={{ mb: 1 }}/>
                {loading ? <Box sx={{ display: 'flex', justifyContent: 'center', my: 2 }}><CircularProgress /></Box> :
                 error ? <Alert severity="error">{error}</Alert> :
                 <FormGroup>
                    {tecnicosDisponiveis.map(tecnico => (
                        <FormControlLabel
                            key={tecnico.id}
                            control={
                                <Checkbox checked={selectedTecnicos.includes(tecnico.id)} onChange={() => handleToggleTecnico(tecnico.id)} />
                            }
                            label={tecnico.name || tecnico.email}
                        />
                    ))}
                </FormGroup>
                }
            </DialogContent>
            <DialogActions>
                <Button onClick={() => onClose(false)} disabled={loading}>Cancelar</Button>
                <Button onClick={handleConfirmarDesignacao} variant="contained" disabled={loading}>
                    {loading ? <CircularProgress size={24} /> : "Confirmar"}
                </Button>
            </DialogActions>
        </Dialog>
    );
}

DesignarTecnicosModal.propTypes = {
    open: PropTypes.bool.isRequired,
    onClose: PropTypes.func.isRequired,
    aula: PropTypes.object,
    setSnackBar: PropTypes.func.isRequired,
};

export default DesignarTecnicosModal;