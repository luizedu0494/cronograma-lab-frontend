import React from 'react';
import { Dialog, DialogTitle, DialogContent, DialogActions, Button, Typography, CircularProgress } from '@mui/material';
import PropTypes from 'prop-types';

const DialogConfirmacao = ({ open, onClose, onConfirm, title, message, confirmText = 'Confirmar', cancelText = 'Cancelar', loading = false, confirmColor = 'primary' }) => {
    return (
        <Dialog open={open} onClose={onClose} maxWidth="xs">
            <DialogTitle>{title}</DialogTitle>
            <DialogContent>
                <Typography>{message}</Typography>
            </DialogContent>
            <DialogActions>
                <Button onClick={onClose} disabled={loading}>{cancelText}</Button>
                <Button onClick={onConfirm} variant="contained" color={confirmColor} disabled={loading}>
                    {loading ? <CircularProgress size={24} /> : confirmText}
                </Button>
            </DialogActions>
        </Dialog>
    );
};

DialogConfirmacao.propTypes = {
    open: PropTypes.bool.isRequired,
    onClose: PropTypes.func.isRequired,
    onConfirm: PropTypes.func.isRequired,
    title: PropTypes.string.isRequired,
    message: PropTypes.oneOfType([PropTypes.string, PropTypes.node]).isRequired,
    confirmText: PropTypes.string,
    cancelText: PropTypes.string,
    loading: PropTypes.bool,
    confirmColor: PropTypes.string,
};

export default DialogConfirmacao;
