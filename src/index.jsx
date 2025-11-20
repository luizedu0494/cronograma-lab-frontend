// src/index.js
import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css'; // Seu CSS global, se houver
import App from './App';
import reportWebVitals from './reportWebVitals'; // Opcional, para métricas de performance

// Importe o AuthProvider que você criou (se o caminho estiver correto)
import { AuthProvider } from './AuthContext'; 

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <React.StrictMode>
    {/* O ThemeProvider e o CssBaseline agora estão dentro do App.js 
      para gerenciar o tema dinâmico (claro/escuro).
    */}
    <AuthProvider>
      <App />
    </AuthProvider>
  </React.StrictMode>
);

// Se você quiser começar a medir a performance no seu app, passe uma função
// para logar resultados (por exemplo: reportWebVitals(console.log))
// ou envie para um endpoint de analytics. Saiba mais: https://bit.ly/CRA-vitals
reportWebVitals();