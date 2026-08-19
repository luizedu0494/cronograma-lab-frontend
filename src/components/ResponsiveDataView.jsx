import React from 'react';
import {
  TableContainer,
  Table,
  TableHead,
  TableRow,
  TableCell,
  TableBody,
  Paper,
  Stack,
  Card,
  CardContent,
  Typography,
  Skeleton,
  useMediaQuery,
  useTheme,
  Box,
} from '@mui/material';
import EmptyState from './EmptyState';

/**
 * Componente de visualização responsiva de dados.
 * Em telas pequenas (mobile), renderiza os itens em Cards empilhados.
 * Em telas grandes (desktop), renderiza a tabela completa do MUI.
 */
export default function ResponsiveDataView({
  columns = [],
  rows = [],
  renderMobileCard,
  loading = false,
  emptyMessage = 'Nenhum registro encontrado.',
  emptyTitle = 'Sem dados',
  keyExtractor = (row, index) => row.id || row.key || index,
}) {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));

  if (loading) {
    if (isMobile) {
      return (
        <Stack spacing={2}>
          {[1, 2, 3].map((i) => (
            <Card key={i} sx={{ p: 2 }}>
              <Skeleton variant="text" width="60%" height={28} />
              <Skeleton variant="text" width="40%" height={20} />
              <Skeleton variant="rectangular" height={60} sx={{ mt: 1, borderRadius: 1 }} />
            </Card>
          ))}
        </Stack>
      );
    }
    return (
      <TableContainer component={Paper} sx={{ borderRadius: 2, overflow: 'hidden' }}>
        <Table>
          <TableHead>
            <TableRow>
              {columns.map((col) => (
                <TableCell key={col.field || col.headerName} align={col.align || 'left'}>
                  {col.headerName}
                </TableCell>
              ))}
            </TableRow>
          </TableHead>
          <TableBody>
            {[1, 2, 3, 4].map((i) => (
              <TableRow key={i}>
                {columns.map((col, idx) => (
                  <TableCell key={idx}>
                    <Skeleton variant="text" height={24} />
                  </TableCell>
                ))}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>
    );
  }

  if (!rows || rows.length === 0) {
    return <EmptyState title={emptyTitle} message={emptyMessage} />;
  }

  if (isMobile) {
    return (
      <Stack spacing={1.5}>
        {rows.map((row, index) => {
          const key = keyExtractor(row, index);
          if (renderMobileCard) {
            return <Box key={key}>{renderMobileCard(row, index)}</Box>;
          }
          return (
            <Card key={key} variant="outlined" sx={{ borderRadius: 2 }}>
              <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
                {columns.map((col) => {
                  const val = col.renderCell ? col.renderCell(row) : row[col.field];
                  return (
                    <Box
                      key={col.field || col.headerName}
                      sx={{
                        display: 'flex',
                        justify: 'space-between',
                        alignItems: 'center',
                        py: 0.5,
                        borderBottom: '1px dashed',
                        borderColor: 'divider',
                        '&:last-child': { borderBottom: 'none' },
                      }}
                    >
                      <Typography variant="caption" color="text.secondary" fontWeight={600}>
                        {col.headerName}
                      </Typography>
                      <Typography variant="body2">{val}</Typography>
                    </Box>
                  );
                })}
              </CardContent>
            </Card>
          );
        })}
      </Stack>
    );
  }

  return (
    <TableContainer component={Paper} sx={{ borderRadius: 2, overflow: 'hidden' }}>
      <Table>
        <TableHead>
          <TableRow sx={{ backgroundColor: 'action.hover' }}>
            {columns.map((col) => (
              <TableCell key={col.field || col.headerName} align={col.align || 'left'} sx={{ fontWeight: 600 }}>
                {col.headerName}
              </TableCell>
            ))}
          </TableRow>
        </TableHead>
        <TableBody>
          {rows.map((row, index) => {
            const key = keyExtractor(row, index);
            return (
              <TableRow key={key} hover>
                {columns.map((col) => (
                  <TableCell key={col.field || col.headerName} align={col.align || 'left'}>
                    {col.renderCell ? col.renderCell(row) : row[col.field]}
                  </TableCell>
                ))}
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </TableContainer>
  );
}
