// src/utils/holiday-api.js

import dayjs from 'dayjs';

// Função para buscar feriados. Usamos um serviço externo para este exemplo.
// O ideal é usar uma biblioteca ou um serviço confiável.
// Para este exemplo, usaremos uma lista de dados mockados para Alagoas e Maceió.
const MOCKED_HOLIDAYS = [
    { date: '2025-01-01', name: 'Confraternização Universal', type: 'nacional' },
    { date: '2025-02-25', name: 'Carnaval', type: 'nacional' },
    { date: '2025-04-21', name: 'Tiradentes', type: 'nacional' },
    { date: '2025-05-01', name: 'Dia do Trabalho', type: 'nacional' },
    { date: '2025-06-24', name: 'São João', type: 'estadual' },
    { date: '2025-08-05', name: 'Dia da Instalação da Capitania de Alagoas', type: 'municipal' },
    { date: '2025-09-07', name: 'Independência do Brasil', type: 'nacional' },
    { date: '2025-09-16', name: 'Emancipação Política de Alagoas', type: 'estadual' },
    { date: '2025-10-12', name: 'Nossa Senhora Aparecida', type: 'nacional' },
    { date: '2025-11-02', name: 'Finados', type: 'nacional' },
    { date: '2025-11-15', name: 'Proclamação da República', type: 'nacional' },
    { date: '2025-11-20', name: 'Dia da Consciência Negra', type: 'estadual' },
    { date: '2025-12-25', name: 'Natal', type: 'nacional' },
    // Adicionando feriados para 2026 para evitar que retorne vazio se o usuário estiver em 2026
    { date: '2026-01-01', name: 'Confraternização Universal', type: 'nacional' },
    { date: '2026-02-17', name: 'Carnaval', type: 'nacional' },
    { date: '2026-04-03', name: 'Sexta-feira Santa', type: 'nacional' },
    { date: '2026-04-21', name: 'Tiradentes', type: 'nacional' },
    { date: '2026-05-01', name: 'Dia do Trabalho', type: 'nacional' },
    { date: '2026-06-24', name: 'São João', type: 'estadual' },
    { date: '2026-09-07', name: 'Independência do Brasil', type: 'nacional' },
    { date: '2026-09-16', name: 'Emancipação Política de Alagoas', type: 'estadual' },
    { date: '2026-10-12', name: 'Nossa Senhora Aparecida', type: 'nacional' },
    { date: '2026-11-02', name: 'Finados', type: 'nacional' },
    { date: '2026-11-15', name: 'Proclamação da República', type: 'nacional' },
    { date: '2026-11-20', name: 'Dia da Consciência Negra', type: 'estadual' },
    { date: '2026-12-25', name: 'Natal', type: 'nacional' },
];

// Cache simples para evitar múltiplas chamadas para o mesmo ano/estado/cidade
const holidayCache = {};

export async function getHolidays(year, state, city) {
    const cacheKey = `${year}-${state}-${city}`;
    
    if (holidayCache[cacheKey]) {
        return holidayCache[cacheKey];
    }

    console.log(`Buscando feriados para ${city}, ${state} no ano de ${year}...`);
    
    // Simula uma chamada de API e retorna feriados para Alagoas/Maceió
    const result = await new Promise(resolve => {
        setTimeout(() => {
            const filteredHolidays = MOCKED_HOLIDAYS.filter(h => {
                const isCorrectYear = dayjs(h.date).year() === year;
                const isRelevant = h.type === 'nacional' || h.type === 'estadual' || h.type === 'municipal';
                return isCorrectYear && isRelevant;
            });
            resolve(filteredHolidays);
        }, 500); // Reduzi o tempo de simulação
    });

    holidayCache[cacheKey] = result;
    return result;
}
