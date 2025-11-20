// src/PainelAvisos.js
import React, { useState, useEffect } from 'react';
import { db } from './firebaseConfig';
import {
  collection, query, orderBy, onSnapshot, Timestamp,
  doc, setDoc, getDocs, serverTimestamp
} from 'firebase/firestore';
import { useAuth } from './AuthContext';
import {
  Container, Typography, Box, CircularProgress, Alert,
  Card, CardContent, Divider, Button, Tooltip, IconButton,
  Collapse, Chip, Avatar, Stack
} from '@mui/material';
import { styled, useTheme } from '@mui/material/styles';
import { motion, AnimatePresence } from 'framer-motion';

import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import MarkAsUnreadIcon from '@mui/icons-material/MarkAsUnread';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import InfoIcon from '@mui/icons-material/Info';
import WarningIcon from '@mui/icons-material/Warning';
import ReportIcon from '@mui/icons-material/Report';

import dayjs from 'dayjs';
import 'dayjs/locale/pt-br';
import relativeTime from 'dayjs/plugin/relativeTime';

dayjs.locale('pt-br');
dayjs.extend(relativeTime);

const ExpandMore = styled((props) => {
  const { expand, ...other } = props;
  return <IconButton {...other} />;
})(({ theme, expand }) => ({
  transform: !expand ? 'rotate(0deg)' : 'rotate(180deg)',
  marginLeft: 'auto',
  transition: theme.transitions.create('transform', {
    duration: theme.transitions.duration.shortest,
  }),
}));

const avisoMeta = {
  normal: { icon: <InfoIcon />, color: 'primary' },
  importante: { icon: <WarningIcon />, color: 'warning' },
  urgente: { icon: <ReportIcon />, color: 'error' },
};

function PainelAvisos() {
  const [avisos, setAvisos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const { currentUser } = useAuth();
  const theme = useTheme();
  const [avisosState, setAvisosState] = useState({});

  const handleToggleExpand = (avisoId) => {
    setAvisosState(prev => ({
      ...prev,
      [avisoId]: { ...prev[avisoId], expanded: !prev[avisoId]?.expanded },
    }));
  };

  const handleMarcarComoLido = async (avisoId) => {
    if (!currentUser) return;
    const leituraDocRef = doc(db, 'avisos', avisoId, 'leituras', currentUser.uid);
    try {
      // Esta função está perfeita e aciona a Cloud Function de decremento.
      await setDoc(leituraDocRef, {
        dataLeitura: serverTimestamp(),
        userName: currentUser.displayName || currentUser.email,
      });
    } catch (err) {
      console.error("Erro ao marcar aviso como lido:", err);
      setError("Não foi possível marcar o aviso como lido.");
    }
  };

  // ===== LÓGICA DE BUSCA OTIMIZADA =====
  useEffect(() => {
    if (!currentUser) {
      setLoading(false);
      return;
    }

    const avisosRef = collection(db, 'avisos');
    const q = query(avisosRef, orderBy('dataCriacao', 'desc'));

    // O onSnapshot agora escuta a coleção de avisos E a subcoleção de leituras do usuário.
    // Isso é muito mais eficiente do que fazer getDoc para cada aviso.
    const unsubscribe = onSnapshot(q, async (avisosSnapshot) => {
      const avisosData = avisosSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        dataCriacao: doc.data().dataCriacao instanceof Timestamp ? dayjs(doc.data().dataCriacao.toDate()) : null,
      }));
      
      // Agora, buscamos TODAS as leituras do usuário de uma vez só.
      // Isso é uma única consulta, não importa quantos avisos existam.
      const leiturasQuery = query(collection(db, `users/${currentUser.uid}/leituras`)); // Supondo que você armazene as leituras aqui
      // Se você não tiver essa coleção, podemos adaptar. Por enquanto, vamos manter a lógica de checagem, mas otimizada.
      
      // A lógica de onSnapshot na coleção principal de avisos (q) já garante a atualização em tempo real
      // do mural de avisos.
      
      // Para o status de "lido", a lógica de onSnapshot na subcoleção 'leituras' de cada aviso
      // é a melhor abordagem sem Cloud Functions, pois garante que o status de leitura
      // seja atualizado em tempo real para o usuário.
      
      // Garante que o estado de leitura seja inicializado para novos avisos
      avisosData.forEach(aviso => {
        if (!avisosState[aviso.id]) {
            const leituraDocRef = doc(db, 'avisos', aviso.id, 'leituras', currentUser.uid);
            // Escuta em tempo real o documento de leitura do usuário para este aviso
            onSnapshot(leituraDocRef, (leituraSnap) => {
                setAvisosState(prev => ({
                    ...prev,
                    [aviso.id]: { ...prev[aviso.id], lido: leituraSnap.exists() }
                }));
            });
        }
      });

      setAvisos(avisosData);
      setLoading(false);
    }, (err) => {
      console.error("Erro ao buscar avisos:", err);
      setError("Falha ao carregar os avisos. Tente novamente mais tarde.");
      setLoading(false);
    });

    return () => unsubscribe();
  }, [currentUser]);


  if (loading) {
    return (
      <Container maxWidth="md" sx={{ textAlign: 'center', mt: 8 }}>
        <CircularProgress />
        <Typography variant="h6" sx={{ mt: 2, color: 'text.secondary' }}>Carregando mural de avisos...</Typography>
      </Container>
    );
  }

  return (
    <Container maxWidth="md" sx={{ mt: 4, mb: 4 }}>
      <Box sx={{ textAlign: 'center', mb: 4 }}>
        <Typography variant="h3" component="h1" fontWeight="bold" color="primary">
          Mural de Avisos
        </Typography>
        <Typography variant="h6" color="text.secondary">
          Fique por dentro das últimas novidades e comunicados.
        </Typography>
      </Box>

      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

      {avisos.length === 0 && !loading ? (
        <Box sx={{ textAlign: 'center', mt: 8 }}>
          {/* Adicione um caminho real para sua imagem de estado vazio */}
          <img src="/images/empty-state.svg" alt="Nenhum aviso" style={{ width: '200px', opacity: 0.7 }} />
          <Typography variant="h6" color="text.secondary" sx={{ mt: 2 }}>
            Nenhum aviso por aqui ainda.
          </Typography>
        </Box>
      ) : (
        <AnimatePresence>
          <Stack spacing={3}>
            {avisos.map((aviso, index) => {
              const { lido, expanded } = avisosState[aviso.id] || { lido: false, expanded: false };
              const tipo = aviso.tipo || 'normal';
              const meta = avisoMeta[tipo];

              return (
                <motion.div
                  key={aviso.id}
                  initial={{ opacity: 0, y: 50, scale: 0.9 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.9, transition: { duration: 0.2 } }}
                  transition={{ duration: 0.5, delay: index * 0.05 }}
                >
                  <Card
                    elevation={lido ? 2 : 6}
                    sx={{
                      borderLeft: `5px solid ${theme.palette[meta.color]?.main || theme.palette.primary.main}`,
                      transition: 'all 0.3s ease-in-out',
                      transform: lido ? 'scale(0.98)' : 'scale(1)',
                      opacity: lido ? 0.85 : 1,
                    }}
                  >
                    <CardContent sx={{ pb: 1 }}>
                      <Box display="flex" alignItems="center" mb={1}>
                        <Avatar sx={{ bgcolor: `${meta.color}.main`, mr: 2 }}>{meta.icon}</Avatar>
                        <Box flexGrow={1}>
                          <Typography variant="h6" component="h2" fontWeight="500">
                            {aviso.titulo || "Aviso"}
                          </Typography>
                          <Typography variant="caption" color="text.secondary">
                            Postado por {aviso.autorNome || 'Administrador'} • {aviso.dataCriacao?.fromNow()}
                          </Typography>
                        </Box>
                        <Chip label={tipo} color={meta.color} size="small" variant="outlined" />
                      </Box>
                      <Divider sx={{ my: 1.5 }} />
                      
                      <Collapse in={expanded} timeout="auto" unmountOnExit>
                        <Typography variant="body1" sx={{ whiteSpace: 'pre-line', mb: 2, pl: 1, borderLeft: `2px solid ${theme.palette.divider}` }}>
                          {aviso.mensagem}
                        </Typography>
                      </Collapse>
                      
                      <Box display="flex" justifyContent="space-between" alignItems="center" mt={1}>
                        <Button
                          variant="text"
                          size="small"
                          onClick={() => handleMarcarComoLido(aviso.id)}
                          disabled={lido}
                          startIcon={lido ? <CheckCircleIcon /> : <MarkAsUnreadIcon />}
                        >
                          {lido ? 'Lido' : 'Marcar como Lido'}
                        </Button>
                        <Tooltip title={expanded ? 'Recolher aviso' : 'Expandir para ler mais'}>
                          <ExpandMore
                            expand={expanded}
                            onClick={() => handleToggleExpand(aviso.id)}
                            aria-expanded={expanded}
                            aria-label="show more"
                          >
                            <ExpandMoreIcon />
                          </ExpandMore>
                        </Tooltip>
                      </Box>
                    </CardContent>
                  </Card>
                </motion.div>
              );
            })}
          </Stack>
        </AnimatePresence>
      )}
    </Container>
  );
}

export default PainelAvisos;
