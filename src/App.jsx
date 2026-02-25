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
    ThemeProvider, CssBaseline, useMediaQuery, Avatar, Divider, Paper
} from '@mui/material';
import { AdapterDayjs } from '@mui/x-date-pickers/AdapterDayjs';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import 'dayjs/locale/pt-br';
import AccountCircle from '@mui/icons-material/AccountCircle';
import {
    Menu as MenuIcon, Sun, Moon, LogOut, User, HelpCircle, UserCheck, Users, Group, CalendarOff, Settings, Bell, ListTodo, Calendar, LayoutDashboard, ThumbsUp, PlusCircle, Download, BarChart, Bug, History, Bot, Upload, FlaskConical
} from 'lucide-react';

// --- LAZY LOADING ---
const ProporAulaForm = lazy(() => import('./ProporAulaForm'));
const ProporEventoForm = lazy(() => import('./ProporEventoForm'));
const MinhasPropostas = lazy(() => import('./MinhasPropostas'));
const GerenciarAprovacoes = lazy(() => import('./GerenciarAprovacoes'));
const GerenciarUsuarios = lazy(() => import('./GerenciarUsuarios'));
const CalendarioCronograma = lazy(() => import('./CalendarioCronograma'));
const MinhasDesignacoes = lazy(() => import('./MinhasDesignacoes'));
const PainelAvisos = lazy(() => import('./PainelAvisos'));
const GerenciarAvisos = lazy(() => import('./GerenciarAvisos'));
const AjudaFAQ = lazy(() => import('./AjudaFAQ'));
const ConfiguracoesPerfil = lazy(() => import('./ConfiguracoesPerfil'));
const PaginaInicial = lazy(() => import('./PaginaInicial'));
const ListagemMensalAulas = lazy(() => import('./ListagemMensalAulas'));
const GerenciarGrupos = lazy(() => import('./GerenciarGrupos'));
const GerenciarPeriodos = lazy(() => import('./GerenciarPeriodos'));
const DownloadCronograma = lazy(() => import('./DownloadCronograma'));
const AnaliseAulas = lazy(() => import('./AnaliseAulas'));
const AnaliseEventos = lazy(() => import('./AnaliseEventos'));
const VerificarIntegridadeDados = lazy(() => import('./VerificarIntegridadeDados'));
const HistoricoAulas = lazy(() => import('./HistoricoAulas'));
const AssistenteIA = lazy(() => import('./AssistenteIA'));
const ImportarAgendamento = lazy(() => import('./ImportarAgendamento'));
const CalendarioRevisoesTecnico = lazy(() => import('./CalendarioRevisoesTecnico'));

const LoadingFallback = () => (<Box display="flex" justifyContent="center" alignItems="center" height="80vh"><CircularProgress /></Box>);
const MainLayout = () => (<Container maxWidth="xl" sx={{ mt: 4, mb: 4 }}><Outlet /></Container>);

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
    const handleCoordenadorMenuOpen = (event) => setCoordenadorMenuAnchorEl(event.currentTarget);
    
    const role = userProfileData?.role;
    const approvalPending = userProfileData?.approvalPending;
    const isCoordenadorOrTecnico = role === 'coordenador' || role === 'tecnico';

    // Estilo unificado para ícones dos menus para garantir contraste
    const menuIconStyle = { marginRight: 10, color: 'inherit' };
    
    if (loading) return <LoadingFallback />;
    
    const PendingApprovalScreen = () => (<Container sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '80vh' }}><Paper elevation={3} sx={{ p: 4, textAlign: 'center', maxWidth: 400 }}><Typography variant="h5" gutterBottom>Acesso Pendente</Typography><Button variant="contained" onClick={handleLogout}>Sair</Button></Paper></Container>);
    const LoginScreen = () => (<Container sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '80vh' }}><Paper elevation={3} sx={{ p: 4, textAlign: 'center' }}><img src={cesmacLogo} alt="Logo" style={{ height: '50px', marginBottom: '16px' }} /><Typography variant="h5">Cronograma Lab</Typography><Button variant="contained" sx={{ mt: 2 }} onClick={handleGoogleLogin} disabled={isLoggingIn}>{isLoggingIn ? 'Entrando...' : 'Login com Google'}</Button></Paper></Container>);

    const CoordenadorGerenciarMenu = () => (
        <Menu anchorEl={coordenadorMenuAnchorEl} open={Boolean(coordenadorMenuAnchorEl)} onClose={handleMenuClose}>
        
            <MenuItem component={Link} to="/gerenciar-aprovacoes" onClick={handleMenuClose}><Badge badgeContent={pendingProposalsCount} color="error" sx={{ mr: 1 }}><ThumbsUp size={18} style={menuIconStyle}/></Badge>Aprovações</MenuItem>
            <MenuItem component={Link} to="/analise-aulas" onClick={handleMenuClose}><BarChart size={18} style={menuIconStyle}/> Análise de Aulas</MenuItem>
<MenuItem component={Link} to="/analise-eventos" onClick={handleMenuClose}><BarChart size={18} style={menuIconStyle}/> Análise de Eventos</MenuItem>
            <Divider sx={{ my: 0.5 }} />
            <MenuItem component={Link} to="/verificar-integridade" onClick={handleMenuClose}><Bug size={18} style={menuIconStyle}/> Integridade</MenuItem>
        </Menu>
    );
    
    const navMenuItems = [
        <MenuItem key="painel" component={Link} to="/" onClick={handleMenuClose}><LayoutDashboard size={18} style={menuIconStyle}/> Painel</MenuItem>,
        <MenuItem key="cal" component={Link} to="/calendario" onClick={handleMenuClose}><Calendar size={18} style={menuIconStyle}/> Calendário</MenuItem>,
        !approvalPending ? <MenuItem key="list" component={Link} to="/listagem-mensal" onClick={handleMenuClose}><ListTodo size={18} style={menuIconStyle}/> Listagem Mensal</MenuItem> : null,
        !approvalPending ? <MenuItem key="historico" component={Link} to="/historico-aulas" onClick={handleMenuClose}><History size={18} style={menuIconStyle}/> Histórico</MenuItem> : null,
        !approvalPending ? <MenuItem key="avisos" component={Link} to="/avisos" onClick={handleMenuClose}><Bell size={18} style={menuIconStyle}/> Avisos</MenuItem> : null,
        <Divider key="div1" sx={{ my: 0.5 }} />,
        ...(role === 'coordenador' && !approvalPending ? [
            <MenuItem key="agend" component={Link} to="/propor-aula" onClick={handleMenuClose}><PlusCircle size={18} style={menuIconStyle}/> Agendar Aula</MenuItem>,
<MenuItem key="agend-evento" component={Link} to="/propor-evento" onClick={handleMenuClose}><PlusCircle size={18} style={menuIconStyle}/> Agendar Evento</MenuItem>,
            <MenuItem key="importar" component={Link} to="/importar-agendamento" onClick={handleMenuClose}><Upload size={18} style={menuIconStyle}/> Importar do Arquivo</MenuItem>,
            <MenuItem key="gerenciar-menu" onClick={handleCoordenadorMenuOpen}><ListTodo size={18} style={menuIconStyle}/> Gerenciar</MenuItem>,
            <MenuItem key="users" component={Link} to="/gerenciar-usuarios" onClick={handleMenuClose}><Users size={18} style={menuIconStyle}/> Usuários</MenuItem>,
            <MenuItem key="grupos" component={Link} to="/gerenciar-grupos" onClick={handleMenuClose}><Group size={18} style={menuIconStyle}/> Grupos</MenuItem>,
            <MenuItem key="periodos" component={Link} to="/gerenciar-periodos" onClick={handleMenuClose}><CalendarOff size={18} style={menuIconStyle}/> Eventos</MenuItem>,
            <MenuItem key="gerenciar-avisos" component={Link} to="/gerenciar-avisos" onClick={handleMenuClose}><Settings size={18} style={menuIconStyle}/> Gerenciar Avisos</MenuItem>,
        ] : []),
        ...(role === 'tecnico' && !approvalPending ? [
            <MenuItem key="aula" component={Link} to="/propor-aula" onClick={handleMenuClose}><PlusCircle size={18} style={menuIconStyle}/> Propor Aula</MenuItem>,
            <MenuItem key="importar-tec" component={Link} to="/importar-agendamento" onClick={handleMenuClose}><Upload size={18} style={menuIconStyle}/> Importar do Arquivo</MenuItem>,
            <MenuItem key="design" component={Link} to="/minhas-designacoes" onClick={handleMenuClose}><UserCheck size={18} style={menuIconStyle}/> Designações</MenuItem>,
            <MenuItem key="prop" component={Link} to="/minhas-propostas" onClick={handleMenuClose}><ListTodo size={18} style={menuIconStyle}/> Minhas Propostas</MenuItem>,
            <MenuItem key="revisoes" component={Link} to="/revisoes" onClick={handleMenuClose}><FlaskConical size={18} style={menuIconStyle}/> Revisões</MenuItem>,
        ] : []),
        <Divider key="div2" sx={{ my: 0.5 }} />,
        isCoordenadorOrTecnico && !approvalPending ? (<MenuItem key="download-cronograma" component={Link} to="/download-cronograma" onClick={handleMenuClose}><Download size={18} style={menuIconStyle}/> Baixar Cronograma</MenuItem>) : null,
        !approvalPending ? <MenuItem key="ajuda" component={Link} to="/ajuda" onClick={handleMenuClose}><HelpCircle size={18} style={menuIconStyle}/> Ajuda/FAQ</MenuItem> : null
    ].filter(Boolean);

    const renderMobileMenu = (<Menu anchorEl={mobileMoreAnchorEl} open={Boolean(mobileMoreAnchorEl)} onClose={handleMenuClose}>{navMenuItems}<Divider /><MenuItem component={Link} to="/perfil" onClick={handleMenuClose}><User size={18} style={menuIconStyle}/> Perfil</MenuItem><MenuItem onClick={handleLogout}><LogOut size={18} style={menuIconStyle}/> Sair</MenuItem></Menu>);
    const renderProfileMenu = (<Menu anchorEl={anchorEl} open={Boolean(anchorEl)} onClose={handleMenuClose}><MenuItem component={Link} to="/perfil" onClick={handleMenuClose}>Perfil</MenuItem><MenuItem onClick={handleLogout}>Sair</MenuItem></Menu>);

    return (
        <ThemeProvider theme={theme}>
            <CssBaseline />
            <Router>
                <LocalizationProvider dateAdapter={AdapterDayjs} adapterLocale="pt-br">
                    {user && !approvalPending && (
                        <AppBar 
                            position="static"
                            sx={{
                                // Lógica para as cores do menu superior
                                bgcolor: darkMode ? 'primary.main' : '#ffffff', // Fundo: Branco no Light, Primário/Padrão no Dark
                                color: darkMode ? '#ffffff' : '#000000'         // Texto: Preto no Light, Branco no Dark
                            }}
                        >
                            <Toolbar>
                                <Box component={Link} to="/" sx={{ display: 'flex', alignItems: 'center', textDecoration: 'none', color: 'inherit', flexGrow: 1 }}>
                                    <img src={cesmacLogo} alt="Logo CESMAC" style={{ height: '35px', marginRight: '8px' }} />
                                    {!isMobile && <Typography variant="h6" noWrap>Cronograma Lab</Typography>}
                                </Box>
                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                    <IconButton sx={{ ml: 1 }} onClick={handleThemeChange} color="inherit">{darkMode ? <Sun size={20}/> : <Moon size={20}/>}</IconButton>
                                    <IconButton size="large" onClick={handleProfileMenuOpen} color="inherit">{userProfileData?.photoURL ? <Avatar src={userProfileData.photoURL} sx={{ width: 32, height: 32 }} /> : <AccountCircle />}</IconButton>
                                    <IconButton size="large" edge="end" onClick={handleMobileMenuOpen} color="inherit"><MenuIcon /></IconButton>
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
                                    <Route path="/listagem-mensal" element={<ListagemMensalAulas userInfo={userProfileData} />} />
                                    <Route path="/historico-aulas" element={<HistoricoAulas />} />
                                    <Route path="/propor-aula" element={<ProporAulaForm userInfo={userProfileData} currentUser={user} />} />
                                    <Route path="/propor-evento" element={<ProporEventoForm userInfo={userProfileData} currentUser={user} />} />
                                    <Route path="/propor-aula/:aulaId" element={<ProporAulaForm userInfo={userProfileData} currentUser={user} />} />
                                    <Route path="/avisos" element={<PainelAvisos />} />
                                    <Route path="/ajuda" element={<AjudaFAQ />} />
                                    <Route path="/perfil" element={<ConfiguracoesPerfil />} />
                                    {role === 'tecnico' && (<><Route path="/minhas-propostas" element={<MinhasPropostas />} /><Route path="/minhas-designacoes" element={<MinhasDesignacoes />} /><Route path="/revisoes" element={<CalendarioRevisoesTecnico userInfo={userProfileData} />} /></>)}
                                    {role === 'coordenador' && (<>
                                        <Route path="/gerenciar-aprovacoes" element={<GerenciarAprovacoes />} />
                                        <Route path="/gerenciar-usuarios" element={<GerenciarUsuarios />} />
                                        <Route path="/gerenciar-avisos" element={<GerenciarAvisos />} />
                                        <Route path="/gerenciar-grupos" element={<GerenciarGrupos />} />
                                        <Route path="/gerenciar-periodos" element={<GerenciarPeriodos />} />
                                    
                                        <Route path="/analise-aulas" element={<AnaliseAulas />} />
                                        <Route path="/analise-eventos" element={<AnaliseEventos />} />
                                        <Route path="/verificar-integridade" element={<VerificarIntegridadeDados />} />
                                    </>)}
                                    {/* Rota aberta para ambos */}
                                    <Route path="/assistente-ia" element={<AssistenteIA userInfo={userProfileData} currentUser={user} mode={darkMode ? 'dark' : 'light'} />} />
                                    {isCoordenadorOrTecnico && (<Route path="/importar-agendamento" element={<ImportarAgendamento userInfo={userProfileData} currentUser={user} />} />)}
                                    {isCoordenadorOrTecnico && (<Route path="/download-cronograma" element={<DownloadCronograma />} />)}
                                    <Route path="*" element={<Navigate to="/" />} />
                                </Route>
                            )}
                        </Routes>
                    </Suspense>
                    <Snackbar open={openSnackbar} autoHideDuration={6000} onClose={handleCloseSnackbar}><Alert onClose={handleCloseSnackbar} severity={snackbarSeverity}>{snackbarMessage}</Alert></Snackbar>
                </LocalizationProvider>
            </Router>
        </ThemeProvider>
    );
}
export default App;