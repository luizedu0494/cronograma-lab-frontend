// src/firebaseConfig.js
import { initializeApp } from "firebase/app";
import { getAuth, GoogleAuthProvider, connectAuthEmulator } from "firebase/auth";
import { getFirestore, connectFirestoreEmulator } from "firebase/firestore";
import { getStorage } from "firebase/storage";

// --- IMPORTANTE: SUAS CONFIGURAÇÕES REAIS DO FIREBASE DEVEM ESTAR AQUI ---
const firebaseConfig = {
  apiKey: "AIzaSyATwNg81vq-nBJTWB_0cnhMDBuhfxYmWJA",
  authDomain: "cronolab-novo.firebaseapp.com",
  projectId: "cronolab-novo",
  storageBucket: "cronolab-novo.firebasestorage.app",
  messagingSenderId: "386849385604",
  appId: "1:386849385604:web:8c76bd4ca86d3d2ea926d1"
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
const storage = getStorage(app);

// Configurações de desenvolvimento (descomente se necessário para desenvolvimento local)
// if (process.env.NODE_ENV === 'development' && !auth._delegate._config.emulator) {
//   connectAuthEmulator(auth, "http://localhost:9099");
//   connectFirestoreEmulator(db, 'localhost', 8080);
// }

// Exporta os serviços para serem usados em outros lugares do seu app
export { auth, googleProvider, db, storage, app };
