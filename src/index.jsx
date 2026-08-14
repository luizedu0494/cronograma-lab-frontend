// src/index.js
import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css'; // Seu CSS global, se houver
import App from './App';
import reportWebVitals from './reportWebVitals'; // Opcional, para métricas de performance

// Importe o AuthProvider que você criou (se o caminho estiver correto)
import { AuthProvider } from './AuthContext'; 

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from 'sonner';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000, // 5 minutos de cache padrão
      refetchOnWindowFocus: false,
    },
  },
});

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <App />
        <Toaster position="bottom-right" richColors />
      </AuthProvider>
    </QueryClientProvider>
  </React.StrictMode>
);

// Se você quiser começar a medir a performance no seu app, passe uma função
// para logar resultados (por exemplo: reportWebVitals(console.log))
// ou envie para um endpoint de analytics. Saiba mais: https://bit.ly/CRA-vitals
reportWebVitals();