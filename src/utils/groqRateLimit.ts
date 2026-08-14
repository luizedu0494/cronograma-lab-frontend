const LIMITE_CHAMADAS_POR_MINUTO = 10;

export const verificarRateLimitGroq = (): boolean => {
  const minutoAtual = Math.floor(Date.now() / 60000);
  const chave = `groq_rate_${minutoAtual}`;
  const chamadas = parseInt(sessionStorage.getItem(chave) || '0', 10);

  if (chamadas >= LIMITE_CHAMADAS_POR_MINUTO) {
    return false;
  }

  sessionStorage.setItem(chave, String(chamadas + 1));
  return true;
};
