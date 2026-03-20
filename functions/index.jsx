// ============================================================
// ATENÇÃO — ESTE ARQUIVO NÃO DEVE SER DEPLOYADO NO PLANO SPARK
// ============================================================
// Cloud Functions exigem o plano Blaze (pay-as-you-go).
// O firebase.json foi atualizado para NÃO incluir este diretório.
//
// A lógica de exclusão de usuário foi migrada para o cliente:
//   - deleteDoc em 'users/{uid}' via GerenciarUsuarios.jsx
//   - O registro no Firebase Auth fica inativo (sem doc no Firestore = sem acesso)
//
// As funções de contador de avisos foram substituídas por:
//   - Estado local + localStorage em PaginaInicial.jsx
//   - Atualização otimista em PainelAvisos.jsx
//
// Se no futuro migrar para o plano Blaze, descomentar o código abaixo
// e readicionar o bloco "functions" ao firebase.json.
// ============================================================

/*
const functions = require('firebase-functions');
const admin = require('firebase-admin');

admin.initializeApp();
const db = admin.firestore();

exports.deleteUser = functions.https.onCall(async (data, context) => {
  if (!context.auth || !(context.auth.token.role === 'coordenador')) {
    throw new functions.https.HttpsError('permission-denied', 'Apenas coordenadores podem excluir usuários.');
  }
  const userId = data.userId;
  try {
    await admin.auth().deleteUser(userId);
    await db.collection('users').doc(userId).delete();
    return { success: true };
  } catch (error) {
    throw new functions.https.HttpsError('internal', 'Erro ao excluir usuário.', error.message);
  }
});

exports.incrementarContadorGlobalDeAvisos = functions.region('southamerica-east1')
  .firestore.document('avisos/{avisoId}')
  .onCreate(async (snap, context) => {
    const usuariosSnapshot = await db.collection('users').get();
    const batch = db.batch();
    usuariosSnapshot.forEach((userDoc) => {
      batch.update(db.collection('users').doc(userDoc.id), {
        avisosNaoLidos: admin.firestore.FieldValue.increment(1),
      });
    });
    return batch.commit();
  });

exports.decrementarContadorIndividualDeAvisos = functions.region('southamerica-east1')
  .firestore.document('avisos/{avisoId}/leituras/{userId}')
  .onCreate(async (snap, context) => {
    return db.collection('users').doc(context.params.userId).update({
      avisosNaoLidos: admin.firestore.FieldValue.increment(-1),
    });
  });
*/
