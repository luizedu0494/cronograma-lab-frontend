import React, { useState, useEffect } from 'react';
import {
    Dialog, DialogTitle, DialogContent, DialogActions, Button,
    TextField, FormControl, InputLabel, Select, MenuItem,
    Box, Typography, Alert, Chip, CircularProgress, Divider,
    FormControlLabel, Checkbox, Stack
} from '@mui/material';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDayjs } from '@mui/x-date-pickers/AdapterDayjs';
import dayjs from 'dayjs';
import 'dayjs/locale/pt-br';
import { LISTA_LABORATORIOS, TIPOS_LABORATORIO } from '../constants/laboratorios';
import { LISTA_CURSOS } from '../constants/cursos';
import { Edit, AlertCircle } from 'lucide-react';

dayjs.locale('pt-br');

const BLOCOS_HORARIO = [
    { value: '07:00-09:10', label: '07:00 - 09:10' },
    { value: '09:30-12:00', label: '09:30 - 12:00' },
    { value: '13:00-15:10', label: '13:00 - 15:10' },
    { value: '15:30-18:00', label: '15:30 - 18:00' },
    { value: '18:30-20:10', label: '18:30 - 20:10' },
    { value: '20:30-22:00', label: '20:30 - 22:00' },
];

/**
 * Diálogo para edição em lote de aulas
 * 
 * Props:
 * - open: boolean
 * - onClose: Callback quando fechar
 * - onConfirm: Callback com dados de edição
 * - aulasCount: número de aulas selecionadas
 * - loading: boolean para estado de carregamento
 */
const BulkEditDialog = ({ 
    open = false, 
    onClose, 
    onConfirm,
    aulasCount = 0,
    loading = false
}) => {
    const [formData, setFormData] = useState({
        assunto: '',
        cursos: [],
        laboratorio: '',
        laboratorioTipo: '',
        data: null,
        horario: '',
        status: '',
        liga: '',
        observacoes: ''
    });

    const [aplicarCampos, setAplicarCampos] = useState({
        assunto: false,
        cursos: false,
        laboratorio: false,
        data: false,
        horario: false,
        status: false,
        liga: false,
        observacoes: false
    });

    const [errors, setErrors] = useState({});

    const handleToggleCampo = (campo) => {
        setAplicarCampos(prev => ({
            ...prev,
            [campo]: !prev[campo]
        }));
    };

    const handleChangeFormData = (campo, valor) => {
        setFormData(prev => ({
            ...prev,
            [campo]: valor
        }));
    };

    const handleLabTipoChange = (tipo) => {
        handleChangeFormData('laboratorioTipo', tipo);
        handleChangeFormData('laboratorio', '');
    };

    const handleConfirm = () => {
        setErrors({});
        const novoErrors = {};

        // Validar que pelo menos um campo foi selecionado
        const algumCampoSelecionado = Object.values(aplicarCampos).some(v => v);
        if (!algumCampoSelecionado) {
            novoErrors.geral = 'Selecione pelo menos um campo para editar';
            setErrors(novoErrors);
            return;
        }

        // Validar campos selecionados
        if (aplicarCampos.assunto && !formData.assunto.trim()) {
            novoErrors.assunto = 'Assunto é obrigatório';
        }

        if (aplicarCampos.laboratorio && !formData.laboratorio) {
            novoErrors.laboratorio = 'Laboratório é obrigatório';
        }

        if (aplicarCampos.data && !formData.data) {
            novoErrors.data = 'Data é obrigatória';
        }

        if (aplicarCampos.horario && !formData.horario) {
            novoErrors.horario = 'Horário é obrigatório';
        }

        if (Object.keys(novoErrors).length > 0) {
            setErrors(novoErrors);
            return;
        }

        // Preparar dados para envio
        const dadosEdicao = {};
        Object.keys(aplicarCampos).forEach(campo => {
            if (aplicarCampos[campo]) {
                dadosEdicao[campo] = formData[campo];
            }
        });

        onConfirm?.(dadosEdicao);
        handleClose();
    };

    const handleClose = () => {
        setFormData({
            assunto: '',
            cursos: [],
            laboratorio: '',
            laboratorioTipo: '',
            data: null,
            horario: '',
            status: '',
            liga: '',
            observacoes: ''
        });
        setAplicarCampos({
            assunto: false,
            cursos: false,
            laboratorio: false,
            data: false,
            horario: false,
            status: false,
            liga: false,
            observacoes: false
        });
        setErrors({});
        onClose?.();
    };

    const labsDisponiveis = formData.laboratorioTipo
        ? LISTA_LABORATORIOS.filter(l => l.tipo === formData.laboratorioTipo)
        : [];

    return (
        <Dialog open={open} onClose={handleClose} maxWidth="sm" fullWidth>
            <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <Edit size={24} />
                Editar {aulasCount} Aula(s)
            </DialogTitle>

            <DialogContent sx={{ pt: 2 }}>
                <Alert severity="info" sx={{ mb: 2 }}>
                    Selecione os campos que deseja editar. Apenas os campos marcados serão alterados.
                </Alert>

                {errors.geral && (
                    <Alert severity="error" sx={{ mb: 2 }}>
                        {errors.geral}
                    </Alert>
                )}

                <LocalizationProvider dateAdapter={AdapterDayjs} adapterLocale="pt-br">
                    <Stack spacing={2}>
                        {/* Assunto */}
                        <Box sx={{ display: 'flex', gap: 1, alignItems: 'flex-start' }}>
                            <Checkbox
                                checked={aplicarCampos.assunto}
                                onChange={() => handleToggleCampo('assunto')}
                                sx={{ mt: 1 }}
                            />
                            <TextField
                                fullWidth
                                label="Assunto"
                                value={formData.assunto}
                                onChange={(e) => handleChangeFormData('assunto', e.target.value)}
                                disabled={!aplicarCampos.assunto}
                                error={!!errors.assunto}
                                helperText={errors.assunto}
                                size="small"
                            />
                        </Box>

                        {/* Cursos */}
                        <Box sx={{ display: 'flex', gap: 1, alignItems: 'flex-start' }}>
                            <Checkbox
                                checked={aplicarCampos.cursos}
                                onChange={() => handleToggleCampo('cursos')}
                                sx={{ mt: 1 }}
                            />
                            <FormControl fullWidth size="small" disabled={!aplicarCampos.cursos}>
                                <InputLabel shrink>Cursos</InputLabel>
                                <Select
                                    multiple
                                    value={formData.cursos}
                                    onChange={(e) => handleChangeFormData('cursos', e.target.value)}
                                    label="Cursos"
                                    renderValue={(selected) => (
                                        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                                            {selected.map((value) => (
                                                <Chip key={value} label={value} size="small" />
                                            ))}
                                        </Box>
                                    )}
                                >
                                    {LISTA_CURSOS.map(c => (
                                        <MenuItem key={c.value} value={c.value}>{c.label}</MenuItem>
                                    ))}
                                </Select>
                            </FormControl>
                        </Box>

                        {/* Laboratório */}
                        <Box sx={{ display: 'flex', gap: 1, alignItems: 'flex-start' }}>
                            <Checkbox
                                checked={aplicarCampos.laboratorio}
                                onChange={() => handleToggleCampo('laboratorio')}
                                sx={{ mt: 1 }}
                            />
                            <Box sx={{ flex: 1 }}>
                                <FormControl fullWidth size="small" disabled={!aplicarCampos.laboratorio} sx={{ mb: 1 }}>
                                    <InputLabel shrink>Tipo de Laboratório</InputLabel>
                                    <Select
                                        value={formData.laboratorioTipo}
                                        onChange={(e) => handleLabTipoChange(e.target.value)}
                                        label="Tipo de Laboratório"
                                    >
                                        <MenuItem value="">
                                            <em>Selecione...</em>
                                        </MenuItem>
                                        {TIPOS_LABORATORIO.map(t => (
                                            <MenuItem key={t.id} value={t.id}>{t.name}</MenuItem>
                                        ))}
                                    </Select>
                                </FormControl>
                                <FormControl fullWidth size="small" disabled={!aplicarCampos.laboratorio || !formData.laboratorioTipo} error={!!errors.laboratorio}>
                                    <InputLabel shrink>Laboratório</InputLabel>
                                    <Select
                                        value={formData.laboratorio}
                                        onChange={(e) => handleChangeFormData('laboratorio', e.target.value)}
                                        label="Laboratório"
                                    >
                                        <MenuItem value="">
                                            <em>Selecione...</em>
                                        </MenuItem>
                                        {labsDisponiveis.map(l => (
                                            <MenuItem key={l.id} value={l.name}>{l.name}</MenuItem>
                                        ))}
                                    </Select>
                                </FormControl>
                            </Box>
                        </Box>

                        {/* Data */}
                        <Box sx={{ display: 'flex', gap: 1, alignItems: 'flex-start' }}>
                            <Checkbox
                                checked={aplicarCampos.data}
                                onChange={() => handleToggleCampo('data')}
                                sx={{ mt: 1 }}
                            />
                            <DatePicker
                                label="Data"
                                value={formData.data}
                                onChange={(newValue) => handleChangeFormData('data', newValue)}
                                disabled={!aplicarCampos.data}
                                slotProps={{
                                    textField: { 
                                        fullWidth: true, 
                                        size: 'small',
                                        error: !!errors.data,
                                        helperText: errors.data
                                    }
                                }}
                            />
                        </Box>

                        {/* Horário */}
                        <Box sx={{ display: 'flex', gap: 1, alignItems: 'flex-start' }}>
                            <Checkbox
                                checked={aplicarCampos.horario}
                                onChange={() => handleToggleCampo('horario')}
                                sx={{ mt: 1 }}
                            />
                            <FormControl fullWidth size="small" disabled={!aplicarCampos.horario} error={!!errors.horario}>
                                <InputLabel shrink>Horário</InputLabel>
                                <Select
                                    value={formData.horario}
                                    onChange={(e) => handleChangeFormData('horario', e.target.value)}
                                    label="Horário"
                                >
                                    <MenuItem value="">
                                        <em>Selecione...</em>
                                    </MenuItem>
                                    {BLOCOS_HORARIO.map(b => (
                                        <MenuItem key={b.value} value={b.value}>{b.label}</MenuItem>
                                    ))}
                                </Select>
                            </FormControl>
                        </Box>

                        {/* Status */}
                        <Box sx={{ display: 'flex', gap: 1, alignItems: 'flex-start' }}>
                            <Checkbox
                                checked={aplicarCampos.status}
                                onChange={() => handleToggleCampo('status')}
                                sx={{ mt: 1 }}
                            />
                            <FormControl fullWidth size="small" disabled={!aplicarCampos.status}>
                                <InputLabel shrink>Status</InputLabel>
                                <Select
                                    value={formData.status}
                                    onChange={(e) => handleChangeFormData('status', e.target.value)}
                                    label="Status"
                                >
                                    <MenuItem value="">
                                        <em>Selecione...</em>
                                    </MenuItem>
                                    <MenuItem value="aprovada">✅ Aprovada</MenuItem>
                                    <MenuItem value="pendente">⏳ Pendente</MenuItem>
                                    <MenuItem value="reprovada">❌ Reprovada</MenuItem>
                                </Select>
                            </FormControl>
                        </Box>

                        {/* Liga */}
                        <Box sx={{ display: 'flex', gap: 1, alignItems: 'flex-start' }}>
                            <Checkbox
                                checked={aplicarCampos.liga}
                                onChange={() => handleToggleCampo('liga')}
                                sx={{ mt: 1 }}
                            />
                            <TextField
                                fullWidth
                                label="Liga"
                                value={formData.liga}
                                onChange={(e) => handleChangeFormData('liga', e.target.value)}
                                disabled={!aplicarCampos.liga}
                                size="small"
                            />
                        </Box>

                        {/* Observações */}
                        <Box sx={{ display: 'flex', gap: 1, alignItems: 'flex-start' }}>
                            <Checkbox
                                checked={aplicarCampos.observacoes}
                                onChange={() => handleToggleCampo('observacoes')}
                                sx={{ mt: 1 }}
                            />
                            <TextField
                                fullWidth
                                label="Observações"
                                value={formData.observacoes}
                                onChange={(e) => handleChangeFormData('observacoes', e.target.value)}
                                disabled={!aplicarCampos.observacoes}
                                multiline
                                rows={2}
                                size="small"
                            />
                        </Box>
                    </Stack>
                </LocalizationProvider>

                <Alert severity="warning" sx={{ mt: 2, display: 'flex', alignItems: 'center', gap: 1 }}>
                    <AlertCircle size={18} />
                    <Typography variant="body2">
                        Campos não marcados não serão alterados
                    </Typography>
                </Alert>
            </DialogContent>

            <DialogActions sx={{ p: 2, gap: 1 }}>
                <Button onClick={handleClose} variant="outlined" disabled={loading}>
                    Cancelar
                </Button>
                <Button 
                    onClick={handleConfirm} 
                    variant="contained"
                    disabled={loading || !Object.values(aplicarCampos).some(v => v)}
                >
                    {loading ? <CircularProgress size={20} sx={{ mr: 1 }} /> : null}
                    Aplicar Edições
                </Button>
            </DialogActions>
        </Dialog>
    );
};

export default BulkEditDialog;
