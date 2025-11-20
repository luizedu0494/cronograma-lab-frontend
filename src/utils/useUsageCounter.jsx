// src/utils/useUsageCounter.jsx

import { useState, useEffect } from 'react';
import { doc, onSnapshot, getFirestore } from 'firebase/firestore';
import { app } from '../firebaseConfig'; // Importa o app que você já tem

const db = getFirestore(app);

// O limite do plano Spark é de 50.000 leituras por dia
const DAILY_READ_LIMIT = 50000;

/**
 * Hook customizado para ler o contador de uso do Firestore.
 * O contador deve ser incrementado manualmente em operações críticas.
 */
export const useUsageCounter = () => {
  const [usageCount, setUsageCount] = useState(0);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Documento único para armazenar o contador de uso
    const counterRef = doc(db, 'system', 'usageCounter');

    // Usa onSnapshot para obter atualizações em tempo real (conta como 1 leitura inicial)
    const unsubscribe = onSnapshot(counterRef, (docSnapshot) => {
      if (docSnapshot.exists()) {
        // Assume que o campo se chama 'criticalReads'
        const data = docSnapshot.data();
        setUsageCount(data.criticalReads || 0);
      } else {
        // Se o documento não existir, inicializa o contador
        setUsageCount(0);
      }
      setIsLoading(false);
    }, (error) => {
      console.error("Erro ao ler o contador de uso:", error);
      setIsLoading(false);
    });

    // Limpa o listener quando o componente for desmontado
    return () => unsubscribe();
  }, []);

  // Calcula a porcentagem de uso
  const usagePercentage = (usageCount / DAILY_READ_LIMIT) * 100;
  const isCritical = usagePercentage >= 80;

  return {
    usageCount,
    DAILY_READ_LIMIT,
    usagePercentage: Math.min(100, usagePercentage), // Limita a 100% para exibição
    isCritical,
    isLoading,
  };
};
