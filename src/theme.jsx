// src/theme.js
import { createTheme } from '@mui/material/styles';

const lightPalette = {
  primary: {
    main: '#1976d2', // Azul mais profundo e profissional (similar ao do Google)
    light: '#63a4ff',
    dark: '#004ba0',
  },
  secondary: {
    main: '#009688', // Ciano-verde (Teal) para um toque de sofisticação
    light: '#52c7b8',
    dark: '#00675b',
  },
  success: {
    main: '#2e7d32',
    light: '#60ad5e',
    dark: '#005005',
  },
  warning: {
    main: '#ff9800',
    light: '#ffc747',
    dark: '#c66900',
  },
  error: {
    main: '#d32f2f',
    light: '#ff6659',
    dark: '#9a0007',
  },
  background: {
    default: '#fafafa', // Branco mais puro para o fundo
    paper: '#ffffff',
  },
  gradient: {
    primary: 'linear-gradient(135deg, #1976d2 0%, #004ba0 100%)',
    secondary: 'linear-gradient(135deg, #009688 0%, #00675b 100%)',
    success: 'linear-gradient(135deg, #2e7d32 0%, #1b5e20 100%)',
    card: 'linear-gradient(135deg, #ffffff 0%, #f0f0f0 100%)',
  }
};

const darkPalette = {
  primary: {
    main: '#90caf9', // Azul claro para modo escuro
    light: '#c3fdff',
    dark: '#5a99d2',
  },
  secondary: {
    main: '#4db6ac', // Ciano-verde claro para modo escuro
    light: '#82e9de',
    dark: '#00867d',
  },
  success: {
    main: '#66bb6a',
    light: '#98ee99',
    dark: '#338a3e',
  },
  warning: {
    main: '#ffb74d',
    light: '#ffe97d',
    dark: '#c88719',
  },
  error: {
    main: '#e57373',
    light: '#ffc4ff',
    dark: '#af4448',
  },
  background: {
    default: '#121212', // Preto mais profundo para o fundo
    paper: '#1e1e1e',   // Cinza escuro para papel/cartões
  },
  text: {
    primary: '#ffffff',
    secondary: '#bdbdbd',
  },
  gradient: {
    primary: 'linear-gradient(135deg, #1565c0 0%, #0d47a1 100%)',
    secondary: 'linear-gradient(135deg, #00897b 0%, #00695c 100%)',
    success: 'linear-gradient(135deg, #1b5e20 0%, #003300 100%)',
    card: 'linear-gradient(135deg, #1e1e1e 0%, #121212 100%)',
  }
};

const getAppTheme = (mode) => createTheme({
  palette: {
    mode: mode,
    ...(mode === 'light' ? lightPalette : darkPalette),
  },
  typography: {
    fontFamily: '"Inter", "Roboto", "Helvetica", "Arial", sans-serif',
    h1: {
      fontWeight: 700,
      fontSize: '2.5rem',
      lineHeight: 1.2,
    },
    h2: {
      fontWeight: 600,
      fontSize: '2rem',
      lineHeight: 1.3,
    },
    h3: {
      fontWeight: 600,
      fontSize: '1.75rem',
      lineHeight: 1.3,
    },
    h4: {
      fontWeight: 600,
      fontSize: '1.5rem',
      lineHeight: 1.4,
    },
    h5: {
      fontWeight: 600,
      fontSize: '1.25rem',
      lineHeight: 1.4,
    },
    h6: {
      fontWeight: 600,
      fontSize: '1.125rem',
      lineHeight: 1.4,
    },
    body1: {
      fontSize: '1rem',
      lineHeight: 1.6,
    },
    body2: {
      fontSize: '0.875rem',
      lineHeight: 1.6,
    },
  },
  shape: {
    borderRadius: 12, // Aumentar o raio para um visual mais suave e moderno
  },
  shadows: [
    'none',
    '0px 2px 4px rgba(0, 0, 0, 0.05)', // Sombras mais sutis para um visual "limpo"
    '0px 4px 8px rgba(0, 0, 0, 0.08)',
    '0px 8px 16px rgba(0, 0, 0, 0.1)',
    '0px 12px 24px rgba(0, 0, 0, 0.12)',
    '0px 16px 32px rgba(0, 0, 0, 0.15)',
    ...Array(19).fill('0px 16px 32px rgba(0, 0, 0, 0.15)')
  ],
  components: {
    MuiCssBaseline: {
      styleOverrides: {
        body: {
          background: mode === 'light' 
            ? '#fafafa' // Fundo sólido mais limpo
            : '#121212', // Fundo sólido mais limpo
          minHeight: '100vh',
        },
      },
    },
    MuiButton: {
      styleOverrides: {
        root: {
          borderRadius: 12,
          textTransform: 'none',
          fontWeight: 500,
          padding: '8px 20px',
          boxShadow: '0px 2px 4px rgba(0, 0, 0, 0.05)', // Adicionar sombra sutil ao botão
          transition: 'all 0.2s ease-in-out',
          '&:hover': {
            transform: 'translateY(-1px)',
            boxShadow: '0px 6px 12px rgba(0, 0, 0, 0.15)',
          },
          '&:active': {
            transform: 'translateY(0px)',
          },
        },
        contained: {
          background: mode === 'light' 
            ? 'linear-gradient(135deg, #1976d2 0%, #004ba0 100%)'
            : 'linear-gradient(135deg, #90caf9 0%, #5a99d2 100%)',
          '&:hover': {
            background: mode === 'light' 
              ? 'linear-gradient(135deg, #004ba0 0%, #003570 100%)'
              : 'linear-gradient(135deg, #5a99d2 0%, #306090 100%)',
          },
        },
      },
    },
    MuiPaper: {
      styleOverrides: {
        root: {
          borderRadius: 12,
          background: mode === 'light' 
            ? '#ffffff' // Fundo sólido mais limpo
            : '#1e1e1e', // Fundo sólido mais limpo
          backdropFilter: 'blur(10px)',
          border: mode === 'light' 
            ? '1px solid rgba(0, 0, 0, 0.08)'
            : '1px solid rgba(255, 255, 255, 0.08)',
          transition: 'all 0.2s ease-in-out',
          '&:hover': {
            transform: 'translateY(-2px)',
            boxShadow: '0px 10px 25px rgba(0, 0, 0, 0.1)',
          },
        },
      },
    },
    MuiCard: {
      styleOverrides: {
        root: {
          borderRadius: 12,
          background: mode === 'light' 
            ? '#ffffff' // Fundo sólido mais limpo
            : '#1e1e1e', // Fundo sólido mais limpo
          backdropFilter: 'blur(10px)',
          border: mode === 'light' 
            ? '1px solid rgba(0, 0, 0, 0.08)'
            : '1px solid rgba(255, 255, 255, 0.08)',
          transition: 'all 0.2s ease-in-out',
          '&:hover': {
            transform: 'translateY(-4px)',
            boxShadow: '0px 15px 30px rgba(0, 0, 0, 0.15)',
          },
        },
      },
    },
    MuiAppBar: {
      styleOverrides: {
        root: {
          background: mode === 'light' 
            ? '#ffffff' // Branco puro para contraste com o logo azul
            : '#1e1e1e', // Cinza escuro para contraste no modo dark
          backdropFilter: 'blur(10px)',
          borderBottom: mode === 'light' 
            ? '1px solid rgba(0, 0, 0, 0.1)' // Borda sutil no modo light
            : '1px solid rgba(255, 255, 255, 0.1)',
          boxShadow: '0px 4px 12px rgba(0, 0, 0, 0.05)', // Sombra mais suave
        },
      },
    },
    MuiIconButton: {
      styleOverrides: {
        root: {
          transition: 'all 0.2s ease-in-out',
          '&:hover': {
            transform: 'scale(1.05)',
            backgroundColor: 'rgba(255, 255, 255, 0.05)',
          },
        },
      },
    },
    MuiListItem: {
      styleOverrides: {
        root: {
          borderRadius: 12,
          margin: '2px 0',
          transition: 'all 0.2s ease-in-out',
          '&:hover': {
            backgroundColor: mode === 'light' 
              ? 'rgba(25, 118, 210, 0.05)'
              : 'rgba(144, 202, 249, 0.05)',
            transform: 'translateX(4px)',
          },
        },
      },
    },
    MuiTextField: {
      styleOverrides: {
        root: {
          '& .MuiOutlinedInput-root': {
            borderRadius: 12,
            transition: 'all 0.2s ease-in-out',
            '&:hover': {
              transform: 'translateY(-1px)',
            },
            '&.Mui-focused': {
              transform: 'translateY(-1px)',
              boxShadow: '0px 6px 12px rgba(25, 118, 210, 0.2)',
            },
          },
        },
      },
    },
  },
});

export default getAppTheme;
