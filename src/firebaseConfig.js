// src/firebaseConfig.js
import { initializeApp } from "firebase/app";
import { getAuth, GoogleAuthProvider, connectAuthEmulator } from "firebase/auth";
import { getFirestore, connectFirestoreEmulator } from "firebase/firestore";

// Configurações do Firebase carregadas a partir das variáveis de ambiente (.env)
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID
};

// Inicializa o Firebase
const app = initializeApp(firebaseConfig);

// Inicializa os serviços do Firebase
const auth = getAuth(app);

// Configura o Google Auth Provider com configurações otimizadas
const googleProvider = new GoogleAuthProvider();

// Configurações adicionais para melhorar a compatibilidade do popup
googleProvider.setCustomParameters({
  prompt: 'select_account',
  // Força a seleção de conta para evitar problemas de cache
});

// Adiciona escopos necessários (opcional, dependendo das necessidades)
googleProvider.addScope('profile');
googleProvider.addScope('email');

const db = getFirestore(app);

// Configurações de desenvolvimento (descomente se necessário para desenvolvimento local)
// if (process.env.NODE_ENV === 'development' && !auth._delegate._config.emulator) {
//   connectAuthEmulator(auth, "http://localhost:9099");
//   connectFirestoreEmulator(db, 'localhost', 8080);
// }

// Exporta os serviços para serem usados em outros lugares do seu app
export { auth, googleProvider, db, app };
