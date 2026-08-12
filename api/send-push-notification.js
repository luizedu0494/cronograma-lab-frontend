// api/send-push-notification.js
import admin from 'firebase-admin';

if (!admin.apps.length) {
  try {
    const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_JSON);
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
    });
    console.log("Firebase Admin SDK inicializado na Vercel Function (Push).");
  } catch (e) {
    console.error("ERRO CRÍTICO ao inicializar Firebase Admin SDK para Push:", e);
  }
}

const db = admin.firestore();

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).end('Method Not Allowed');
  }

  const clientSecret = req.headers['x-app-secret-key'];
  if (clientSecret !== process.env.MY_APP_SECRET_KEY) {
    console.warn("Acesso não autorizado ao endpoint de push notification.");
    return res.status(403).json({ error: 'Não autorizado.' });
  }

  const { uids, title, body, data } = req.body;

  if (!uids || !Array.isArray(uids) || uids.length === 0 || !title || !body) {
    return res.status(400).json({ error: 'uids (array), title e body são obrigatórios.' });
  }

  if (!admin.apps.length || !db) {
    return res.status(500).json({ error: 'Firebase Admin não inicializado.' });
  }

  try {
    const tokens = [];

    // Buscar tokens FCM cadastrados para os UIDs especificados
    for (const uid of uids) {
      const doc = await db.collection('fcmTokens').doc(uid).get();
      if (doc.exists) {
        const userTokens = doc.data().tokens || [];
        tokens.push(...userTokens);
      }
    }

    if (tokens.length === 0) {
      return res.status(200).json({ message: 'Nenhum token FCM registrado para os usuários indicados.' });
    }

    const payload = {
      tokens,
      notification: {
        title,
        body,
      },
      data: data || {},
    };

    const response = await admin.messaging().sendEachForMulticast(payload);
    console.log(`Push enviado: ${response.successCount} sucessos, ${response.failureCount} falhas.`);

    return res.status(200).json({
      successCount: response.successCount,
      failureCount: response.failureCount,
    });
  } catch (error) {
    console.error('Erro ao enviar push notification:', error);
    return res.status(500).json({ error: error.message || 'Erro ao enviar notificação push.' });
  }
}



