// src/theme.js
import { createTheme } from '@mui/material/styles';

const lightPalette = {
  primary: {
    main: '#3f51b5', // Azul corporativo
    light: '#757de8',
    dark: '#002984',
  },
  secondary: {
    main: '#4caf50', // Verde para sucesso/ênfase
    light: '#80e27e',
    dark: '#00701a',
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
    default: '#f5f5f5', // Cinza claro
    paper: '#ffffff',
  },
  gradient: {
    primary: 'linear-gradient(135deg, #3f51b5 0%, #283593 100%)',
    secondary: 'linear-gradient(135deg, #4caf50 0%, #388e3c 100%)',
    success: 'linear-gradient(135deg, #2e7d32 0%, #1b5e20 100%)',
    card: 'linear-gradient(135deg, #ffffff 0%, #f5f5f5 100%)',
  }
};

const darkPalette = {
  primary: {
    main: '#7986cb', // Azul mais claro para modo escuro
    light: '#aab6fe',
    dark: '#49599a',
  },
  secondary: {
    main: '#81c784', // Verde mais claro
    light: '#b2fab4',
    dark: '#519657',
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
    default: '#303030', // Cinza escuro
    paper: '#424242',   // Cinza um pouco mais claro que o fundo
  },
  text: {
    primary: '#ffffff',
    secondary: '#bdbdbd',
  },
  gradient: {
    primary: 'linear-gradient(135deg, #303f9f 0%, #1a237e 100%)',
    secondary: 'linear-gradient(135deg, #2e7d32 0%, #1b5e20 100%)',
    success: 'linear-gradient(135deg, #1b5e20 0%, #003300 100%)',
    card: 'linear-gradient(135deg, #424242 0%, #303030 100%)',
  }
};

const getAppTheme = (mode) => createTheme({
  palette: {
    mode: mode,
    ...(mode === 'light' ? lightPalette : darkPalette),
  },
  typography: {
    fontFamily: '"Roboto", "Helvetica", "Arial", sans-serif',
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
    borderRadius: 8,
  },
  shadows: [
    'none',
    '0px 1px 3px rgba(0, 0, 0, 0.12), 0px 1px 2px rgba(0, 0, 0, 0.24)',
    '0px 3px 6px rgba(0, 0, 0, 0.16), 0px 3px 6px rgba(0, 0, 0, 0.23)',
    '0px 10px 20px rgba(0, 0, 0, 0.19), 0px 6px 6px rgba(0, 0, 0, 0.23)',
    '0px 14px 28px rgba(0, 0, 0, 0.25), 0px 10px 10px rgba(0, 0, 0, 0.22)',
    '0px 19px 38px rgba(0, 0, 0, 0.30), 0px 15px 12px rgba(0, 0, 0, 0.22)',
    ...Array(19).fill('0px 19px 38px rgba(0, 0, 0, 0.30), 0px 15px 12px rgba(0, 0, 0, 0.22)')
  ],
  components: {
    MuiCssBaseline: {
      styleOverrides: {
        body: {
          background: mode === 'light' 
            ? 'linear-gradient(135deg, #f5f5f5 0%, #e0e0e0 100%)'
            : 'linear-gradient(135deg, #303030 0%, #212121 100%)',
          minHeight: '100vh',
        },
      },
    },
    MuiButton: {
      styleOverrides: {
        root: {
          borderRadius: 8,
          textTransform: 'none',
          fontWeight: 500,
          padding: '8px 20px',
          boxShadow: 'none',
          transition: 'all 0.2s ease-in-out',
          '&:hover': {
            transform: 'translateY(-1px)',
            boxShadow: '0px 4px 10px rgba(0, 0, 0, 0.1)',
          },
          '&:active': {
            transform: 'translateY(0px)',
          },
        },
        contained: {
          background: mode === 'light' 
            ? 'linear-gradient(135deg, #3f51b5 0%, #283593 100%)'
            : 'linear-gradient(135deg, #7986cb 0%, #49599a 100%)',
          '&:hover': {
            background: mode === 'light' 
              ? 'linear-gradient(135deg, #283593 0%, #1a237e 100%)'
              : 'linear-gradient(135deg, #49599a 0%, #303f9f 100%)',
          },
        },
      },
    },
    MuiPaper: {
      styleOverrides: {
        root: {
          borderRadius: 12,
          background: mode === 'light' 
            ? 'linear-gradient(135deg, #ffffff 0%, #f5f5f5 100%)'
            : 'linear-gradient(135deg, #424242 0%, #303030 100%)',
          backdropFilter: 'blur(10px)',
          border: mode === 'light' 
            ? '1px solid rgba(0, 0, 0, 0.05)'
            : '1px solid rgba(255, 255, 255, 0.05)',
          transition: 'all 0.2s ease-in-out',
          '&:hover': {
            transform: 'translateY(-2px)',
            boxShadow: '0px 8px 20px rgba(0, 0, 0, 0.08)',
          },
        },
      },
    },
    MuiCard: {
      styleOverrides: {
        root: {
          borderRadius: 12,
          background: mode === 'light' 
            ? 'linear-gradient(135deg, #ffffff 0%, #f5f5f5 100%)'
            : 'linear-gradient(135deg, #424242 0%, #303030 100%)',
          backdropFilter: 'blur(10px)',
          border: mode === 'light' 
            ? '1px solid rgba(0, 0, 0, 0.05)'
            : '1px solid rgba(255, 255, 255, 0.05)',
          transition: 'all 0.2s ease-in-out',
          '&:hover': {
            transform: 'translateY(-4px)',
            boxShadow: '0px 12px 25px rgba(0, 0, 0, 0.1)',
          },
        },
      },
    },
    MuiAppBar: {
      styleOverrides: {
        root: {
          background: mode === 'light' 
            ? 'linear-gradient(135deg, #3f51b5 0%, #283593 100%)'
            : 'linear-gradient(135deg, #303f9f 0%, #1a237e 100%)',
          backdropFilter: 'blur(10px)',
          borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
          boxShadow: '0px 2px 10px rgba(0, 0, 0, 0.05)',
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
          borderRadius: 8,
          margin: '2px 0',
          transition: 'all 0.2s ease-in-out',
          '&:hover': {
            backgroundColor: mode === 'light' 
              ? 'rgba(63, 81, 181, 0.05)'
              : 'rgba(121, 134, 203, 0.05)',
            transform: 'translateX(4px)',
          },
        },
      },
    },
    MuiTextField: {
      styleOverrides: {
        root: {
          '& .MuiOutlinedInput-root': {
            borderRadius: 8,
            transition: 'all 0.2s ease-in-out',
            '&:hover': {
              transform: 'translateY(-1px)',
            },
            '&.Mui-focused': {
              transform: 'translateY(-1px)',
              boxShadow: '0px 4px 10px rgba(63, 81, 181, 0.1)',
            },
          },
        },
      },
    },
  },
});

export default getAppTheme;

