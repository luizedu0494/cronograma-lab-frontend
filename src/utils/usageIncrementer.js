// src/utils/usageIncrementer.js

import { doc, setDoc, getFirestore, increment } from 'firebase/firestore';
import { app } from '../firebaseConfig'; 

const db = getFirestore(app);

// increment() é a forma correta no SDK modular Firebase v9+
// FieldValue não existe nessa versão do SDK

/**
 * Incrementa o contador de leituras críticas no Firestore.
 * Usa setDoc com merge:true para criar o documento se não existir.
 * @param {number} amount - Quantidade a ser incrementada (padrão: 1).
 */
export const incrementCriticalReads = async (amount = 1) => {
  const counterRef = doc(db, 'system', 'usageCounter');
  try {
    await setDoc(counterRef, {
      criticalReads: increment(amount),
      lastUpdated: new Date(),
    }, { merge: true });
  } catch (error) {
    console.error('Erro ao incrementar contador de leituras críticas:', error);
  }
};
