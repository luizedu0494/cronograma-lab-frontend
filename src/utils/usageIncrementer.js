// src/utils/usageIncrementer.js

import { doc, updateDoc, getFirestore } from 'firebase/firestore';
import { app } from '../firebaseConfig'; 

const db = getFirestore(app);

// Importa FieldValue do SDK do Firebase para o frontend
// Nota: O FieldValue é importado de 'firebase/firestore' no seu projeto.
// Se você estiver usando o SDK v9, a importação correta é:
// import { FieldValue } from 'firebase/firestore';
// Mas para garantir a compatibilidade com o que foi sugerido, vou usar a forma que funciona com o SDK v9.

import { FieldValue } from 'firebase/firestore';

/**
 * Incrementa o contador de leituras críticas no Firestore.
 * @param {number} amount - Quantidade a ser incrementada (padrão: 1).
 */
export const incrementCriticalReads = async (amount = 1) => {
  const counterRef = doc(db, 'system', 'usageCounter');
  try {
    await updateDoc(counterRef, {
      criticalReads: FieldValue.increment(amount),
      lastUpdated: new Date(),
    }, { merge: true }); // 'merge: true' garante que o documento seja criado se não existir
  } catch (error) {
    console.error("Erro ao incrementar contador de leituras críticas:", error);
  }
};
