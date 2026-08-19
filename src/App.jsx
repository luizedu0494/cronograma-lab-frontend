import React, { useState, useEffect, useMemo, useCallback, lazy, Suspense } from 'react';
import { BrowserRouter as Router, Routes, Route, Link, Navigate, Outlet } from 'react-router-dom';
import { auth, db, googleProvider } from './firebaseConfig';
import { signInWithPopup, signOut, onAuthStateChanged } from 'firebase/auth';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import getAppTheme from './theme';
import cesmacLogo from './assets/images/cesmac-logo.png';
import {
    AppBar, Toolbar, Typography, Button, Container, Box,
    CircularProgress, Snackbar, Alert, IconButton, Menu, MenuItem, Badge,
    ThemeProvider, CssBaseline, useMediaQuery, Avatar, Divider, Paper,
    Drawer, BottomNavigation, BottomNavigationAction, List, ListItemButton,
    ListItemIcon, ListItemText, Collapse
} from '@mui/material';
import { AdapterDayjs } from '@mui/x-date-pickers/AdapterDayjs';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import 'dayjs/locale/pt-br';
import AccountCircle from '@mui/icons-material/AccountCircle';
import {
    Menu as MenuIcon, Sun, Moon, LogOut, User, HelpCircle, UserCheck, Users, CalendarOff, Settings, Bell, ListTodo, Calendar, LayoutDashboard, ThumbsUp, PlusCircle, Download, BarChart, Bug, History, Bot, FlaskConical, Search, ChevronDown, ChevronUp
} from 'lucide-react';


import PromptInstalacaoPWA from './componentes/comuns/PromptInstalacaoPWA';

// --- LAZY LOADING DE PÁGINAS COM TRATAMENTO DE RE-DEPLOY ---
const lazyWithRetry = (componentImport) =>
    lazy(async () => {
        const pageHasAlreadyBeenReloaded = JSON.parse(
            window.sessionStorage.getItem('page-has-been-reloaded') || 'false'
        );
        try {
            const component = await componentImport();
            window.sessionStorage.setItem('page-has-been-reloaded', 'false');
            return component;
        } catch (error) {
            if (!pageHasAlreadyBeenReloaded) {
                window.sessionStorage.setItem('page-has-been-reloaded', 'true');
                window.location.reload();
            }
            throw error;
        }
    });

const ProporAulaForm = lazyWithRetry(() => import('./ProporAulaForm'));
const ProporEventoForm = lazyWithRetry(() => import('./ProporEventoForm'));
const MinhasPropostas = lazyWithRetry(() => import('./MinhasPropostas'));
const GerenciarAprovacoes = lazyWithRetry(() => import('./pages/Gerenciar/GerenciarAprovacoes'));
const GerenciarUsuarios = lazyWithRetry(() => import('./pages/Gerenciar/GerenciarUsuarios'));
const CalendarioCronograma = lazyWithRetry(() => import('./pages/Cronograma/CalendarioCronograma'));
const MinhasDesignacoes = lazyWithRetry(() => import('./MinhasDesignacoes'));
const PainelAvisos = lazyWithRetry(() => import('./PainelAvisos'));
const GerenciarAvisos = lazyWithRetry(() => import('./pages/Gerenciar/GerenciarAvisos'));
const AjudaFAQ = lazyWithRetry(() => import('./AjudaFAQ'));
const ConfiguracoesPerfil = lazyWithRetry(() => import('./pages/Perfil/ConfiguracoesPerfil'));
const PaginaInicial = lazyWithRetry(() => import('./pages/Cronograma/PaginaInicial'));
const GerenciarPeriodos = lazyWithRetry(() => import('./pages/Gerenciar/GerenciarPeriodos'));
const DownloadCronograma = lazyWithRetry(() => import('./DownloadCronograma'));
const AnaliseAulas = lazyWithRetry(() => import('./pages/Gerenciar/AnaliseAulas'));
const AnaliseEventos = lazyWithRetry(() => import('./pages/Gerenciar/AnaliseEventos'));
const VerificarIntegridadeDados = lazyWithRetry(() => import('./pages/Gerenciar/VerificarIntegridadeDados'));
const HistoricoAulas = lazyWithRetry(() => import('./pages/Cronograma/HistoricoAulas'));
const AssistenteIA = lazyWithRetry(() => import('./pages/IA/AssistenteIA'));
const CalendarioRevisoesTecnico = lazyWithRetry(() => import('./pages/Cronograma/CalendarioRevisoesTecnico'));
const UploadCronogramaExterno = lazyWithRetry(() => import('./UploadCronogramaExterno'));
const GerenciarEventosAvancado = lazyWithRetry(() => import('./GerenciarEventosAvancado'));
const ConsultaDisponibilidade = lazyWithRetry(() => import('./ConsultaDisponibilidade'));

const LoadingFallback = () => (<Box display="flex" justifyContent="center" alignItems="center" height="80vh"><CircularProgress /></Box>);
const MainLayout = () => (<Container maxWidth="xl" sx={{ mt: { xs: 1.5, sm: 4 }, mb: { xs: 8, sm: 4 }, px: { xs: 1.5, sm: 3 } }}><Outlet /></Container>);


function App() {
    const [user, setUser] = useState(null);
    const [userProfileData, setUserProfileData] = useState(null);
    const [pendingProposalsCount, setPendingProposalsCount] = useState(0);
    const [loading, setLoading] = useState(true);
    const [openSnackbar, setOpenSnackbar] = useState(false);
    const [snackbarMessage, setSnackbarMessage] = useState('');
    const [snackbarSeverity, setSnackbarSeverity] = useState('success');
    const [anchorEl, setAnchorEl] = useState(null);
    const [mobileMoreAnchorEl, setMobileMoreAnchorEl] = useState(null);
    const [coordenadorMenuAnchorEl, setCoordenadorMenuAnchorEl] = useState(null);
    const [darkMode, setDarkMode] = useState(() => localStorage.getItem('themeMode') === 'dark');

    const theme = useMemo(() => getAppTheme(darkMode ? 'dark' : 'light'), [darkMode]);
    const isMobile = useMediaQuery(theme.breakpoints.down('sm'));

    const handleThemeChange = () => { const newMode = !darkMode; setDarkMode(newMode); localStorage.setItem('themeMode', newMode ? 'dark' : 'light'); };
    const fetchUserProfileData = useCallback(async (firebaseUser) => {
        if (!firebaseUser) { setUserProfileData(null); return; }
        const userDocRef = doc(db, 'users', firebaseUser.uid);
        const userDocSnap = await getDoc(userDocRef);
        if (userDocSnap.exists()) { setUserProfileData({ uid: firebaseUser.uid, ...userDocSnap.data() }); }
        else {
            const newUserProfile = { email: firebaseUser.email, name: firebaseUser.displayName || firebaseUser.email.split('@')[0], role: null, approvalPending: true, createdAt: serverTimestamp(), photoURL: firebaseUser.photoURL || null };
            await setDoc(userDocRef, newUserProfile);
            setUserProfileData({ uid: firebaseUser.uid, ...newUserProfile });
        }
    }, []);

    useEffect(() => {
        setLoading(true);
        const unsubscribe = onAuthStateChanged(auth, async (currentUserAuth) => {
            setUser(currentUserAuth);
            if (currentUserAuth) await fetchUserProfileData(currentUserAuth);
            else setUserProfileData(null);
            setLoading(false);
        });
        return () => unsubscribe();
    }, [fetchUserProfileData]);

    useEffect(() => {
        if (userProfileData?.role !== 'coordenador') return;
        const q = query(collection(db, 'aulas'), where('status', '==', 'pendente'));
        const unsubscribe = onSnapshot(q, (snapshot) => setPendingProposalsCount(snapshot.size));
        return () => unsubscribe();
    }, [userProfileData?.role]);
    
    const [isLoggingIn, setIsLoggingIn] = useState(false);
    const handleGoogleLogin = async () => {
        if (isLoggingIn) return; setIsLoggingIn(true);
        try {
            googleProvider.setCustomParameters({ prompt: 'select_account' });
            await signInWithPopup(auth, googleProvider);
            setSnackbarMessage("Login realizado com sucesso!"); setSnackbarSeverity("success"); setOpenSnackbar(true);
        } catch (error) { if (error.code !== 'auth/popup-closed-by-user') { setSnackbarMessage(`Erro: ${error.message}`); setSnackbarSeverity("error"); setOpenSnackbar(true); } } finally { setIsLoggingIn(false); }
    };
    const handleLogout = () => { signOut(auth).then(() => handleMenuClose()); };
    const handleCloseSnackbar = (event, reason) => { if (reason === 'clickaway') return; setOpenSnackbar(false); };
    const handleProfileMenuOpen = (event) => setAnchorEl(event.currentTarget);
    const handleMenuClose = () => { setAnchorEl(null); setMobileMoreAnchorEl(null); setCoordenadorMenuAnchorEl(null); };
    const handleMobileMenuOpen = (event) => setMobileMoreAnchorEl(event.currentTarget);
    const handleCoordenadorMenuOpen = (event) => {
        setMobileMoreAnchorEl(null);
        setCoordenadorMenuAnchorEl(event.currentTarget);
    };
    
    const role = userProfileData?.role;
    const approvalPending = userProfileData?.approvalPending;
    const isCoordenadorOrTecnico = role === 'coordenador' || role === 'tecnico';
    
    if (loading) return <LoadingFallback />;
    
    const PendingApprovalScreen = () => (<Container sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '80vh' }}><Paper elevation={3} sx={{ p: 4, textAlign: 'center', maxWidth: 400 }}><Typography variant="h5" gutterBottom>Acesso Pendente</Typography><Button variant="contained" onClick={handleLogout}>Sair</Button></Paper></Container>);
    const LoginScreen = () => (<Container sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '80vh' }}><Paper elevation={3} sx={{ p: 4, textAlign: 'center' }}><img src={cesmacLogo} alt="Logo" style={{ height: '50px', marginBottom: '16px' }} /><Typography variant="h5">Cronograma Lab</Typography><Button variant="contained" sx={{ mt: 2 }} onClick={handleGoogleLogin} disabled={isLoggingIn}>{isLoggingIn ? 'Entrando...' : 'Login com Google'}</Button></Paper></Container>);

    const CoordenadorGerenciarMenu = () => (
        <Menu 
            anchorEl={coordenadorMenuAnchorEl} 
            open={Boolean(coordenadorMenuAnchorEl)} 
            onClose={handleMenuClose}
            anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
            transformOrigin={{ vertical: 'top', horizontal: 'right' }}
        >
            <MenuItem component={Link} to="/gerenciar-aprovacoes" onClick={handleMenuClose}>
                <ListItemIcon>
                    <Badge badgeContent={pendingProposalsCount} color="error">
                        <ThumbsUp size={18} />
                    </Badge>
                </ListItemIcon>
                <ListItemText primary="Aprovações" primaryTypographyProps={{ noWrap: true }} />
            </MenuItem>
            <MenuItem component={Link} to="/analise-aulas" onClick={handleMenuClose}>
                <ListItemIcon><BarChart size={18} /></ListItemIcon>
                <ListItemText primary="Análise de Aulas" primaryTypographyProps={{ noWrap: true }} />
            </MenuItem>
            <MenuItem component={Link} to="/analise-eventos" onClick={handleMenuClose}>
                <ListItemIcon><BarChart size={18} /></ListItemIcon>
                <ListItemText primary="Análise de Eventos" primaryTypographyProps={{ noWrap: true }} />
            </MenuItem>
            <Divider sx={{ my: 0.5 }} />
            <MenuItem component={Link} to="/verificar-integridade" onClick={handleMenuClose}>
                <ListItemIcon><Bug size={18} /></ListItemIcon>
                <ListItemText primary="Integridade" primaryTypographyProps={{ noWrap: true }} />
            </MenuItem>
        </Menu>
    );
    
    const navMenuItems = [
        <MenuItem key="painel" component={Link} to="/" onClick={handleMenuClose}><ListItemIcon><LayoutDashboard size={18} /></ListItemIcon><ListItemText primary="Painel" primaryTypographyProps={{ noWrap: true }} /></MenuItem>,
        <MenuItem key="cal" component={Link} to="/calendario" onClick={handleMenuClose}><ListItemIcon><Calendar size={18} /></ListItemIcon><ListItemText primary="Calendário" primaryTypographyProps={{ noWrap: true }} /></MenuItem>,
        !approvalPending ? <MenuItem key="historico" component={Link} to="/historico-aulas" onClick={handleMenuClose}><ListItemIcon><History size={18} /></ListItemIcon><ListItemText primary="Histórico" primaryTypographyProps={{ noWrap: true }} /></MenuItem> : null,
        !approvalPending ? <MenuItem key="avisos" component={Link} to="/avisos" onClick={handleMenuClose}><ListItemIcon><Bell size={18} /></ListItemIcon><ListItemText primary="Avisos" primaryTypographyProps={{ noWrap: true }} /></MenuItem> : null,
        !approvalPending ? <MenuItem key="ia" component={Link} to="/assistente-ia" onClick={handleMenuClose}><ListItemIcon><Bot size={18} /></ListItemIcon><ListItemText primary="Assistente IA" primaryTypographyProps={{ noWrap: true }} /></MenuItem> : null,
        <Divider key="div1" sx={{ my: 0.5 }} />,
        ...(role === 'coordenador' && !approvalPending ? [
            <MenuItem key="agend" component={Link} to="/propor-aula" onClick={handleMenuClose}><ListItemIcon><PlusCircle size={18} /></ListItemIcon><ListItemText primary="Agendar Aula" primaryTypographyProps={{ noWrap: true }} /></MenuItem>,
            <MenuItem key="agend-evento" component={Link} to="/propor-evento" onClick={handleMenuClose}><ListItemIcon><PlusCircle size={18} /></ListItemIcon><ListItemText primary="Agendar Evento" primaryTypographyProps={{ noWrap: true }} /></MenuItem>,
            <MenuItem key="gerenciar-eventos-avancado" component={Link} to="/gerenciar-eventos-avancado" onClick={handleMenuClose}><ListItemIcon><CalendarOff size={18} /></ListItemIcon><ListItemText primary="Gerenciar Eventos" primaryTypographyProps={{ noWrap: true }} /></MenuItem>,
            <MenuItem key="consulta-disponibilidade" component={Link} to="/consulta-disponibilidade" onClick={handleMenuClose}><ListItemIcon><Search size={18} /></ListItemIcon><ListItemText primary="Consulta Disponibilidade" primaryTypographyProps={{ noWrap: true }} /></MenuItem>,
            <MenuItem key="gerenciar-menu" onClick={handleCoordenadorMenuOpen}><ListItemIcon><ListTodo size={18} /></ListItemIcon><ListItemText primary="Gerenciar" primaryTypographyProps={{ noWrap: true }} /></MenuItem>,
            <MenuItem key="users" component={Link} to="/gerenciar-usuarios" onClick={handleMenuClose}><ListItemIcon><Users size={18} /></ListItemIcon><ListItemText primary="Usuários" primaryTypographyProps={{ noWrap: true }} /></MenuItem>,
            <MenuItem key="importar-externo" component={Link} to="/importar-cronograma-externo" onClick={handleMenuClose}><ListItemIcon><Download size={18} /></ListItemIcon><ListItemText primary="Importar Cronograma" primaryTypographyProps={{ noWrap: true }} /></MenuItem>,
            <MenuItem key="periodos" component={Link} to="/gerenciar-periodos" onClick={handleMenuClose}><ListItemIcon><CalendarOff size={18} /></ListItemIcon><ListItemText primary="Períodos Eventos" primaryTypographyProps={{ noWrap: true }} /></MenuItem>,
            <MenuItem key="gerenciar-avisos" component={Link} to="/gerenciar-avisos" onClick={handleMenuClose}><ListItemIcon><Settings size={18} /></ListItemIcon><ListItemText primary="Gerenciar Avisos" primaryTypographyProps={{ noWrap: true }} /></MenuItem>,
        ] : []),
        ...(role === 'tecnico' && !approvalPending ? [
            <MenuItem key="aula" component={Link} to="/propor-aula" onClick={handleMenuClose}><ListItemIcon><PlusCircle size={18} /></ListItemIcon><ListItemText primary="Propor Atividade" primaryTypographyProps={{ noWrap: true }} /></MenuItem>,
            <MenuItem key="consulta-disponibilidade-tec" component={Link} to="/consulta-disponibilidade" onClick={handleMenuClose}><ListItemIcon><Search size={18} /></ListItemIcon><ListItemText primary="Consulta Disponibilidade" primaryTypographyProps={{ noWrap: true }} /></MenuItem>,
            <MenuItem key="design" component={Link} to="/minhas-designacoes" onClick={handleMenuClose}><ListItemIcon><UserCheck size={18} /></ListItemIcon><ListItemText primary="Designações" primaryTypographyProps={{ noWrap: true }} /></MenuItem>,
            <MenuItem key="prop" component={Link} to="/minhas-propostas" onClick={handleMenuClose}><ListItemIcon><ListTodo size={18} /></ListItemIcon><ListItemText primary="Minhas Propostas" primaryTypographyProps={{ noWrap: true }} /></MenuItem>,
            <MenuItem key="revisoes" component={Link} to="/revisoes" onClick={handleMenuClose}><ListItemIcon><FlaskConical size={18} /></ListItemIcon><ListItemText primary="Revisões" primaryTypographyProps={{ noWrap: true }} /></MenuItem>,
        ] : []),
        <Divider key="div2" sx={{ my: 0.5 }} />,
        isCoordenadorOrTecnico && !approvalPending ? (<MenuItem key="download-cronograma" component={Link} to="/download-cronograma" onClick={handleMenuClose}><ListItemIcon><Download size={18} /></ListItemIcon><ListItemText primary="Baixar Cronograma" primaryTypographyProps={{ noWrap: true }} /></MenuItem>) : null,
        !approvalPending ? <MenuItem key="ajuda" component={Link} to="/ajuda" onClick={handleMenuClose}><ListItemIcon><HelpCircle size={18} /></ListItemIcon><ListItemText primary="Ajuda/FAQ" primaryTypographyProps={{ noWrap: true }} /></MenuItem> : null
    ];

    const cleanMenuItems = (items) => {
        const activeItems = items.filter(Boolean);
        return activeItems.filter((item, idx) => {
            if (item.type === Divider) {
                if (idx === 0 || idx === activeItems.length - 1) return false;
                if (activeItems[idx - 1]?.type === Divider) return false;
            }
            return true;
        });
    };

    const renderMobileMenu = (
        <Menu 
            anchorEl={mobileMoreAnchorEl} 
            open={Boolean(mobileMoreAnchorEl)} 
            onClose={handleMenuClose}
            anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
            transformOrigin={{ vertical: 'top', horizontal: 'right' }}
        >
            {cleanMenuItems(navMenuItems)}
            <Divider sx={{ my: 0.5 }} />
            <MenuItem component={Link} to="/perfil" onClick={handleMenuClose}>
                <ListItemIcon><User size={18} /></ListItemIcon>
                <ListItemText primary="Perfil" primaryTypographyProps={{ noWrap: true }} />
            </MenuItem>
            <MenuItem onClick={handleLogout}>
                <ListItemIcon><LogOut size={18} /></ListItemIcon>
                <ListItemText primary="Sair" primaryTypographyProps={{ noWrap: true }} />
            </MenuItem>
        </Menu>
    );
    const renderProfileMenu = (
        <Menu 
            anchorEl={anchorEl} 
            open={Boolean(anchorEl)} 
            onClose={handleMenuClose}
            anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
            transformOrigin={{ vertical: 'top', horizontal: 'right' }}
        >
            <MenuItem component={Link} to="/perfil" onClick={handleMenuClose}>
                <ListItemIcon><User size={18} /></ListItemIcon>
                <ListItemText primary="Perfil" primaryTypographyProps={{ noWrap: true }} />
            </MenuItem>
            <MenuItem onClick={handleLogout}>
                <ListItemIcon><LogOut size={18} /></ListItemIcon>
                <ListItemText primary="Sair" primaryTypographyProps={{ noWrap: true }} />
            </MenuItem>
        </Menu>
    );

    return (
        <ThemeProvider theme={theme}>
            <CssBaseline />
            <Router>
                <LocalizationProvider dateAdapter={AdapterDayjs} adapterLocale="pt-br">
                    {user && !approvalPending && (
                        <AppBar 
                            position="static"
                            sx={{
                                bgcolor: darkMode ? 'primary.main' : '#ffffff',
                                color: darkMode ? '#ffffff' : '#000000'
                            }}
                        >
                            <Toolbar>
                                <Box component={Link} to="/" sx={{ display: 'flex', alignItems: 'center', textDecoration: 'none', color: 'inherit', flexGrow: 1 }}>
                                    <img src={cesmacLogo} alt="Logo CESMAC" style={{ height: '35px', marginRight: '8px' }} />
                                    {!isMobile && <Typography variant="h6" noWrap>Cronograma Lab</Typography>}
                                </Box>
                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                                    <IconButton onClick={handleThemeChange} color="inherit" aria-label="Alternar tema">
                                        {darkMode ? <Sun size={20}/> : <Moon size={20}/>}
                                    </IconButton>
                                    <IconButton onClick={handleProfileMenuOpen} color="inherit" aria-label="Menu de perfil">
                                        {userProfileData?.photoURL ? (
                                            <Avatar src={userProfileData.photoURL} sx={{ width: 24, height: 24 }} />
                                        ) : (
                                            <AccountCircle sx={{ fontSize: 24 }} />
                                        )}
                                    </IconButton>
                                    <IconButton edge="end" onClick={handleMobileMenuOpen} color="inherit" aria-label="Menu principal">
                                        <MenuIcon size={22} />
                                    </IconButton>
                                </Box>
                            </Toolbar>
                        </AppBar>
                    )}
                    {renderMobileMenu} {renderProfileMenu} {role === 'coordenador' && <CoordenadorGerenciarMenu />}
                    <Suspense fallback={<LoadingFallback />}>
                        <Routes>
                            {!user ? (<Route path="*" element={<LoginScreen />} />) : approvalPending ? (<Route path="*" element={<PendingApprovalScreen />} />) : (
                                <Route element={<MainLayout />}>
                                    <Route path="/" element={<PaginaInicial userInfo={userProfileData}/>} />
                                    <Route path="/calendario" element={<CalendarioCronograma userInfo={userProfileData} />} />
                                    <Route path="/historico-aulas" element={<HistoricoAulas />} />
                                    <Route path="/propor-aula" element={<ProporAulaForm userInfo={userProfileData} currentUser={user} />} />
                                    <Route path="/propor-evento" element={<ProporEventoForm userInfo={userProfileData} currentUser={user} />} />
                                    <Route path="/propor-aula/:aulaId" element={<ProporAulaForm userInfo={userProfileData} currentUser={user} />} />
                                    <Route path="/propor-evento/:eventoId" element={<ProporEventoForm userInfo={userProfileData} currentUser={user} />} />
                                    <Route path="/avisos" element={<PainelAvisos />} />
                                    <Route path="/ajuda" element={<AjudaFAQ />} />
                                    <Route path="/perfil" element={<ConfiguracoesPerfil />} />
                                    <Route path="/consulta-disponibilidade" element={<ConsultaDisponibilidade />} />
                                    {role === 'tecnico' && (<><Route path="/minhas-propostas" element={<MinhasPropostas />} /><Route path="/minhas-designacoes" element={<MinhasDesignacoes />} /><Route path="/revisoes" element={<CalendarioRevisoesTecnico userInfo={userProfileData} />} /></>)}
                                    {role === 'coordenador' && (<>
                                        <Route path="/gerenciar-aprovacoes" element={<GerenciarAprovacoes />} />
                                        <Route path="/gerenciar-usuarios" element={<GerenciarUsuarios />} />
                                        <Route path="/gerenciar-avisos" element={<GerenciarAvisos />} />
                                        <Route path="/gerenciar-periodos" element={<GerenciarPeriodos />} />
                                        <Route path="/gerenciar-eventos-avancado" element={<GerenciarEventosAvancado userInfo={userProfileData} />} />
                                        <Route path="/analise-aulas" element={<AnaliseAulas />} />
                                        <Route path="/analise-eventos" element={<AnaliseEventos />} />
                                        <Route path="/verificar-integridade" element={<VerificarIntegridadeDados />} />
                                        <Route path="/importar-cronograma-externo" element={<UploadCronogramaExterno />} />
                                    </>)}
                                    <Route path="/assistente-ia" element={<AssistenteIA userInfo={userProfileData} currentUser={user} mode={darkMode ? 'dark' : 'light'} />} />
                                    {isCoordenadorOrTecnico && (<Route path="/download-cronograma" element={<DownloadCronograma />} />)}
                                    <Route path="*" element={<Navigate to="/" />} />

                                </Route>
                            )}
                        </Routes>
                    </Suspense>
                    <Snackbar open={openSnackbar} autoHideDuration={6000} onClose={handleCloseSnackbar}><Alert onClose={handleCloseSnackbar} severity={snackbarSeverity}>{snackbarMessage}</Alert></Snackbar>
                    <PromptInstalacaoPWA />
                </LocalizationProvider>
            </Router>
        </ThemeProvider>
    );
}
export default App;