import React, { useState } from 'react';
import { Paper, Box, Typography, Collapse, Divider, Tooltip, IconButton, Menu, MenuItem, Chip, ButtonBase, Checkbox, ListItemIcon, ListItemText } from '@mui/material';
import { MoreVert as MoreVertIcon, Edit as EditIcon, Delete as DeleteIcon } from '@mui/icons-material';
import dayjs from 'dayjs';

const EVENT_COLORS = {
    'Manutenção': '#f44336',
    'Feriado': '#ff9800',
    'Evento': '#1E7EC8', // Azul CESMAC institucional
    'Giro': '#9c27b0',
    'Outro': '#607d8b',
    'default': '#757575'
};

const EventoCard = ({ evento, onEdit, onDelete, isCoordenador, isSelectionMode, isSelected, onToggleSelect }) => {
    const [expanded, setExpanded] = useState(false);
    const [anchorEl, setAnchorEl] = useState(null);
    const openMenu = Boolean(anchorEl);

    const handleMenuClick = (event) => {
        event.stopPropagation();
        setAnchorEl(event.currentTarget);
    };
    const handleMenuClose = () => {
        setAnchorEl(null);
    };

    const handleEditClick = () => {
        onEdit(evento);
        handleMenuClose();
    };

    const handleDeleteClick = () => {
        onDelete(evento);
        handleMenuClose();
    };

    const color = EVENT_COLORS[evento.tipo] || EVENT_COLORS.default;

    // Função para formatar a data com segurança
    const formatTime = (date) => {
        if (!date) return '--:--';
        const d = dayjs(date.toDate ? date.toDate() : date);
        return d.isValid() ? d.format('HH:mm') : '--:--';
    };

    const handleCardClick = () => {
        if (isSelectionMode && onToggleSelect) {
            onToggleSelect(evento.id);
            return;
        }
        setExpanded(!expanded);
    };

    return (
        <Paper 
            elevation={expanded ? 6 : 2} 
            sx={{ 
                width: '100%', 
                mb: 1, 
                position: 'relative',
                borderLeft: `4px solid ${color}`,
                transition: 'box-shadow 0.2s ease-in-out, transform 0.15s ease-in-out',
                bgcolor: isSelected ? 'rgba(25, 118, 210, 0.12)' : 'background.paper',
                border: isSelected ? '1px solid #1976d2' : undefined
            }}
        >
            {isSelectionMode && (
                <Box sx={{ position: 'absolute', top: 4, left: 4, zIndex: 2 }}>
                    <Checkbox size="small" checked={isSelected} onChange={() => onToggleSelect(evento.id)} onClick={(e) => e.stopPropagation()} />
                </Box>
            )}
            {isCoordenador && !isSelectionMode && (
                <>
                    <Tooltip title="Mais Opções">
                        <IconButton size="small" onClick={handleMenuClick} sx={{ position: 'absolute', top: 4, right: 4, zIndex: 2 }}>
                            <MoreVertIcon fontSize="small" />
                        </IconButton>
                    </Tooltip>
                    <Menu 
                        anchorEl={anchorEl} 
                        open={openMenu} 
                        onClose={handleMenuClose}
                        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
                        transformOrigin={{ vertical: 'top', horizontal: 'right' }}
                    >
                        <MenuItem onClick={handleEditClick}>
                            <ListItemIcon><EditIcon fontSize="small" /></ListItemIcon>
                            <ListItemText primary="Editar" />
                        </MenuItem>
                        <MenuItem onClick={handleDeleteClick} sx={{ color: 'error.main' }}>
                            <ListItemIcon><DeleteIcon fontSize="small" sx={{ color: 'error.main' }} /></ListItemIcon>
                            <ListItemText primary="Excluir" />
                        </MenuItem>
                    </Menu>
                </>
            )}
            <ButtonBase 
                onClick={handleCardClick} 
                sx={{ 
                    p: 1.5, 
                    pl: isSelectionMode ? 5 : 1.5,
                    width: '100%', 
                    display: 'block', 
                    textAlign: 'left', 
                    borderRadius: 1 
                }}
            >
                <Box>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mb: 0.5 }}>
                        <Chip label={evento.tipo} size="small" sx={{ fontSize: '0.75rem', bgcolor: color, color: 'white', fontWeight: 600 }} />
                    </Box>
                    <Typography variant="subtitle2" fontWeight="bold" sx={{ pr: '30px', lineHeight: 1.2 }}>{evento.titulo}</Typography>
                    <Typography variant="caption" color="text.secondary">
                        {formatTime(evento.dataInicio || evento.start)} - {formatTime(evento.dataFim || evento.end)}
                    </Typography>
                </Box>
                <Collapse in={expanded} timeout="auto" unmountOnExit>
                    <Divider sx={{ my: 1 }} />
                    <Box sx={{ mt: 1, pl: 1 }}>
                        <Typography variant="body2"><strong>Laboratório:</strong> {evento.laboratorio}</Typography>
                        {evento.descricao && <Typography variant="body2"><strong>Descrição:</strong> {evento.descricao}</Typography>}
                    </Box>
                </Collapse>
            </ButtonBase>
        </Paper>
    );
};

export default EventoCard;
