import React from 'react';
import { Box, Card, CardContent, Typography, List, ListItem, ListItemText, Divider, Chip, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Paper } from '@mui/material';
import { Event, AccessTime, School, Science } from '@mui/icons-material';

// Componente para renderizar o resultado de uma consulta de forma visual
const ResultadoVisual = ({ resultado, mode }) => {
    const { tipo_visual, titulo, dados_consulta, sugestoes_acao } = resultado;

    // 1. Renderização de Card de Resumo (Ex: "Quantas aulas tenho?")
    if (tipo_visual === 'card_resumo' && dados_consulta) {
        return (
            <Card sx={{ minWidth: 275, mt: 2, backgroundColor: mode === 'dark' ? '#333' : '#fff' }}>
                <CardContent>
                    <Typography variant="h5" component="div" gutterBottom color="primary">
                        {titulo || "Resumo da Consulta"}
                    </Typography>
                    <Divider sx={{ mb: 2 }} />
                    
                    <List dense>
                        <ListItem>
                            <Event color="action" sx={{ mr: 1 }} />
                            <ListItemText 
                                primary={<Typography variant="h4" color="text.primary">{dados_consulta.total_aulas}</Typography>}
                                secondary="Total de Aulas Encontradas"
                            />
                        </ListItem>
                        <ListItem>
                            <AccessTime color="action" sx={{ mr: 1 }} />
                            <ListItemText 
                                primary={dados_consulta.proxima_aula || "Nenhuma próxima aula"}
                                secondary="Próxima Aula Agendada"
                            />
                        </ListItem>
                        <ListItem>
                            <Science color="action" sx={{ mr: 1 }} />
                            <ListItemText 
                                primary={dados_consulta.laboratorio_mais_usado || "N/A"}
                                secondary="Laboratório Mais Utilizado"
                            />
                        </ListItem>
                    </List>

                    {sugestoes_acao && sugestoes_acao.length > 0 && (
                        <Box sx={{ mt: 2 }}>
                            <Typography variant="subtitle2" gutterBottom>Próximas Ações Sugeridas:</Typography>
                            {sugestoes_acao.map((sugestao, index) => (
                                <Chip 
                                    key={index} 
                                    label={sugestao.label} 
                                    onClick={() => console.log('Ação Sugerida:', sugestao.comando)} 
                                    color="primary" 
                                    variant="outlined" 
                                    sx={{ mr: 1, mb: 1 }}
                                />
                            ))}
                        </Box>
                    )}
                </CardContent>
            </Card>
        );
    }

    // 2. Renderização de Tabela de Aulas (Ex: "Aulas de Medicina em Dezembro")
    if (tipo_visual === 'tabela_aulas' && Array.isArray(dados_consulta)) {
        return (
            <TableContainer component={Paper} sx={{ mt: 2, backgroundColor: mode === 'dark' ? '#333' : '#fff' }}>
                <Typography variant="h6" sx={{ p: 2, color: mode === 'dark' ? '#fff' : '#000' }}>
                    {titulo || "Lista de Aulas"}
                </Typography>
                <Table size="small">
                    <TableHead>
                        <TableRow>
                            <TableCell>Assunto</TableCell>
                            <TableCell>Data</TableCell>
                            <TableCell>Horário</TableCell>
                            <TableCell>Laboratório</TableCell>
                            <TableCell>Cursos</TableCell>
                        </TableRow>
                    </TableHead>
                    <TableBody>
                        {dados_consulta.map((aula, index) => (
                            <TableRow key={index} sx={{ '&:last-child td, &:last-child th': { border: 0 } }}>
                                <TableCell component="th" scope="row">{aula.assunto}</TableCell>
                                <TableCell>{aula.data}</TableCell>
                                <TableCell>{aula.horario}</TableCell>
                                <TableCell>{aula.laboratorio}</TableCell>
                                <TableCell>
                                    {aula.cursos.map((curso, i) => (
                                        <Chip key={i} label={curso} size="small" sx={{ mr: 0.5, mb: 0.5 }} />
                                    ))}
                                </TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </TableContainer>
        );
    }

    // 3. Fallback para texto simples (se a IA não especificar um tipo visual ou se o tipo for desconhecido)
    return (
        <Box sx={{ mt: 1 }}>
            <Typography variant="body1" sx={{ whiteSpace: 'pre-wrap' }}>
                {resultado.resposta || "Resultado da consulta sem formato visual específico."}
            </Typography>
        </Box>
    );
};

export default ResultadoVisual;
