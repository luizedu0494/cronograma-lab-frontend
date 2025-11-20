// functions/index.js

const functions = require('firebase-functions');
const admin = require('firebase-admin');

admin.initializeApp();

const db = admin.firestore();

// ========================================================================
// SUA FUNÇÃO EXISTENTE - NENHUMA MUDANÇA AQUI
// ========================================================================
// Funcao para deletar o usuario no Firebase Auth e no Firestore
exports.deleteUser = functions.https.onCall(async (data, context ) => {
  // 1. Verifique se o usuário é um administrador/coordenador
  if (!context.auth || !(context.auth.token.role === "coordenador")) {
    throw new functions.https.HttpsError(
      "permission-denied",
      "Apenas coordenadores podem excluir usuários."
     );
  }

  const userId = data.userId;

  try {
    // 2. Apague o usuário do Firebase Auth
    await admin.auth().deleteUser(userId);

    // 3. Apague os dados do usuário no Firestore
    const userDocRef = db.collection('users').doc(userId);
    await userDocRef.delete();

    return { success: true, message: `Usuário ${userId} excluído com sucesso.` };
  } catch (error) {
    console.error("Erro ao excluir usuário:", error);
    throw new functions.https.HttpsError(
      "internal",
      "Erro ao excluir usuário.",
      error.message
     );
  }
});


// ========================================================================
// NOVAS FUNÇÕES PARA OTIMIZAR A CONTAGEM DE AVISOS
// ========================================================================

/**
 * Cloud Function que dispara quando um NOVO AVISO é criado.
 * Ela busca todos os usuários e incrementa o contador 'avisosNaoLidos' de cada um.
 */
exports.incrementarContadorGlobalDeAvisos = functions.region('southamerica-east1')
  .firestore.document("avisos/{avisoId}")
  .onCreate(async (snap, context) => {
    console.log(`Novo aviso ${context.params.avisoId} criado. Incrementando contadores.`);

    const usuariosRef = db.collection("users");
    const usuariosSnapshot = await usuariosRef.get();

    if (usuariosSnapshot.empty) {
      console.log("Nenhum usuário encontrado.");
      return null;
    }

    const batch = db.batch();
    usuariosSnapshot.forEach((userDoc) => {
      const userRef = db.collection("users").doc(userDoc.id);
      batch.update(userRef, {
        avisosNaoLidos: admin.firestore.FieldValue.increment(1),
      });
    });

    console.log(`Contador incrementado para ${usuariosSnapshot.size} usuários.`);
    return batch.commit();
  });

/**
 * Cloud Function que dispara quando um usuário LÊ um aviso.
 * Ela decrementa o contador 'avisosNaoLidos' APENAS para aquele usuário.
 */
exports.decrementarContadorIndividualDeAvisos = functions.region('southamerica-east1')
  .firestore.document("avisos/{avisoId}/leituras/{userId}")
  .onCreate(async (snap, context) => {
    const userId = context.params.userId;
    const userRef = db.collection("users").doc(userId);

    console.log(`Usuário ${userId} leu o aviso ${context.params.avisoId}. Decrementando contador.`);

    return userRef.update({
      avisosNaoLidos: admin.firestore.FieldValue.increment(-1),
    });
  });
