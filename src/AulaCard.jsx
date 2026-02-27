import React, { useState } from 'react';
import {
    ListItem, ListItemText, Box, Typography, Chip, IconButton, Tooltip,
    TextField, FormControl, InputLabel, Select, MenuItem, Grid, Button
} from '@mui/material';
import EditIcon from '@mui/icons-material/Edit';
import SaveIcon from '@mui/icons-material/Save';
import CancelIcon from '@mui/icons-material/Cancel';
import MoreVertIcon from '@mui/icons-material/MoreVert';
import GroupIcon from '@mui/icons-material/Group';
import dayjs from 'dayjs';

import { LISTA_CURSOS } from './constants/cursos';
import { LISTA_LABORATORIOS } from './constants/laboratorios';

// É uma boa prática ter as constantes em um só lugar.
// Se você não tiver este arquivo, pode copiar o array para cá.
const BLOCOS_HORARIO = [
    {"value": "07:00-09:10", "label": "07:00 - 09:10", "turno": "Matutino"},
    {"value": "09:30-12:00", "label": "09:30 - 12:00", "turno": "Matutino"},
    {"value": "13:00-15:10", "label": "13:00 - 15:10", "turno": "Vespertino"},
    {"value": "15:30-18:00", "label": "15:30 - 18:00", "turno": "Vespertino"},
    {"value": "18:30-20:10", "label": "18:30 - 20:10", "turno": "Noturno"},
    {"value": "20:30-22:00", "label": "20:30 - 22:00", "turno": "Noturno"},
];

const CURSO_COLORS = {
    'biomedicina': '#4CAF50', 'farmacia': '#F44336', 'enfermagem': '#2196F3',
    'odontologia': '#FF9800', 'medicina': '#9C27B0', 'fisioterapia': '#FFC107',
    'nutricao': '#00BCD4', 'ed_fisica': '#795548', 'psicologia': '#E91E63',
    'med_veterinaria': '#8BC34A', 'quimica_tecnologica': '#607D8B', 'engenharia': '#9E9E9E',
    'tec_cosmetico': '#3F51B5', 'default': '#616161'
};

function AulaCard({ aula, onOpenMenu, onSave, isCoordenador }) {
    const [isEditing, setIsEditing] = useState(false);
    const [editData, setEditData] = useState(null);
    const [loading, setLoading] = useState(false);

    const handleEdit = () => {
        setEditData({
            assunto: aula.title,
            laboratorioSelecionado: aula.laboratorio,
            horarioSlotString: aula.horarioSlotString,
        });
        setIsEditing(true);
    };

    const handleCancel = () => {
        setIsEditing(false);
        setEditData(null);
    };

    const handleSave = async () => {
        setLoading(true);
        try {
            await onSave(aula.id, editData);
            setIsEditing(false);
        } catch (error) {
            console.error("Falha ao salvar no card:", error);
        } finally {
            setLoading(false);
        }
    };

    const handleChange = (field) => (event) => {
        setEditData({ ...editData, [field]: event.target.value });
    };

    if (isEditing) {
        return (
            <ListItem divider sx={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', p: 2, bgcolor: 'action.hover' }}>
                <Grid container spacing={2} alignItems="center">
                    <Grid item xs={12}>
                        <TextField
                            fullWidth
                            label="Assunto"
                            defaultValue={editData.assunto}
                            onChange={handleChange('assunto')}
                            size="small"
                        />
                    </Grid>
                    <Grid item xs={12} sm={6}>
                        <FormControl sx={{ minWidth: 160 }} size="small">
                            <InputLabel shrink>Laboratório</InputLabel>
                            <Select
                                defaultValue={editData.laboratorioSelecionado}
                                label="Laboratório"
                                onChange={handleChange('laboratorioSelecionado')}
                            >
                                {LISTA_LABORATORIOS.map(l => <MenuItem key={l.id} value={l.name}>{l.name}</MenuItem>)}
                            </Select>
                        </FormControl>
                    </Grid>
                    <Grid item xs={12} sm={6}>
                        <FormControl sx={{ minWidth: 150 }} size="small">
                            <InputLabel shrink>Horário</InputLabel>
                            <Select
                                defaultValue={editData.horarioSlotString}
                                label="Horário"
                                onChange={handleChange('horarioSlotString')}
                            >
                                {BLOCOS_HORARIO.map(bloco => <MenuItem key={bloco.value} value={bloco.value}>{bloco.label}</MenuItem>)}
                            </Select>
                        </FormControl>
                    </Grid>
                    <Grid item xs={12} sx={{ display: 'flex', justifyContent: 'flex-end', gap: 1, mt: 1 }}>
                        <Button onClick={handleCancel} startIcon={<CancelIcon />} size="small">Cancelar</Button>
                        <Button onClick={handleSave} variant="contained" color="primary" startIcon={<SaveIcon />} size="small" disabled={loading}>
                            {loading ? 'Salvando...' : 'Salvar'}
                        </Button>
                    </Grid>
                </Grid>
            </ListItem>
        );
    }

    return (
        <ListItem
            divider
            secondaryAction={
                <Box>
                    {isCoordenador && (
                        <Tooltip title="Edição Rápida">
                            <IconButton edge="end" onClick={handleEdit} sx={{ mr: 0.5 }}><EditIcon fontSize="small" /></IconButton>
                        </Tooltip>
                    )}
                    <Tooltip title="Mais opções">
                        <IconButton edge="end" onClick={(e) => onOpenMenu(e, aula)}><MoreVertIcon /></IconButton>
                    </Tooltip>
                </Box>
            }
        >
            <ListItemText
                primary={
                    <Box sx={{ display: 'flex', alignItems: 'center' }}>
                        <Tooltip title={aula.title}>
                            <Typography variant="subtitle1" noWrap sx={{ fontWeight: 'bold', mr: 1.5 }}>{aula.title}</Typography>
                        </Tooltip>
                        <Chip label={aula.tipoAtividade === 'aula' ? 'Aula' : 'Revisão'} color={aula.tipoAtividade === 'aula' ? 'primary' : 'secondary'} size="small" />
                    </Box>
                }
                secondary={
                    <>
                        <Typography variant="body2" color="text.secondary">{aula.start?.format('HH:mm')} - {aula.end?.format('HH:mm')}</Typography>
                        <Typography variant="body2" color="text.secondary">Lab: {aula.laboratorioSelecionado || aula.laboratorio}</Typography>
                        {aula.cursos?.length > 0 && (
                            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, mt: 1 }}>
                                {aula.cursos.map((curso) => (
                                    <Chip key={curso} label={LISTA_CURSOS.find(c => c.value === curso)?.label || curso} size="small" variant="outlined" sx={{ bgcolor: CURSO_COLORS[curso] || '#9e9e9e', color: 'white' }} />
                                ))}
                            </Box>
                        )}
                        {aula.tecnicosNomes?.length > 0 && <Typography variant="caption" sx={{ display: 'flex', alignItems: 'center', mt: 0.5 }}><GroupIcon fontSize='small' sx={{ mr: 0.5 }} />{aula.tecnicosNomes.join(', ')}</Typography>}
                    </>
                }
            />
        </ListItem>
    );
}

export default AulaCard;
