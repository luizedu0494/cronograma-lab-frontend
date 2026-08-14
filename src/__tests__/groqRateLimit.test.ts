import { describe, it, expect } from 'vitest';
import { verificarRateLimitGroq } from '../utils/groqRateLimit';

describe('Groq Rate Limiting Client-Side', () => {
  it('deve permitir chamadas dentro do limite de 10 por minuto', () => {
    sessionStorage.clear();
    for (let i = 0; i < 10; i++) {
      expect(verificarRateLimitGroq()).toBe(true);
    }
  });

  it('deve bloquear a 11ª chamada no mesmo minuto', () => {
    sessionStorage.clear();
    for (let i = 0; i < 10; i++) {
      verificarRateLimitGroq();
    }
    expect(verificarRateLimitGroq()).toBe(false);
  });
});
