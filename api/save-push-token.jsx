// api/save-push-token.js

// Importa as bibliotecas do Firebase Admin SDK.
// Para rodar isso, a Vercel precisará instalar esses pacotes. Adicione
// "firebase-admin" ao seu package.json com `npm install firebase-admin`
import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import { getAuth } from 'firebase-admin/auth';

// --- Configuração do Firebase Admin ---
// A chave da sua conta de serviço virá de uma Variável de Ambiente na Vercel, por segurança.
// É essencial que você NÃO coloque o conteúdo da chave diretamente aqui no código.
const serviceAccount = JSON.parse(
  process.env.FIREBASE_SERVICE_ACCOUNT_KEY
);

// Inicializa o Firebase Admin SDK, mas apenas se ainda não foi inicializado.
if (!getApps().length) {
  initializeApp({
    credential: cert(serviceAccount),
  });
}

const db = getFirestore();
const auth = getAuth();

// Esta é a função principal que será executada pela Vercel.
export default async function handler(req, res) {
  // Permite apenas requisições do tipo POST.
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).end('Method Not Allowed');
  }

  try {
    const { token } = req.body; // Pega o token FCM do corpo da requisição
    const authorizationHeader = req.headers.authorization; // Pega o cabeçalho de autorização

    if (!token || !authorizationHeader) {
      return res.status(400).json({ error: 'Token de notificação e token de autorização são necessários.' });
    }

    // Verifica o token de autenticação do usuário vindo do frontend para garantir que a requisição é legítima.
    const idToken = authorizationHeader.split('Bearer ')[1];
    const decodedToken = await auth.verifyIdToken(idToken);
    const uid = decodedToken.uid;

    if (!uid) {
      return res.status(401).json({ error: 'Não autorizado.' });
    }

    // Cria uma referência para o documento do usuário na nova coleção 'fcmTokens'.
    const userTokensRef = db.collection('fcmTokens').doc(uid);
    
    // Usa 'arrayUnion' para adicionar o novo token à lista de tokens do usuário,
    // garantindo que não haja duplicatas.
    await userTokensRef.set({
      tokens: FieldValue.arrayUnion(token),
      lastUpdate: FieldValue.serverTimestamp() // Opcional: para saber quando foi a última atualização
    }, { merge: true }); // 'merge: true' garante que não vamos sobrescrever outros campos se existirem.

    console.log(`Token salvo com sucesso para o usuário: ${uid}`);
    return res.status(200).json({ message: 'Token salvo com sucesso!' });

  } catch (error) {
    console.error('Erro ao salvar token de notificação:', error);
    if (error.code === 'auth/id-token-expired') {
      return res.status(401).json({ error: 'Token de autenticação expirado.' });
    }
    return res.status(500).json({ error: 'Erro interno do servidor ao salvar token.' });
  }
}