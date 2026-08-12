// src/theme.jsx
// Paleta baseada na identidade visual do CESMAC — Centro Universitário
//
// Cores extraídas do logo oficial (src/assets/images/cesmac-logo.png):
//   Azul principal  #1E7EC8  — texto "CESMAC"
//   Azul claro      #4AADE8  — páginas do livro
//   Dourado         #F5C518  — páginas abertas no topo do livro
//
// Modo escuro: fundo azul-marinho profundo (#0B0F18) que conversa
// com a identidade institucional.

import { createTheme } from '@mui/material/styles';

// ─── Tokens de cor ────────────────────────────────────────────────────────────

const CESMAC_BLUE_MAIN  = '#1E7EC8';
const CESMAC_BLUE_LIGHT = '#4AADE8';
const CESMAC_BLUE_DARK  = '#0D5A9A';

const CESMAC_GOLD_MAIN  = '#D4940A';
const CESMAC_GOLD_LIGHT = '#F5C518';
const CESMAC_GOLD_DARK  = '#A06800';

const CESMAC_TEAL_MAIN  = '#0097A7';
const CESMAC_TEAL_LIGHT = '#4DD0E1';
const CESMAC_TEAL_DARK  = '#006978';

// ─── Paleta light ─────────────────────────────────────────────────────────────

const lightPalette = {
    primary:    { main: CESMAC_BLUE_MAIN,  light: CESMAC_BLUE_LIGHT,  dark: CESMAC_BLUE_DARK,  contrastText: '#ffffff' },
    secondary:  { main: CESMAC_TEAL_MAIN,  light: CESMAC_TEAL_LIGHT,  dark: CESMAC_TEAL_DARK,  contrastText: '#ffffff' },
    info:       { main: CESMAC_BLUE_MAIN,  light: CESMAC_BLUE_LIGHT,  dark: CESMAC_BLUE_DARK,  contrastText: '#ffffff' },
    warning:    { main: CESMAC_GOLD_MAIN,  light: CESMAC_GOLD_LIGHT,  dark: CESMAC_GOLD_DARK,  contrastText: '#ffffff' },
    success:    { main: '#2E7D32', light: '#60AD5E', dark: '#005005', contrastText: '#ffffff' },
    error:      { main: '#C62828', light: '#EF5350', dark: '#8E0000', contrastText: '#ffffff' },
    background: { default: '#F2F4F8', paper: '#FFFFFF' },
    text:       { primary: '#0D1B2A', secondary: '#4A5568', disabled: '#94A3B8' },
    divider:    'rgba(0, 0, 0, 0.08)',
};

// ─── Paleta dark ──────────────────────────────────────────────────────────────

const darkPalette = {
    primary:    { main: CESMAC_BLUE_LIGHT, light: '#7EC8F0', dark: CESMAC_BLUE_MAIN,  contrastText: '#0B0F18' },
    secondary:  { main: CESMAC_TEAL_LIGHT, light: '#80DEEA', dark: CESMAC_TEAL_MAIN,  contrastText: '#0B0F18' },
    info:       { main: CESMAC_BLUE_LIGHT, light: '#7EC8F0', dark: CESMAC_BLUE_MAIN,  contrastText: '#0B0F18' },
    warning:    { main: CESMAC_GOLD_LIGHT, light: '#FFE066', dark: CESMAC_GOLD_MAIN,  contrastText: '#1A1200' },
    success:    { main: '#66BB6A', light: '#98EE99', dark: '#338A3E', contrastText: '#0B0F18' },
    error:      { main: '#EF5350', light: '#FF8A80', dark: '#C62828', contrastText: '#ffffff' },
    background: { default: '#0B0F18', paper: '#131826' },
    text:       { primary: '#E8EDF5', secondary: '#8898B8', disabled: '#485880' },
    divider:    'rgba(255, 255, 255, 0.08)',
};

// ─── Tema ─────────────────────────────────────────────────────────────────────

const getAppTheme = (mode) => createTheme({
    palette: {
        mode,
        ...(mode === 'light' ? lightPalette : darkPalette),
    },

    typography: {
        fontFamily: '"Sora", "Inter", "Roboto", "Helvetica", "Arial", sans-serif',
        h1: { fontWeight: 700, fontSize: '2.5rem',    lineHeight: 1.2 },
        h2: { fontWeight: 600, fontSize: '2rem',      lineHeight: 1.3 },
        h3: { fontWeight: 600, fontSize: '1.75rem',   lineHeight: 1.3 },
        h4: { fontWeight: 600, fontSize: '1.5rem',    lineHeight: 1.4 },
        h5: { fontWeight: 600, fontSize: '1.25rem',   lineHeight: 1.4 },
        h6: { fontWeight: 600, fontSize: '1.125rem',  lineHeight: 1.4 },
        body1:   { fontSize: '1rem',     lineHeight: 1.6 },
        body2:   { fontSize: '0.875rem', lineHeight: 1.6 },
        caption: { fontSize: '0.75rem',  lineHeight: 1.5 },
        button:  { textTransform: 'none', fontWeight: 500 },
    },

    shape: { borderRadius: 10 },

    shadows: [
        'none',
        mode === 'light' ? '0px 1px 3px rgba(30,126,200,0.08)' : '0px 1px 3px rgba(0,0,0,0.3)',
        mode === 'light' ? '0px 2px 6px rgba(30,126,200,0.10)' : '0px 2px 6px rgba(0,0,0,0.35)',
        mode === 'light' ? '0px 4px 12px rgba(30,126,200,0.12)' : '0px 4px 12px rgba(0,0,0,0.40)',
        mode === 'light' ? '0px 8px 20px rgba(30,126,200,0.14)' : '0px 8px 20px rgba(0,0,0,0.45)',
        mode === 'light' ? '0px 12px 28px rgba(30,126,200,0.16)' : '0px 12px 28px rgba(0,0,0,0.50)',
        ...Array(19).fill(
            mode === 'light' ? '0px 16px 32px rgba(30,126,200,0.18)' : '0px 16px 32px rgba(0,0,0,0.55)'
        ),
    ],

    components: {
        MuiCssBaseline: {
            styleOverrides: {
                body: {
                    background: mode === 'light' ? '#F2F4F8' : '#0B0F18',
                    minHeight: '100vh',
                    WebkitFontSmoothing: 'antialiased',
                    MozOsxFontSmoothing: 'grayscale',
                },
                '::-webkit-scrollbar': { width: 6, height: 6 },
                '::-webkit-scrollbar-track': {
                    background: mode === 'light' ? '#E8ECF2' : '#131826',
                    borderRadius: 10,
                },
                '::-webkit-scrollbar-thumb': {
                    background: mode === 'light' ? CESMAC_BLUE_MAIN : CESMAC_BLUE_LIGHT,
                    borderRadius: 10,
                },
                '::-webkit-scrollbar-thumb:hover': {
                    background: mode === 'light' ? CESMAC_BLUE_DARK : '#7EC8F0',
                },
                '::selection': {
                    background: mode === 'light' ? 'rgba(30,126,200,0.25)' : 'rgba(74,173,232,0.30)',
                },
            },
        },

        MuiAppBar: {
            styleOverrides: {
                root: {
                    background: mode === 'light' ? '#ffffff' : '#131826',
                    borderBottom: mode === 'light'
                        ? '1px solid rgba(30,126,200,0.12)'
                        : '1px solid rgba(74,173,232,0.10)',
                    boxShadow: mode === 'light'
                        ? '0px 1px 8px rgba(30,126,200,0.08)'
                        : '0px 1px 8px rgba(0,0,0,0.4)',
                },
            },
        },

        MuiPaper: {
            styleOverrides: {
                root: {
                    backgroundImage: 'none',
                    background: mode === 'light' ? '#ffffff' : '#131826',
                    border: mode === 'light'
                        ? '1px solid rgba(30,126,200,0.08)'
                        : '1px solid rgba(74,173,232,0.07)',
                    transition: 'box-shadow 0.2s ease, transform 0.2s ease',
                    '&:hover': {
                        transform: 'translateY(-1px)',
                        boxShadow: mode === 'light'
                            ? '0px 6px 20px rgba(30,126,200,0.12)'
                            : '0px 6px 20px rgba(0,0,0,0.5)',
                    },
                },
            },
        },

        MuiCard: {
            styleOverrides: {
                root: {
                    backgroundImage: 'none',
                    background: mode === 'light' ? '#ffffff' : '#131826',
                    border: mode === 'light'
                        ? '1px solid rgba(30,126,200,0.08)'
                        : '1px solid rgba(74,173,232,0.07)',
                    transition: 'box-shadow 0.2s ease, transform 0.2s ease',
                    '&:hover': {
                        transform: 'translateY(-2px)',
                        boxShadow: mode === 'light'
                            ? '0px 8px 24px rgba(30,126,200,0.14)'
                            : '0px 8px 24px rgba(0,0,0,0.55)',
                    },
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
                    transition: 'all 0.18s ease',
                    '&:hover': { transform: 'translateY(-1px)' },
                    '&:active': { transform: 'translateY(0)' },
                },
                contained: { boxShadow: 'none', '&:hover': { boxShadow: 'none' } },
                containedPrimary: {
                    background: mode === 'light' ? CESMAC_BLUE_MAIN : CESMAC_BLUE_LIGHT,
                    color: mode === 'light' ? '#ffffff' : '#0B0F18',
                    '&:hover': { background: mode === 'light' ? CESMAC_BLUE_DARK : '#7EC8F0' },
                },
                containedInfo: {
                    background: mode === 'light' ? CESMAC_BLUE_MAIN : CESMAC_BLUE_LIGHT,
                    color: mode === 'light' ? '#ffffff' : '#0B0F18',
                    '&:hover': { background: mode === 'light' ? CESMAC_BLUE_DARK : '#7EC8F0' },
                },
                containedWarning: {
                    background: mode === 'light' ? CESMAC_GOLD_MAIN : CESMAC_GOLD_LIGHT,
                    color: mode === 'light' ? '#ffffff' : '#1A1200',
                    '&:hover': { background: mode === 'light' ? CESMAC_GOLD_DARK : '#FFE066' },
                },
            },
        },

        MuiChip: {
            styleOverrides: {
                root: { borderRadius: 6, fontWeight: 500, fontSize: '0.75rem' },
                colorInfo: {
                    background: mode === 'light' ? 'rgba(30,126,200,0.10)' : 'rgba(74,173,232,0.15)',
                    color: mode === 'light' ? CESMAC_BLUE_DARK : CESMAC_BLUE_LIGHT,
                    border: `1px solid ${mode === 'light' ? 'rgba(30,126,200,0.25)' : 'rgba(74,173,232,0.30)'}`,
                },
                colorWarning: {
                    background: mode === 'light' ? 'rgba(212,148,10,0.10)' : 'rgba(245,197,24,0.12)',
                    color: mode === 'light' ? CESMAC_GOLD_DARK : CESMAC_GOLD_LIGHT,
                    border: `1px solid ${mode === 'light' ? 'rgba(212,148,10,0.30)' : 'rgba(245,197,24,0.30)'}`,
                },
            },
        },

        MuiTextField: {
            styleOverrides: {
                root: {
                    '& .MuiOutlinedInput-root': {
                        borderRadius: 8,
                        transition: 'box-shadow 0.18s ease',
                        '&.Mui-focused': {
                            boxShadow: mode === 'light'
                                ? '0px 0px 0px 3px rgba(30,126,200,0.15)'
                                : '0px 0px 0px 3px rgba(74,173,232,0.15)',
                        },
                    },
                },
            },
        },

        MuiListItem: {
            styleOverrides: {
                root: {
                    borderRadius: 8,
                    margin: '1px 0',
                    transition: 'background 0.15s ease',
                    '&:hover': {
                        backgroundColor: mode === 'light'
                            ? 'rgba(30,126,200,0.05)'
                            : 'rgba(74,173,232,0.06)',
                    },
                },
            },
        },

        MuiIconButton: {
            styleOverrides: {
                root: {
                    transition: 'all 0.15s ease',
                    '&:hover': {
                        transform: 'scale(1.08)',
                        backgroundColor: mode === 'light'
                            ? 'rgba(30,126,200,0.08)'
                            : 'rgba(74,173,232,0.10)',
                    },
                },
            },
        },

        MuiCheckbox: {
            styleOverrides: {
                root: {
                    color: mode === 'light' ? 'rgba(30,126,200,0.5)' : 'rgba(74,173,232,0.4)',
                    '&.Mui-checked': {
                        color: mode === 'light' ? CESMAC_BLUE_MAIN : CESMAC_BLUE_LIGHT,
                    },
                },
            },
        },

        MuiTabs: {
            styleOverrides: {
                indicator: {
                    backgroundColor: mode === 'light' ? CESMAC_BLUE_MAIN : CESMAC_BLUE_LIGHT,
                    height: 3,
                    borderRadius: '3px 3px 0 0',
                },
            },
        },
        MuiTab: {
            styleOverrides: {
                root: {
                    textTransform: 'none',
                    fontWeight: 500,
                    fontSize: '0.875rem',
                    '&.Mui-selected': {
                        color: mode === 'light' ? CESMAC_BLUE_MAIN : CESMAC_BLUE_LIGHT,
                        fontWeight: 600,
                    },
                },
            },
        },

        MuiAlert: {
            styleOverrides: {
                root: { borderRadius: 8 },
                standardInfo: {
                    background: mode === 'light' ? 'rgba(30,126,200,0.08)' : 'rgba(74,173,232,0.10)',
                    color: mode === 'light' ? CESMAC_BLUE_DARK : CESMAC_BLUE_LIGHT,
                    border: `1px solid ${mode === 'light' ? 'rgba(30,126,200,0.20)' : 'rgba(74,173,232,0.20)'}`,
                    '& .MuiAlert-icon': { color: mode === 'light' ? CESMAC_BLUE_MAIN : CESMAC_BLUE_LIGHT },
                },
                standardWarning: {
                    background: mode === 'light' ? 'rgba(212,148,10,0.08)' : 'rgba(245,197,24,0.10)',
                    color: mode === 'light' ? CESMAC_GOLD_DARK : CESMAC_GOLD_LIGHT,
                    border: `1px solid ${mode === 'light' ? 'rgba(212,148,10,0.22)' : 'rgba(245,197,24,0.22)'}`,
                    '& .MuiAlert-icon': { color: mode === 'light' ? CESMAC_GOLD_MAIN : CESMAC_GOLD_LIGHT },
                },
            },
        },

        MuiAccordion: {
            styleOverrides: {
                root: {
                    backgroundImage: 'none',
                    background: mode === 'light' ? '#ffffff' : '#131826',
                    border: mode === 'light'
                        ? '1px solid rgba(30,126,200,0.08)'
                        : '1px solid rgba(74,173,232,0.07)',
                    borderRadius: '10px !important',
                    '&:before': { display: 'none' },
                    '&.Mui-expanded': { margin: 0 },
                },
            },
        },

        MuiDialog: {
            styleOverrides: {
                paper: {
                    borderRadius: 14,
                    backgroundImage: 'none',
                    background: mode === 'light' ? '#ffffff' : '#131826',
                    border: mode === 'light'
                        ? '1px solid rgba(30,126,200,0.10)'
                        : '1px solid rgba(74,173,232,0.08)',
                },
            },
        },

        MuiBadge: {
            styleOverrides: {
                badge: {
                    background: CESMAC_BLUE_MAIN,
                    color: '#ffffff',
                    fontWeight: 600,
                    fontSize: '0.65rem',
                },
            },
        },
    },
});

export default getAppTheme;
